const DATA_URL = "tasks.json";
let appData = null;
const today = new Date().toISOString().slice(0,10);
const threeDaysLater = new Date(Date.now()+3*86400000).toISOString().slice(0,10);

async function loadData() {
  try {
    const res = await fetch(DATA_URL + "?t=" + Date.now());
    appData = await res.json();
    renderOverview();
    renderSidebar();
  } catch(e) { 
    console.error(e); 
    // If tasks.json doesn not exist, show a placeholder
    document.getElementById("taskColumns").innerHTML = `
      <div class="column">
        <div class="col-header">📋 任务概览</div>
        <div style="padding:20px;text-align:center;color:var(--muted);">
          <p>暂无任务数据</p>
          <p>请检查 tasks.json 文件</p>
        </div>
      </div>
    `;
  }
}

function isUrgent(t) { return !t.done && t.due && t.due <= threeDaysLater; }
function isDoneToday(t) { return t.done && t.doneDate === today; }

function taskHtml(task, projectId, taskIndex) {
  const urgentClass = isUrgent(task) ? " urgent-bg" : "";
  const doneTodayClass = isDoneToday(task) ? " done-today" : "";
  const checkedClass = task.done ? " checked" : "";
  const titleClass = task.done ? " done" : "";
  
  let dueMeta = "";
  if (task.due) {
    const dueDate = new Date(task.due);
    const now = new Date();
    const diffDays = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) dueMeta = `<span class="overdue">已过期 ${Math.abs(diffDays)} 天</span>`;
    else if (diffDays === 0) dueMeta = `<span class="soon">今天截止</span>`;
    else if (diffDays <= 3) dueMeta = `<span class="soon">${diffDays} 天后截止</span>`;
    else dueMeta = `截止: ${task.due}`;
  }
  
  let priorityDot = "";
  if (task.priority) {
    priorityDot = `<span class="priority-dot ${task.priority}"></span>`;
  }
  
  return `<div class="task${urgentClass}${doneTodayClass}">
    <div class="task-row">
      <div class="task-chk${checkedClass}" onclick="toggleTask(${projectId}, ${taskIndex})"></div>
      <div class="task-content">
        <div class="title${titleClass}">${priorityDot}${task.title}</div>
        ${(dueMeta || task.note) ? `<div class="meta">${dueMeta}${task.note ? ` · ${task.note}` : ""}</div>` : ""}
      </div>
    </div>
  </div>`;
}

function renderOverview() {
  if (!appData || !appData.projects) {
    document.getElementById("taskColumns").innerHTML = `
      <div class="column">
        <div class="col-header">📋 任务概览</div>
        <div style="padding:20px;text-align:center;color:var(--muted);">
          <p>正在加载任务数据...</p>
        </div>
      </div>
    `;
    return;
  }
  
  // Task columns - by project, 3 columns
  const projectsWithTasks = appData.projects.filter(p =>
    p.tasks && p.tasks.some(t => !t.done || isDoneToday(t))
  );

  const projectHtmls = projectsWithTasks.map(p => {
    const visibleTasks = p.tasks.filter(t => !t.done || isDoneToday(t));
    if (!visibleTasks.length) return "";
    let html = `<div class="project-group"><div class="project-group-header">${p.emoji} ${p.name}<span class="pcount">${visibleTasks.filter(t=>!t.done).length} 项</span></div>`;
    visibleTasks.sort((a,b) => {
      if(a.done !== b.done) return a.done ? 1 : -1;
      return (a.due||"9999").localeCompare(b.due||"9999");
    });
    visibleTasks.forEach((t, i) => { html += taskHtml(t, p.id, i); });
    html += "</div>";
    return html;
  }).filter(Boolean);

  const cols = ["","",""];
  projectHtmls.forEach((h, i) => { cols[i % 3] += h; });

  document.getElementById("taskColumns").innerHTML = cols.map((c, i) =>
    `<div class="column">${i===0?"<div class=\"col-header\">📋 任务（按项目分组）</div>":"<div class=\"col-header\">&nbsp;</div>"}${c}</div>`
  ).join("");
}

function renderSidebar() {
  // Placeholder for sidebar functions if needed
}

// Simple task toggle function
async function toggleTask(projectId, taskIndex) {
  try {
    const res = await fetch("/api/task/toggle", {
      method: "POST", 
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({project: projectId, taskIndex})
    });
    if (res.ok) {
      loadData(); // Reload data
    }
  } catch(e) {
    console.error("Toggle task failed:", e);
  }
}

// Initialize
loadData();
setInterval(loadData, 60000);
