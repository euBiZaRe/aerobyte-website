import requests
import json
import discord
from discord.ext import commands
import asyncio
from google.oauth2 import service_account
import google.auth.transport.requests
import os

# --- CONFIGURATION (Loaded from GitHub Secrets) ---
DISCORD_BOT_TOKEN = os.getenv('DISCORD_BOT_TOKEN')
GUILD_ID = int(os.getenv('GUILD_ID', 1485462438840107082))
FIREBASE_CONFIG = os.getenv('FIREBASE_CONFIG')

ROLE_MAP = {
    "Owner": 1486502858760261732,
    "Media": 1486501952077434890,
    "Premium": 1486501864013955153,
    "Trial": 1486502028866752562,
    "Free": 1486502072294707250,
}

if not FIREBASE_CONFIG or not DISCORD_BOT_TOKEN:
    print("CRITICAL ERROR: FIREBASE_CONFIG or DISCORD_BOT_TOKEN secrets missing!")
    exit(1)

# Load Service Account from Secret
info = json.loads(FIREBASE_CONFIG)
PROJECT_ID = info['project_id']
CREDENTIALS = service_account.Credentials.from_service_account_info(info, scopes=["https://www.googleapis.com/auth/datastore"])

# Discord Setup
intents = discord.Intents.default()
intents.members = True
bot = commands.Bot(command_prefix="!", intents=intents)

def get_access_token():
    auth_req = google.auth.transport.requests.Request()
    CREDENTIALS.refresh(auth_req)
    return CREDENTIALS.token

async def update_discord_role(discord_id, plan):
    try:
        guild = bot.get_guild(GUILD_ID)
        if not guild: return
        member = await guild.fetch_member(int(discord_id))
        if not member: return

        print(f"Checking {member.display_name} -> {plan}")
        target_role_id = ROLE_MAP.get(plan)
        target_role = guild.get_role(target_role_id) if target_role_id else None

        # Detect current roles to avoid spamming the API
        has_correct_role = target_role in member.roles if target_role else False
        
        # Remove old irrelevant roles
        roles_to_remove = [guild.get_role(rid) for rid in ROLE_MAP.values() if guild.get_role(rid) and guild.get_role(rid) != target_role]
        roles_found = [r for r in roles_to_remove if r in member.roles]
        
        if roles_found:
            await member.remove_roles(*roles_found)
            print(f"Removed old roles from {member.display_name}")

        if target_role and not has_correct_role:
            await member.add_roles(target_role)
            print(f"Added {plan} role to {member.display_name}")

    except Exception as e:
        print(f"Discord Error for {discord_id}: {e}")

async def sync_once():
    print("Performing one-time sync...")
    base_url = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/users"
    
    try:
        token = get_access_token()
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(base_url, headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            documents = data.get('documents', [])
            
            for doc in documents:
                fields = doc.get('fields', {})
                plan = fields.get('plan', {}).get('stringValue')
                discord_id = fields.get('discordId', {}).get('stringValue')

                if discord_id and plan:
                    await update_discord_role(discord_id, plan)
        else:
            print(f"Firestore API Error: {response.status_code}")
            
    except Exception as e:
        print(f"Sync Error: {e}")

@bot.event
async def on_ready():
    print(f'Sync Action logged in as {bot.user}')
    await sync_once()
    print("Sync complete. Closing...")
    await bot.close()

if __name__ == "__main__":
    bot.run(DISCORD_BOT_TOKEN)
