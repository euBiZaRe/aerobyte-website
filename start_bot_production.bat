@echo off
setlocal EnableExtensions EnableDelayedExpansion
TITLE AeroByte Discord Sync Bot [PRODUCTION]
COLOR 0B

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

set "VENV_DIR=%SCRIPT_DIR%.venv"
set "PYTHON_EXE=%VENV_DIR%\Scripts\python.exe"
set "LOG_DIR=%SCRIPT_DIR%logs"
set "LOG_FILE=%LOG_DIR%\discord-bot.log"

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

if exist "%SCRIPT_DIR%.env" (
    for /f "usebackq tokens=1,* delims==" %%A in ("%SCRIPT_DIR%.env") do (
        if not "%%A"=="" if /I not "%%A"=="REM" if /I not "%%A:~0,1%"=="#" set "%%A=%%B"
    )
)

if not exist "%PYTHON_EXE%" (
    echo [%date% %time%] Creating virtual environment...
    py -3 -m venv "%VENV_DIR%" || goto :setup_failed
)

echo [%date% %time%] Installing/updating Python dependencies...
"%PYTHON_EXE%" -m pip install --upgrade pip >nul 2>&1
"%PYTHON_EXE%" -m pip install -r requirements.txt || goto :setup_failed

if "%DISCORD_BOT_TOKEN%"=="" (
    echo [%date% %time%] ERROR: DISCORD_BOT_TOKEN is not set. Add it to the system environment or "%SCRIPT_DIR%.env".
    goto :setup_failed
)

:start
echo [%date% %time%] Starting AeroByte Discord Sync Bot...
echo [%date% %time%] Starting AeroByte Discord Sync Bot...>> "%LOG_FILE%"
"%PYTHON_EXE%" -u discord_sync_bot_universal.py >> "%LOG_FILE%" 2>&1

echo.
echo [%date% %time%] WARNING: Bot process terminated! Restarting in 5 seconds...
echo [%date% %time%] WARNING: Bot process terminated! Restarting in 5 seconds...>> "%LOG_FILE%"
echo Press Ctrl+C to stop the loop.
timeout /t 5 >nul
goto start

:setup_failed
echo.
echo [%date% %time%] Startup aborted. Review the message above.
pause
exit /b 1
