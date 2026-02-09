import os
import shutil
import datetime

DEPLOY_DIR = "deployment_package"
SOURCE_DIR = "app"

def create_readme_txt():
    content = """SMARTFIX CORS MAP - DEPLOYMENT INSTRUCTIONS
=============================================

TECHNICAL REQUIREMENTS
----------------------
*   **Static Site Only**: This is a pure HTML/JavaScript application.
*   **No Python/PHP/Backend Required**: The server does not need Python installed.
*   **HTTPS Recommended**: For security and geolocation features.

1. COPY FILES
   Copy all the files in this folder to your web server (Apache, IIS, Nginx, etc.).
   For example, put them in a folder named 'smartfix' on your website.

2. THAT'S IT!
   The map is ready to use. 
   You can verify it works by going to: https://yoursite.com/smartfix/index.html

---------------------------------------------
IFRAME EMBED CODE (For Developers)
If you want to put this map inside another page:

<iframe src="https://yoursite.com/smartfix/index.html" width="100%" height="800px" style="border:none;"></iframe>
---------------------------------------------
"""
    with open(os.path.join(DEPLOY_DIR, "READ_ME_FOR_ADMIN.txt"), "w") as f:
        f.write(content)

def create_test_plan_txt():
    content = """SMARTFIX MAP - TESTING CHECKLIST
================================

Open the map in your browser and check these 5 things:

1. CHECK THE MAP LOADS
   - Do you see the map of New Zealand?
   - Do you see blue and green dots (stations)?

2. CHECK THE LAYERS (Top Left Icon)
   - Click the layer icon (square stack).
   - Click "Satellite". Does the background become an aerial photo?
   - Switch back to "Standard".

3. CHECK A STATION
   - Click any colored dot.
   - A box should pop up with the Station Name and Port Number.
   - It should also show the "Est. Baseline Error".

4. TEST THE TOOLS (Top Right Buttons)
   - Click the "Ruler" icon. Click two points on the map. It should measure distance.
   - Click the "Target" icon. Enter "20". It should draw green rings around all stations.

5. CHECK COORDINATES (Bottom Left)
   - Move your mouse. The numbers in the bottom-left corner should change.
   - Click the numbers to switch between Lat/Lon and NZTM.

If all of these work, the deployment is successful.
"""
    with open(os.path.join(DEPLOY_DIR, "TESTING_CHECKLIST.txt"), "w") as f:
        f.write(content)

def create_phone_guide():
    content = """HOW TO TEST ON YOUR PHONE (LOCAL WIFI)
======================================

1. ENSURE CONNECTION
   Make sure your phone and this PC are on the same Wi-Fi network.

2. FIND YOUR PC's IP ADDRESS
   - On this PC, open a terminal (Command Prompt).
   - Type `ipconfig` and press Enter.
   - Look for "IPv4 Address" (e.g., 192.168.1.50).

3. OPEN ON PHONE
   - On your phone's browser (Chrome/Safari), type:
     http://YOUR_IP_ADDRESS:8000/app/index.html
     
     Example: http://192.168.1.50:8000/app/index.html

4. VERIFY MOBILE LAYOUT
   - Check that the controls (search box, buttons) fit on the screen.
   - Check that the "Coordinate Box" moves to the bottom and looks good.
   - Try using two fingers to pinch/zoom the map.

TROUBLESHOOTING
--------------
*   **Can't Load?** It is likely the Windows Firewall blocking the connection.
    1.  On your PC, a popup might have appeared asking to allow Python. Click "Allow/Public".
    2.  If no popup: Search Windows for "Firewall & network protection" -> "Allow an app through firewall" -> Ensure `python.exe` is checked for Private/Public.
*   **Different WiFi?** Your phone and laptop MUST be on the same Wireless network. If your laptop is on a cable (Ethernet) and phone is on WiFi, it might not work depending on the router setting.
"""
    with open(os.path.join(DEPLOY_DIR, "TEST_ON_PHONE.txt"), "w") as f:
        f.write(content)

def create_run_bat():
    content = """@echo off
echo Starting Local Map Server...
echo If this window closes immediately, you might not have Python installed.
echo Opening Map in Browser...
start "" "http://localhost:8000/index.html"
echo Hosting at http://localhost:8000
echo To connect on phone, stick to the TEST_ON_PHONE.txt instructions!
echo Hosting at port 8000
python serve.py
pause
"""
    with open(os.path.join(DEPLOY_DIR, "run_local_server.bat"), "w") as f:
        f.write(content)

def create_admin_questions_txt():
    content = """QUESTIONS FOR IT ADMIN
======================

Please ask the IT administrator the following questions to ensure the map is deployed correctly:

1. WHAT IS THE URL?
   - What will be the final web address for the map?
   - Example: https://globalsurvey.co.nz/smartfix

2. IS HTTPS ENABLED?
   - Does the server support HTTPS?
   - This is important for the "Find My Location" (GPS) feature to work on mobile devices.

3. HOW DO I UPDATE DATA?
   - If I generate new station data files in the future, how should I send them to you?
   - Can I email them, or is there a specific folder/FTP I should upload to?
"""
    with open(os.path.join(DEPLOY_DIR, "QUESTIONS_FOR_IT_ADMIN.txt"), "w") as f:
        f.write(content)

def main():
    # 1. Create Clean Directory
    if os.path.exists(DEPLOY_DIR):
        print(f"Cleaning existing {DEPLOY_DIR}...")
        shutil.rmtree(DEPLOY_DIR)
    
    os.makedirs(DEPLOY_DIR)
    print(f"Created {DEPLOY_DIR}")

    # 2. Copy App Content
    print(f"Copying files from {SOURCE_DIR}...")
    
    # Files to exclude from the package (source artifacts we don't need on server)
    exclude_files = ["TEST_PLAN.md", "README_DEPLOY.md"]

    for item in os.listdir(SOURCE_DIR):
        if item in exclude_files:
            continue
            
        s = os.path.join(SOURCE_DIR, item)
        d = os.path.join(DEPLOY_DIR, item)
        
        if os.path.isdir(s):
            shutil.copytree(s, d)
        else:
            shutil.copy2(s, d)

    # 3. Create Documentation
    create_readme_txt()
    create_test_plan_txt()
    create_phone_guide()
    create_run_bat()
    create_admin_questions_txt()
    
    print("\nDeployment Package Created Successfully!")
    print(f"Location: {os.path.abspath(DEPLOY_DIR)}")
    print("Contents:")
    for root, dirs, files in os.walk(DEPLOY_DIR):
        level = root.replace(DEPLOY_DIR, '').count(os.sep)
        indent = ' ' * 4 * (level)
        print(f"{indent}{os.path.basename(root)}/")
        subindent = ' ' * 4 * (level + 1)
        for f in files:
            print(f"{subindent}{f}")

if __name__ == "__main__":
    main()
