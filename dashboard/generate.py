#!/usr/bin/env python3
"""Parse task markdown + MS Graph Calendar and generate tasks.json for dashboard."""
import json, re, glob, os, sys
from datetime import date, datetime, timedelta

sys.path.insert(0, os.path.dirname(__file__))
from ms_graph import list_events

TASKS_DIR = os.path.expanduser("~/.openclaw/tasks/projects")
OUTPUT = os.path.expanduser("~/.openclaw/dashboard/tasks.json")

PROJECT_META = {
    "royal": {"name": "Royal 数据平台", "emoji": "🚀"},
    "docomo": {"name": "Docomo 項目", "emoji": "🔧"},
    "laboro": {"name": "Laboro", "emoji": "🧪"},
    "nobdata": {"name": "Nobdata", "emoji": "📊"},
    "flect": {"name": "Flect", "emoji": "⚡"},
    "mcd-3": {"name": "MCD-3", "emoji": "☁️"},
    "personal": {"name": "个人事務", "emoji": "🏠"},
}

JST_OFFSET = timedelta(hours=9)

def parse_tasks(filepath):
    tasks = []
    current_status = None
    with open(filepath, 'r') as f:
        for line in f:
            line = line.strip()
            if '进行中' in line: current_status = 'doing'
            elif '待开始' in line: current_status = 'todo'
            elif '已完成' in line: current_status = 'done'
            m = re.match(r'- \[([ x])\] (.+)', line)
            if m:
                done = m.group(1) == 'x'
                parts = [p.strip() for p in m.group(2).split('|')]
                title = parts[0]
                priority = next((p for p in parts if p in ('P1','P2','P3')), None)
                due_m = next((re.search(r'due:(\S+)', p) for p in parts if 'due:' in p), None)
                due = due_m.group(1) if due_m else None
                assignee_m = next((re.search(r'@(\S+)', p) for p in parts if '@' in p), None)
                assignee = assignee_m.group(1) if assignee_m else None
                done_m = next((re.search(r'done:(\S+)', p) for p in parts if 'done:' in p), None)
                tasks.append({
                    "title": title, "done": done,
                    "status": "done" if done else (current_status or "todo"),
                    "priority": priority, "due": due,
                    "assignee": assignee,
                    "doneDate": done_m.group(1) if done_m else None,
                })
    return tasks

def utc_to_jst(dt_str):
    """Convert UTC datetime string to JST."""
    dt = datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
    jst = dt + JST_OFFSET
    return jst

def main():
    today = date.today()

    # Parse tasks
    projects = []
    for f in sorted(glob.glob(os.path.join(TASKS_DIR, "*.md"))):
        name = os.path.splitext(os.path.basename(f))[0]
        meta = PROJECT_META.get(name, {"name": name, "emoji": "📁"})
        tasks = parse_tasks(f)
        projects.append({"id": name, **meta, "tasks": tasks})

    # Fetch calendar events via Graph API
    print("Fetching calendar via Microsoft Graph API...")
    try:
        events = list_events()
        print(f"  Found {len(events)} events for today")
    except Exception as e:
        print(f"  Calendar fetch error: {e}")
        events = []

    all_meetings = []
    for e in events:
        # API returns JST already (Prefer: outlook.timezone="Asia/Tokyo")
        start_dt = datetime.fromisoformat(e['start']['dateTime'][:19])
        end_dt = datetime.fromisoformat(e['end']['dateTime'][:19])
        duration_min = int((end_dt - start_dt).total_seconds() / 60)

        all_meetings.append({
            "time": start_dt.strftime('%H:%M'),
            "endTime": end_dt.strftime('%H:%M'),
            "title": e.get('subject', '(No title)'),
            "duration": f"{duration_min}min",
            "location": e.get('location', {}).get('displayName', ''),
            "id": e.get('id', ''),
            "calendar": "Hotmail",
        })

    all_meetings.sort(key=lambda e: e['time'])

    # Build timeline
    timeline = [{"time": "04:30", "desc": "起床・开始工作", "project": ""}]
    for m in all_meetings:
        timeline.append({
            "time": m['time'],
            "desc": m['title'],
            "project": m.get('calendar', ''),
        })
    timeline.append({"time": "21:00", "desc": "休息", "project": ""})
    seen = set()
    unique_timeline = []
    for t in timeline:
        key = t['time'] + t['desc']
        if key not in seen:
            seen.add(key)
            unique_timeline.append(t)
    unique_timeline.sort(key=lambda t: t['time'])

    data = {
        "date": today.isoformat(),
        "generatedAt": datetime.now().isoformat(),
        "projects": projects,
        "meetings": all_meetings,
        "timeline": unique_timeline,
    }

    with open(OUTPUT, 'w') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Generated {OUTPUT} with {len(all_meetings)} meetings")

if __name__ == '__main__':
    main()
