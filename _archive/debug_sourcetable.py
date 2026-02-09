import socket

HOST = "www.smartfix.co.nz"
PORT = 2101

def get_sourcetable():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(10)
        s.connect((HOST, PORT))
        s.sendall(b"GET / HTTP/1.0\r\nUser-Agent: NTRIP check\r\n\r\n")
        
        response = b""
        while True:
            chunk = s.recv(4096)
            if not chunk:
                break
            response += chunk
        s.close()
        return response.decode('utf-8', 'ignore')
    except Exception as e:
        print(f"Error: {e}")
        return ""

data = get_sourcetable()
print(f"Downloaded {len(data)} bytes.")

# Search for patterns
if "SingleSiteADV" in data:
    print("FOUND 'SingleSiteADV' in sourcetable!")
    # Print some examples
    lines = data.split('\n')
    found = [l for l in lines if "SingleSiteADV" in l]
    print("Examples:")
    for l in found[:5]:
        print(l)
else:
    print("Did NOT find 'SingleSiteADV' in sourcetable.")
    
    # Print some regular stations to see format
    lines = data.split('\n')
    str_lines = [l for l in lines if l.startswith("STR")]
    print("Standard Examples:")
    for l in str_lines[:5]:
        print(l)
