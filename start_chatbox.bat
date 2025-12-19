@echo off
echo ==================================================
echo 🚀 Starting Chat-Box Server with Auto-Restart
echo ==================================================
echo.

cd backend

REM Install dependencies if needed
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
    call venv\Scripts\activate
    pip install -r requirements.txt
) else (
    call venv\Scripts\activate
)

echo.
echo Starting server watchdog...
echo Logs will be saved to: server_watchdog.log
echo.

python run_server.py

pause