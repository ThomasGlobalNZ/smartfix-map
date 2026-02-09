import json

try:
    with open('swagger.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    print("Swagger Version:", data.get('swagger', data.get('openapi', '')))
    print("Base Path:", data.get('basePath'))
    print("Servers:", data.get('servers'))
    
    paths = data.get('paths', {})
    for path, methods in paths.items():
        for method, details in methods.items():
            if method.upper() == 'GET':
                 summary = details.get('summary', '')
                 print(f"{method.upper()} {path}: {summary}")
except Exception as e:
    print(e)
