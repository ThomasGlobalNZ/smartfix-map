import http.server
import socketserver
import socket
import os

PORT = 8000

def get_all_ips():
    ips = []
    try:
        # Get hostname
        hostname = socket.gethostname()
        # Get all addresses associated with hostname
        addr_infos = socket.getaddrinfo(hostname, None)
        
        for info in addr_infos:
            ip = info[4][0]
            # Filter for IPv4 and non-loopback
            if ':' not in ip and ip != '127.0.0.1':
                if ip not in ips:
                    ips.append(ip)
    except Exception as e:
        print(f"Error checking IPs: {e}")
    
    # Fallback method just in case
    if not ips:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect(('8.8.8.8', 1))
            ip = s.getsockname()[0]
            ips.append(ip)
        except Exception:
            pass
        finally:
            s.close()
            
    return ips

import json
import requests
import sys

# --- API Integration ---
def update_station_status(token):
    if not token:
        print("No token provided. Skipping API check.")
        return

    print("Fetching station status from SBC API...")
    BASE_URL = "https://smartfix.co.nz/SBC/API"
    HEADERS = {
        "X-SBC-Auth": token,
        "Accept": "application/json"
    }
    
    try:
        response = requests.get(f"{BASE_URL}/sites", headers=HEADERS, timeout=10)
        if response.status_code == 200:
            data = response.json()
            sites = data['sites'] if isinstance(data, dict) and 'sites' in data else data
            
            status_map = {}
            online_count = 0
            
            for site in sites:
                code = site.get('siteCode', 'N/A')
                connected = site.get('connected', False)
                receiving = site.get('receivingData', False)
                
                status_map[code] = {
                    "status": "Online" if connected and receiving else "Offline",
                    "connected": connected,
                    "receiving": receiving
                }
                if status_map[code]["status"] == "Online":
                    online_count += 1
            
            # Save to app/data/station_meta.json (overwriting or merging?)
            # The script.js loads 'station_meta.json'. Let's see if we should merge with existing or just create new.
            # Looking at script.js line 222, it tries to load station_meta.json.
            # Let's write to station_status.json and update script.js to read it, OR just write to station_meta.json
            # Currently station_meta.json might have other info?
            # Let's assume we can overwrite or create a specific status file.
            # To be safe, let's write to 'station_status.json' and update script.js to read it.
            
            output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'station_status.json')
            with open(output_path, 'w') as f:
                json.dump(status_map, f, indent=2)
                
            print(f"Successfully updated status for {len(sites)} stations ({online_count} Online).")
            print(f"Saved to {output_path}")
        else:
            print(f"API Error: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"Failed to update status: {e}")

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Prevent caching
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        super().end_headers()

# Serve from script directory
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# Prompt for Token
print("\n" + "="*60)
print("  SBC STATION STATUS CHECK")
print("="*60)
token_input = input("  Enter Session Token (Press Enter to skip): ").strip()
if token_input:
    update_station_status(token_input)
else:
    print("  Skipping status check (showing default/cached status).")

ips = get_all_ips()

print("\n" + "="*60)
print(f"  MOBILE TESTING SERVER")
print("="*60)
print(f"  1. Connect your phone to the SAME Wi-Fi/Network as this PC.")
print(f"  2. Open Chrome/Safari on your phone.")
print(f"  3. Type ONE of these URLs (try the 192.168... one first):")
print("")

for ip in ips:
    print(f"     http://{ip}:{PORT}/index.html")

if not ips:
    print(f"     (Could not detect IP. Try http://<YOUR_PC_IP>:{PORT}/index.html)")

print("")
print("  IMPORTANT: You MUST use 'http://', NOT 'https://'")
print("  If your phone automatically switches to https, type http:// manually.")
print("="*60 + "\n")

with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as httpd:
    print(f"Serving at port {PORT}...")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
