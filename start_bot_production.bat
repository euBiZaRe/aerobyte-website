@echo off
TITLE AeroByte Discord Sync Bot [PRODUCTION]
COLOR 0B

:start
echo [%date% %time%] Starting AeroByte Discord Sync Bot...
python discord_sync_bot_universal.py

echo.
echo [%date% %time%] WARNING: Bot process terminated! Restarting in 5 seconds...
echo Press Ctrl+C to stop the loop.
timeout /t 5
goto start
