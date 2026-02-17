import os
#!/usr/bin/env python3
"""Device Code Flow for Microsoft Graph API - no browser redirect needed."""
import json, urllib.request, urllib.parse, time, sys

CONFIG_PATH = "/home/linou/.openclaw/dashboard/ms_calendar.json"
CLIENT_SECRET = os.environ.get("MS_CLIENT_SECRET", "")

with open(CONFIG_PATH) as f:
    config = json.load(f)

CLIENT_ID = config["client_id"]
TENANT_ID = config["tenant_id"]
SCOPE = "Calendars.ReadWrite User.Read offline_access"

DEVICE_URL = "https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode"
TOKEN_URL = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token"

def request_device_code():
    data = urllib.parse.urlencode({
        'client_id': CLIENT_ID,
        'scope': SCOPE,
    }).encode()
    req = urllib.request.Request(DEVICE_URL, data=data, method='POST')
    req.add_header('Content-Type', 'application/x-www-form-urlencoded')
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

def poll_for_token(device_code, interval):
    while True:
        time.sleep(interval)
        data = urllib.parse.urlencode({
            'client_id': CLIENT_ID,
            # 'client_secret': CLIENT_SECRET,  # public client, no secret
            'grant_type': 'urn:ietf:params:oauth:grant-type:device_code',
            'device_code': device_code,
        }).encode()
        req = urllib.request.Request(TOKEN_URL, data=data, method='POST')
        req.add_header('Content-Type', 'application/x-www-form-urlencoded')
        try:
            with urllib.request.urlopen(req) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            body = json.loads(e.read())
            error = body.get('error', '')
            if error == 'authorization_pending':
                print('.', end='', flush=True)
                continue
            elif error == 'slow_down':
                interval += 5
                continue
            elif error == 'expired_token':
                print("\n❌ Code expired. Please run again.")
                sys.exit(1)
            else:
                print(f"\n❌ Error: {body.get('error_description', error)}")
                sys.exit(1)

def main():
    print("Requesting device code...")
    resp = request_device_code()
    
    user_code = resp['user_code']
    device_code = resp['device_code']
    verify_url = resp['verification_uri']
    interval = resp.get('interval', 5)
    
    print(f"\n{'='*50}")
    print(f"🔗 Open: {verify_url}")
    print(f"📝 Enter code: {user_code}")
    print(f"{'='*50}")
    print(f"\nWaiting for authorization", end='', flush=True)
    
    tokens = poll_for_token(device_code, interval)
    
    print(f"\n\n✅ Authorization successful!")
    
    config['tokens'] = {
        'access_token': tokens['access_token'],
        'refresh_token': tokens.get('refresh_token', ''),
        'expires_in': tokens.get('expires_in', 3600),
    }
    with open(CONFIG_PATH, 'w') as f:
        json.dump(config, f, indent=2)
    print(f"✅ Tokens saved to {CONFIG_PATH}")

if __name__ == '__main__':
    main()
