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

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Prevent caching
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        super().end_headers()

# Serve from script directory
os.chdir(os.path.dirname(os.path.abspath(__file__)))

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
