@echo off
echo Starting Manual Update Process...
echo ==========================================

cd /d "%~dp0"

:: Cleanup potential lock files from previous crashed runs
if exist ".git\index.lock" (
    echo Removing stale git lock file...
    del ".git\index.lock"
)
if exist ".git\rebase-merge" (
    echo Removing stale rebase directory...
    rmdir /s /q ".git\rebase-merge"
)

echo 1. Regenerating Port Regions...
python export_port_regions.py

echo.
echo 2. Staging all changes...
git add .

echo.
echo 3. Committing changes...
git commit -m "Manual update via batch script"

echo.
echo 4. Pulling latest changes from Remote (Rebase)...
git pull --rebase

echo.
echo 5. Pushing to GitHub...
git push

echo.
echo ==========================================
echo Update Complete.
pause
