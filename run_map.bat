@echo off
echo Starting SmartFix CORS Map Server...
echo Opening Web Map...
start "" "http://localhost:8000/index.html"
echo Server is running at http://localhost:8000
echo Press Ctrl+C to stop the server.
python app/serve.py
