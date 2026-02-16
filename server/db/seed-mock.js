const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'ocm.db');
const db = new Database(dbPath);

// 临时禁用外键约束
db.pragma('foreign_keys = OFF');

// 清空现有数据
db.exec('DELETE FROM optimizations');
db.exec('DELETE FROM events');
db.exec('DELETE FROM scores');
db.exec('DELETE FROM backups');
db.exec('DELETE FROM api_keys');
db.exec('DELETE FROM bots');
db.exec('DELETE FROM nodes');
console.log('🗑️  Cleared existing data');

// 重新启用外键约束
db.pragma('foreign_keys = ON');

const now = Date.now();

// Mock 节点数据 (7台)
const nodes = [
  { id: 'g3s-01', name: '书房G3S-1号', host: '192.168.20.101', status: 'online', cpu: 8, ram: 42, disk: 55, version: 'v1.8.2', score: 95 },
  { id: 'g3s-02', name: '书房G3S-2号', host: '192.168.20.102', status: 'online', cpu: 12, ram: 38, disk: 48, version: 'v1.8.2', score: 88 },
  { id: 'g3s-03', name: '客厅G3S-3号', host: '192.168.20.103', status: 'online', cpu: 5, ram: 51, disk: 62, version: 'v1.8.2', score: 91 },
  { id: 'g3s-04', name: '卧室G3S-4号', host: '192.168.20.104', status: 'online', cpu: 45, ram: 67, disk: 70, version: 'v1.8.1', score: 72 },
  { id: 'g3s-05', name: '厨房G3S-5号', host: '192.168.20.105', status: 'online', cpu: 10, ram: 40, disk: 53, version: 'v1.8.2', score: 89 },
  { id: 'macmini-01', name: 'Mac Mini 主力', host: '192.168.20.110', status: 'online', cpu: 22, ram: 55, disk: 68, version: 'v1.8.2', score: 93 },
  { id: 'macmini-02', name: 'Mac Mini 备用', host: '192.168.20.111', status: 'offline', cpu: 0, ram: 0, disk: 0, version: 'v1.8.2', score: null },
];

const insertNode = db.prepare(`
  INSERT INTO nodes (id, name, host, port, ssh_user, openclaw_path, status, 
    cpu_usage, ram_usage, disk_usage, openclaw_version, 
    last_seen_at, last_backup_at, last_score, last_score_at, created_at, updated_at)
  VALUES (?, ?, ?, 22, 'ocm', '/home/ocm/.openclaw', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

nodes.forEach(n => {
  const lastSeen = n.status === 'online' ? now : now - 3600000;
  const lastBackup = now - Math.floor(Math.random() * 7200000);
  const lastScoreAt = n.score ? now - Math.floor(Math.random() * 86400000) : null;
  insertNode.run(
    n.id, n.name, n.host, n.status, 
    n.cpu, n.ram, n.disk, n.version,
    lastSeen, lastBackup, n.score, lastScoreAt,
    now, now
  );
});

console.log(`✅ Inserted ${nodes.length} nodes`);

// Mock 备份历史 (每节点5条)
const insertBackup = db.prepare(`
  INSERT INTO backups (node_id, git_commit, git_tag, type, score, is_stable, file_count, total_size, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

nodes.forEach(n => {
  if (n.status === 'offline') return;
  for (let i = 0; i < 5; i++) {
    const backupTime = now - (i * 6 * 3600000); // 每6小时一次
    const commit = Math.random().toString(36).substring(2, 10);
    const score = Math.floor(70 + Math.random() * 28);
    const isStable = score >= 90 ? 1 : 0;
    const tag = isStable ? `${n.id}/stable/${new Date(backupTime).toISOString().split('T')[0]}` : null;
    insertBackup.run(
      n.id, commit, tag, 'auto', score, isStable,
      Math.floor(50 + Math.random() * 100),
      Math.floor(5000000 + Math.random() * 10000000),
      backupTime
    );
  }
});

console.log('✅ Inserted backup history');

// Mock 智力评分历史 (5维度详细)
const insertScore = db.prepare(`
  INSERT INTO scores (node_id, total_score, memory_score, logic_score, tool_score, quality_score, personality_score, action_taken, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

nodes.forEach(n => {
  if (n.status === 'offline' || !n.score) return;
  
  // 基准分数，每个节点有不同的强弱项
  const baseScores = {
    memory: 15 + Math.random() * 5,
    logic: 15 + Math.random() * 5,
    tool: 15 + Math.random() * 5,
    quality: 15 + Math.random() * 5,
    personality: 15 + Math.random() * 5,
  };
  
  for (let i = 0; i < 10; i++) {
    const scoreTime = now - (i * 12 * 3600000); // 每12小时一次
    
    // 每次有小波动 (-3 到 +3)
    const memory = Math.max(0, Math.min(20, Math.floor(baseScores.memory + (Math.random() - 0.5) * 6)));
    const logic = Math.max(0, Math.min(20, Math.floor(baseScores.logic + (Math.random() - 0.5) * 6)));
    const tool = Math.max(0, Math.min(20, Math.floor(baseScores.tool + (Math.random() - 0.5) * 6)));
    const quality = Math.max(0, Math.min(20, Math.floor(baseScores.quality + (Math.random() - 0.5) * 6)));
    const personality = Math.max(0, Math.min(20, Math.floor(baseScores.personality + (Math.random() - 0.5) * 6)));
    
    const total = memory + logic + tool + quality + personality;
    const action = total < 70 ? (total < 50 ? 'rollback' : 'alert') : 'none';
    
    insertScore.run(
      n.id, total,
      memory, logic, tool, quality, personality,
      action,
      scoreTime
    );
    
    // 基准分数缓慢变化（模拟长期趋势）
    if (i % 3 === 0) {
      baseScores.memory += (Math.random() - 0.5) * 0.5;
      baseScores.logic += (Math.random() - 0.5) * 0.5;
      baseScores.tool += (Math.random() - 0.5) * 0.5;
      baseScores.quality += (Math.random() - 0.5) * 0.5;
      baseScores.personality += (Math.random() - 0.5) * 0.5;
    }
  }
});

console.log('✅ Inserted score history');

// Mock 事件日志
const events = [
  { node_id: 'g3s-01', type: 'backup', severity: 'info', message: 'G3S-01 自动备份完成' },
  { node_id: 'g3s-04', type: 'alert', severity: 'warn', message: 'G3S-04 智力评分下降至 72' },
  { node_id: null, type: 'backup', severity: 'info', message: '全集群备份完成' },
  { node_id: 'g3s-02', type: 'score', severity: 'info', message: 'G3S-02 智力测试完成，评分: 88' },
  { node_id: 'macmini-02', type: 'alert', severity: 'error', message: 'Mac Mini 备用 连接中断' },
  { node_id: 'g3s-03', type: 'backup', severity: 'info', message: 'G3S-03 备份完成' },
  { node_id: null, type: 'config', severity: 'info', message: '配置模板已更新' },
  { node_id: 'macmini-01', type: 'score', severity: 'info', message: 'Mac Mini 主力 智力测试完成，评分: 93' },
  { node_id: 'g3s-05', type: 'backup', severity: 'info', message: 'G3S-05 备份完成' },
  { node_id: null, type: 'backup', severity: 'info', message: '全集群定期备份已开始' },
];

const insertEvent = db.prepare(`
  INSERT INTO events (node_id, type, severity, message, created_at)
  VALUES (?, ?, ?, ?, ?)
`);

events.forEach((e, idx) => {
  insertEvent.run(e.node_id, e.type, e.severity, e.message, now - (idx * 600000)); // 每10分钟一条
});

console.log(`✅ Inserted ${events.length} events`);

// Mock 优化部署流水线数据
const optimizations = [
  {
    title: '升级 OpenClaw v1.8.3',
    description: '升级到最新版本，包含性能优化和安全补丁',
    commands: JSON.stringify(['cd ~/.openclaw', 'git pull', 'npm install', 'pm2 restart all']),
    test_node_id: 'macmini-02',
    status: 'deployed',
    test_backup_id: 3,
    test_score: 94,
    test_result: JSON.stringify({ memory: 19, logic: 19, tool: 19, quality: 18, personality: 19 }),
    deploy_progress: JSON.stringify([
      { node_id: 'g3s-01', status: 'deployed', backup_id: 5, score: 93 },
      { node_id: 'g3s-02', status: 'deployed', backup_id: 6, score: 91 },
      { node_id: 'g3s-03', status: 'deployed', backup_id: 7, score: 92 }
    ]),
    created_at: now - 86400000 * 5,
    completed_at: now - 86400000 * 4
  },
  {
    title: '优化记忆系统提示词',
    description: '改进 MEMORY.md 的格式和结构',
    commands: JSON.stringify(['cd ~/.openclaw/workspace', 'cp MEMORY.md MEMORY.backup', 'cat new-prompt.txt > MEMORY.md']),
    test_node_id: 'macmini-02',
    status: 'test_passed',
    test_backup_id: 8,
    test_score: 89,
    test_result: JSON.stringify({ memory: 20, logic: 17, tool: 18, quality: 17, personality: 17 }),
    deploy_progress: null,
    created_at: now - 86400000 * 2,
    completed_at: null
  },
  {
    title: '调整工具使用策略',
    description: '减少不必要的 web_search 调用',
    commands: JSON.stringify(['echo "search_threshold=0.8" >> ~/.openclaw/config.env', 'pm2 restart gateway']),
    test_node_id: 'macmini-02',
    status: 'testing',
    test_backup_id: 9,
    test_score: null,
    test_result: null,
    deploy_progress: null,
    created_at: now - 3600000 * 2,
    completed_at: null
  },
  {
    title: '增加日语响应能力',
    description: '优化日语对话流畅度',
    commands: JSON.stringify(['cd ~/.openclaw/workspace', 'echo "lang=ja,en" >> config.txt']),
    test_node_id: 'macmini-02',
    status: 'test_failed',
    test_backup_id: 10,
    test_score: 65,
    test_result: JSON.stringify({ memory: 14, logic: 13, tool: 12, quality: 13, personality: 13 }),
    deploy_progress: null,
    created_at: now - 86400000 * 1,
    completed_at: null
  },
  {
    title: '配置新的 API Key 轮询',
    description: '添加多个备用 API Key 提高稳定性',
    commands: JSON.stringify(['openclaw config set-key anthropic sk-ant-...', 'openclaw config set-key openai sk-proj-...']),
    test_node_id: 'macmini-02',
    status: 'draft',
    test_backup_id: null,
    test_score: null,
    test_result: null,
    deploy_progress: null,
    created_at: now - 3600000 * 8,
    completed_at: null
  },
  {
    title: '启用实验性推理模式',
    description: '测试 Claude 4.5 的 extended thinking',
    commands: JSON.stringify(['openclaw config set thinking=extended', 'pm2 restart gateway']),
    test_node_id: 'macmini-02',
    status: 'deploying',
    test_backup_id: 11,
    test_score: 91,
    test_result: JSON.stringify({ memory: 18, logic: 19, tool: 18, quality: 18, personality: 18 }),
    deploy_progress: JSON.stringify([
      { node_id: 'g3s-01', status: 'deployed', backup_id: 12, score: 90 },
      { node_id: 'g3s-02', status: 'deploying', backup_id: 13, score: null },
      { node_id: 'g3s-03', status: 'pending', backup_id: null, score: null }
    ]),
    created_at: now - 3600000 * 4,
    completed_at: null
  },
  {
    title: '修复 TTS 语音合成问题',
    description: '解决某些日语发音不准确的问题',
    commands: JSON.stringify(['npm install @google-cloud/text-to-speech@latest', 'pm2 restart tts-service']),
    test_node_id: 'macmini-02',
    status: 'rollback',
    test_backup_id: 14,
    test_score: 58,
    test_result: JSON.stringify({ memory: 12, logic: 11, tool: 11, quality: 12, personality: 12 }),
    deploy_progress: null,
    created_at: now - 86400000 * 3,
    completed_at: now - 86400000 * 3 + 7200000
  }
];

const insertOptimization = db.prepare(`
  INSERT INTO optimizations (title, description, commands, test_node_id, status, 
    test_backup_id, test_score, test_result, deploy_progress, created_at, updated_at, completed_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

optimizations.forEach(opt => {
  insertOptimization.run(
    opt.title, opt.description, opt.commands, opt.test_node_id, opt.status,
    opt.test_backup_id, opt.test_score, opt.test_result, opt.deploy_progress,
    opt.created_at, opt.created_at, opt.completed_at
  );
});

console.log(`✅ Inserted ${optimizations.length} optimization records`);

db.close();
console.log('🎉 Mock data seeded successfully!');
