@echo off
echo Starting Local Map Server...
echo If this window closes immediately, you might not have Python installed.
echo Opening Map in Browser...
start "" "http://localhost:8000/index.html"
echo Hosting at http://localhost:8000
echo To connect on phone, stick to the TEST_ON_PHONE.txt instructions!
echo Hosting at port 8000
python serve.py
pause
