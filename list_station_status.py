import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "https://smartfix.co.nz/SBC/API"
TOKEN = "jqgVbuhB9o9IqkYni3cKEMF9kuzPZMmOBHjXu8Fm2uAjloYqLQbB9PA7hIVtRezHY42Pxk265acdjsb8JQ1h5wDQhkd6DPx8R3NFhK2SL2vQ661K1yrcpZBfihNyW6ZhLFil5zhq6kRrXzKGff9VPj1fkOFqz5qV5uF7XUbMwYfwG8JjN9Jmgw7y6dO7NSLsNWe3XkeFJ1bTQn7redUCrDpvWz2KahIaQP13HYU2vNlEXAuUciYC60lLr69KNZmh"

HEADERS = {
    "X-SBC-Auth": TOKEN,
    "Accept": "application/json"
}

def get_station_status():
    url = f"{BASE_URL}/sites"
    print(f"Querying {url}...")
    
    try:
        response = requests.get(url, headers=HEADERS, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            # Handle response structure (dictionary with 'sites' key or list)
            if isinstance(data, dict) and 'sites' in data:
                sites = data['sites']
            elif isinstance(data, list):
                sites = data
            else:
                print("Unexpected JSON structure.")
                return

            print(f"Total Sites Found: {len(sites)}")
            print("-" * 60)
            print(f"{'Site Code':<10} | {'Connected':<10} | {'Receiving':<10} | {'Status'}")
            print("-" * 60)
            
            online_count = 0
            offline_count = 0
            
            for site in sites:
                code = site.get('siteCode', 'N/A')
                connected = site.get('connected', False)
                receiving = site.get('receivingData', False)
                
                status = "ONLINE" if connected and receiving else "OFFLINE"
                if status == "ONLINE":
                    online_count += 1
                else:
                    offline_count += 1
                
                # Only print interesting ones or all? let's print a sample or summary if too many
                # User wants to determine which stations are online.
                # Printing 300 lines might be too much for console but useful for user.
                # Let's print all but concise.
                
                conn_str = "Yes" if connected else "No"
                recv_str = "Yes" if receiving else "No"
                
                print(f"{code:<10} | {conn_str:<10} | {recv_str:<10} | {status}")

            print("-" * 60)
            print(f"Summary: {online_count} Online, {offline_count} Offline")
            
        else:
            print(f"Error: {response.status_code} - {response.text}")
            
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    get_station_status()
