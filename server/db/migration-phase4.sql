-- OCM Phase 4 Migration: 账号管理系统

-- 1. 创建 accounts 表
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,          -- 'anthropic', 'openai', 'google', 'groq', 'mistral', 'cohere'
  account_name TEXT NOT NULL,      -- '个人账号', '公司账号', 'Team A'
  email TEXT,                      -- 登录邮箱
  plan TEXT,                       -- 'free', 'pro', 'team', 'enterprise'
  monthly_budget REAL,             -- 月预算 (USD)
  monthly_used REAL DEFAULT 0,
  status TEXT DEFAULT 'active',    -- 'active', 'suspended', 'expired'
  note TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s','now') * 1000)
);

-- 2. 为 api_keys 表添加 account_id 字段
-- SQLite 不支持 ALTER TABLE ADD COLUMN IF NOT EXISTS，需要先检查
-- 但可以直接尝试添加，如果已存在会失败但不影响后续操作
ALTER TABLE api_keys ADD COLUMN account_id INTEGER REFERENCES accounts(id);

-- 3. 更新 bots 表，添加缺失的字段（如果不存在）
-- 这些字段在 schema.sql 中已定义，但可能旧数据库没有
-- ALTER TABLE bots ADD COLUMN IF NOT EXISTS ... 在 SQLite 中不支持
-- 我们使用安全的方式：先尝试添加，失败也没关系

-- 索引
CREATE INDEX IF NOT EXISTS idx_accounts_provider ON accounts(provider);
CREATE INDEX IF NOT EXISTS idx_api_keys_account_id ON api_keys(account_id);
