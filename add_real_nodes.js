const Database = require("better-sqlite3");
const db = new Database("./server/db/ocm.db");

// 禁用外键检查
db.pragma("foreign_keys = OFF");

// 清除现有数据（按正确顺序）
db.exec("DELETE FROM events");
db.exec("DELETE FROM scores"); 
db.exec("DELETE FROM backups");
db.exec("DELETE FROM nodes");

// 重启外键检查
db.pragma("foreign_keys = ON");

// 添加真实节点
const insertNode = db.prepare(`
  INSERT INTO nodes (
    id, name, host, port, ssh_user, openclaw_path, status,
    cpu_usage, ram_usage, disk_usage, openclaw_version,
    last_seen_at, tags, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const nodes = [
  {
    id: "baota",
    name: "宝塔服务器 (Jack生态)",
    host: "192.168.3.11",
    ssh_user: "linou",
    openclaw_path: "/home/linou/.openclaw",
    status: "online",
    openclaw_version: "2026.2.13",
    tags: "production,personal"
  },
  {
    id: "pc-b", 
    name: "PC-B 备机 (测试节点)",
    host: "192.168.3.17",
    ssh_user: "openclaw02",
    openclaw_path: "/home/openclaw02/.openclaw",
    status: "clean",
    openclaw_version: "none",
    tags: "testing,clean"
  },
  {
    id: "t440",
    name: "T440 工作服务器",
    host: "192.168.3.33",
    ssh_user: "linou", 
    openclaw_path: "/home/linou/.openclaw",
    status: "unstable",
    openclaw_version: "2026.2.13",
    tags: "work,agents"
  }
];

nodes.forEach(node => {
  insertNode.run(
    node.id, node.name, node.host, 22, node.ssh_user,
    node.openclaw_path, node.status, 15, 35, 60, 
    node.openclaw_version, Date.now(), node.tags, 
    Date.now(), Date.now()
  );
});

console.log("✅ 添加了3个真实节点");
db.close();
