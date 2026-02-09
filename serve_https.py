import http.server
import ssl
import os
import socket
import datetime

# Configuration
PORT = 8443
CERT_FILE = "localhost.pem"

def generate_self_signed_cert():
    """Generates a self-signed certificate using the cryptography library."""
    if os.path.exists(CERT_FILE):
        return

    print("Generating self-signed certificate...")
    try:
        from cryptography import x509
        from cryptography.x509.oid import NameOID
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.hazmat.primitives import serialization
        
        # Generate Key
        key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
        )
        
        # Generate Cert
        subject = issuer = x509.Name([
            x509.NameAttribute(NameOID.COMMON_NAME, u"localhost"),
        ])
        
        cert = x509.CertificateBuilder().subject_name(
            subject
        ).issuer_name(
            issuer
        ).public_key(
            key.public_key()
        ).serial_number(
            x509.random_serial_number()
        ).not_valid_before(
            datetime.datetime.utcnow()
        ).not_valid_after(
            # Valid for 1 year
            datetime.datetime.utcnow() + datetime.timedelta(days=365)
        ).add_extension(
            x509.SubjectAlternativeName([x509.DNSName(u"localhost")]),
            critical=False,
        ).sign(key, hashes.SHA256())
        
        # Write to file (PEM format)
        with open(CERT_FILE, "wb") as f:
            f.write(key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.TraditionalOpenSSL,
                encryption_algorithm=serialization.NoEncryption(),
            ))
            f.write(cert.public_bytes(serialization.Encoding.PEM))
            
        print(f"Certificate generated: {CERT_FILE}")
            
    except ImportError:
        print("\nCRITICAL ERROR: 'cryptography' library is missing.")
        print("The batch file should have installed it. Please run: pip install cryptography\n")
        raise
    except Exception as e:
        print(f"Error generating cert: {e}")

def run_server():
    server_address = ('0.0.0.0', PORT)
    httpd = http.server.HTTPServer(server_address, http.server.SimpleHTTPRequestHandler)
    
    # Create SSL Context
    if os.path.exists(CERT_FILE):
        print(f"Using certificate: {CERT_FILE}")
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(certfile=CERT_FILE)
        httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
    else:
        print("ERROR: Certificate file creation failed.")
        return

    # Get Local IP
    hostname = socket.gethostname()
    local_ip = socket.gethostbyname(hostname)
    
    print(f"\nServing HTTPS on port {PORT}")
    print(f"Local:   https://localhost:{PORT}")
    print(f"Network: https://{local_ip}:{PORT}")
    print("\nNote: You will see a security warning in the browser (Self-Signed Cert).")
    print("Click 'Advanced' -> 'Proceed' (Chrome) or 'Accept Risk' (Firefox).\n")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")

if __name__ == '__main__':
    # Change into 'app' directory
    if os.path.isdir("app"):
        os.chdir("app")
    
    # Prompt for Token (Added Logic)
    print("\n" + "="*60)
    print("  SBC STATION STATUS CHECK")
    print("="*60)
    token_input = input("  Enter Session Token (Press Enter to skip): ").strip()

    if token_input:
        # Import here to avoid polluting global namespace earlier
        import json
        import requests
        
        def update_station_status(token):
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
                    
                    output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'station_status.json')
                    # Ensure directory exists just in case
                    os.makedirs(os.path.dirname(output_path), exist_ok=True)
                    
                    with open(output_path, 'w') as f:
                        json.dump(status_map, f, indent=2)
                    print(f"Successfully updated status for {len(sites)} stations ({online_count} Online).")
                    print(f"Saved to {output_path}")
                else:
                    print(f"API Error: {response.status_code} - {response.text}")
            except Exception as e:
                print(f"Failed to update status: {e}")

        update_station_status(token_input)
    else:
        print("  Skipping status check (showing default/cached status).")
        
    generate_self_signed_cert()
    run_server()
