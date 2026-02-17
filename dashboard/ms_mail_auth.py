#!/usr/bin/env python3
"""Add Mail.Read scope to existing MS Graph token via Device Code Flow."""
import json, urllib.request, urllib.parse, time

CONFIG_PATH = "/home/linou/.openclaw/dashboard/ms_calendar.json"
TOKEN_URL = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token"
DEVICE_CODE_URL = "https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode"

# New scope includes Mail.Read
NEW_SCOPE = "Calendars.ReadWrite Mail.Read Mail.ReadBasic User.Read offline_access"

with open(CONFIG_PATH) as f:
    config = json.load(f)

client_id = config['client_id']

# Step 1: Request device code
params = urllib.parse.urlencode({
    'client_id': client_id,
    'scope': NEW_SCOPE,
}).encode()

req = urllib.request.Request(DEVICE_CODE_URL, data=params, method='POST')
req.add_header('Content-Type', 'application/x-www-form-urlencoded')
with urllib.request.urlopen(req) as resp:
    device = json.loads(resp.read())

print("\n" + "="*60)
print(f"请访问: {device['verification_uri']}")
print(f"输入代码: {device['user_code']}")
print("="*60 + "\n")

# Step 2: Poll for token
interval = device.get('interval', 5)
while True:
    time.sleep(interval)
    params = urllib.parse.urlencode({
        'client_id': client_id,
        'grant_type': 'urn:ietf:params:oauth:grant-type:device_code',
        'device_code': device['device_code'],
    }).encode()
    req = urllib.request.Request(TOKEN_URL, data=params, method='POST')
    req.add_header('Content-Type', 'application/x-www-form-urlencoded')
    try:
        with urllib.request.urlopen(req) as resp:
            tokens = json.loads(resp.read())
        # Success!
        config['tokens'] = {
            'access_token': tokens['access_token'],
            'refresh_token': tokens['refresh_token'],
            'expires_in': tokens.get('expires_in', 3600),
        }
        config['scope'] = NEW_SCOPE
        with open(CONFIG_PATH, 'w') as f:
            json.dump(config, f, indent=2)
        print("✅ Token updated with Mail.Read scope!")
        
        # Quick test - read latest email
        req2 = urllib.request.Request(
            "https://graph.microsoft.com/v1.0/me/messages?$top=1&$select=subject,from,receivedDateTime",
            method='GET'
        )
        req2.add_header('Authorization', f"Bearer {tokens['access_token']}")
        with urllib.request.urlopen(req2) as resp2:
            mail = json.loads(resp2.read())
        if mail.get('value'):
            m = mail['value'][0]
            print(f"📧 Latest email: {m['subject']} (from: {m['from']['emailAddress']['address']})")
        break
    except urllib.error.HTTPError as e:
        body = json.loads(e.read())
        error = body.get('error', '')
        if error == 'authorization_pending':
            print('.', end='', flush=True)
        elif error == 'slow_down':
            interval += 5
        else:
            print(f"Error: {body}")
            break
