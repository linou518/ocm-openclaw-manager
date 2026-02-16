-- Phase 7 Migration: OpenClaw Architecture Adaptation
-- 6 Core Modules: Agent Identity, Memory Health, Sessions, Cron Jobs, Gateway Config, Skills

-- 1. Agent Identity - Extend bots table
ALTER TABLE bots ADD COLUMN agent_name TEXT;
ALTER TABLE bots ADD COLUMN agent_emoji TEXT;
ALTER TABLE bots ADD COLUMN agent_vibe TEXT;
ALTER TABLE bots ADD COLUMN soul_summary TEXT;
ALTER TABLE bots ADD COLUMN user_name TEXT;
ALTER TABLE bots ADD COLUMN workspace_files TEXT;  -- JSON array

-- 2. Memory Health Monitoring
CREATE TABLE IF NOT EXISTS memory_health (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bot_id INTEGER NOT NULL,
  node_id TEXT NOT NULL,
  memory_md_size INTEGER,          -- MEMORY.md bytes
  memory_dir_files INTEGER,        -- memory/ dir file count
  memory_dir_size INTEGER,         -- memory/ dir total size
  total_memory_size INTEGER,       -- total memory size
  oldest_daily TEXT,               -- oldest daily note date
  newest_daily TEXT,               -- newest daily note date
  health_status TEXT DEFAULT 'healthy',  -- healthy/warning/critical
  issues TEXT,                     -- JSON array of issues
  checked_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_memory_health_bot_id ON memory_health(bot_id);
CREATE INDEX IF NOT EXISTS idx_memory_health_checked_at ON memory_health(checked_at DESC);

-- 3. Session Monitoring
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bot_id INTEGER NOT NULL,
  node_id TEXT NOT NULL,
  session_key TEXT NOT NULL,
  session_type TEXT,               -- main/dm/group/cron/subagent
  display_name TEXT,
  channel TEXT,                    -- telegram/discord/slack
  model TEXT,
  total_tokens INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT 1,
  last_activity_at INTEGER,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_bot_id ON sessions(bot_id);
CREATE INDEX IF NOT EXISTS idx_sessions_node_id ON sessions(node_id);
CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON sessions(is_active);

-- 4. Cron Job Management
CREATE TABLE IF NOT EXISTS cron_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bot_id INTEGER NOT NULL,
  node_id TEXT NOT NULL,
  job_name TEXT NOT NULL,
  schedule_type TEXT,              -- at/every/cron
  schedule_expr TEXT,              -- cron expression or interval
  payload_type TEXT,               -- systemEvent/agentTurn
  payload_text TEXT,               -- task content summary
  session_target TEXT,             -- main/isolated
  enabled BOOLEAN DEFAULT 1,
  last_run_at INTEGER,
  last_result TEXT,                -- success/failed/null
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cron_jobs_bot_id ON cron_jobs(bot_id);
CREATE INDEX IF NOT EXISTS idx_cron_jobs_node_id ON cron_jobs(node_id);
CREATE INDEX IF NOT EXISTS idx_cron_jobs_enabled ON cron_jobs(enabled);

-- 5. Gateway Configuration
CREATE TABLE IF NOT EXISTS gateway_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  node_id TEXT NOT NULL UNIQUE,
  config_json TEXT,                -- openclaw.json content (sanitized)
  channels TEXT,                   -- JSON array of enabled channels
  default_model TEXT,
  agent_workspace TEXT,
  heartbeat_enabled BOOLEAN,
  heartbeat_interval TEXT,
  fetched_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_gateway_configs_node_id ON gateway_configs(node_id);

-- 6. Skills Management
CREATE TABLE IF NOT EXISTS skills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  node_id TEXT NOT NULL,
  skill_name TEXT NOT NULL,
  skill_path TEXT,                 -- installation path
  source TEXT,                     -- bundled/managed/workspace/custom
  description TEXT,
  version TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_skills_node_id ON skills(node_id);
CREATE INDEX IF NOT EXISTS idx_skills_source ON skills(source);
