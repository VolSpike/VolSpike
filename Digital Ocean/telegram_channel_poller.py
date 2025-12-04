#!/usr/bin/env python3
"""
Telegram Channel Poller for VolSpike

This script monitors public Telegram channels using Pyrogram and sends
messages to the VolSpike backend for storage and display in the admin panel.

Requirements:
    pip install pyrogram tgcrypto requests

Environment Variables (in ~/.volspike.env):
    TELEGRAM_API_ID=your_api_id
    TELEGRAM_API_HASH=your_api_hash
    TELEGRAM_CHANNELS=marketfeed  # Comma-separated channel usernames (without @)
    VOLSPIKE_API_URL=https://volspike-production.up.railway.app
    VOLSPIKE_API_KEY=your_api_key

First-time setup:
    1. Run the script manually: python telegram_channel_poller.py
    2. Enter your phone number when prompted
    3. Enter the verification code from Telegram
    4. The session file will be saved for future use

Systemd service:
    sudo cp telegram-channel-poller.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable telegram-channel-poller
    sudo systemctl start telegram-channel-poller
"""

import os
import sys
import json
import time
import asyncio
import logging
import signal
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import requests
from pyrogram import Client
from pyrogram.types import Message
from pyrogram.errors import FloodWait, ChannelPrivate, UsernameNotOccupied

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
    ]
)
logger = logging.getLogger('TelegramPoller')

# Configuration
SCRIPT_DIR = Path(__file__).parent
STATE_FILE = SCRIPT_DIR / '.telegram_poller_state.json'
SESSION_NAME = 'volspike_telegram'
POLL_INTERVAL = 30  # seconds
MAX_MESSAGES_PER_FETCH = 100
BATCH_SIZE = 50  # Messages per API request

# Load environment variables
def load_env():
    """Load environment variables from /home/trader/.volspike.env"""
    # Use fixed path to trader's env file (works whether running as root or trader)
    env_file = Path('/home/trader/.volspike.env')
    if env_file.exists():
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ.setdefault(key.strip(), value.strip())

load_env()

# Configuration from environment
API_ID = os.environ.get('TELEGRAM_API_ID')
API_HASH = os.environ.get('TELEGRAM_API_HASH')
CHANNELS = [c.strip() for c in os.environ.get('TELEGRAM_CHANNELS', 'marketfeed,WatcherGuru').split(',') if c.strip()]
BACKEND_URL = os.environ.get('VOLSPIKE_API_URL', 'http://localhost:3001')
API_KEY = os.environ.get('VOLSPIKE_API_KEY', '')

# Channel category mapping
CHANNEL_CATEGORIES = {
    'marketfeed': 'macro',
    'watcherguru': 'crypto',
}

def get_channel_category(username: str) -> str:
    """Get the category for a channel based on its username"""
    return CHANNEL_CATEGORIES.get(username.lower(), 'general')

# Graceful shutdown
shutdown_event = asyncio.Event()

def signal_handler(signum, frame):
    """Handle shutdown signals"""
    logger.info(f"Received signal {signum}, initiating shutdown...")
    shutdown_event.set()

signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)


class TelegramPoller:
    def __init__(self):
        self.client: Optional[Client] = None
        self.state = self.load_state()

    def load_state(self) -> dict:
        """Load state from file"""
        if STATE_FILE.exists():
            try:
                with open(STATE_FILE) as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"Failed to load state: {e}")
        return {'last_message_ids': {}, 'last_fetch': None}

    def save_state(self):
        """Save state to file"""
        try:
            self.state['last_fetch'] = datetime.now(timezone.utc).isoformat()
            with open(STATE_FILE, 'w') as f:
                json.dump(self.state, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save state: {e}")

    async def start(self):
        """Start the Pyrogram client"""
        if not API_ID or not API_HASH:
            logger.error("TELEGRAM_API_ID and TELEGRAM_API_HASH must be set in ~/.volspike.env")
            sys.exit(1)

        self.client = Client(
            SESSION_NAME,
            api_id=int(API_ID),
            api_hash=API_HASH,
            workdir=str(SCRIPT_DIR),
        )

        logger.info("Starting Pyrogram client...")
        await self.client.start()
        me = await self.client.get_me()
        logger.info(f"Logged in as {me.first_name} (@{me.username or 'N/A'})")

    async def stop(self):
        """Stop the Pyrogram client"""
        if self.client:
            await self.client.stop()
            logger.info("Pyrogram client stopped")

    async def fetch_channel_messages(self, channel_username: str) -> list[dict]:
        """Fetch new messages from a channel"""
        messages = []

        try:
            # Get channel info
            chat = await self.client.get_chat(channel_username)
            channel_info = {
                'id': chat.id,
                'username': channel_username,
                'title': chat.title or channel_username,
                'category': get_channel_category(channel_username),
            }

            # Get last known message ID for this channel
            last_id = self.state['last_message_ids'].get(channel_username, 0)

            logger.info(f"Fetching messages from @{channel_username} (after ID: {last_id})")

            # Fetch messages
            new_last_id = last_id
            async for message in self.client.get_chat_history(
                chat.id,
                limit=MAX_MESSAGES_PER_FETCH,
            ):
                # Skip messages we've already seen
                if message.id <= last_id:
                    break

                # Update highest seen ID
                if message.id > new_last_id:
                    new_last_id = message.id

                # Extract message data
                msg_data = self.extract_message_data(message)
                if msg_data:
                    messages.append(msg_data)

            # Update state with new last message ID
            if new_last_id > last_id:
                self.state['last_message_ids'][channel_username] = new_last_id
                self.save_state()

            logger.info(f"Fetched {len(messages)} new messages from @{channel_username}")

            return channel_info, messages

        except ChannelPrivate:
            logger.error(f"Cannot access @{channel_username} - channel is private")
            return None, []
        except UsernameNotOccupied:
            logger.error(f"Channel @{channel_username} does not exist")
            return None, []
        except FloodWait as e:
            logger.warning(f"Flood wait: sleeping for {e.value} seconds")
            await asyncio.sleep(e.value)
            return None, []
        except Exception as e:
            logger.error(f"Error fetching from @{channel_username}: {e}")
            return None, []

    def extract_message_data(self, message: Message) -> Optional[dict]:
        """Extract relevant data from a Pyrogram message"""
        # Skip service messages, deleted messages, etc.
        if message.empty or message.service:
            return None

        # Determine media type
        media_type = None
        has_media = False
        if message.photo:
            media_type = 'photo'
            has_media = True
        elif message.video:
            media_type = 'video'
            has_media = True
        elif message.document:
            media_type = 'document'
            has_media = True
        elif message.audio:
            media_type = 'audio'
            has_media = True
        elif message.voice:
            media_type = 'voice'
            has_media = True
        elif message.sticker:
            media_type = 'sticker'
            has_media = True
        elif message.animation:
            media_type = 'animation'
            has_media = True

        # Get sender name
        sender_name = None
        if message.from_user:
            sender_name = message.from_user.first_name
            if message.from_user.last_name:
                sender_name += f" {message.from_user.last_name}"
        elif message.sender_chat:
            sender_name = message.sender_chat.title

        return {
            'id': message.id,
            'text': message.text or message.caption,
            'date': message.date.replace(tzinfo=timezone.utc).isoformat(),
            'sender_name': sender_name,
            'views': message.views,
            'forwards': message.forwards,
            'has_media': has_media,
            'media_type': media_type,
        }

    def send_to_backend(self, channel_info: dict, messages: list[dict]) -> bool:
        """Send messages to VolSpike backend"""
        if not messages:
            return True

        url = f"{BACKEND_URL}/api/telegram/ingest"
        headers = {
            'Content-Type': 'application/json',
            'X-API-Key': API_KEY,
        }

        # Send in batches
        for i in range(0, len(messages), BATCH_SIZE):
            batch = messages[i:i + BATCH_SIZE]
            payload = {
                'channel': channel_info,
                'messages': batch,
            }

            try:
                response = requests.post(url, json=payload, headers=headers, timeout=30)
                if response.status_code == 200:
                    data = response.json()
                    logger.info(
                        f"Sent {len(batch)} messages to backend: "
                        f"inserted={data.get('inserted', 0)}, "
                        f"duplicates={data.get('duplicates', 0)}"
                    )
                elif response.status_code == 401:
                    logger.error("Backend authentication failed - check VOLSPIKE_API_KEY")
                    return False
                else:
                    logger.error(f"Backend error: {response.status_code} - {response.text}")
                    return False
            except requests.exceptions.Timeout:
                logger.error("Backend request timed out")
                return False
            except requests.exceptions.ConnectionError as e:
                logger.error(f"Cannot connect to backend: {e}")
                return False
            except Exception as e:
                logger.error(f"Failed to send to backend: {e}")
                return False

        return True

    async def poll_once(self):
        """Poll all channels once"""
        for channel in CHANNELS:
            channel_info, messages = await self.fetch_channel_messages(channel)
            if channel_info and messages:
                self.send_to_backend(channel_info, messages)

    async def run(self):
        """Main polling loop"""
        await self.start()

        logger.info(f"Starting polling loop (interval: {POLL_INTERVAL}s)")
        logger.info(f"Monitoring channels: {', '.join(['@' + c for c in CHANNELS])}")

        try:
            while not shutdown_event.is_set():
                try:
                    await self.poll_once()
                except Exception as e:
                    logger.error(f"Error in poll cycle: {e}")

                # Wait for next poll or shutdown
                try:
                    await asyncio.wait_for(
                        shutdown_event.wait(),
                        timeout=POLL_INTERVAL
                    )
                except asyncio.TimeoutError:
                    pass  # Normal timeout, continue polling
        finally:
            await self.stop()
            logger.info("Poller shutdown complete")


async def main():
    """Main entry point"""
    # Validate configuration
    if not API_ID or not API_HASH:
        logger.error("Missing Telegram credentials!")
        logger.error("Please set TELEGRAM_API_ID and TELEGRAM_API_HASH in ~/.volspike.env")
        logger.error("")
        logger.error("Get your credentials at: https://my.telegram.org")
        sys.exit(1)

    if not API_KEY:
        logger.warning("VOLSPIKE_API_KEY not set - backend requests will fail")

    logger.info("=" * 60)
    logger.info("VolSpike Telegram Channel Poller")
    logger.info("=" * 60)
    logger.info(f"Backend URL: {BACKEND_URL}")
    logger.info(f"Channels: {', '.join(['@' + c for c in CHANNELS])}")
    logger.info(f"Poll interval: {POLL_INTERVAL}s")
    logger.info("=" * 60)

    poller = TelegramPoller()
    await poller.run()


if __name__ == '__main__':
    asyncio.run(main())
