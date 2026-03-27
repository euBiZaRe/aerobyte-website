import asyncio
import io
import json
import logging
import os
import random
import re
import string
import time
from pathlib import Path
from typing import Any

import discord
import google.auth.transport.requests
import requests
from discord import app_commands
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
STATE_FILE = BASE_DIR / "bot_state.json"
FIREBASE_SERVICE_ACCOUNT_PATH = BASE_DIR / "serviceAccountKey.json"
FIRESTORE_SCOPE = ["https://www.googleapis.com/auth/datastore"]
FIRESTORE_TIMEOUT = (10, 30)
DEFAULT_POLL_INTERVAL = 60
EXPIRY_CHECK_INTERVAL = 60
TRIAL_DURATION_MS = 60 * 60 * 1000
TRIAL_COOLDOWN_MS = 6 * 60 * 60 * 1000

ROLE_MAP = {
    "Owner": 1486502858760261732,
    "Media": 1486501952077434890,
    "Premium": 1486501864013955153,
    "Trial": 1486502028866752562,
    "Free": 1486502072294707250,
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
ADMIN_ROLE_ID = env_int("ADMIN_ROLE_ID")
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
    def find_user_by_discord_id(self, discord_id: int) -> tuple[str | None, dict[str, Any] | None]:
        payload = {
            "structuredQuery": {
                "from": [{"collectionId": "users"}],
                "where": {
                    "fieldFilter": {
                        "field": {"fieldPath": "discordId"},
                        "op": "EQUAL",
                        "value": {"stringValue": str(discord_id)},
                    }
                },
                "limit": 1,
            }
        }
        results = self._request("POST", f"{self.base_url}:runQuery", json_body=payload)
        if results and isinstance(results, list) and "document" in results[0]:
            document = results[0]["document"]
            uid = document["name"].split("/")[-1]
            return uid, document.get("fields", {})
        return None, None

    def find_user_by_license_key(self, license_key: str) -> tuple[str | None, dict[str, Any] | None]:
        payload = {
            "structuredQuery": {
                "from": [{"collectionId": "users"}],
                "where": {
                    "fieldFilter": {
                        "field": {"fieldPath": "licenseKey"},
                        "op": "EQUAL",
                        "value": {"stringValue": str(license_key)},
                    }
                },
                "limit": 1,
            }
        }
        results = self._request("POST", f"{self.base_url}:runQuery", json_body=payload)
        if results and isinstance(results, list) and "document" in results[0]:
            document = results[0]["document"]
            uid = document["name"].split("/")[-1]
            return uid, document.get("fields", {})
        return None, None

    def patch_user_fields(self, uid: str, patch_fields: dict[str, Any]) -> None:
        params = [("updateMask.fieldPaths", field_name) for field_name in patch_fields.keys()]
        self._request(
            "PATCH",
            f"{self.base_url}/users/{uid}",
            params=params,
            json_body={"fields": patch_fields},
        )

    def create_license(self, key: str, uid: str, now_ms: int) -> None:
        self._request(
            "PATCH",
            f"{self.base_url}/licenses/{key}",
            json_body={
                "fields": {
                    "userId": {"stringValue": uid},
                    "plan": {"stringValue": "Trial"},
                    "status": {"stringValue": "active"},
                    "createdAt": {"integerValue": str(now_ms)},
                }
            },
        )


class StateStore:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.lock = asyncio.Lock()
        self.data = self._load()

    def _default_state(self) -> dict[str, Any]:
        return {
            "ticket_panel_channel_id": None,
            "ticket_panel_message_id": None,
            "ticket_category_id": None,
            "ticket_log_channel_id": None,
            "support_role_id": None,
            "last_ticket_number": 0,
            "tickets": {},
        }

    def _load(self) -> dict[str, Any]:
        if not self.path.exists():
            return self._default_state()
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            logger.warning("State file was unreadable. Rebuilding default state.")
            return self._default_state()

        state = self._default_state()
        state.update(raw)
        state["tickets"] = raw.get("tickets", {})
        return state

    async def save(self) -> None:
        async with self.lock:
            payload = json.dumps(self.data, indent=2, sort_keys=True)
            await asyncio.to_thread(self.path.write_text, payload, encoding="utf-8")

    async def configure_tickets(
        self,
        *,
        panel_channel_id: int,
        panel_message_id: int,
        category_id: int | None,
        log_channel_id: int | None,
        support_role_id: int | None,
    ) -> None:
        self.data["ticket_panel_channel_id"] = panel_channel_id
        self.data["ticket_panel_message_id"] = panel_message_id
        self.data["ticket_category_id"] = category_id
        self.data["ticket_log_channel_id"] = log_channel_id
        self.data["support_role_id"] = support_role_id
        await self.save()

    def get_open_ticket_for_owner(self, owner_id: int) -> tuple[str | None, dict[str, Any] | None]:
        for channel_id, ticket in self.data["tickets"].items():
            if ticket.get("owner_id") == owner_id and ticket.get("status") == "open":
                return channel_id, ticket
        return None, None

    def get_ticket_by_channel(self, channel_id: int) -> dict[str, Any] | None:
        return self.data["tickets"].get(str(channel_id))

    def open_tickets(self) -> list[tuple[int, dict[str, Any]]]:
        tickets: list[tuple[int, dict[str, Any]]] = []
        for channel_id, ticket in self.data["tickets"].items():
            if ticket.get("status") == "open":
                tickets.append((int(channel_id), ticket))
        return tickets

    async def register_ticket(self, channel_id: int, owner_id: int, subject: str) -> int:
        self.data["last_ticket_number"] += 1
        ticket_number = self.data["last_ticket_number"]
        self.data["tickets"][str(channel_id)] = {
            "owner_id": owner_id,
            "subject": subject,
            "status": "open",
            "created_at": int(time.time()),
            "ticket_number": ticket_number,
            "claimed_by": None,
            "auto_close_at": None,
        }
        await self.save()
        return ticket_number

    async def claim_ticket(self, channel_id: int, user_id: int) -> dict[str, Any] | None:
        ticket = self.data["tickets"].get(str(channel_id))
        if not ticket:
            return None
        ticket["claimed_by"] = user_id
        ticket["claimed_at"] = int(time.time())
        await self.save()
        return ticket

    async def set_ticket_autoclose(self, channel_id: int, close_at: int | None) -> dict[str, Any] | None:
        ticket = self.data["tickets"].get(str(channel_id))
        if not ticket:
            return None
        ticket["auto_close_at"] = close_at
        ticket["auto_close_updated_at"] = int(time.time())
        await self.save()
        return ticket

    async def close_ticket(self, channel_id: int, closed_by: int, reason: str | None) -> dict[str, Any] | None:
        ticket = self.data["tickets"].get(str(channel_id))
        if not ticket:
            return None
        ticket["status"] = "closed"
        ticket["closed_at"] = int(time.time())
        ticket["closed_by"] = closed_by
        ticket["close_reason"] = reason or "No reason provided."
        ticket["auto_close_at"] = None
        await self.save()
        return ticket


firebase_info = load_firebase_info()
firestore = FirestoreClient(firebase_info)
state_store = StateStore(STATE_FILE)
user_states: dict[str, dict[str, str | None]] = {}
sync_task: asyncio.Task | None = None
expiry_task: asyncio.Task | None = None
ticket_autoclose_tasks: dict[int, asyncio.Task] = {}
firestore_backoff_until = 0.0
commands_synced = False

intents = discord.Intents.default()
intents.members = True
intents.guilds = True
intents.messages = True
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


def build_trial_key() -> str:
    chars = string.ascii_uppercase + string.digits
    return "-".join("".join(random.choices(chars, k=4)) for _ in range(4))


def support_role_id() -> int | None:
    return state_store.data.get("support_role_id") or ADMIN_ROLE_ID


def is_support_member(member: discord.Member) -> bool:
    if member.guild_permissions.manage_channels or member.guild_permissions.administrator:
        return True
    configured_role_id = support_role_id()
    return bool(configured_role_id and any(role.id == configured_role_id for role in member.roles))


def can_manage_ticket(member: discord.Member, ticket: dict[str, Any]) -> bool:
    return ticket.get("owner_id") == member.id or is_support_member(member)


def sanitize_channel_name(text: str) -> str:
    clean = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return clean[:30] or "support"


async def run_firestore(callable_obj, *args, **kwargs):
    return await asyncio.to_thread(callable_obj, *args, **kwargs)


async def send_ephemeral(interaction: discord.Interaction, message: str) -> None:
    if interaction.response.is_done():
        await interaction.followup.send(message, ephemeral=True)
    else:
        await interaction.response.send_message(message, ephemeral=True)


async def send_ticket_log(guild: discord.Guild, embed: discord.Embed, file: discord.File | None = None) -> None:
    log_channel_id = state_store.data.get("ticket_log_channel_id")
    if not log_channel_id:
        return
    log_channel = guild.get_channel(log_channel_id)
    if isinstance(log_channel, discord.TextChannel):
        await log_channel.send(embed=embed, file=file)


def cancel_ticket_autoclose(channel_id: int) -> None:
    task = ticket_autoclose_tasks.pop(channel_id, None)
    if task and not task.done():
        task.cancel()


async def export_ticket_transcript(channel: discord.TextChannel) -> discord.File:
    transcript_lines: list[str] = []
    async for message in channel.history(limit=None, oldest_first=True):
        created = message.created_at.strftime("%Y-%m-%d %H:%M:%S")
        attachments = ", ".join(attachment.url for attachment in message.attachments) or "-"
        clean_content = message.clean_content.replace("\r", " ").replace("\n", " ").strip() or "[no text]"
        transcript_lines.append(f"[{created}] {message.author} | {clean_content} | attachments: {attachments}")
    payload = "\n".join(transcript_lines) if transcript_lines else "No messages captured."
    buffer = io.BytesIO(payload.encode("utf-8"))
    filename = f"{channel.name}-transcript.txt"
    return discord.File(buffer, filename=filename)


async def schedule_ticket_autoclose(channel: discord.TextChannel, close_at: int) -> None:
    cancel_ticket_autoclose(channel.id)

    async def _runner() -> None:
        delay = max(close_at - int(time.time()), 0)
        if delay:
            await asyncio.sleep(delay)
        ticket = state_store.get_ticket_by_channel(channel.id)
        if not ticket or ticket.get("status") != "open":
            return
        await close_ticket_channel(None, channel, reason="Auto-closed by timer.", closed_by_id=bot.user.id if bot.user else 0)

    ticket_autoclose_tasks[channel.id] = asyncio.create_task(_runner(), name=f"ticket-autoclose-{channel.id}")


def build_user_summary(uid: str, fields: dict[str, Any]) -> str:
    plan = field_string(fields, "plan", "Unknown")
    discord_id = field_string(fields, "discordId", "Not linked")
    license_key = field_string(fields, "licenseKey", "None")
    expires_at = field_int(fields, "expiresAt", 0)
    expiry_text = f"<t:{int(expires_at / 1000)}:R>" if expires_at else "Not set"
    return (
        f"User ID: `{uid}`\n"
        f"Plan: `{plan}`\n"
        f"Discord ID: `{discord_id}`\n"
        f"License: `{license_key}`\n"
        f"Trial expiry: {expiry_text}"
    )


async def sync_member_from_fields(discord_id: int, uid: str, fields: dict[str, Any]) -> str:
    plan = field_string(fields, "plan")
    linked_discord_id = field_string(fields, "discordId")
    if not plan or linked_discord_id != str(discord_id):
        return f"No matching linked plan record found for `{discord_id}`."
    await update_discord_role(discord_id, plan)
    user_states[uid] = {"plan": plan, "discordId": linked_discord_id}
    return f"Synced Discord member `{discord_id}` to `{plan}`."


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


async def find_user_by_discord_id(discord_id: int) -> tuple[str | None, dict[str, Any] | None]:
    try:
        return await run_firestore(firestore.find_user_by_discord_id, discord_id)
    except requests.RequestException as exc:
        logger.warning("User lookup failed for %s: %s", discord_id, exc)
        return None, None


async def find_user_by_license_key(license_key: str) -> tuple[str | None, dict[str, Any] | None]:
    try:
        return await run_firestore(firestore.find_user_by_license_key, license_key)
    except requests.RequestException as exc:
        logger.warning("License lookup failed for %s: %s", license_key, exc)
        return None, None


async def update_user_trial(uid: str, expires_at: int, now_ms: int, license_key: str) -> None:
    patch_fields = {
        "plan": {"stringValue": "Trial"},
        "expiresAt": {"integerValue": str(expires_at)},
        "lastTrialAt": {"integerValue": str(now_ms)},
        "licenseKey": {"stringValue": license_key},
    }
    await run_firestore(firestore.patch_user_fields, uid, patch_fields)


class TicketCreateModal(discord.ui.Modal, title="Create Support Ticket"):
    subject = discord.ui.TextInput(label="What do you need help with?", max_length=100)
    details = discord.ui.TextInput(
        label="Give us the details",
        style=discord.TextStyle.paragraph,
        required=False,
        max_length=1000,
    )

    def __init__(self, support_bot: commands.Bot) -> None:
        super().__init__(timeout=300)
        self.support_bot = support_bot

    async def on_submit(self, interaction: discord.Interaction) -> None:
        try:
            await interaction.response.defer(ephemeral=True, thinking=True)
            await create_support_ticket(interaction, str(self.subject), str(self.details))
        except Exception:
            logger.exception("Ticket modal submit failed.")
            await send_ephemeral(interaction, "Ticket creation failed. Please try again or contact staff.")


class TicketPanelView(discord.ui.View):
    def __init__(self, support_bot: commands.Bot) -> None:
        super().__init__(timeout=None)
        self.support_bot = support_bot

    @discord.ui.button(label="Open Support Ticket", style=discord.ButtonStyle.green, custom_id="tickets:create")
    async def open_ticket(self, interaction: discord.Interaction, _: discord.ui.Button) -> None:
        await interaction.response.send_modal(TicketCreateModal(self.support_bot))


class TicketChannelView(discord.ui.View):
    def __init__(self) -> None:
        super().__init__(timeout=None)

    @discord.ui.button(label="Claim Ticket", style=discord.ButtonStyle.blurple, custom_id="tickets:claim")
    async def claim_ticket_button(self, interaction: discord.Interaction, _: discord.ui.Button) -> None:
        if not isinstance(interaction.user, discord.Member) or not is_support_member(interaction.user):
            await interaction.response.send_message("You need support/admin permissions to claim tickets.", ephemeral=True)
            return
        if not isinstance(interaction.channel, discord.TextChannel):
            await interaction.response.send_message("This button only works in ticket channels.", ephemeral=True)
            return
        ticket = await state_store.claim_ticket(interaction.channel.id, interaction.user.id)
        if not ticket:
            await interaction.response.send_message("This channel is not tracked as a ticket.", ephemeral=True)
            return
        await interaction.response.send_message(f"Ticket claimed by {interaction.user.mention}.")

    @discord.ui.button(label="Close Ticket", style=discord.ButtonStyle.red, custom_id="tickets:close")
    async def close_ticket_button(self, interaction: discord.Interaction, _: discord.ui.Button) -> None:
        await close_ticket_channel(interaction, reason="Closed from the ticket panel button.")


async def create_support_ticket(interaction: discord.Interaction, subject: str, details: str) -> None:
    if not interaction.guild or not isinstance(interaction.user, discord.Member):
        await send_ephemeral(interaction, "Tickets can only be created inside a server.")
        return

    existing_channel_id, existing_ticket = state_store.get_open_ticket_for_owner(interaction.user.id)
    if existing_channel_id and existing_ticket:
        existing_channel = interaction.guild.get_channel(int(existing_channel_id))
        if existing_channel:
            await send_ephemeral(interaction, f"You already have an open ticket: {existing_channel.mention}")
            return

    category_id = state_store.data.get("ticket_category_id")
    category = interaction.guild.get_channel(category_id) if category_id else None
    support_role = interaction.guild.get_role(support_role_id()) if support_role_id() else None
    bot_member = interaction.guild.me or interaction.guild.get_member(bot.user.id)

    overwrites = {
        interaction.guild.default_role: discord.PermissionOverwrite(view_channel=False),
        interaction.user: discord.PermissionOverwrite(
            view_channel=True,
            send_messages=True,
            read_message_history=True,
            attach_files=True,
            embed_links=True,
        ),
    }
    if bot_member:
        overwrites[bot_member] = discord.PermissionOverwrite(
            view_channel=True,
            send_messages=True,
            read_message_history=True,
            manage_channels=True,
            manage_messages=True,
        )
    if support_role:
        overwrites[support_role] = discord.PermissionOverwrite(
            view_channel=True,
            send_messages=True,
            read_message_history=True,
            manage_channels=True,
        )

    ticket_stub = sanitize_channel_name(f"ticket-{interaction.user.display_name}-{subject}")
    ticket_channel = await interaction.guild.create_text_channel(
        name=ticket_stub[:90],
        category=category if isinstance(category, discord.CategoryChannel) else None,
        overwrites=overwrites,
        reason=f"Support ticket for {interaction.user}",
    )

    ticket_number = await state_store.register_ticket(ticket_channel.id, interaction.user.id, subject)
    embed = discord.Embed(title=f"Support Ticket #{ticket_number}", color=discord.Color.blurple())
    embed.add_field(name="Opened by", value=interaction.user.mention, inline=False)
    embed.add_field(name="Subject", value=subject, inline=False)
    embed.add_field(name="Details", value=details or "No extra details provided.", inline=False)
    embed.add_field(name="Ticket Controls", value="Claim with the button below or run /ticket-autoclose to set a timer.", inline=False)
    embed.set_footer(text="Support staff can use /ticket-add, /ticket-remove, /ticket-note, and /ticket-close here.")

    content = support_role.mention if support_role else interaction.user.mention
    await ticket_channel.send(content=content, embed=embed, view=TicketChannelView())

    log_embed = discord.Embed(title="Ticket Opened", color=discord.Color.green())
    log_embed.add_field(name="Ticket", value=ticket_channel.mention, inline=False)
    log_embed.add_field(name="Opened by", value=interaction.user.mention, inline=False)
    log_embed.add_field(name="Subject", value=subject, inline=False)
    await send_ticket_log(interaction.guild, log_embed)

    await send_ephemeral(interaction, f"Your ticket is ready: {ticket_channel.mention}")


async def close_ticket_channel(
    interaction: discord.Interaction | None,
    channel: discord.TextChannel | None = None,
    *,
    reason: str | None = None,
    closed_by_id: int | None = None,
) -> None:
    target_channel = channel or interaction.channel
    guild = target_channel.guild if isinstance(target_channel, discord.TextChannel) else interaction.guild if interaction else None
    actor = interaction.user if interaction else None

    if not guild or not isinstance(target_channel, discord.TextChannel):
        if interaction:
            await interaction.response.send_message("This command only works inside a ticket channel.", ephemeral=True)
        return
    if interaction and not isinstance(interaction.user, discord.Member):
        await interaction.response.send_message("Could not validate your member permissions.", ephemeral=True)
        return

    ticket = state_store.get_ticket_by_channel(target_channel.id)
    if not ticket:
        if interaction:
            await interaction.response.send_message("This channel is not tracked as a support ticket.", ephemeral=True)
        return
    if interaction and not can_manage_ticket(interaction.user, ticket):
        await interaction.response.send_message("You do not have permission to close this ticket.", ephemeral=True)
        return

    cancel_ticket_autoclose(target_channel.id)
    closer_id = closed_by_id or (actor.id if actor else 0)
    await state_store.close_ticket(target_channel.id, closer_id, reason)

    transcript = await export_ticket_transcript(target_channel)
    log_embed = discord.Embed(title="Ticket Closed", color=discord.Color.red())
    log_embed.add_field(name="Channel", value=target_channel.name, inline=False)
    log_embed.add_field(name="Closed by", value=f"<@{closer_id}>" if closer_id else "System", inline=False)
    log_embed.add_field(name="Reason", value=reason or "No reason provided.", inline=False)
    await send_ticket_log(guild, log_embed, file=transcript)

    if interaction:
        await interaction.response.send_message("Closing ticket in 3 seconds.")
    else:
        await target_channel.send("This ticket is being closed.")
    await asyncio.sleep(3)
    await target_channel.delete(reason=f"Ticket closed by {closer_id}")


@bot.tree.command(name="trial", description="Claim a 1-hour trial every 6 hours.")
async def trial(interaction: discord.Interaction) -> None:
    await interaction.response.defer(ephemeral=True)
    uid, fields = await find_user_by_discord_id(interaction.user.id)
    if not uid or not fields:
        await interaction.followup.send(
            "Your Discord is not linked to an AeroByte account. Link it at https://aerobyte.shop/profile.html first.",
            ephemeral=True,
        )
        return

    now_ms = int(time.time() * 1000)
    last_trial = field_int(fields, "lastTrialAt", 0)
    if now_ms - last_trial < TRIAL_COOLDOWN_MS:
        remaining = (TRIAL_COOLDOWN_MS - (now_ms - last_trial)) // 1000
        hours = remaining // 3600
        minutes = (remaining % 3600) // 60
        await interaction.followup.send(
            f"Cooldown active. You can claim another trial in {hours}h {minutes}m.",
            ephemeral=True,
        )
        return

    current_key = field_string(fields, "licenseKey")
    license_key = current_key or build_trial_key()
    if not current_key:
        await run_firestore(firestore.create_license, license_key, uid, now_ms)

    expires_at = now_ms + TRIAL_DURATION_MS
    await update_user_trial(uid, expires_at, now_ms, license_key)
    await update_discord_role(interaction.user.id, "Trial")
    await interaction.followup.send(
        (
            "Trial activated.\n"
            f"License: `{license_key}`\n"
            f"Expires: <t:{int(expires_at / 1000)}:R>"
        ),
        ephemeral=True,
    )


@bot.tree.command(name="global-reset", description="Reset trial cooldowns for all linked users.")
async def global_reset(interaction: discord.Interaction) -> None:
    if not isinstance(interaction.user, discord.Member) or not is_support_member(interaction.user):
        await interaction.response.send_message("You need support/admin permissions to run this command.", ephemeral=True)
        return

    await interaction.response.defer(ephemeral=True)
    try:
        users = await poll_users()
        now_ms = int(time.time() * 1000)
        trial_count = 0
        for doc in users:
            uid = doc["name"].split("/")[-1]
            fields = doc.get("fields", {})
            patch_fields: dict[str, Any] = {"lastTrialAt": {"integerValue": "0"}}
            if field_string(fields, "plan", "") == "Trial":
                patch_fields["expiresAt"] = {"integerValue": str(now_ms + TRIAL_DURATION_MS)}
                trial_count += 1
            await run_firestore(firestore.patch_user_fields, uid, patch_fields)

        await interaction.followup.send(
            f"Reset cooldowns for {len(users)} user(s). Refreshed {trial_count} active trial(s).",
            ephemeral=True,
        )
    except Exception as exc:
        logger.exception("Global reset failed.")
        await interaction.followup.send(f"Global reset failed: {exc}", ephemeral=True)


@bot.tree.command(name="ticket-panel", description="Post or refresh the support ticket panel.")
@app_commands.describe(
    channel="Where the ticket panel should live.",
    category="Optional category for newly created ticket channels.",
    support_role="Optional role that can see and manage tickets.",
    log_channel="Optional log channel for ticket events.",
)
async def ticket_panel(
    interaction: discord.Interaction,
    channel: discord.TextChannel,
    category: discord.CategoryChannel | None = None,
    support_role: discord.Role | None = None,
    log_channel: discord.TextChannel | None = None,
) -> None:
    if not isinstance(interaction.user, discord.Member) or not is_support_member(interaction.user):
        await interaction.response.send_message("You need support/admin permissions to configure tickets.", ephemeral=True)
        return

    embed = discord.Embed(title="AeroByte Support", color=discord.Color.blurple())
    embed.description = (
        "Need help with your account, access, or tools?\n"
        "Press the button below and the bot will open a private support ticket for you."
    )
    embed.add_field(name="What happens next", value="A private channel is created for you and the support team.", inline=False)

    message = await channel.send(embed=embed, view=TicketPanelView(bot))
    await state_store.configure_tickets(
        panel_channel_id=channel.id,
        panel_message_id=message.id,
        category_id=category.id if category else None,
        log_channel_id=log_channel.id if log_channel else None,
        support_role_id=support_role.id if support_role else None,
    )
    await interaction.response.send_message(f"Ticket panel posted in {channel.mention}.", ephemeral=True)


@bot.tree.command(name="ticket-close", description="Close the current support ticket.")
@app_commands.describe(reason="Optional reason for closing the ticket.")
async def ticket_close(interaction: discord.Interaction, reason: str | None = None) -> None:
    await close_ticket_channel(interaction, reason=reason)


@bot.tree.command(name="ticket-claim", description="Claim the current support ticket.")
async def ticket_claim(interaction: discord.Interaction) -> None:
    if not isinstance(interaction.user, discord.Member) or not is_support_member(interaction.user):
        await interaction.response.send_message("You need support/admin permissions to claim tickets.", ephemeral=True)
        return
    if not isinstance(interaction.channel, discord.TextChannel):
        await interaction.response.send_message("This command only works inside a ticket channel.", ephemeral=True)
        return
    ticket = await state_store.claim_ticket(interaction.channel.id, interaction.user.id)
    if not ticket:
        await interaction.response.send_message("This channel is not tracked as a ticket.", ephemeral=True)
        return
    await interaction.response.send_message(f"Ticket claimed by {interaction.user.mention}.")


@bot.tree.command(name="ticket-autoclose", description="Set or clear an auto-close timer for this ticket.")
@app_commands.describe(minutes="Minutes until the ticket closes. Use 0 to disable the timer.")
async def ticket_autoclose(interaction: discord.Interaction, minutes: app_commands.Range[int, 0, 10080]) -> None:
    if not isinstance(interaction.user, discord.Member) or not is_support_member(interaction.user):
        await interaction.response.send_message("You need support/admin permissions to manage auto-close timers.", ephemeral=True)
        return
    if not isinstance(interaction.channel, discord.TextChannel):
        await interaction.response.send_message("This command only works inside a ticket channel.", ephemeral=True)
        return
    ticket = state_store.get_ticket_by_channel(interaction.channel.id)
    if not ticket:
        await interaction.response.send_message("This channel is not tracked as a ticket.", ephemeral=True)
        return

    if minutes == 0:
        cancel_ticket_autoclose(interaction.channel.id)
        await state_store.set_ticket_autoclose(interaction.channel.id, None)
        await interaction.response.send_message("Auto-close disabled for this ticket.")
        return

    close_at = int(time.time()) + (minutes * 60)
    await state_store.set_ticket_autoclose(interaction.channel.id, close_at)
    await schedule_ticket_autoclose(interaction.channel, close_at)
    await interaction.response.send_message(f"This ticket will auto-close <t:{close_at}:R>.")


@bot.tree.command(name="ticket-note", description="Send a staff-only ticket note to the ticket log channel.")
@app_commands.describe(note="Internal note for staff.")
async def ticket_note(interaction: discord.Interaction, note: str) -> None:
    if not isinstance(interaction.user, discord.Member) or not is_support_member(interaction.user):
        await interaction.response.send_message("You need support/admin permissions to add internal notes.", ephemeral=True)
        return
    if not isinstance(interaction.channel, discord.TextChannel):
        await interaction.response.send_message("This command only works inside a ticket channel.", ephemeral=True)
        return
    ticket = state_store.get_ticket_by_channel(interaction.channel.id)
    if not ticket:
        await interaction.response.send_message("This channel is not tracked as a ticket.", ephemeral=True)
        return
    if not state_store.data.get("ticket_log_channel_id"):
        await interaction.response.send_message("No ticket log channel is configured yet.", ephemeral=True)
        return

    embed = discord.Embed(title="Staff Ticket Note", color=discord.Color.orange())
    embed.add_field(name="Ticket", value=interaction.channel.name, inline=False)
    embed.add_field(name="Staff Member", value=interaction.user.mention, inline=False)
    embed.add_field(name="Note", value=note, inline=False)
    await send_ticket_log(interaction.guild, embed)
    await interaction.response.send_message("Internal ticket note sent to the log channel.", ephemeral=True)


@bot.tree.command(name="ticket-add", description="Add a member to the current support ticket.")
@app_commands.describe(member="Member to add to this ticket channel.")
async def ticket_add(interaction: discord.Interaction, member: discord.Member) -> None:
    if not isinstance(interaction.user, discord.Member) or not is_support_member(interaction.user):
        await interaction.response.send_message("You need support/admin permissions to add users.", ephemeral=True)
        return
    if not isinstance(interaction.channel, discord.TextChannel):
        await interaction.response.send_message("This command only works inside a ticket channel.", ephemeral=True)
        return
    if not state_store.get_ticket_by_channel(interaction.channel.id):
        await interaction.response.send_message("This channel is not tracked as a ticket.", ephemeral=True)
        return

    await interaction.channel.set_permissions(
        member,
        view_channel=True,
        send_messages=True,
        read_message_history=True,
        attach_files=True,
        embed_links=True,
        reason=f"Added to ticket by {interaction.user}",
    )
    await interaction.response.send_message(f"Added {member.mention} to this ticket.")


@bot.tree.command(name="ticket-remove", description="Remove a member from the current support ticket.")
@app_commands.describe(member="Member to remove from this ticket channel.")
async def ticket_remove(interaction: discord.Interaction, member: discord.Member) -> None:
    if not isinstance(interaction.user, discord.Member) or not is_support_member(interaction.user):
        await interaction.response.send_message("You need support/admin permissions to remove users.", ephemeral=True)
        return
    if not isinstance(interaction.channel, discord.TextChannel):
        await interaction.response.send_message("This command only works inside a ticket channel.", ephemeral=True)
        return
    if not state_store.get_ticket_by_channel(interaction.channel.id):
        await interaction.response.send_message("This channel is not tracked as a ticket.", ephemeral=True)
        return

    await interaction.channel.set_permissions(member, overwrite=None, reason=f"Removed from ticket by {interaction.user}")
    await interaction.response.send_message(f"Removed {member.mention} from this ticket.")


@bot.tree.command(name="ticket-stats", description="Show current support ticket stats.")
async def ticket_stats(interaction: discord.Interaction) -> None:
    if not isinstance(interaction.user, discord.Member) or not is_support_member(interaction.user):
        await interaction.response.send_message("You need support/admin permissions to view ticket stats.", ephemeral=True)
        return
    open_tickets = state_store.open_tickets()
    claimed = sum(1 for _, ticket in open_tickets if ticket.get("claimed_by"))
    await interaction.response.send_message(
        f"Open tickets: {len(open_tickets)} | Claimed: {claimed} | Unclaimed: {len(open_tickets) - claimed}",
        ephemeral=True,
    )


@bot.tree.command(name="license-check", description="Look up a linked user's plan and license.")
@app_commands.describe(member="Discord member to inspect.")
async def license_check(interaction: discord.Interaction, member: discord.Member) -> None:
    if not isinstance(interaction.user, discord.Member) or not is_support_member(interaction.user):
        await interaction.response.send_message("You need support/admin permissions to inspect licenses.", ephemeral=True)
        return
    await interaction.response.defer(ephemeral=True)
    uid, fields = await find_user_by_discord_id(member.id)
    if not uid or not fields:
        await interaction.followup.send("No linked AeroByte account was found for that member.", ephemeral=True)
        return
    await interaction.followup.send(build_user_summary(uid, fields), ephemeral=True)


@bot.tree.command(name="link-discord", description="Link a Discord member to an AeroByte account by license key.")
@app_commands.describe(member="Discord member to link.", license_key="License key to link to this Discord user.")
async def link_discord(interaction: discord.Interaction, member: discord.Member, license_key: str) -> None:
    if not isinstance(interaction.user, discord.Member) or not is_support_member(interaction.user):
        await interaction.response.send_message("You need support/admin permissions to link users.", ephemeral=True)
        return

    await interaction.response.defer(ephemeral=True)

    normalized_key = license_key.strip().upper()
    existing_uid, existing_fields = await find_user_by_discord_id(member.id)
    if existing_uid and existing_fields:
        await interaction.followup.send(
            f"{member.mention} is already linked.\n\n{build_user_summary(existing_uid, existing_fields)}",
            ephemeral=True,
        )
        return

    uid, fields = await find_user_by_license_key(normalized_key)
    if not uid or not fields:
        await interaction.followup.send("No AeroByte account was found with that license key.", ephemeral=True)
        return

    linked_discord = field_string(fields, "discordId")
    if linked_discord and linked_discord != str(member.id):
        await interaction.followup.send(
            f"That license key is already linked to Discord ID `{linked_discord}`.",
            ephemeral=True,
        )
        return

    patch_fields = {"discordId": {"stringValue": str(member.id)}}
    await run_firestore(firestore.patch_user_fields, uid, patch_fields)

    refreshed_uid, refreshed_fields = await find_user_by_license_key(normalized_key)
    result = await sync_member_from_fields(member.id, refreshed_uid or uid, refreshed_fields or fields)
    await interaction.followup.send(
        f"Linked {member.mention} to license `{normalized_key}`.\n{result}",
        ephemeral=True,
    )


@bot.tree.command(name="force-sync", description="Force a single member's Discord role sync from Firestore.")
@app_commands.describe(member="Discord member to sync.")
async def force_sync(interaction: discord.Interaction, member: discord.Member) -> None:
    if not isinstance(interaction.user, discord.Member) or not is_support_member(interaction.user):
        await interaction.response.send_message("You need support/admin permissions to force sync users.", ephemeral=True)
        return
    await interaction.response.defer(ephemeral=True)
    uid, fields = await find_user_by_discord_id(member.id)
    if not uid or not fields:
        await interaction.followup.send("No linked AeroByte account was found for that member.", ephemeral=True)
        return
    result = await sync_member_from_fields(member.id, uid, fields)
    await interaction.followup.send(result, ephemeral=True)


@bot.tree.command(name="sync-all", description="Force a full Firestore-to-Discord role sync now.")
async def sync_all(interaction: discord.Interaction) -> None:
    if not isinstance(interaction.user, discord.Member) or not is_support_member(interaction.user):
        await interaction.response.send_message("You need support/admin permissions to run a full sync.", ephemeral=True)
        return
    await interaction.response.defer(ephemeral=True)
    documents = await poll_users()
    synced = 0
    for doc in documents:
        fields = doc.get("fields", {})
        uid = doc["name"].split("/")[-1]
        plan = field_string(fields, "plan")
        discord_id = field_string(fields, "discordId")
        if not plan or not discord_id:
            continue
        await update_discord_role(discord_id, plan)
        user_states[uid] = {"plan": plan, "discordId": discord_id}
        synced += 1
    await interaction.followup.send(f"Full sync complete. Updated {synced} linked member(s).", ephemeral=True)


@bot.event
async def on_ready() -> None:
    global commands_synced, sync_task, expiry_task

    logger.info("Logged in as %s (%s)", bot.user, bot.user.id if bot.user else "unknown")
    for guild in bot.guilds:
        logger.info("Connected to server: %s (%s)", guild.name, guild.id)

    bot.add_view(TicketPanelView(bot))
    bot.add_view(TicketChannelView())

    if not commands_synced:
        try:
            guild_object = discord.Object(id=GUILD_ID)
            bot.tree.copy_global_to(guild=guild_object)
            await bot.tree.sync(guild=guild_object)
            await bot.tree.sync()
            commands_synced = True
            logger.info("Slash commands synced.")
        except Exception:
            logger.exception("Slash command sync failed.")

    if sync_task is None or sync_task.done():
        sync_task = asyncio.create_task(sync_loop(), name="firestore-sync-loop")
    if expiry_task is None or expiry_task.done():
        expiry_task = asyncio.create_task(expiry_loop(), name="trial-expiry-loop")

    for channel_id, ticket in state_store.open_tickets():
        auto_close_at = ticket.get("auto_close_at")
        if not auto_close_at:
            continue
        channel = bot.get_channel(channel_id)
        if isinstance(channel, discord.TextChannel):
            await schedule_ticket_autoclose(channel, int(auto_close_at))


if __name__ == "__main__":
    bot.run(DISCORD_BOT_TOKEN)
