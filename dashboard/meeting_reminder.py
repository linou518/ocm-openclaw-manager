#!/usr/bin/env python3
"""Check upcoming meetings and trigger reminders via OpenClaw cron wake."""
import json, os, sys, urllib.request, urllib.parse
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(__file__))
from ms_graph import list_events

REMINDER_STATE = os.path.expanduser("~/.openclaw/dashboard/reminder_state.json")
GATEWAY_URL = "http://localhost:18789"
GATEWAY_TOKEN = None

def get_gateway_token():
    """Read gateway token from openclaw config."""
    cfg_path = os.path.expanduser("~/.openclaw/openclaw.json")
    with open(cfg_path) as f:
        cfg = json.load(f)
    return cfg.get('gateway', {}).get('auth', {}).get('token', '')

def load_state():
    try:
        with open(REMINDER_STATE) as f:
            return json.load(f)
    except:
        return {"reminded": []}

def save_state(state):
    with open(REMINDER_STATE, 'w') as f:
        json.dump(state, f)

def send_wake(text):
    """Send a wake event to the gateway."""
    token = get_gateway_token()
    data = json.dumps({
        "jsonrpc": "2.0",
        "method": "cron.wake",
        "params": {"text": text, "mode": "now"},
        "id": 1
    }).encode()
    req = urllib.request.Request(
        f"{GATEWAY_URL}/rpc",
        data=data,
        method='POST',
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {token}'
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())
    except Exception as e:
        print(f"Wake error: {e}")
        # Fallback: write to a file that heartbeat can pick up
        return None

def main():
    now = datetime.now()
    today_str = now.strftime('%Y-%m-%d')
    
    # Reset state at midnight
    state = load_state()
    if state.get('date') != today_str:
        state = {"date": today_str, "reminded": []}
    
    # Fetch today's events
    try:
        events = list_events()
    except Exception as e:
        print(f"Calendar error: {e}")
        return
    
    for e in events:
        event_id = e.get('id', '')[:40]
        subject = e.get('subject', '')
        start_utc = e['start']['dateTime']
        
        # Parse UTC time, add 9h for JST
        start_dt = datetime.fromisoformat(start_utc.replace('Z', '+00:00'))
        start_jst = start_dt + timedelta(hours=9)
        
        # Check if meeting is 5 minutes away
        diff = (start_jst - now).total_seconds()
        
        if 0 < diff <= 300 and event_id not in state['reminded']:  # Within 5 minutes
            minutes = max(1, int(diff / 60))
            reminder_text = f"⏰ 会议提醒：{subject}\n🕐 {start_jst.strftime('%H:%M')} 开始（{minutes}分钟后）"
            
            print(f"Sending reminder: {subject} at {start_jst.strftime('%H:%M')}")
            
            # Write reminder to a trigger file for the gateway
            trigger_path = os.path.expanduser("~/.openclaw/dashboard/pending_reminder.txt")
            with open(trigger_path, 'w') as f:
                f.write(reminder_text)
            
            state['reminded'].append(event_id)
            save_state(state)
    
    # Clean up old reminded entries (keep only today)
    save_state(state)

if __name__ == '__main__':
    main()
