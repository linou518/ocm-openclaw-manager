-- Phase 6 Mock Data

-- 更新节点，添加宿主机信息
UPDATE nodes SET os_info = '{"os":"Ubuntu","kernel":"5.15.0-97-generic","arch":"x86_64","distro":"Ubuntu 22.04.4 LTS"}' WHERE id = 'g3s-01';
UPDATE nodes SET os_info = '{"os":"Ubuntu","kernel":"5.15.0-97-generic","arch":"x86_64","distro":"Ubuntu 22.04.4 LTS"}' WHERE id = 'g3s-02';
UPDATE nodes SET os_info = '{"os":"Debian","kernel":"6.1.0-17-amd64","arch":"x86_64","distro":"Debian GNU/Linux 12"}' WHERE id = 'g3s-03';
UPDATE nodes SET os_info = '{"os":"Ubuntu","kernel":"5.15.0-91-generic","arch":"x86_64","distro":"Ubuntu 22.04.3 LTS"}' WHERE id = 'g3s-04';
UPDATE nodes SET os_info = '{"os":"Ubuntu","kernel":"5.15.0-97-generic","arch":"x86_64","distro":"Ubuntu 22.04.4 LTS"}' WHERE id = 'g3s-05';
UPDATE nodes SET os_info = '{"os":"macOS","kernel":"Darwin 25.2.0","arch":"arm64","distro":"macOS 15.2"}' WHERE id = 'mac-study';
UPDATE nodes SET os_info = '{"os":"macOS","kernel":"Darwin 25.2.0","arch":"arm64","distro":"macOS 15.2"}' WHERE id = 'mac-bedroom';

-- 更新版本号（大部分为 v1.8.2，g3s-04 为 v1.8.1 落后）
UPDATE nodes SET openclaw_version = 'v1.8.2' WHERE id IN ('g3s-01', 'g3s-02', 'g3s-03', 'g3s-05', 'mac-study', 'mac-bedroom');
UPDATE nodes SET openclaw_version = 'v1.8.1' WHERE id = 'g3s-04';

-- 更新部分备份，标记包含宿主机信息
UPDATE backups SET includes_host = 1, host_snapshot = '{"os_info":{"os":"Ubuntu","kernel":"5.15.0-97-generic"},"packages":["python3","nodejs","git","docker"],"crontabs":3,"services":12}' WHERE id IN (1, 3, 5, 7, 10, 12, 15);

-- Bot 备份 Mock 数据 (每个 bot 3-5 条备份)
-- 先查询现有 bot 的 id 和 node_id
-- Bot 1 (假设 id=1, node_id='g3s-01')
INSERT INTO bot_backups (bot_id, node_id, git_commit, git_tag, type, file_count, total_size, score, is_stable, note, created_at) VALUES
(1, 'g3s-01', 'a1b2c3d', 'v1.0.0', 'manual', 156, 8920000, 92, 1, '手动备份 - 生产稳定版本', 1735948800000),
(1, 'g3s-01', 'e4f5g6h', NULL, 'auto', 158, 9120000, 88, 0, '自动备份', 1736035200000),
(1, 'g3s-01', 'i7j8k9l', 'v1.0.1', 'manual', 159, 9250000, 90, 1, '手动备份 - 修复bug后', 1736121600000),
(1, 'g3s-01', 'm0n1o2p', NULL, 'auto', 161, 9380000, 85, 0, '自动备份', 1736208000000);

-- Bot 2
INSERT INTO bot_backups (bot_id, node_id, git_commit, type, file_count, total_size, score, note, created_at) VALUES
(2, 'g3s-02', 'q3r4s5t', 'auto', 142, 7850000, 91, '自动备份', 1735948800000),
(2, 'g3s-02', 'u6v7w8x', 'manual', 143, 7920000, 93, '手动备份 - 功能更新', 1736035200000),
(2, 'g3s-02', 'y9z0a1b', 'auto', 145, 8050000, 89, '自动备份', 1736121600000);

-- Bot 3
INSERT INTO bot_backups (bot_id, node_id, git_commit, git_tag, type, file_count, total_size, score, is_stable, note, created_at) VALUES
(3, 'mac-study', 'c2d3e4f', 'v2.0.0', 'manual', 203, 12500000, 95, 1, '手动备份 - 重大版本', 1735948800000),
(3, 'mac-study', 'g5h6i7j', NULL, 'pre-rollback', 205, 12650000, 72, 0, '回滚前备份', 1736035200000),
(3, 'mac-study', 'k8l9m0n', NULL, 'auto', 207, 12800000, 87, 0, '自动备份', 1736121600000),
(3, 'mac-study', 'o1p2q3r', 'v2.0.1', 'manual', 209, 12950000, 94, 1, '手动备份 - 回滚后修复', 1736208000000),
(3, 'mac-study', 's4t5u6v', NULL, 'auto', 211, 13100000, 91, 0, '自动备份', 1736294400000);

-- Bot 4
INSERT INTO bot_backups (bot_id, node_id, git_commit, type, file_count, total_size, score, note, created_at) VALUES
(4, 'g3s-03', 'w7x8y9z', 'auto', 178, 10200000, 88, '自动备份', 1735948800000),
(4, 'g3s-03', 'a0b1c2d', 'manual', 179, 10350000, 90, '手动备份', 1736121600000),
(4, 'g3s-03', 'e3f4g5h', 'auto', 181, 10480000, 86, '自动备份', 1736294400000);

-- Accounts Mock Data (AI Providers)
INSERT INTO accounts (provider, account_name, email, plan, monthly_budget, monthly_used, status, note) VALUES
('anthropic', 'Anthropic Main', 'main@example.com', 'pro', 500, 287.5, 'active', '主力账号'),
('anthropic', 'Anthropic Backup', 'backup@example.com', 'free', 100, 45.2, 'active', '备用账号'),
('openai', 'OpenAI Team', 'team@example.com', 'team', 1000, 623.8, 'active', '团队账号'),
('openai', 'OpenAI Dev', 'dev@example.com', 'pro', 300, 156.3, 'active', '开发测试'),
('google', 'Google AI Pro', 'google@example.com', 'pro', 200, 78.9, 'active', 'Gemini Pro'),
('groq', 'Groq Free', 'groq@example.com', 'free', 0, 0, 'active', '免费额度'),
('mistral', 'Mistral API', 'mistral@example.com', 'pro', 150, 34.6, 'active', 'Mistral Large');

-- 关联现有 Keys 到 Accounts (如果 api_keys 表有 account_id 列)
-- UPDATE api_keys SET account_id = 1 WHERE provider = 'anthropic' AND id IN (1, 2);
-- UPDATE api_keys SET account_id = 2 WHERE provider = 'anthropic' AND id IN (3);
-- UPDATE api_keys SET account_id = 3 WHERE provider = 'openai' AND id IN (4, 5);
-- UPDATE api_keys SET account_id = 5 WHERE provider = 'google' AND id IN (6);

-- 审计日志 Mock Data
INSERT INTO audit_log (operator, operator_detail, action, target, params, result, duration_ms, created_at) VALUES
('web', 'admin', 'node_backup', 'g3s-01', '{"type":"manual"}', 'success', 12450, 1736208000000),
('cron', 'auto-backup', 'cluster_backup', 'all', '{"nodes":7}', 'success', 45200, 1736121600000),
('bot', '@yn_work_bot', 'node_restart', 'g3s-04', '{}', 'success', 3200, 1736035200000),
('web', 'admin', 'key_verify', 'key:12', '{"provider":"anthropic"}', 'success', 890, 1735948800000),
('system', 'watchdog', 'node_health_check', 'g3s-02', '{}', 'failed', 5000, 1735862400000),
('web', 'admin', 'bot_restart', 'bot:3', '{}', 'success', 1800, 1735776000000),
('cron', 'auto-score', 'intelligence_test', 'g3s-01', '{}', 'success', 23400, 1735689600000),
('web', 'admin', 'node_restore', 'g3s-05', '{"backup_id":8}', 'cancelled', 0, 1735603200000);
