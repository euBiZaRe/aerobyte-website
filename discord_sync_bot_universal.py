import asyncio
import json
import logging
import os
import time
from pathlib import Path
from typing import Any

import aiohttp
from aiohttp import web
import discord
import google.auth.transport.requests
import requests
from discord.ext import commands
from google.oauth2 import service_account
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("aerobyte.discord.bot")

BASE_DIR = Path(__file__).resolve().parent
FIREBASE_SERVICE_ACCOUNT_PATH = BASE_DIR / "serviceAccountKey.json"
FIRESTORE_SCOPE = ["https://www.googleapis.com/auth/datastore"]
FIRESTORE_TIMEOUT = (10, 30)
DEFAULT_POLL_INTERVAL = 60
EXPIRY_CHECK_INTERVAL = 60

ROLE_MAP = {
    "Owner": 1488439110417776772,
    "Media": 1488672355453763811,
    "Premium": 1488439114469740665,
    "Trial": 1488672442456215606,
    "Free": 1488439115681632317,
}


def env_int(name: str, default: int | None = None) -> int | None:
    value = os.getenv(name)
    if value is None or value == "":
        return default
    try:
        return int(value)
    except ValueError as exc:
        raise RuntimeError(f"Environment variable {name} must be an integer.") from exc


def env_float(name: str, default: float) -> float:
    value = os.getenv(name)
    if value is None or value == "":
        return default
    try:
        return float(value)
    except ValueError as exc:
        raise RuntimeError(f"Environment variable {name} must be a number.") from exc


DISCORD_BOT_TOKEN = os.getenv("DISCORD_BOT_TOKEN")
GUILD_ID = env_int("GUILD_ID", 1485462438840107082)
POLL_INTERVAL = max(env_float("POLL_INTERVAL", DEFAULT_POLL_INTERVAL), 30.0)

if not DISCORD_BOT_TOKEN:
    raise RuntimeError("DISCORD_BOT_TOKEN is not set.")
if not GUILD_ID:
    raise RuntimeError("GUILD_ID is not set.")


def load_firebase_info() -> dict[str, Any]:
    if FIREBASE_SERVICE_ACCOUNT_PATH.exists():
        logger.info("Loading Firebase config from local file.")
        info = json.loads(FIREBASE_SERVICE_ACCOUNT_PATH.read_text(encoding="utf-8"))
    else:
        config_str = os.getenv("FIREBASE_CONFIG")
        if not config_str:
            raise RuntimeError(
                "No Firebase configuration found. Set FIREBASE_CONFIG or add serviceAccountKey.json."
            )
        logger.info("Loading Firebase config from environment variable.")
        info = json.loads(config_str)

    private_key = info.get("private_key")
    if private_key:
        info["private_key"] = private_key.replace("\\n", "\n").strip()
    return info


class FirestoreClient:
    def __init__(self, info: dict[str, Any]) -> None:
        self.project_id = info["project_id"]
        self.base_url = (
            f"https://firestore.googleapis.com/v1/projects/{self.project_id}/databases/(default)/documents"
        )
        self.credentials = service_account.Credentials.from_service_account_info(
            info,
            scopes=FIRESTORE_SCOPE,
        )
        self._auth_request = google.auth.transport.requests.Request()
        self._session = requests.Session()
        retries = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=frozenset(["GET", "POST", "PATCH"]),
        )
        adapter = HTTPAdapter(max_retries=retries)
        self._session.mount("https://", adapter)
        self._session.mount("http://", adapter)

    def _get_access_token(self) -> str:
        if not self.credentials.valid or not self.credentials.token:
            self.credentials.refresh(self._auth_request)
        elif self.credentials.expired:
            self.credentials.refresh(self._auth_request)
        return self.credentials.token

    def _request(
        self,
        method: str,
        url: str,
        *,
        params: Any = None,
        json_body: dict[str, Any] | None = None,
    ) -> dict[str, Any] | list[Any]:
        headers = {
            "Authorization": f"Bearer {self._get_access_token()}",
            "Content-Type": "application/json",
        }
        response = self._session.request(
            method,
            url,
            headers=headers,
            params=params,
            json=json_body,
            timeout=FIRESTORE_TIMEOUT,
        )
        response.raise_for_status()
        if not response.content:
            return {}
        return response.json()

    def list_users(self, page_size: int = 300) -> list[dict[str, Any]]:
        documents: list[dict[str, Any]] = []
        params: dict[str, Any] = {"pageSize": page_size}
        while True:
            payload = self._request("GET", f"{self.base_url}/users", params=params)
            documents.extend(payload.get("documents", []))
            next_page = payload.get("nextPageToken")
            if not next_page:
                break
            params["pageToken"] = next_page
        return documents

    def patch_user_fields(self, uid: str, patch_fields: dict[str, Any]) -> None:
        params = [("updateMask.fieldPaths", field_name) for field_name in patch_fields.keys()]
        self._request(
            "PATCH",
            f"{self.base_url}/users/{uid}",
            params=params,
            json_body={"fields": patch_fields},
        )


firebase_info = load_firebase_info()
firestore = FirestoreClient(firebase_info)
user_states: dict[str, dict[str, str | None]] = {}
sync_task: asyncio.Task | None = None
expiry_task: asyncio.Task | None = None
firestore_backoff_until = 0.0

intents = discord.Intents.default()
intents.members = True
intents.guilds = True
bot = commands.Bot(command_prefix="!", intents=intents)


def field_string(fields: dict[str, Any], key: str, default: str | None = None) -> str | None:
    return fields.get(key, {}).get("stringValue", default)


def field_int(fields: dict[str, Any], key: str, default: int = 0) -> int:
    raw = fields.get(key, {}).get("integerValue")
    if raw is None:
        return default
    try:
        return int(raw)
    except (TypeError, ValueError):
        return default


async def run_firestore(callable_obj, *args, **kwargs):
    return await asyncio.to_thread(callable_obj, *args, **kwargs)


async def update_discord_role(discord_id: str | int, plan: str) -> None:
    guild = bot.get_guild(GUILD_ID)
    if guild is None:
        logger.warning("Guild %s is not cached yet.", GUILD_ID)
        return

    try:
        member = await guild.fetch_member(int(discord_id))
    except (discord.NotFound, ValueError):
        logger.warning("Discord member %s was not found.", discord_id)
        return
    except discord.HTTPException as exc:
        logger.warning("Failed to fetch member %s: %s", discord_id, exc)
        return

    target_role_id = ROLE_MAP.get(plan)
    target_role = guild.get_role(target_role_id) if target_role_id else None
    managed_roles = [guild.get_role(role_id) for role_id in ROLE_MAP.values()]
    managed_roles = [role for role in managed_roles if role is not None]
    roles_to_remove = [role for role in managed_roles if role != target_role and role in member.roles]

    if roles_to_remove:
        await member.remove_roles(*roles_to_remove, reason=f"Plan sync -> {plan}")
    if target_role and target_role not in member.roles:
        await member.add_roles(target_role, reason=f"Plan sync -> {plan}")

    logger.info("Synced %s to plan %s", member.display_name, plan)


async def poll_users() -> list[dict[str, Any]]:
    global firestore_backoff_until

    now = time.time()
    if firestore_backoff_until > now:
        await asyncio.sleep(firestore_backoff_until - now)

    try:
        return await run_firestore(firestore.list_users)
    except requests.RequestException as exc:
        message = str(exc)
        if "429" in message:
            firestore_backoff_until = time.time() + 120
            logger.warning("Firestore rate-limited the bot. Backing off for 120 seconds.")
        else:
            firestore_backoff_until = time.time() + 15
            logger.warning("Firestore user poll failed: %s", exc)
        return []


async def sync_loop() -> None:
    logger.info("Sync loop started with %.1fs interval.", POLL_INTERVAL)
    while not bot.is_closed():
        try:
            documents = await poll_users()
            for doc in documents:
                fields = doc.get("fields", {})
                uid = doc["name"].split("/")[-1]
                plan = field_string(fields, "plan")
                discord_id = field_string(fields, "discordId")
                previous = user_states.get(uid)
                if previous and previous.get("plan") == plan and previous.get("discordId") == discord_id:
                    continue
                if discord_id and plan:
                    await update_discord_role(discord_id, plan)
                user_states[uid] = {"plan": plan, "discordId": discord_id}
        except Exception:
            logger.exception("Unexpected sync loop failure.")
        await asyncio.sleep(POLL_INTERVAL)


async def expiry_loop() -> None:
    logger.info("Expiry loop started with %ss interval.", EXPIRY_CHECK_INTERVAL)
    while not bot.is_closed():
        await asyncio.sleep(EXPIRY_CHECK_INTERVAL)
        try:
            documents = await poll_users()
            now_ms = int(time.time() * 1000)
            for doc in documents:
                fields = doc.get("fields", {})
                uid = doc["name"].split("/")[-1]
                plan = field_string(fields, "plan", "")
                expires_at = field_int(fields, "expiresAt", 0)
                discord_id = field_string(fields, "discordId")

                if plan != "Trial" or expires_at <= 0 or now_ms <= expires_at:
                    continue

                patch_fields = {
                    "plan": {"stringValue": "Free"},
                    "expiresAt": {"nullValue": None},
                }
                await run_firestore(firestore.patch_user_fields, uid, patch_fields)
                if discord_id:
                    await update_discord_role(discord_id, "Free")
                user_states[uid] = {"plan": "Free", "discordId": discord_id}
                logger.info("Downgraded expired trial user %s to Free.", uid)
        except Exception:
            logger.exception("Unexpected expiry loop failure.")


async def handle_ping(request):
    return web.Response(text="Bot is alive!")


async def start_web_server():
    app = web.Application()
    app.router.add_get("/", handle_ping)
    runner = web.AppRunner(app)
    await runner.setup()
    port = int(os.getenv("PORT", 8080))
    site = web.TCPSite(runner, "0.0.0.0", port)
    logger.info("Starting heartbeat web server on port %s", port)
    await site.start()


@bot.event
async def on_ready() -> None:
    global sync_task, expiry_task

    logger.info("Logged in as %s (%s)", bot.user, bot.user.id if bot.user else "unknown")
    for guild in bot.guilds:
        logger.info("Connected to server: %s (%s)", guild.name, guild.id)

    # Start heartbeat server
    asyncio.create_task(start_web_server())

    if sync_task is None or sync_task.done():
        sync_task = asyncio.create_task(sync_loop(), name="firestore-sync-loop")
    if expiry_task is None or expiry_task.done():
        expiry_task = asyncio.create_task(expiry_loop(), name="trial-expiry-loop")


if __name__ == "__main__":
    bot.run(DISCORD_BOT_TOKEN)
