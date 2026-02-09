import requests
import json
import sys
import os

# Configuration
BASE_URL = "https://nzsmartnet.co.nz/SBC/API"
# Use environment variable if available, otherwise fallback to hardcoded (for local testing without env vars)
TOKEN = os.environ.get("SBC_AUTH_TOKEN", "ndeDt9iZK8xCPxglCL0KwM8kWUNQpHBCJWs0a5ZmeYrD9gvfqj9ZGSKCxFF8tmM0jctgwmCU213Csf97nfb9DNEQCuiaIfDx3Sgm8xTDxcDUxT8kRJPGD7UQQpH6UQZRBQbcVSwt286otlBSDZKpX1oEvWcIDECPZaHjAF5CUK8vaui5V7o7f7PRE2gxc6Vq4LY8dPI8sbDUvgrhIdcuIA91k4JRU42MesNHvRAds22cpuWJ3KpirJIASdRWUPrY")

HEADERS = {
    "X-SBC-Auth": TOKEN,
    "Accept": "application/json"
}

def check_sites():
    url = f"{BASE_URL}/sites"
    print(f"Checking {url}...")
    try:
        response = requests.get(url, headers=HEADERS)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            sites = response.json()
            print(f"Type of response: {type(sites)}")
            if isinstance(sites, dict):
                print("Keys:", sites.keys())
                # If there are items, print them
                # Check for common list keys
                for key in ['items', 'value', 'sites', 'list']:
                   if key in sites:
                       print(f"Found list in '{key}', length: {len(sites[key])}")
                       print(json.dumps(sites[key][:1], indent=2))
                       break
            elif isinstance(sites, list):
                print(f"List length: {len(sites)}")
                print(json.dumps(sites[:1], indent=2))
                
            # Check for status field
            online_count = 0
            for site in sites:
                # Inspecting keys to find status
                # Common keys: 'status', 'active', 'isOnline', etc.
                pass
                
        else:
            print("Error:", response.text)
            
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    check_sites()
