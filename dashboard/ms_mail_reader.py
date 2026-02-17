#!/usr/bin/env python3
"""MS Graph Mail Reader - read emails and extract verification codes.

Usage:
  python3 ms_mail_reader.py latest [N]          - Show latest N emails (default 5)
  python3 ms_mail_reader.py code [sender]       - Get latest verification code (optionally filter by sender)
  python3 ms_mail_reader.py search <query>      - Search emails
"""
import json, urllib.request, urllib.parse, re, sys

CONFIG_PATH = "/home/linou/.openclaw/dashboard/ms_calendar.json"
TOKEN_URL = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token"
GRAPH_URL = "https://graph.microsoft.com/v1.0"

def load_config():
    with open(CONFIG_PATH) as f:
        return json.load(f)

def save_config(config):
    with open(CONFIG_PATH, 'w') as f:
        json.dump(config, f, indent=2)

def refresh_token(config):
    params = {
        'client_id': config['client_id'],
        'refresh_token': config['tokens']['refresh_token'],
        'grant_type': 'refresh_token',
        'scope': config['scope'],
    }
    data = urllib.parse.urlencode(params).encode()
    req = urllib.request.Request(TOKEN_URL, data=data, method='POST')
    req.add_header('Content-Type', 'application/x-www-form-urlencoded')
    with urllib.request.urlopen(req) as resp:
        tokens = json.loads(resp.read())
    config['tokens']['access_token'] = tokens['access_token']
    if 'refresh_token' in tokens:
        config['tokens']['refresh_token'] = tokens['refresh_token']
    save_config(config)
    return config

def api_get(config, path, retry=True):
    url = GRAPH_URL + path
    req = urllib.request.Request(url, method='GET')
    req.add_header('Authorization', 'Bearer ' + config['tokens']['access_token'])
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read()), config
    except urllib.error.HTTPError as e:
        if e.code == 401 and retry:
            config = refresh_token(config)
            return api_get(config, path, retry=False)
        raise

def get_latest_emails(n=5):
    config = load_config()
    params = urllib.parse.urlencode({
        "$top": str(n),
        "$orderby": "receivedDateTime desc",
        "$select": "subject,from,receivedDateTime,bodyPreview"
    })
    data, _ = api_get(config, "/me/messages?" + params)
    for m in data.get("value", []):
        frm = m["from"]["emailAddress"]["address"]
        print(json.dumps({
            "subject": m["subject"],
            "from": frm,
            "time": m["receivedDateTime"],
            "preview": m["bodyPreview"][:200]
        }, ensure_ascii=False))

def get_verification_code(sender_filter=None):
    """Get the latest verification code from email."""
    config = load_config()
    params = urllib.parse.urlencode({
        "$top": "5",
        "$orderby": "receivedDateTime desc",
        "$select": "subject,from,receivedDateTime,body"
    })
    data, _ = api_get(config, "/me/messages?" + params)
    
    # Known CSS/template noise codes to filter out
    noise = {'000000', '000001', '003152', '173966'}
    
    for m in data.get("value", []):
        frm = m["from"]["emailAddress"]["address"]
        subj = m["subject"]
        
        # Filter by sender if specified
        if sender_filter and sender_filter.lower() not in frm.lower():
            continue
        
        # Look for verification-related emails
        if not any(kw in subj.lower() for kw in ['code', 'passcode', 'verification', 'verify', '验证']):
            continue
        
        body = m["body"]["content"]
        all_codes = re.findall(r'\b(\d{4,8})\b', body)
        # Filter noise and find unique real code
        real_codes = [c for c in all_codes if c not in noise and len(c) >= 4]
        
        # Deduplicate while preserving order
        seen = set()
        unique_codes = []
        for c in real_codes:
            if c not in seen:
                seen.add(c)
                unique_codes.append(c)
        
        if unique_codes:
            print(json.dumps({
                "code": unique_codes[0],
                "all_codes": unique_codes[:3],
                "from": frm,
                "subject": subj,
                "time": m["receivedDateTime"]
            }, ensure_ascii=False))
            return
    
    print(json.dumps({"error": "No verification code found"}))

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "latest"
    
    if cmd == "latest":
        n = int(sys.argv[2]) if len(sys.argv) > 2 else 5
        get_latest_emails(n)
    elif cmd == "code":
        sender = sys.argv[2] if len(sys.argv) > 2 else None
        get_verification_code(sender)
    elif cmd == "search":
        query = sys.argv[2] if len(sys.argv) > 2 else ""
        get_latest_emails(10)  # simplified search
    else:
        print(__doc__)
