import os
#!/usr/bin/env python3
"""Microsoft Graph Calendar API - read/write events."""
import json, urllib.request, urllib.parse, sys
from datetime import datetime, timedelta

CONFIG_PATH = "/home/linou/.openclaw/dashboard/ms_calendar.json"
CLIENT_SECRET = os.environ.get("MS_CLIENT_SECRET", "")
TOKEN_URL = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token"
IS_PUBLIC_CLIENT = True
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
    if not IS_PUBLIC_CLIENT:
        params['client_secret'] = CLIENT_SECRET
    data = urllib.parse.urlencode(params).encode()
    req = urllib.request.Request(TOKEN_URL, data=data, method='POST')
    req.add_header('Content-Type', 'application/x-www-form-urlencoded')
    with urllib.request.urlopen(req) as resp:
        tokens = json.loads(resp.read())
    config['tokens']['access_token'] = tokens['access_token']
    if 'refresh_token' in tokens:
        config['tokens']['refresh_token'] = tokens['refresh_token']
    config['tokens']['expires_in'] = tokens.get('expires_in', 3600)
    save_config(config)
    return config

def api_call(config, method, path, body=None, retry=True):
    url = f"{GRAPH_URL}{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header('Authorization', f"Bearer {config['tokens']['access_token']}")
    req.add_header("Prefer", "outlook.timezone=\"Asia/Tokyo\"")
    req.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req) as resp:
            if resp.status == 204:
                return {}
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        if e.code == 401 and retry:
            config = refresh_token(config)
            return api_call(config, method, path, body, retry=False)
        raise

def list_events(start_date=None, end_date=None):
    """List calendar events for a date range."""
    config = load_config()
    if not start_date:
        start_date = datetime.now().strftime('%Y-%m-%dT00:00:00')
    if not end_date:
        end_date = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%dT00:00:00')
    
    params = urllib.parse.urlencode({
        'startDateTime': start_date,
        'endDateTime': end_date,
        '$orderby': 'start/dateTime',
        '$top': 50,
    })
    result = api_call(config, 'GET', f'/me/calendarview?{params}')
    return result.get('value', [])

def create_event(subject, start, end, body_text="", location="", is_all_day=False):
    """Create a new calendar event."""
    config = load_config()
    event = {
        "subject": subject,
        "start": {
            "dateTime": start,
            "timeZone": "Asia/Tokyo"
        },
        "end": {
            "dateTime": end,
            "timeZone": "Asia/Tokyo"
        },
        "isAllDay": is_all_day,
    }
    if body_text:
        event["body"] = {"contentType": "text", "content": body_text}
    if location:
        event["location"] = {"displayName": location}
    
    return api_call(config, 'POST', '/me/events', event)

def delete_event(event_id):
    """Delete a calendar event."""
    config = load_config()
    return api_call(config, 'DELETE', f'/me/events/{event_id}')

def update_event(event_id, updates):
    """Update a calendar event."""
    config = load_config()
    return api_call(config, 'PATCH', f'/me/events/{event_id}', updates)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: ms_graph.py [list|create|delete]")
        sys.exit(1)
    
    cmd = sys.argv[1]
    
    if cmd == 'list':
        events = list_events()
        print(f"Found {len(events)} events for today:")
        for e in events:
            start = e['start']['dateTime'][:16].replace('T', ' ')
            end = e['end']['dateTime'][11:16]
            print(f"  {start}-{end} | {e['subject']} | id:{e['id'][:20]}...")
    
    elif cmd == 'create':
        if len(sys.argv) < 5:
            print("Usage: ms_graph.py create 'Subject' '2026-02-09T10:00:00' '2026-02-09T11:00:00' ['body'] ['location']")
            sys.exit(1)
        result = create_event(
            subject=sys.argv[2],
            start=sys.argv[3],
            end=sys.argv[4],
            body_text=sys.argv[5] if len(sys.argv) > 5 else "",
            location=sys.argv[6] if len(sys.argv) > 6 else "",
        )
        print(f"✅ Created: {result.get('subject')} (id: {result.get('id', '')[:20]}...)")
    
    elif cmd == 'delete':
        if len(sys.argv) < 3:
            print("Usage: ms_graph.py delete <event_id>")
            sys.exit(1)
        delete_event(sys.argv[2])
        print("✅ Deleted")
    
    else:
        print(f"Unknown command: {cmd}")
