#!/usr/bin/env python3
"""Generate meeting reminders as OpenClaw cron jobs for today."""
import json, os, sys, urllib.request
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(__file__))
from ms_graph import list_events

GATEWAY_URL = "http://localhost:18789"
STATE_FILE = os.path.expanduser("~/.openclaw/dashboard/reminder_jobs.json")

def get_gateway_token():
    cfg_path = os.path.expanduser("~/.openclaw/openclaw.json")
    with open(cfg_path) as f:
        cfg = json.load(f)
    return cfg.get('gateway', {}).get('auth', {}).get('token', '')

def rpc_call(method, params):
    token = get_gateway_token()
    data = json.dumps({"jsonrpc": "2.0", "method": method, "params": params, "id": 1}).encode()
    req = urllib.request.Request(f"{GATEWAY_URL}/rpc", data=data, method='POST',
        headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'})
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read())

def load_state():
    try:
        with open(STATE_FILE) as f:
            return json.load(f)
    except:
        return {"date": "", "jobIds": []}

def save_state(state):
    with open(STATE_FILE, 'w') as f:
        json.dump(state, f, indent=2)

def main():
    now = datetime.now()
    today_str = now.strftime('%Y-%m-%d')
    state = load_state()

    # Clean up yesterday's reminder jobs
    if state.get('date') != today_str:
        for job_id in state.get('jobIds', []):
            try:
                rpc_call('cron.remove', {'jobId': job_id})
                print(f"Removed old job: {job_id}")
            except:
                pass
        state = {"date": today_str, "jobIds": []}

    # Fetch today's events
    events = list_events()
    created = 0

    for e in events:
        subject = e.get('subject', '')
        start_utc = e['start']['dateTime']
        start_dt = datetime.fromisoformat(start_utc.replace('Z', '+00:00'))
        start_jst = start_dt + timedelta(hours=9)
        
        # Reminder time = 5 minutes before
        reminder_time = start_jst - timedelta(minutes=5)
        
        # Skip if already past
        if reminder_time <= now:
            continue

        # Check if already scheduled
        event_key = f"{subject}_{start_jst.strftime('%H%M')}"
        if event_key in [j.get('key') for j in state.get('jobs', [])]:
            continue

        reminder_text = f"⏰ 会议提醒：{subject}\n🕐 {start_jst.strftime('%H:%M')} 开始（5分钟后）\n请准备好相关资料。"
        
        # Create one-shot cron job
        result = rpc_call('cron.add', {
            'job': {
                'name': f"会议提醒: {subject}",
                'schedule': {
                    'kind': 'at',
                    'at': reminder_time.strftime('%Y-%m-%dT%H:%M:00+09:00')
                },
                'sessionTarget': 'main',
                'payload': {
                    'kind': 'systemEvent',
                    'text': f"[会议提醒] 请立即通过 Telegram 提醒 Linou：{reminder_text}"
                },
                'enabled': True
            }
        })
        
        job_id = result.get('result', {}).get('id', '')
        if job_id:
            state.setdefault('jobs', []).append({'key': event_key, 'id': job_id})
            state['jobIds'].append(job_id)
            created += 1
            print(f"  ⏰ {reminder_time.strftime('%H:%M')} → {subject}")

    save_state(state)
    print(f"Scheduled {created} meeting reminders for today")

if __name__ == '__main__':
    main()
