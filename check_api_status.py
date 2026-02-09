import urllib.request
import urllib.error
import json
import ssl
import sys
import os
import time
from datetime import datetime

# Configuration
BASE_URL = "https://smartfix.co.nz/SBC/API/v12.0" 
# Use Environment Variables with fallback to provided defaults
USERNAME = os.environ.get("SMARTFIX_USER", "Admin")
PASSWORD = os.environ.get("SMARTFIX_PASSWORD", "Surv3y")

META_FILE = "app/data/station_meta.json"
QA_FILE = "app/data/QA_Port_Assignments.txt"

# Bypass SSL verification
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def make_request(url, method='GET', data=None, headers=None):
    if headers is None:
        headers = {}
    
    req = urllib.request.Request(url, method=method)
    for k, v in headers.items():
        req.add_header(k, v)
    
    json_data = None
    if data:
        json_data = json.dumps(data).encode('utf-8')
        req.add_header('Content-Type', 'application/json')
    
    try:
        with urllib.request.urlopen(req, data=json_data, context=ctx) as response:
            content = response.read()
            resp_headers = dict(response.info())
            if content:
                try:
                    return response.status, json.loads(content), resp_headers
                except json.JSONDecodeError:
                    return response.status, content.decode('utf-8'), resp_headers 
            return response.status, None, resp_headers
    except urllib.error.HTTPError as e:
        try:
            err_body = e.read().decode('utf-8')
            return e.code, json.loads(err_body), {}
        except:
            return e.code, str(e), {}
    except Exception as e:
        return 0, str(e), {}

def login():
    url = f"{BASE_URL}/login"
    
    # Try lowercase payload first
    payload = {"username": USERNAME, "password": PASSWORD}
    status, body, headers = make_request(url, 'POST', payload)
    
    token = None
    if status == 200:
        if isinstance(body, dict):
             for k in ['token', 'sessionToken', 'id', 'accessToken']:
                 if k in body:
                     token = body[k]
                     break
                 for key in body.keys():
                     if key.lower() == k.lower():
                         token = body[key]
                         break
        elif isinstance(body, str):
            token = body
        
        if not token:
            for k, v in headers.items():
                if k.lower() in ['x-sbc-auth', 'token', 'authorization']:
                    token = v
                    break
            
    if not token and status != 200:
        print(f"Login failed with lowercase payload (Status {status}). Retrying legacy...")
        # Try Capitalized payload if needed (legacy)
        payload = {"Username": USERNAME, "Password": PASSWORD}
        status, body, headers = make_request(url, 'POST', payload)
        if status == 200:
             if isinstance(body, dict):
                 for k in ['token', 'sessionToken', 'id']:
                     if k in body:
                         token = body[k]
                         break
             elif isinstance(body, str):
                token = body

    if token:
        return token.strip('"')
    else:
        print(f"Login failed. Status: {status}, Body: {body}")
        return None

def get_sites(token):
    url = f"{BASE_URL}/sites" 
    status, data, _ = make_request(url, 'GET', headers={'X-SBC-Auth': token})
    
    if status == 200 and data:
        return data.get('sites', data) if isinstance(data, dict) else data
    else:
        print(f"Failed to retrieve sites (Status {status}).")
        return None

def load_meta():
    if os.path.exists(META_FILE):
        try:
            with open(META_FILE, 'r') as f:
                return json.load(f)
        except:
            return {}
    return {}

def main():
    print(f"Connecting to SmartFix API ({BASE_URL})...")
    
    token = login()
    if not token:
        print("CRITICAL: Failed to login to API. Aborting update.")
        exit(1)
        
    print("Login successful.")
    
    sites = get_sites(token)
    if not sites:
        print("CRITICAL: No sites returned from API. Aborting update.")
        exit(1)
        
    print(f"Retrieved {len(sites)} sites from API.")
    
    # Load existing metadata (to preserve ports)
    station_meta = load_meta()
    
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M")
    updates_count = 0
    online_count = 0
    
    # Map API sites by Code or Name for lookup
    api_map = {}
    for s in sites:
        # Try to find a 4-char code
        code = s.get('siteCode')
        if not code:
            # Fallback to name if it looks like a code
            name = s.get('name', '')
            if len(name) == 4 and name.isupper():
                code = name
        
        if code:
            api_map[code.upper()] = s

    # Update metadata
    for code, data in station_meta.items():
        api_data = api_map.get(code)
        
        if api_data:
            # Determine status
            connected = api_data.get('connected', False)
            receiving = api_data.get('receivingData', False)
            
            is_online = connected and receiving
            new_status = "Online" if is_online else "Offline"
            
            # Update status
            data['status'] = new_status
            
            # Update last_seen if online
            if is_online:
                data['last_seen'] = current_time
                online_count += 1
            
            updates_count += 1
        else:
            if data['status'] == 'Online':
                print(f"Warning: Station {code} not found in API. Marking Offline.")
                data['status'] = 'Offline'
            # If already offline, verify we have port info preserved. 
            # (We loaded the whole meta, so it is preserved by default)

    # Save metadata
    with open(META_FILE, 'w') as f:
        json.dump(station_meta, f, indent=4, sort_keys=True)
    
    print(f"Updated metadata for {updates_count} stations ({online_count} Online).")
    print(f"Saved to {META_FILE}")
    
    # Generate QA Report
    report_lines = []
    report_lines.append(f"QA STATION STATUS REPORT ({current_time})")
    report_lines.append(f"Source: SmartFix API")
    report_lines.append("="*40)
    
    # Group by Port (using existing port info)
    port_groups = {}
    offline_stations = []
    
    for code, data in station_meta.items():
        if data['status'] == 'Offline':
             offline_stations.append(f"{code} (Last: {data.get('last_seen', 'Never')})")
        
        p = data.get('port')
        if p:
            if p not in port_groups:
                port_groups[p] = []
            port_groups[p].append(f"{code} ({data['status']})")
            
    for port in sorted(port_groups.keys()):
        report_lines.append(f"\nPORT {port} ({len(port_groups[port])} stations):")
        stats = sorted(port_groups[port])
        for i in range(0, len(stats), 5):
            report_lines.append(", ".join(stats[i:i+5]))

    if offline_stations:
        report_lines.append(f"\nOFFLINE STATIONS ({len(offline_stations)}):")
        offline_stations.sort()
        for i in range(0, len(offline_stations), 3):
            report_lines.append(", ".join(offline_stations[i:i+3]))
            
    with open(QA_FILE, 'w') as f:
        f.write("\n".join(report_lines))
        
    print(f"Report saved to {QA_FILE}")

if __name__ == "__main__":
    main()
