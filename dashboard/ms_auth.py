import os
#!/usr/bin/env python3
"""OAuth2 flow for Microsoft Graph API - one-time authorization."""
import json, http.server, urllib.request, urllib.parse, ssl, webbrowser, threading, sys

CONFIG_PATH = "/home/linou/.openclaw/dashboard/ms_calendar.json"
CLIENT_SECRET = os.environ.get("MS_CLIENT_SECRET", "")

with open(CONFIG_PATH) as f:
    config = json.load(f)

CLIENT_ID = config["client_id"]
TENANT_ID = config["tenant_id"]
REDIRECT_URI = config["redirect_uri"]
SCOPE = config["scope"]

AUTH_URL = f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/authorize"
TOKEN_URL = f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token"

auth_code = None

class CallbackHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        global auth_code
        params = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        if 'code' in params:
            auth_code = params['code'][0]
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.end_headers()
            self.wfile.write(b'<html><body><h1>&#10004; Authorization successful!</h1><p>You can close this tab.</p></body></html>')
        elif 'error' in params:
            self.send_response(400)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.end_headers()
            error = params.get('error_description', params.get('error', ['Unknown']))
            self.wfile.write(f'<html><body><h1>Error</h1><p>{error}</p></body></html>'.encode())
        else:
            self.send_response(404)
            self.end_headers()
    def log_message(self, format, *args):
        pass

def exchange_code(code):
    data = urllib.parse.urlencode({
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET,
        'code': code,
        'redirect_uri': REDIRECT_URI,
        'grant_type': 'authorization_code',
        'scope': SCOPE,
    }).encode()
    req = urllib.request.Request(TOKEN_URL, data=data, method='POST')
    req.add_header('Content-Type', 'application/x-www-form-urlencoded')
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

def main():
    # Start callback server
    server = http.server.HTTPServer(('0.0.0.0', 8091), CallbackHandler)
    thread = threading.Thread(target=server.handle_request, daemon=True)
    thread.start()

    # Build auth URL
    params = urllib.parse.urlencode({
        'client_id': CLIENT_ID,
        'response_type': 'code',
        'redirect_uri': REDIRECT_URI,
        'response_mode': 'query',
        'scope': SCOPE,
    })
    url = f"{AUTH_URL}?{params}"
    print(f"\n🔗 Open this URL in your browser to authorize:\n\n{url}\n")
    print("Waiting for callback on port 8091...")

    thread.join(timeout=300)
    server.server_close()

    if not auth_code:
        print("❌ No authorization code received. Timed out.")
        sys.exit(1)

    print("✅ Got authorization code, exchanging for tokens...")
    tokens = exchange_code(auth_code)

    config['tokens'] = {
        'access_token': tokens['access_token'],
        'refresh_token': tokens.get('refresh_token', ''),
        'expires_in': tokens.get('expires_in', 3600),
    }
    with open(CONFIG_PATH, 'w') as f:
        json.dump(config, f, indent=2)
    print(f"✅ Tokens saved to {CONFIG_PATH}")
    print(f"Access token: {tokens['access_token'][:20]}...")

if __name__ == '__main__':
    main()
