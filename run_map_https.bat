@echo off
echo Starting SBC Stations Web Map (SECURE MODE)...
echo.
echo Installing dependencies for secure server...
pip install cryptography
echo.
echo Note: This server uses a self-signed certificate.
echo You must accept the browser warning to proceed.
echo.
python "%~dp0serve_https.py"
pause
