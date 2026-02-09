import socket
import json
import base64
import time

import os
# ... (imports already there)

EXCLUDED_STATIONS = ["TREC", "trec", "2GRO", "2GR0", "1778", "7651", "xGRX", "xgrx", "GSMG", "gsmg"]

HOST = "www.smartfix.co.nz"
# Check ports 4800 to 4815 (inclusive)
PORTS = list(range(4800, 4816))
USER = os.environ.get("NTRIP_USER", "THOMASM")
PASSWORD = os.environ.get("NTRIP_PASSWORD", "THOMASM")
OUTPUT_FILE = "app/data/station_port_mapping.json"

def load_known_stations(geojson_path):
    """Loads all known station codes from the GeoJSON file."""
    if not os.path.exists(geojson_path):
        print(f"Warning: GeoJSON not found at {geojson_path}")
        return set()
    
    with open(geojson_path, 'r') as f:
        data = json.load(f)
    
    codes = set()
    for feature in data.get('features', []):
        props = feature.get('properties', {})
        code = props.get('Site Code')
        if code:
            codes.add(code)
    return codes

def get_sourcetable(host, port, user, password):
    """
    Connects to an NTRIP caster and requests the source table.
    Returns a list of stream (STR) entries.
    """
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)
        sock.connect((host, port))

        # Basic Auth
        auth_str = f"{user}:{password}"
        auth_bytes = auth_str.encode('ascii')
        auth_b64 = base64.b64encode(auth_bytes).decode('ascii')

        # NTRIP Request
        # Getting source table usually just requires a GET / with Ntrip-Version header
        request = (
            f"GET / HTTP/1.1\r\n"
            f"Host: {host}\r\n"
            f"Ntrip-Version: 2.0\r\n"
            f"User-Agent: NTRIP Python Client\r\n"
            f"Authorization: Basic {auth_b64}\r\n"
            f"Connection: close\r\n"
            f"\r\n"
        )

        sock.sendall(request.encode('ascii'))

        response = b""
        while True:
            chunk = sock.recv(4096)
            if not chunk:
                break
            response += chunk

        sock.close()
        return response.decode('utf-8', errors='ignore')

    except Exception as e:
        print(f"Error fetching port {port}: {e}")
        return None

def parse_sourcetable(data):
    """
    Parses NTRIP source table data and returns a list of mountpoints.
    """
    mountpoints = []
    lines = data.splitlines()
    for line in lines:
        if line.startswith("STR;"):
            parts = line.split(";")
            if len(parts) > 1:
                mountpoint = parts[1]
                mountpoints.append(mountpoint)
    return mountpoints

def main():
    mapping = {}
    
    print(f"Connecting to {HOST}...")
    
    # 0. Load Existing Meta (to preserve last_seen)
    existing_meta = {}
    if os.path.exists("app/data/station_meta.json"):
        try:
            with open("app/data/station_meta.json", "r") as f:
                existing_meta = json.load(f)
        except Exception as e:
            print(f"Warning: Could not load existing meta: {e}")

    # 1. Fetch Active Streams
    active_streams = set()
    total_streams_found = 0

    for port in PORTS:
        print(f"Checking Port {port}...", end="", flush=True)
        data = get_sourcetable(HOST, port, USER, PASSWORD)
        
        if data:
            mountpoints = parse_sourcetable(data)
            count = len(mountpoints)
            print(f" Found {count} streams.")
            total_streams_found += count
            
            for mp in mountpoints:
                # Basic parsing
                if len(mp) >= 4:
                    station_code = mp[:4].upper()
                    
                    # Ignore common non-station mountpoints
                    if station_code in ["NEAR", "VRS_", "MAC_", "RTCM"]:
                        continue
                    
                    if station_code in EXCLUDED_STATIONS:
                        continue

                    active_streams.add(station_code)

                    # Track all ports this station is seen on
                    if station_code not in mapping:
                        mapping[station_code] = {'ports': []}
                    mapping[station_code]['ports'].append(port)
        else:
            print(" No data/Connection failed.")
        
        time.sleep(1)

    # FAIL-SAFE: If we found 0 streams total, something is wrong with network/auth.
    # Do NOT overwrite the file with empty data.
    if total_streams_found == 0:
        print("\nCRITICAL ERROR: No streams found on any port!")
        print("Possible causes: Network down, detailed auth failure, or caster maintenance.")
        print("ABORTING UPDATE to preserve existing map data.")
        return

    # 2. Manual Overrides (User Request)
    OVERRIDE_PORTS = {
        # "NTGT": 4806, # Removed
        # "JTGT": 4802  # Removed
    }
    
    # 3. Load Known Stations (for Offline detection)
    known_stations = load_known_stations("app/data/Sites_20250725_Global.geojson")
    
    # 4. Determine Status & Build Meta Data
    # Meta data structure: {"CODE": {"single_port": 1234, "network_port": 5678, "status": "Online", "last_seen": "YYYY-MM-DD HH:MM"}}
    station_meta = {}
    
    all_codes = known_stations.union(active_streams)
    
    # Define Network Port Ranges or Map
    NETWORK_MAP = {
        4801: 4811, 4802: 4812, 4803: 4813, 
        4804: 4814, 4806: None, 4807: None, 4809: None # Others might not have net ports?
        # Actually user said "network ports are for certian stations only".
        # We just check if they appear in any of the known network ports (4810-4815?)
    }
    NETWORK_PORTS_RANGE = range(4810, 4816)

    current_time = time.strftime("%Y-%m-%d %H:%M")

    for code in all_codes:
        if code in EXCLUDED_STATIONS:
            continue
            
        is_online = code in active_streams
        status = "Online" if is_online else "Offline"
        
        # Determine specific ports
        seen_ports = mapping.get(code, {}).get('ports', [])
        
        # Find Single Site Port (e.g., < 4810)
        single_port = None
        for p in seen_ports:
            if p < 4810: 
                single_port = p
                break 
        
        # Override Single Port if manual
        if code in OVERRIDE_PORTS:
            single_port = OVERRIDE_PORTS[code]
            if status == "Offline": status = "Online" # Force online if overridden

        # Find Network Port (e.g., >= 4810)
        network_port = None
        for p in seen_ports:
            if p in NETWORK_PORTS_RANGE:
                network_port = p
                break
        
        # Preserve Last Seen
        last_seen = existing_meta.get(code, {}).get('last_seen', 'Never')
        if is_online:
            last_seen = current_time
        
        # If Offline, maybe preserve old port info?
        # If we have no new port info (because offline), use old info if available
        if status == "Offline" and code in existing_meta:
            if not single_port: single_port = existing_meta[code].get('port')
            if not network_port: network_port = existing_meta[code].get('network_port')

        station_meta[code] = {
            "status": status,
            "port": single_port, # Primary Single Port
            "network_port": network_port, # If available
            "last_seen": last_seen
        }

    # 5. Save/Export
    
    # A. Station Port Mapping (Backwards compatibility for python script)
    # Only save stations that HAVE a port assigned
    clean_mapping = {k: v['port'] for k, v in station_meta.items() if v['port'] is not None}
    
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(clean_mapping, f, indent=4, sort_keys=True)
    print(f"Mapping saved to {OUTPUT_FILE}")

    # B. Station Meta (for JS - Status + Port)
    with open("app/data/station_meta.json", "w") as f:
        json.dump(station_meta, f, indent=4, sort_keys=True)
    print(f"Station Metadata saved to app/data/station_meta.json")

    # C. QA Text Report
    report_lines = []
    report_lines.append(f"QA PORT ASSIGNMENT & STATUS REPORT ({current_time})")
    report_lines.append("="*40)
    
    # Group by Port
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
        # Columns of 5
        for i in range(0, len(stats), 5):
            report_lines.append(", ".join(stats[i:i+5]))
            
    if offline_stations:
        report_lines.append(f"\nOFFLINE STATIONS ({len(offline_stations)}):")
        offline_stations.sort()
        for i in range(0, len(offline_stations), 3): # 3 per line since longer with timestamp
            report_lines.append(", ".join(offline_stations[i:i+3]))
            
    report_content = "\n".join(report_lines)
    print(report_content)
    
    with open("app/data/QA_Port_Assignments.txt", "w") as f:
        f.write(report_content)
    print("QA Report saved to app/data/QA_Port_Assignments.txt")

if __name__ == "__main__":
    main()
