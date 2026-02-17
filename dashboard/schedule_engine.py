#!/usr/bin/env python3
"""Schedule engine: generate daily timeline, check reminders, handle actions."""
import json, os, sys, re
from datetime import datetime, date, timedelta

TASKS_JSON = os.path.expanduser("~/.openclaw/dashboard/tasks.json")
SCHEDULE_JSON = os.path.expanduser("~/.openclaw/dashboard/schedule.json")
TASKS_DIR = os.path.expanduser("~/.openclaw/tasks/projects")

TL_START = 5 * 60   # 5:00
TL_END = 18 * 60    # 18:00

FIXED_BLOCKS = [
    {"start": 420, "end": 510, "label": "🚸 送孩子上学", "type": "fixed"},
    {"start": 1080, "end": 1140, "label": "📝 辅导作业", "type": "fixed"},
]

# Lunch break added dynamically - skipped if meeting occupies 12:00-13:00
LUNCH_START = 720
LUNCH_END = 780

def time_to_min(t):
    h, m = map(int, t.split(':'))
    return h * 60 + m

def min_to_time(m):
    return f"{m // 60:02d}:{m % 60:02d}"

def load_tasks_json():
    with open(TASKS_JSON) as f:
        return json.load(f)

def generate_schedule():
    """Generate today's schedule from tasks.json."""
    data = load_tasks_json()
    blocks = []

    # 1. Fixed blocks
    for fb in FIXED_BLOCKS:
        blocks.append({
            "start": min_to_time(fb["start"]),
            "end": min_to_time(fb["end"]),
            "label": fb["label"],
            "type": fb["type"],
            "id": f"fixed-{fb['start']}",
            "status": "pending"
        })

    # 2. Meetings
    for i, m in enumerate(data.get("meetings", [])):
        blocks.append({
            "start": m["time"],
            "end": m["endTime"],
            "label": f"📅 {m['title']}",
            "type": "meeting",
            "id": f"meeting-{i}",
            "status": "pending"
        })

    # 3. Collect active tasks
    task_queue = []
    for p in data.get("projects", []):
        for ti, t in enumerate(p["tasks"]):
            if not t.get("done"):
                pri = {"P1": 0, "P2": 1, "P3": 2}.get(t.get("priority", ""), 3)
                task_queue.append({
                    "title": t["title"],
                    "project_id": p["id"],
                    "project_emoji": p.get("emoji", "📁"),
                    "project_name": p.get("name", p["id"]),
                    "priority": t.get("priority", ""),
                    "pri_order": pri,
                    "due": t.get("due", ""),
                    "task_index": ti,
                })
    task_queue.sort(key=lambda x: (x["pri_order"], x.get("due") or "9999"))

    # 4. Find free slots
    occupied = []
    for b in blocks:
        occupied.append((time_to_min(b["start"]), time_to_min(b["end"])))
    occupied.sort()

    free_slots = []
    cursor = TL_START
    for s, e in occupied:
        if cursor < s:
            free_slots.append((cursor, s))
        cursor = max(cursor, e)
    if cursor < TL_END:
        free_slots.append((cursor, TL_END))

    # 4b. Add lunch break if no meeting at 12:00-13:00
    lunch_conflict = any(
        time_to_min(b["start"]) < LUNCH_END and time_to_min(b["end"]) > LUNCH_START
        for b in blocks if b["type"] == "meeting"
    )
    if not lunch_conflict:
        blocks.append({
            "start": min_to_time(LUNCH_START),
            "end": min_to_time(LUNCH_END),
            "label": "🍱 午休",
            "type": "break",
            "id": "fixed-720",
            "status": "pending"
        })

    # 5. Insert 10-min breaks after meetings
    meeting_blocks = [b for b in blocks if b["type"] == "meeting"]
    for mb in meeting_blocks:
        mb_end = time_to_min(mb["end"])
        # Check if next block starts right after (no room for break)
        has_conflict = any(
            time_to_min(b["start"]) < mb_end + 10 and time_to_min(b["start"]) >= mb_end
            for b in blocks if b != mb
        )
        if not has_conflict and mb_end + 10 <= TL_END:
            blocks.append({
                "start": min_to_time(mb_end),
                "end": min_to_time(mb_end + 10),
                "label": "☕ 休息",
                "type": "break",
                "id": f"break-after-{mb['id']}",
                "status": "pending"
            })

    # Recalculate free slots with breaks included
    occupied = []
    for b in blocks:
        occupied.append((time_to_min(b["start"]), time_to_min(b["end"])))
    occupied.sort()

    free_slots = []
    cursor = TL_START
    for s, e in occupied:
        if cursor < s:
            free_slots.append((cursor, s))
        cursor = max(cursor, e)
    if cursor < TL_END:
        free_slots.append((cursor, TL_END))

    # 6. Fill tasks into free slots with 10-min break every 60 min of work
    task_idx = 0
    work_since_break = 0  # minutes of continuous work
    for slot_s, slot_e in free_slots:
        cursor = slot_s
        work_since_break = 0  # reset after each occupied block (meeting/break)
        while cursor < slot_e and task_idx < len(task_queue):
            # If worked 60 min, insert a break
            if work_since_break >= 60:
                if cursor + 10 <= slot_e:
                    blocks.append({
                        "start": min_to_time(cursor),
                        "end": min_to_time(cursor + 10),
                        "label": "☕ 休息",
                        "type": "break",
                        "id": f"break-work-{cursor}",
                        "status": "pending"
                    })
                    cursor += 10
                    work_since_break = 0
                    continue

            remaining = slot_e - cursor
            if remaining < 30:
                break
            # Cap at 60 - work_since_break to ensure break at 60 min
            max_work = 60 - work_since_break
            duration = min(60 if remaining >= 60 else 30, remaining, max_work if max_work >= 30 else 60)
            if duration < 30:
                # Not enough room before break, just take a break now
                if cursor + 10 <= slot_e:
                    blocks.append({
                        "start": min_to_time(cursor),
                        "end": min_to_time(cursor + 10),
                        "label": "☕ 休息",
                        "type": "break",
                        "id": f"break-work-{cursor}",
                        "status": "pending"
                    })
                    cursor += 10
                    work_since_break = 0
                    continue
                else:
                    break

            t = task_queue[task_idx]
            blocks.append({
                "start": min_to_time(cursor),
                "end": min_to_time(cursor + duration),
                "label": f"{t['project_emoji']} {t['title']}",
                "type": "task",
                "id": f"task-{t['project_id']}-{t['task_index']}",
                "project_id": t["project_id"],
                "task_index": t["task_index"],
                "priority": t["priority"],
                "status": "pending"
            })
            work_since_break += duration
            cursor += duration
            task_idx += 1

    # Sort by start time
    blocks.sort(key=lambda b: time_to_min(b["start"]))

    schedule = {
        "date": date.today().isoformat(),
        "generatedAt": datetime.now().isoformat(),
        "blocks": blocks,
        "reminders_sent": {},  # track which blocks already got reminders
    }

    with open(SCHEDULE_JSON, 'w') as f:
        json.dump(schedule, f, ensure_ascii=False, indent=2)

    print(f"Generated schedule: {len(blocks)} blocks ({len([b for b in blocks if b['type']=='task'])} tasks, "
          f"{len([b for b in blocks if b['type']=='meeting'])} meetings)")
    return schedule

def check_reminders():
    """Check which blocks need reminders now. Returns list of blocks to remind."""
    if not os.path.exists(SCHEDULE_JSON):
        return []

    with open(SCHEDULE_JSON) as f:
        schedule = json.load(f)

    if schedule.get("date") != date.today().isoformat():
        return []  # stale schedule

    now = datetime.now()
    now_min = now.hour * 60 + now.minute
    reminders = []

    for block in schedule["blocks"]:
        bid = block["id"]
        if block["status"] in ("done", "deferred"):
            continue
        if bid in schedule.get("reminders_sent", {}):
            continue

        block_start = time_to_min(block["start"])
        # Remind 5 minutes before start
        if now_min >= block_start - 5 and now_min <= block_start + 5:
            reminders.append(block)
            schedule.setdefault("reminders_sent", {})[bid] = datetime.now().isoformat()

    # Save updated reminders_sent
    with open(SCHEDULE_JSON, 'w') as f:
        json.dump(schedule, f, ensure_ascii=False, indent=2)

    return reminders

def mark_done(block_id):
    """Mark a schedule block as done. If it's a task, also toggle in task file."""
    if not os.path.exists(SCHEDULE_JSON):
        return {"ok": False, "error": "no schedule"}

    with open(SCHEDULE_JSON) as f:
        schedule = json.load(f)

    for block in schedule["blocks"]:
        if block["id"] == block_id:
            block["status"] = "done"
            # If it's a task, mark it done in the project file
            if block["type"] == "task" and "project_id" in block:
                _toggle_task_in_file(block["project_id"], block["task_index"])
            break
    else:
        return {"ok": False, "error": "block not found"}

    with open(SCHEDULE_JSON, 'w') as f:
        json.dump(schedule, f, ensure_ascii=False, indent=2)

    return {"ok": True, "action": "done", "block_id": block_id}

def mark_deferred(block_id):
    """Mark a schedule block as deferred (will appear in tomorrow's schedule)."""
    if not os.path.exists(SCHEDULE_JSON):
        return {"ok": False, "error": "no schedule"}

    with open(SCHEDULE_JSON) as f:
        schedule = json.load(f)

    for block in schedule["blocks"]:
        if block["id"] == block_id:
            block["status"] = "deferred"
            break
    else:
        return {"ok": False, "error": "block not found"}

    with open(SCHEDULE_JSON, 'w') as f:
        json.dump(schedule, f, ensure_ascii=False, indent=2)

    return {"ok": True, "action": "deferred", "block_id": block_id}


def mark_start(block_id):
    """Mark a schedule block as in-progress."""
    if not os.path.exists(SCHEDULE_JSON):
        return {"ok": False, "error": "no schedule"}

    with open(SCHEDULE_JSON) as f:
        schedule = json.load(f)

    for block in schedule["blocks"]:
        if block["id"] == block_id:
            block["status"] = "in_progress"
            block["startedAt"] = datetime.now().isoformat()
            break
    else:
        return {"ok": False, "error": "block not found"}

    with open(SCHEDULE_JSON, 'w') as f:
        json.dump(schedule, f, ensure_ascii=False, indent=2)

    return {"ok": True, "action": "start", "block_id": block_id}


def mark_ack(block_id):
    """Mark a meeting as acknowledged (no further reminders)."""
    if not os.path.exists(SCHEDULE_JSON):
        return {"ok": False, "error": "no schedule"}

    with open(SCHEDULE_JSON) as f:
        schedule = json.load(f)

    for block in schedule["blocks"]:
        if block["id"] == block_id:
            block["status"] = "acknowledged"
            block["ackedAt"] = datetime.now().isoformat()
            break
    else:
        return {"ok": False, "error": "block not found"}

    with open(SCHEDULE_JSON, 'w') as f:
        json.dump(schedule, f, ensure_ascii=False, indent=2)

    return {"ok": True, "action": "ack", "block_id": block_id}

def _toggle_task_in_file(project_id, task_index):
    """Toggle task done status in the project markdown file."""
    filepath = os.path.join(TASKS_DIR, f"{project_id}.md")
    if not os.path.exists(filepath):
        return

    with open(filepath, 'r') as f:
        lines = f.readlines()

    task_count = 0
    for i, line in enumerate(lines):
        m = re.match(r'^(- \[)([ x])(\] .+)$', line.rstrip('\n'))
        if m:
            if task_count == task_index:
                today_str = date.today().isoformat()
                rest = m.group(3)
                if 'done:' not in rest:
                    rest = rest.rstrip() + f' | done:{today_str}'
                lines[i] = f"{m.group(1)}x{rest}\n"
                break
            task_count += 1

    with open(filepath, 'w') as f:
        f.writelines(lines)

    # Regenerate tasks.json
    import subprocess
    subprocess.run(
        ['python3', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'dashboard', 'generate.py')],
        capture_output=True, timeout=30,
        cwd=os.path.expanduser("~/.openclaw/dashboard")
    )

def get_schedule_summary():
    """Get a summary of today's schedule for display."""
    if not os.path.exists(SCHEDULE_JSON):
        return "无排程"

    with open(SCHEDULE_JSON) as f:
        schedule = json.load(f)

    if schedule.get("date") != date.today().isoformat():
        return "排程已过期"

    blocks = schedule["blocks"]
    done = len([b for b in blocks if b["status"] == "done"])
    pending = len([b for b in blocks if b["status"] == "pending" and b["type"] in ("task", "meeting")])
    deferred = len([b for b in blocks if b["status"] == "deferred"])

    return f"✅ {done} 完成 | ⏳ {pending} 待做 | ⏰ {deferred} 延迟"


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: schedule_engine.py [generate|check|done <id>|defer <id>|start <id>|ack <id>|summary]")
        sys.exit(1)

    cmd = sys.argv[1]
    if cmd == "generate":
        generate_schedule()
    elif cmd == "check":
        reminders = check_reminders()
        for r in reminders:
            print(json.dumps(r, ensure_ascii=False))
    elif cmd == "done" and len(sys.argv) > 2:
        print(json.dumps(mark_done(sys.argv[2]), ensure_ascii=False))
    elif cmd == "defer" and len(sys.argv) > 2:
        print(json.dumps(mark_deferred(sys.argv[2]), ensure_ascii=False))
    elif cmd == "start" and len(sys.argv) > 2:
        print(json.dumps(mark_start(sys.argv[2]), ensure_ascii=False))
    elif cmd == "ack" and len(sys.argv) > 2:
        print(json.dumps(mark_ack(sys.argv[2]), ensure_ascii=False))
    elif cmd == "summary":
        print(get_schedule_summary())
    else:
        print(f"Unknown: {cmd}")
