-- OCM Database Schema

CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,           -- 'g3s-01'
  name TEXT NOT NULL,            -- '书房G3S-1号'
  host TEXT NOT NULL,            -- '192.168.20.101'
  port INTEGER DEFAULT 22,
  ssh_user TEXT DEFAULT 'ocm',
  ssh_key_path TEXT,
  openclaw_path TEXT,            -- '/home/ocm/.openclaw'
  status TEXT DEFAULT 'unknown', -- online/offline/error
  cpu_usage REAL DEFAULT 0,      -- CPU使用率 %
  ram_usage REAL DEFAULT 0,      -- RAM使用率 %
  disk_usage REAL DEFAULT 0,     -- Disk使用率 %
  openclaw_version TEXT,         -- 'v1.8.2'
  last_seen_at INTEGER,
  last_backup_at INTEGER,
  last_score INTEGER,
  last_score_at INTEGER,
  tags TEXT,                     -- JSON array
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  node_id TEXT NOT NULL,
  git_commit TEXT,              -- commit SHA
  git_tag TEXT,                 -- tag name (if stable)
  type TEXT,                    -- auto/manual/pre-rollback
  score INTEGER,               -- 智力评分 (null if not tested)
  is_stable BOOLEAN DEFAULT 0,
  file_count INTEGER,
  total_size INTEGER,           -- bytes
  note TEXT,
  created_at INTEGER,
  FOREIGN KEY (node_id) REFERENCES nodes(id)
);

CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  node_id TEXT NOT NULL,
  total_score INTEGER,
  memory_score INTEGER,         -- 记忆一致性
  logic_score INTEGER,          -- 逻辑推理
  tool_score INTEGER,           -- 工具使用
  quality_score INTEGER,        -- 回复质量
  personality_score INTEGER,    -- 人格一致性
  details TEXT,                 -- JSON: 详细测试结果
  action_taken TEXT,            -- none/alert/rollback
  backup_id INTEGER,            -- 关联的备份
  created_at INTEGER,
  FOREIGN KEY (node_id) REFERENCES nodes(id)
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  node_id TEXT,                 -- null = 全局事件
  type TEXT,                    -- install/backup/restore/score/alert/config
  severity TEXT,                -- info/warn/error/critical
  message TEXT,
  details TEXT,                 -- JSON
  created_at INTEGER
);

-- API Keys 管理
CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  node_id TEXT NOT NULL,
  provider TEXT NOT NULL,        -- 'anthropic', 'openai', 'google', 'groq', 'mistral', 'cohere', 'custom'
  key_name TEXT NOT NULL,        -- 显示名 如 'Anthropic主Key', 'OpenAI备用'
  api_key TEXT NOT NULL,         -- 实际key (mock用明文, 生产用加密)
  is_active BOOLEAN DEFAULT 1,
  last_verified_at INTEGER,      -- 上次验证时间
  status TEXT DEFAULT 'unknown', -- 'valid', 'invalid', 'expired', 'unknown'
  monthly_limit REAL,            -- 月度预算限制 (USD)
  monthly_used REAL DEFAULT 0,
  note TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  FOREIGN KEY (node_id) REFERENCES nodes(id)
);

-- Bot/Workspace 管理
CREATE TABLE IF NOT EXISTS bots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  node_id TEXT NOT NULL,
  bot_name TEXT NOT NULL,          -- '@yn_work_bot'
  bot_token TEXT,                  -- token (脱敏显示)
  platform TEXT DEFAULT 'telegram', -- 'telegram', 'discord', 'slack'
  workspace_path TEXT,             -- '/home/ocm/.openclaw/workspace'
  status TEXT DEFAULT 'running',   -- 'running', 'stopped', 'error'
  session_count INTEGER DEFAULT 0,
  cron_count INTEGER DEFAULT 0,
  model TEXT,                      -- 当前使用的模型
  openclaw_url TEXT,               -- 节点的OpenClaw web界面URL
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  FOREIGN KEY (node_id) REFERENCES nodes(id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_backups_node_id ON backups(node_id);
CREATE INDEX IF NOT EXISTS idx_backups_created_at ON backups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scores_node_id ON scores(node_id);
CREATE INDEX IF NOT EXISTS idx_scores_created_at ON scores(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_node_id ON events(node_id);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_severity ON events(severity);
CREATE INDEX IF NOT EXISTS idx_api_keys_node_id ON api_keys(node_id);
CREATE INDEX IF NOT EXISTS idx_bots_node_id ON bots(node_id);

-- 优化部署流水线
CREATE TABLE IF NOT EXISTS optimizations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,           -- 优化标题
  description TEXT,              -- 描述
  commands TEXT NOT NULL,        -- JSON数组，要执行的命令列表
  test_node_id TEXT DEFAULT 'macmini-02',  -- 测试节点
  status TEXT DEFAULT 'draft',   -- draft/testing/test_passed/test_failed/deploying/deployed/rollback
  test_backup_id INTEGER,        -- 测试前备份ID
  test_score INTEGER,            -- 测试得分
  test_result TEXT,              -- 测试详细结果JSON
  deploy_progress TEXT,          -- 部署进度JSON: [{node_id, status, backup_id, score}]
  created_by TEXT DEFAULT 'admin',
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_optimizations_status ON optimizations(status);
CREATE INDEX IF NOT EXISTS idx_optimizations_created_at ON optimizations(created_at DESC);
