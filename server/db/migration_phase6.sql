-- Phase 6 Migration: 多项功能增强

-- 1. Bot 单独备份表
CREATE TABLE IF NOT EXISTS bot_backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bot_id INTEGER NOT NULL,
  node_id TEXT NOT NULL,
  git_commit TEXT,
  git_tag TEXT,
  type TEXT DEFAULT 'auto',       -- auto/manual/pre-rollback
  workspace_snapshot TEXT,         -- JSON: 包含的文件列表
  config_snapshot TEXT,            -- JSON: bot配置快照
  file_count INTEGER,
  total_size INTEGER,
  score INTEGER,
  is_stable BOOLEAN DEFAULT 0,
  note TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE,
  FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bot_backups_bot_id ON bot_backups(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_backups_created_at ON bot_backups(created_at DESC);

-- 2. Accounts 表 (已存在，但确保所有字段完整)
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,          -- 'anthropic', 'openai', 'google', etc.
  account_name TEXT NOT NULL,      -- 显示名
  email TEXT,
  plan TEXT DEFAULT 'free',        -- 'free', 'pro', 'team', 'enterprise'
  monthly_budget REAL DEFAULT 0,   -- 月度预算限制 (USD)
  monthly_used REAL DEFAULT 0,     -- 本月已用
  status TEXT DEFAULT 'active',    -- 'active', 'suspended', 'expired'
  note TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s','now') * 1000)
);

-- 关联 api_keys 表到 accounts (如果没有 account_id，添加)
-- ALTER TABLE api_keys ADD COLUMN account_id INTEGER REFERENCES accounts(id);
-- 注意：SQLite 不支持 ADD FOREIGN KEY，所以我们只添加列

-- 检查是否已有 account_id 列（手动操作）
-- 如果没有，需要重建表或添加列

-- 3. 宿主机信息字段 (扩展 nodes 表)
ALTER TABLE nodes ADD COLUMN os_info TEXT;              -- JSON: {os, kernel, arch, distro}
ALTER TABLE nodes ADD COLUMN installed_packages TEXT;    -- JSON: 关键包列表

-- 4. 备份内容扩展 (扩展 backups 表)
ALTER TABLE backups ADD COLUMN includes_host BOOLEAN DEFAULT 0;
ALTER TABLE backups ADD COLUMN host_snapshot TEXT;      -- JSON: 宿主机信息快照

-- 5. 审计日志表 (如果不存在)
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operator TEXT NOT NULL,          -- 'bot', 'web', 'cron', 'system'
  operator_detail TEXT,            -- 具体的bot/user名称
  action TEXT NOT NULL,            -- 操作类型
  target TEXT,                     -- 操作目标 (node_id, bot_id, etc.)
  params TEXT,                     -- JSON: 操作参数
  result TEXT DEFAULT 'success',   -- 'success', 'failed', 'cancelled'
  error_message TEXT,
  duration_ms INTEGER,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_audit_operator ON audit_log(operator);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at DESC);
