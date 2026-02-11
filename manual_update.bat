@echo off
echo ==========================================
echo      SBC Stations Map - Manual Update
echo ==========================================
echo.

cd /d "%~dp0"

echo [1/4] Regenerating Map Regions...
python export_port_regions.py
if %ERRORLEVEL% NEQ 0 (
    echo Error running python script!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/4] Staging changes...
git add .

echo.
set /p commit_msg="Enter commit message (or press Enter for 'Manual Update'): "
if "%commit_msg%"=="" set commit_msg=Manual Update

echo.
echo [3/4] Committing...
git commit -m "%commit_msg%"

echo.
echo [4/4] Syncing with GitHub...
git pull --rebase
git push

echo.
echo ==========================================
echo      Success! Changes are live.
echo ==========================================
pause
