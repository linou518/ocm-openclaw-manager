#!/usr/bin/env python3
"""Dashboard API server - serves static files + task management + schedule API."""
import json, re, os, glob
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory

app = Flask(__name__, static_folder='.', static_url_path='')
TASKS_DIR = os.path.expanduser("~/.openclaw/tasks/projects")

# Import schedule engine
import schedule_engine

# --- Static files ---
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('.', path)

# --- API: Toggle task done/undone ---
@app.route('/api/task/toggle', methods=['POST'])
def toggle_task():
    data = request.json
    pid = data.get('project')
    idx = data.get('taskIndex')
    filepath = os.path.join(TASKS_DIR, f"{pid}.md")
    if not os.path.exists(filepath):
        return jsonify({"error": "project not found"}), 404

    with open(filepath, 'r') as f:
        lines = f.readlines()

    task_count = 0
    for i, line in enumerate(lines):
        m = re.match(r'^(- \[)([ x])(\] .+)$', line.rstrip('\n'))
        if m:
            if task_count == idx:
                new_state = ' ' if m.group(2) == 'x' else 'x'
                rest = m.group(3)
                if new_state == 'x':
                    today = datetime.now().strftime('%Y-%m-%d')
                    if 'done:' not in rest:
                        rest = rest.rstrip() + f' | done:{today}'
                else:
                    rest = re.sub(r'\s*\|\s*done:\S+', '', rest)
                lines[i] = f"{m.group(1)}{new_state}{rest}\n"
                break
            task_count += 1

    with open(filepath, 'w') as f:
        f.writelines(lines)

    _regenerate()
    return jsonify({"ok": True})

# --- API: Add new task ---
@app.route('/api/task/add', methods=['POST'])
def add_task():
    data = request.json
    pid = data.get('project')
    title = data.get('title', '').strip()
    priority = data.get('priority', '')
    due = data.get('due', '')
    if not pid or not title:
        return jsonify({"error": "project and title required"}), 400

    filepath = os.path.join(TASKS_DIR, f"{pid}.md")
    if not os.path.exists(filepath):
        return jsonify({"error": "project not found"}), 404

    parts = [title]
    if priority:
        parts.append(priority)
    if due:
        parts.append(f"due:{due}")
    task_line = f"- [ ] {' | '.join(parts)}\n"

    with open(filepath, 'r') as f:
        content = f.read()

    lines = content.split('\n')
    insert_idx = None
    in_todo = False
    for i, line in enumerate(lines):
        if '待开始' in line:
            in_todo = True
            continue
        if in_todo:
            if not line.strip().startswith('- [') and line.strip() != '':
                insert_idx = i
                in_todo = False
                break
            if line.strip() == '' and i > 0:
                insert_idx = i
                break

    if insert_idx is None:
        for i, line in enumerate(lines):
            if '已完成' in line:
                insert_idx = i
                break
        if insert_idx is None:
            insert_idx = len(lines)

    lines.insert(insert_idx, task_line.rstrip('\n'))
    with open(filepath, 'w') as f:
        f.write('\n'.join(lines))

    _regenerate()
    return jsonify({"ok": True})

# --- Schedule APIs ---
@app.route('/api/schedule/generate', methods=['POST'])
def api_schedule_generate():
    schedule = schedule_engine.generate_schedule()
    return jsonify({"ok": True, "blocks": len(schedule["blocks"])})

@app.route('/api/schedule/today')
def api_schedule_today():
    path = os.path.expanduser("~/.openclaw/dashboard/schedule.json")
    if not os.path.exists(path):
        return jsonify({"error": "no schedule, POST /api/schedule/generate first"}), 404
    with open(path) as f:
        return jsonify(json.load(f))

@app.route('/api/schedule/done', methods=['POST'])
def api_schedule_done():
    data = request.json
    result = schedule_engine.mark_done(data.get("blockId", ""))
    if result["ok"]:
        _regenerate()
    return jsonify(result)

@app.route('/api/schedule/defer', methods=['POST'])
def api_schedule_defer():
    data = request.json
    result = schedule_engine.mark_deferred(data.get("blockId", ""))
    return jsonify(result)

@app.route('/api/schedule/check')
def api_schedule_check():
    reminders = schedule_engine.check_reminders()
    return jsonify({"reminders": reminders})

def _regenerate():
    import subprocess
    subprocess.run(
        ['python3', os.path.join(os.path.dirname(__file__), 'generate.py')],
        capture_output=True, timeout=30
    )

# --- API: Family Anniversaries ---
FAMILY_FILE = os.path.join(os.path.dirname(__file__), 'family.json')

def _load_family():
    if not os.path.exists(FAMILY_FILE):
        return {"members": [], "anniversaries": [], "gifts": []}
    with open(FAMILY_FILE) as f:
        return json.load(f)

def _save_family(data):
    with open(FAMILY_FILE, 'w') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

@app.route('/api/family')
def family_get():
    data = _load_family()
    today = datetime.now()
    year = today.year

    def days_until(md):
        m, d = map(int, md.split('-'))
        target = datetime(year, m, d)
        if target.date() < today.date():
            target = datetime(year + 1, m, d)
        return (target.date() - today.date()).days

    for member in data.get('members', []):
        member['daysUntil'] = days_until(member['birthday'])
    for ann in data.get('anniversaries', []):
        ann['daysUntil'] = days_until(ann['date'])

    upcoming = sorted(
        [{'type': 'birthday', 'name': m['name'], 'emoji': m['emoji'], 'date': m['birthday'], 'days': m['daysUntil'], 'info': f"{m['age']+1}岁"} for m in data['members']] +
        [{'type': 'anniversary', 'name': a['name'], 'emoji': a['emoji'], 'date': a['date'], 'days': a['daysUntil'], 'info': f"{a['years']+1}周年"} for a in data['anniversaries']],
        key=lambda x: x['days']
    )
    data['upcoming'] = upcoming
    return jsonify(data)

@app.route('/api/family/gift', methods=['POST'])
def family_gift():
    data = _load_family()
    gift = request.json
    gift['updatedAt'] = datetime.now().isoformat()
    existing = next((g for g in data['gifts'] if g.get('event') == gift.get('event') and g.get('item') == gift.get('item')), None)
    if existing:
        existing.update(gift)
    else:
        data['gifts'].append(gift)
    _save_family(data)
    return jsonify({"ok": True})

@app.route('/api/family/gift/delete', methods=['POST'])
def family_gift_delete():
    data = _load_family()
    req = request.json
    data['gifts'] = [g for g in data['gifts'] if not (g.get('event') == req.get('event') and g.get('item') == req.get('item'))]
    _save_family(data)
    return jsonify({"ok": True})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8090, debug=False)
