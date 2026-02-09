@echo off
echo ==========================================
echo      SBC STATIONS - UPDATE & PUSH
echo ==========================================
echo.

:: 1. Run Check NTRIP Ports
echo [1/3] Checking NTRIP Ports...
python check_ntrip_ports.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] check_ntrip_ports.py failed!
    echo Aborting update to protect data.
    pause
    exit /b %ERRORLEVEL%
)

:: 2. Run Station Health (Optional - don't fail on this, just warn)
echo.
echo [2/3] Checking Station Health...
python check_station_health.py

:: 3. Run Export Port Regions
echo.
echo [3/3] Updating Map Regions...
python export_port_regions.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] export_port_regions.py failed!
    echo Aborting update.
    pause
    exit /b %ERRORLEVEL%
)

:: 4. Git Push
echo.
echo ==========================================
echo      PUSHING TO GITHUB
echo ==========================================
echo.
git status
echo.
set /p confirm="Ready to push updates? (Y/N): "
if /i "%confirm%" NEQ "Y" goto :EOF

git add .
git commit -m "Manual Update via Batch Script"

echo [Running Git Pull to sync remote changes...]
git pull --rebase

git push

echo.
echo ==========================================
echo      DONE!
echo ==========================================
pause
