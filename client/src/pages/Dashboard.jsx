import React, { useState, useEffect, useCallback } from 'react';

const PRIORITY_COLORS = { P1: 'bg-red-500', P2: 'bg-yellow-500', P3: 'bg-blue-500' };
const BLOCK_COLORS = { meeting: 'bg-purple-500/30 border-purple-500/50', task: 'bg-blue-500/30 border-blue-500/50', fixed: 'bg-gray-500/30 border-gray-500/50', break: 'bg-green-500/30 border-green-500/50' };

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const weekdays = ['日','月','火','水','木','金','土'];
  return (
    <div className="text-right">
      <div className="text-2xl font-bold text-white font-mono">{now.toLocaleTimeString('ja-JP',{hour12:false})}</div>
      <div className="text-sm text-gray-400">{now.getFullYear()}/{String(now.getMonth()+1).padStart(2,'0')}/{String(now.getDate()).padStart(2,'0')} ({weekdays[now.getDay()]})</div>
    </div>
  );
}

function Timeline({ scheduleBlocks, meetings }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);
  
  const START_HOUR = 5, END_HOUR = 18, TOTAL_MINS = (END_HOUR - START_HOUR) * 60;
  const toPercent = (h, m) => Math.max(0, Math.min(100, ((h * 60 + m) - START_HOUR * 60) / TOTAL_MINS * 100));
  const nowPercent = toPercent(now.getHours(), now.getMinutes());
  
  const isWeekday = now.getDay() >= 1 && now.getDay() <= 5;
  const fixedBlocks = isWeekday ? [
    { start: '07:00', end: '08:30', label: '🚸 送孩子上学', type: 'fixed' },
    { start: '12:00', end: '13:00', label: '🍱 午休', type: 'break' }
  ] : [];
  
  const meetingBlocks = (meetings || []).map(m => ({
    start: m.time, end: m.endTime || m.time, label: `📅 ${m.title}`, type: 'meeting'
  }));
  
  const allBlocks = [...fixedBlocks, ...(scheduleBlocks || []), ...meetingBlocks];
  
  const parseTime = (t) => { const [h,m] = t.split(':').map(Number); return { h, m }; };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
      <h3 className="text-sm font-medium text-gray-400 mb-3">📅 今日タイムライン</h3>
      <div className="relative h-16 bg-gray-950 rounded-lg overflow-hidden">
        {/* Hour markers */}
        {Array.from({length: END_HOUR - START_HOUR + 1}, (_, i) => i + START_HOUR).map(h => (
          <div key={h} className="absolute top-0 bottom-0 border-l border-gray-800" style={{left: `${toPercent(h,0)}%`}}>
            <span className="absolute -top-0.5 -translate-x-1/2 text-[9px] text-gray-600">{h}</span>
          </div>
        ))}
        {/* Blocks */}
        {allBlocks.map((b, i) => {
          const s = parseTime(b.start), e = parseTime(b.end);
          const left = toPercent(s.h, s.m), right = toPercent(e.h, e.m);
          return (
            <div key={i} className={`absolute top-4 bottom-1 rounded border ${BLOCK_COLORS[b.type] || BLOCK_COLORS.task} flex items-center justify-center overflow-hidden`}
              style={{left: `${left}%`, width: `${Math.max(right-left, 1)}%`}} title={b.label}>
              <span className="text-[9px] text-white truncate px-1">{b.label}</span>
            </div>
          );
        })}
        {/* Now indicator */}
        {nowPercent > 0 && nowPercent < 100 && (
          <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 animate-pulse" style={{left: `${nowPercent}%`}}>
            <div className="absolute -top-1 -translate-x-1/2 w-2 h-2 bg-red-500 rounded-full"/>
          </div>
        )}
      </div>
    </div>
  );
}

function AddTaskModal({ projects, onClose, onAdd }) {
  const [project, setProject] = useState('');
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('P2');
  const [due, setDue] = useState('');
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!project || !title) return;
    onAdd({ project, title, priority, due: due || undefined });
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 w-full max-w-md" onClick={e=>e.stopPropagation()}>
        <h3 className="text-lg font-bold text-white mb-4">➕ タスク追加</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <select value={project} onChange={e=>setProject(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white" required>
            <option value="">プロジェクト選択...</option>
            {(projects||[]).map(p => <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
          </select>
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="タスク名" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white" required/>
          <div className="flex gap-2">
            {['P1','P2','P3'].map(p => (
              <button key={p} type="button" onClick={()=>setPriority(p)}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium ${priority===p ? 'border-white text-white' : 'border-gray-600 text-gray-400'}`}>
                <span className={`inline-block w-2 h-2 rounded-full ${PRIORITY_COLORS[p]} mr-1`}/>{p}
              </button>
            ))}
          </div>
          <input type="date" value={due} onChange={e=>setDue(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"/>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 bg-gray-700 rounded-lg text-gray-300">キャンセル</button>
            <button type="submit" className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium">追加</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TaskCard({ project }) {
  const { emoji, name, tasks } = project;
  const undone = tasks.filter(t => !t.done);
  const done = tasks.filter(t => t.done);
  
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors">
      <h3 className="text-base font-bold text-white mb-3">{emoji} {name} <span className="text-xs text-gray-500 font-normal ml-1">{undone.length}件</span></h3>
      <div className="space-y-1.5">
        {undone.map((t, i) => {
          const isOverdue = t.due && new Date(t.due) < new Date() && !t.done;
          const isUrgent = t.priority === 'P1' && !t.done;
          return (
            <div key={i} className={`flex items-start gap-2 p-1.5 rounded text-sm ${isUrgent ? 'border border-yellow-500/50 bg-yellow-900/20' : ''}`}>
              <input type="checkbox" checked={t.done} onChange={() => project.onToggle(project.id, i)}
                className="mt-0.5 rounded border-gray-600 bg-gray-700"/>
              <div className="flex-1 min-w-0">
                <span className={isOverdue ? 'text-red-400 font-semibold' : 'text-gray-200'}>{t.title}</span>
                <div className="flex items-center gap-2 mt-0.5">
                  {t.priority && <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_COLORS[t.priority]}`}/>}
                  {t.due && <span className={`text-[10px] ${isOverdue ? 'text-red-400' : 'text-gray-500'}`}>{t.due}</span>}
                </div>
              </div>
            </div>
          );
        })}
        {done.slice(0, 3).map((t, i) => (
          <div key={`d${i}`} className="flex items-start gap-2 p-1.5 opacity-60">
            <input type="checkbox" checked readOnly className="mt-0.5 rounded border-gray-600 bg-gray-700"/>
            <span className="text-sm line-through text-gray-500">{t.title}</span>
          </div>
        ))}
        {done.length > 3 && <div className="text-[10px] text-gray-600 pl-6">+{done.length-3} 完了済み</div>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [taskData, setTaskData] = useState(null);
  const [scheduleBlocks, setScheduleBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [tasksRes, schedRes] = await Promise.all([
        fetch('/api/dashboard-data/tasks'),
        fetch('/api/dashboard-data/schedule/today').catch(() => null)
      ]);
      const tasks = await tasksRes.json();
      setTaskData(tasks);
      if (schedRes && schedRes.ok) { const s = await schedRes.json(); setScheduleBlocks(s.blocks || []); }
    } catch(e) { console.error('Dashboard fetch error:', e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); const t = setInterval(fetchData, 60000); return () => clearInterval(t); }, [fetchData]);

  const handleToggle = async (project, taskIndex) => {
    await fetch('/api/dashboard-data/task/toggle', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({project, taskIndex}) });
    fetchData();
  };

  const handleAdd = async (data) => {
    await fetch('/api/dashboard-data/task/add', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
    setShowAddModal(false);
    fetchData();
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-gray-400">読み込み中...</div></div>;

  const projects = (taskData?.projects || []).map(p => ({...p, onToggle: handleToggle}));

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">📊 ダッシュボード</h1>
        <div className="flex items-center gap-4">
          <button onClick={()=>setShowAddModal(true)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm text-white font-medium">➕ タスク</button>
          <Clock/>
        </div>
      </div>

      <Timeline scheduleBlocks={scheduleBlocks} meetings={taskData?.meetings}/>

      <div>
        <h2 className="text-lg font-bold text-white mb-3">📋 プロジェクトタスク</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.filter(p => p.tasks.some(t => !t.done)).map(p => <TaskCard key={p.id} project={p}/>)}
        </div>
        {projects.filter(p => p.tasks.every(t => t.done)).length > 0 && (
          <div className="mt-4 text-sm text-gray-500">✅ {projects.filter(p=>p.tasks.every(t=>t.done)).map(p=>`${p.emoji}${p.name}`).join(', ')} — 全完了</div>
        )}
      </div>

      {showAddModal && <AddTaskModal projects={projects} onClose={()=>setShowAddModal(false)} onAdd={handleAdd}/>}
    </div>
  );
}
