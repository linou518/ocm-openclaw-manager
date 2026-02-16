-- Phase 7 Mock Data

-- 1. Update existing bots with Agent Identity
UPDATE bots SET 
  agent_name = 'Work Bot',
  agent_emoji = '🔧',
  agent_vibe = '高效专业，注重工作效率',
  soul_summary = '工作助手，擅长任务管理和技术支持',
  user_name = 'Yano',
  workspace_files = '["SOUL.md","MEMORY.md","IDENTITY.md","USER.md","AGENTS.md","TOOLS.md","memory/"]'
WHERE bot_name = '@yn_work_bot';

UPDATE bots SET 
  agent_name = 'Personal Bot',
  agent_emoji = '🌟',
  agent_vibe = '温暖随和，富有同理心',
  soul_summary = '个人生活助手，关注身心健康和日常生活',
  user_name = 'Yano',
  workspace_files = '["SOUL.md","MEMORY.md","IDENTITY.md","USER.md","AGENTS.md","memory/"]'
WHERE bot_name = '@yn_personal_bot';

UPDATE bots SET 
  agent_name = 'Agent Alpha',
  agent_emoji = '⚡',
  agent_vibe = '快速精准，技术导向',
  soul_summary = '通用助手，追求快速响应和准确性',
  user_name = 'Yano',
  workspace_files = '["SOUL.md","IDENTITY.md","USER.md","AGENTS.md"]'
WHERE bot_name = '@yn_agent_01_bot';

UPDATE bots SET 
  agent_name = 'Lab Assistant',
  agent_emoji = '🧪',
  agent_vibe = '好奇探索，实验性质',
  soul_summary = '实验室助手，用于测试新功能',
  user_name = 'Team',
  workspace_files = '["SOUL.md","USER.md"]'
WHERE bot_name = '@lab_bot';

UPDATE bots SET 
  agent_name = 'Dev Helper',
  agent_emoji = '💻',
  agent_vibe = '代码专家，注重细节',
  soul_summary = '开发助手，专注于代码和技术讨论',
  user_name = 'Dev Team',
  workspace_files = '["SOUL.md","MEMORY.md","AGENTS.md","TOOLS.md"]'
WHERE bot_name = '@dev_helper_bot';

UPDATE bots SET 
  agent_name = 'Monitor Bot',
  agent_emoji = '👁️',
  agent_vibe = '警觉观察，主动监控',
  soul_summary = '监控助手，负责系统状态观察',
  user_name = 'Admin',
  workspace_files = '["SOUL.md","IDENTITY.md","AGENTS.md"]'
WHERE bot_name = '@monitor_bot';

-- 2. Memory Health - Mock data (5 checks per bot)
INSERT INTO memory_health (bot_id, node_id, memory_md_size, memory_dir_files, memory_dir_size, total_memory_size, oldest_daily, newest_daily, health_status, issues, checked_at) VALUES
-- @yn_work_bot (id=1, g3s-01)
(1, 'g3s-01', 45823, 28, 892450, 938273, '2026-01-15', '2026-02-15', 'healthy', '[]', strftime('%s','now') * 1000 - 0),
(1, 'g3s-01', 43200, 26, 845000, 888200, '2026-01-15', '2026-02-10', 'healthy', '[]', strftime('%s','now') * 1000 - 432000000),
(1, 'g3s-01', 41500, 24, 798000, 839500, '2026-01-15', '2026-02-05', 'healthy', '[]', strftime('%s','now') * 1000 - 864000000),
(1, 'g3s-01', 39800, 22, 751000, 790800, '2026-01-15', '2026-01-31', 'healthy', '[]', strftime('%s','now') * 1000 - 1296000000),
(1, 'g3s-01', 38100, 20, 704000, 742100, '2026-01-15', '2026-01-26', 'healthy', '[]', strftime('%s','now') * 1000 - 1728000000),

-- @yn_personal_bot (id=2, macmini-1) - has warning
(2, 'macmini-1', 2145678, 118, 15840000, 17985678, '2025-11-01', '2026-02-15', 'warning', '["MEMORY.md 超过 2MB，建议清理"]', strftime('%s','now') * 1000 - 0),
(2, 'macmini-1', 2098000, 115, 15300000, 17398000, '2025-11-01', '2026-02-10', 'warning', '["MEMORY.md 超过 2MB"]', strftime('%s','now') * 1000 - 432000000),
(2, 'macmini-1', 2045000, 112, 14800000, 16845000, '2025-11-01', '2026-02-05', 'warning', '["MEMORY.md 超过 2MB"]', strftime('%s','now') * 1000 - 864000000),
(2, 'macmini-1', 1987000, 108, 14200000, 16187000, '2025-11-01', '2026-01-31', 'healthy', '[]', strftime('%s','now') * 1000 - 1296000000),
(2, 'macmini-1', 1923000, 104, 13600000, 15523000, '2025-11-01', '2026-01-26', 'healthy', '[]', strftime('%s','now') * 1000 - 1728000000),

-- @yn_agent_01_bot (id=3, nuc-2)
(3, 'nuc-2', 28450, 12, 345000, 373450, '2026-01-20', '2026-02-15', 'healthy', '[]', strftime('%s','now') * 1000 - 0),
(3, 'nuc-2', 26800, 11, 320000, 346800, '2026-01-20', '2026-02-10', 'healthy', '[]', strftime('%s','now') * 1000 - 432000000),
(3, 'nuc-2', 25100, 10, 295000, 320100, '2026-01-20', '2026-02-05', 'healthy', '[]', strftime('%s','now') * 1000 - 864000000),
(3, 'nuc-2', 23400, 9, 270000, 293400, '2026-01-20', '2026-01-31', 'healthy', '[]', strftime('%s','now') * 1000 - 1296000000),
(3, 'nuc-2', 21700, 8, 245000, 266700, '2026-01-20', '2026-01-26', 'healthy', '[]', strftime('%s','now') * 1000 - 1728000000);

-- 3. Sessions - Mock data
INSERT INTO sessions (bot_id, node_id, session_key, session_type, display_name, channel, model, total_tokens, is_active, last_activity_at, created_at) VALUES
-- @yn_work_bot (id=1) - 8 sessions
(1, 'g3s-01', 'agent:work:telegram:main', 'main', 'Main Session', 'telegram', 'anthropic/claude-sonnet-4-5', 1245000, 1, strftime('%s','now') * 1000 - 3600000, strftime('%s','now') * 1000 - 7776000000),
(1, 'g3s-01', 'agent:work:telegram:group:-5207852480', 'group', 'MacMini-1 Group', 'telegram', 'anthropic/claude-sonnet-4-5', 856000, 1, strftime('%s','now') * 1000 - 7200000, strftime('%s','now') * 1000 - 6048000000),
(1, 'g3s-01', 'agent:work:cron:ppcd-morning', 'cron', 'PPCD Morning Meeting', 'telegram', 'anthropic/claude-haiku-4', 45000, 1, strftime('%s','now') * 1000 - 86400000, strftime('%s','now') * 1000 - 5184000000),
(1, 'g3s-01', 'agent:work:cron:lunch-break', 'cron', 'Lunch Break Reminder', 'telegram', 'anthropic/claude-haiku-4', 23000, 1, strftime('%s','now') * 1000 - 43200000, strftime('%s','now') * 1000 - 5184000000),
(1, 'g3s-01', 'agent:work:cron:dt-bb-meeting', 'cron', 'DT-BB Meeting', 'telegram', 'anthropic/claude-haiku-4', 38000, 1, strftime('%s','now') * 1000 - 90000000, strftime('%s','now') * 1000 - 5184000000),
(1, 'g3s-01', 'agent:work:cron:daily-summary', 'cron', 'Daily Summary', 'telegram', 'anthropic/claude-sonnet-4', 67000, 1, strftime('%s','now') * 1000 - 172800000, strftime('%s','now') * 1000 - 5184000000),
(1, 'g3s-01', 'agent:work:cron:weekly-review', 'cron', 'Weekly Review', 'telegram', 'anthropic/claude-sonnet-4', 125000, 0, strftime('%s','now') * 1000 - 604800000, strftime('%s','now') * 1000 - 5184000000),
(1, 'g3s-01', 'agent:work:subagent:task-processor', 'subagent', 'Task Processor', 'telegram', 'anthropic/claude-sonnet-4', 89000, 0, strftime('%s','now') * 1000 - 259200000, strftime('%s','now') * 1000 - 2592000000),

-- @yn_personal_bot (id=2) - 5 sessions
(2, 'macmini-1', 'agent:personal:telegram:main', 'main', 'Main Session', 'telegram', 'anthropic/claude-sonnet-4-5', 985000, 1, strftime('%s','now') * 1000 - 1800000, strftime('%s','now') * 1000 - 8640000000),
(2, 'macmini-1', 'agent:personal:telegram:dm:123456', 'dm', 'Family Chat', 'telegram', 'anthropic/claude-sonnet-4', 234000, 1, strftime('%s','now') * 1000 - 14400000, strftime('%s','now') * 1000 - 7776000000),
(2, 'macmini-1', 'agent:personal:cron:morning-greeting', 'cron', 'Morning Greeting', 'telegram', 'anthropic/claude-haiku-4', 12000, 1, strftime('%s','now') * 1000 - 86400000, strftime('%s','now') * 1000 - 6048000000),
(2, 'macmini-1', 'agent:personal:cron:evening-summary', 'cron', 'Evening Summary', 'telegram', 'anthropic/claude-sonnet-4', 34000, 1, strftime('%s','now') * 1000 - 129600000, strftime('%s','now') * 1000 - 6048000000),
(2, 'macmini-1', 'agent:personal:cron:health-reminder', 'cron', 'Health Check Reminder', 'telegram', 'anthropic/claude-haiku-4', 8000, 1, strftime('%s','now') * 1000 - 43200000, strftime('%s','now') * 1000 - 4320000000),

-- @yn_agent_01_bot (id=3) - 3 sessions
(3, 'nuc-2', 'agent:alpha:telegram:main', 'main', 'Main Session', 'telegram', 'anthropic/claude-sonnet-4', 456000, 1, strftime('%s','now') * 1000 - 10800000, strftime('%s','now') * 1000 - 5184000000),
(3, 'nuc-2', 'agent:alpha:cron:heartbeat', 'cron', 'Heartbeat Check', 'telegram', 'anthropic/claude-haiku-4', 5000, 1, strftime('%s','now') * 1000 - 1800000, strftime('%s','now') * 1000 - 3456000000),
(3, 'nuc-2', 'agent:alpha:cron:status-report', 'cron', 'Status Report', 'telegram', 'anthropic/claude-sonnet-4', 28000, 1, strftime('%s','now') * 1000 - 259200000, strftime('%s','now') * 1000 - 3456000000);

-- 4. Cron Jobs - Mock data based on real jobs
INSERT INTO cron_jobs (bot_id, node_id, job_name, schedule_type, schedule_expr, payload_type, payload_text, session_target, enabled, last_run_at, last_result, created_at) VALUES
-- @yn_work_bot (id=1) - 10 cron jobs
(1, 'g3s-01', 'PPCD早会提醒', 'cron', '0 9 * * 1-5', 'systemEvent', 'PPCD早会时间到了！参会链接：...', 'isolated', 1, strftime('%s','now') * 1000 - 90000000, 'success', strftime('%s','now') * 1000 - 5184000000),
(1, 'g3s-01', '午休提醒', 'every', '12:00', 'systemEvent', '该休息啦！起来走走，放松一下', 'main', 1, strftime('%s','now') * 1000 - 43200000, 'success', strftime('%s','now') * 1000 - 5184000000),
(1, 'g3s-01', 'DT-BB早会', 'cron', '0 10 * * 2,4', 'systemEvent', 'DT-BB早会开始，Zoom链接：...', 'isolated', 1, strftime('%s','now') * 1000 - 90000000, 'success', strftime('%s','now') * 1000 - 5184000000),
(1, 'g3s-01', '每日工作总结', 'every', '18:00', 'agentTurn', '请总结今天的工作内容和进展', 'main', 1, strftime('%s','now') * 1000 - 172800000, 'success', strftime('%s','now') * 1000 - 5184000000),
(1, 'g3s-01', '周度复盘', 'cron', '0 10 * * 1', 'agentTurn', '生成上周工作总结和本周计划', 'isolated', 1, strftime('%s','now') * 1000 - 604800000, 'success', strftime('%s','now') * 1000 - 5184000000),
(1, 'g3s-01', 'API Keys健康检查', 'cron', '0 6 * * 1', 'agentTurn', '检查所有API Keys状态和余额', 'isolated', 1, strftime('%s','now') * 1000 - 691200000, 'success', strftime('%s','now') * 1000 - 4320000000),
(1, 'g3s-01', '备份检查', 'cron', '0 7 * * *', 'agentTurn', '检查昨日备份是否成功', 'isolated', 1, strftime('%s','now') * 1000 - 86400000, 'success', strftime('%s','now') * 1000 - 4320000000),
(1, 'g3s-01', 'GitHub Issues同步', 'every', '09:00,15:00', 'agentTurn', '同步GitHub Issues到工作日志', 'main', 0, strftime('%s','now') * 1000 - 259200000, 'failed', strftime('%s','now') * 1000 - 3456000000),
(1, 'g3s-01', '节点健康检查', 'every', '30m', 'agentTurn', '检查所有节点状态和资源使用', 'isolated', 1, strftime('%s','now') * 1000 - 1800000, 'success', strftime('%s','now') * 1000 - 2592000000),
(1, 'g3s-01', '月度报告', 'cron', '0 10 1 * *', 'agentTurn', '生成上月工作总结和下月计划', 'isolated', 1, strftime('%s','now') * 1000 - 2592000000, 'success', strftime('%s','now') * 1000 - 2592000000),

-- @yn_personal_bot (id=2) - 7 cron jobs
(2, 'macmini-1', '早安问候', 'every', '08:00', 'systemEvent', '早上好！今天是美好的一天 🌅', 'main', 1, strftime('%s','now') * 1000 - 86400000, 'success', strftime('%s','now') * 1000 - 6048000000),
(2, 'macmini-1', '晚安总结', 'every', '22:00', 'agentTurn', '今天过得怎么样？有什么想记录的吗？', 'main', 1, strftime('%s','now') * 1000 - 129600000, 'success', strftime('%s','now') * 1000 - 6048000000),
(2, 'macmini-1', '健康提醒', 'every', '10:00,15:00,20:00', 'systemEvent', '记得喝水，站起来活动一下！', 'main', 1, strftime('%s','now') * 1000 - 43200000, 'success', strftime('%s','now') * 1000 - 5184000000),
(2, 'macmini-1', '周末计划', 'cron', '0 10 * * 6', 'agentTurn', '周末有什么计划吗？要不要推荐一些活动？', 'main', 1, strftime('%s','now') * 1000 - 604800000, 'success', strftime('%s','now') * 1000 - 4320000000),
(2, 'macmini-1', '生日提醒检查', 'cron', '0 9 * * *', 'agentTurn', '检查通讯录中是否有人生日', 'isolated', 1, strftime('%s','now') * 1000 - 86400000, 'success', strftime('%s','now') * 1000 - 4320000000),
(2, 'macmini-1', '天气预报', 'every', '07:00', 'agentTurn', '获取今日天气，提醒穿衣和带伞', 'isolated', 1, strftime('%s','now') * 1000 - 86400000, 'success', strftime('%s','now') * 1000 - 3456000000),
(2, 'macmini-1', '记忆整理', 'cron', '0 3 * * 0', 'agentTurn', '整理本周记忆，更新MEMORY.md', 'isolated', 0, strftime('%s','now') * 1000 - 604800000, 'success', strftime('%s','now') * 1000 - 2592000000),

-- @yn_agent_01_bot (id=3) - 4 cron jobs
(3, 'nuc-2', '心跳检查', 'every', '30m', 'agentTurn', '执行heartbeat检查任务', 'main', 1, strftime('%s','now') * 1000 - 1800000, 'success', strftime('%s','now') * 1000 - 3456000000),
(3, 'nuc-2', '状态报告', 'cron', '0 9,18 * * *', 'agentTurn', '生成系统状态报告', 'isolated', 1, strftime('%s','now') * 1000 - 259200000, 'success', strftime('%s','now') * 1000 - 3456000000),
(3, 'nuc-2', '日志清理', 'cron', '0 4 * * 0', 'agentTurn', '清理7天前的日志文件', 'isolated', 1, strftime('%s','now') * 1000 - 604800000, 'success', strftime('%s','now') * 1000 - 2592000000),
(3, 'nuc-2', '资源监控', 'every', '10m', 'agentTurn', '监控系统资源使用情况', 'isolated', 1, strftime('%s','now') * 1000 - 600000, 'success', strftime('%s','now') * 1000 - 1728000000);

-- 5. Gateway Configs - Mock data for each node
INSERT INTO gateway_configs (node_id, config_json, channels, default_model, agent_workspace, heartbeat_enabled, heartbeat_interval, fetched_at) VALUES
('g3s-01', '{"channels":["telegram"],"heartbeat":{"enabled":true,"intervalMinutes":30}}', '["telegram"]', 'anthropic/claude-sonnet-4-5', '/home/ocm/.openclaw/workspace', 1, '30min', strftime('%s','now') * 1000),
('macmini-1', '{"channels":["telegram"],"heartbeat":{"enabled":true,"intervalMinutes":30}}', '["telegram"]', 'anthropic/claude-sonnet-4-5', '/Users/yano/.openclaw/workspace', 1, '30min', strftime('%s','now') * 1000),
('nuc-2', '{"channels":["telegram"],"heartbeat":{"enabled":true,"intervalMinutes":60}}', '["telegram"]', 'anthropic/claude-sonnet-4', '/home/ocm/.openclaw/workspace', 1, '60min', strftime('%s','now') * 1000),
('rpi-work', '{"channels":["telegram"],"heartbeat":{"enabled":false}}', '["telegram"]', 'anthropic/claude-haiku-4', '/home/pi/.openclaw/workspace', 0, null, strftime('%s','now') * 1000),
('vps-hk-1', '{"channels":["telegram","discord"],"heartbeat":{"enabled":true,"intervalMinutes":30}}', '["telegram","discord"]', 'anthropic/claude-sonnet-4', '/opt/openclaw/workspace', 1, '30min', strftime('%s','now') * 1000),
('dev-local', '{"channels":["telegram"],"heartbeat":{"enabled":false}}', '["telegram"]', 'anthropic/claude-sonnet-4-5', '/Users/dev/.openclaw/workspace', 0, null, strftime('%s','now') * 1000),
('aws-prod', '{"channels":["telegram","slack"],"heartbeat":{"enabled":true,"intervalMinutes":15}}', '["telegram","slack"]', 'anthropic/claude-opus-4-6', '/var/openclaw/workspace', 1, '15min', strftime('%s','now') * 1000);

-- 6. Skills - Mock data for each node
INSERT INTO skills (node_id, skill_name, skill_path, source, description, version, created_at) VALUES
-- g3s-01 (7 skills)
('g3s-01', 'weather', '/home/ocm/.openclaw/skills/bundled/weather', 'bundled', '天气查询 - 支持全球城市天气预报', 'v1.2.0', strftime('%s','now') * 1000),
('g3s-01', 'video-frames', '/home/ocm/.openclaw/skills/bundled/video-frames', 'bundled', '视频帧提取 - 分析视频内容', 'v1.0.3', strftime('%s','now') * 1000),
('g3s-01', 'healthcheck', '/home/ocm/.openclaw/skills/bundled/healthcheck', 'bundled', '健康检查 - 系统状态监控', 'v1.1.0', strftime('%s','now') * 1000),
('g3s-01', 'coding-agent', '/home/ocm/.openclaw/skills/bundled/coding-agent', 'bundled', '代码助手 - 多语言编程支持', 'v2.0.1', strftime('%s','now') * 1000),
('g3s-01', 'skill-creator', '/home/ocm/.openclaw/skills/bundled/skill-creator', 'bundled', 'Skill创建器 - 快速生成新技能', 'v1.3.0', strftime('%s','now') * 1000),
('g3s-01', 'security-sentinel', '/home/ocm/.openclaw/workspace/skills/security-sentinel', 'custom', '安全哨兵 - 监控异常访问', 'v1.0.0', strftime('%s','now') * 1000),
('g3s-01', 'sw-devops', '/home/ocm/.openclaw/workspace/skills/sw-devops', 'custom', '软件开发运维工具集', 'v0.9.0', strftime('%s','now') * 1000),

-- macmini-1 (8 skills)
('macmini-1', 'weather', '/Users/yano/.openclaw/skills/bundled/weather', 'bundled', '天气查询', 'v1.2.0', strftime('%s','now') * 1000),
('macmini-1', 'video-frames', '/Users/yano/.openclaw/skills/bundled/video-frames', 'bundled', '视频帧提取', 'v1.0.3', strftime('%s','now') * 1000),
('macmini-1', 'healthcheck', '/Users/yano/.openclaw/skills/bundled/healthcheck', 'bundled', '健康检查', 'v1.1.0', strftime('%s','now') * 1000),
('macmini-1', 'coding-agent', '/Users/yano/.openclaw/skills/bundled/coding-agent', 'bundled', '代码助手', 'v2.0.1', strftime('%s','now') * 1000),
('macmini-1', 'skill-creator', '/Users/yano/.openclaw/skills/bundled/skill-creator', 'bundled', 'Skill创建器', 'v1.3.0', strftime('%s','now') * 1000),
('macmini-1', 'calendar-sync', '/Users/yano/.openclaw/workspace/skills/calendar-sync', 'custom', '日历同步 - Google Calendar集成', 'v1.1.0', strftime('%s','now') * 1000),
('macmini-1', 'home-automation', '/Users/yano/.openclaw/workspace/skills/home-automation', 'custom', '家庭自动化控制', 'v2.0.0', strftime('%s','now') * 1000),
('macmini-1', 'photo-organizer', '/Users/yano/.openclaw/workspace/skills/photo-organizer', 'custom', '照片智能分类整理', 'v0.8.5', strftime('%s','now') * 1000),

-- nuc-2 (5 skills)
('nuc-2', 'weather', '/home/ocm/.openclaw/skills/bundled/weather', 'bundled', '天气查询', 'v1.2.0', strftime('%s','now') * 1000),
('nuc-2', 'healthcheck', '/home/ocm/.openclaw/skills/bundled/healthcheck', 'bundled', '健康检查', 'v1.1.0', strftime('%s','now') * 1000),
('nuc-2', 'coding-agent', '/home/ocm/.openclaw/skills/bundled/coding-agent', 'bundled', '代码助手', 'v2.0.1', strftime('%s','now') * 1000),
('nuc-2', 'skill-creator', '/home/ocm/.openclaw/skills/bundled/skill-creator', 'bundled', 'Skill创建器', 'v1.3.0', strftime('%s','now') * 1000),
('nuc-2', 'network-monitor', '/home/ocm/.openclaw/workspace/skills/network-monitor', 'custom', '网络监控工具', 'v1.2.0', strftime('%s','now') * 1000),

-- rpi-work (4 skills - minimal)
('rpi-work', 'weather', '/home/pi/.openclaw/skills/bundled/weather', 'bundled', '天气查询', 'v1.2.0', strftime('%s','now') * 1000),
('rpi-work', 'healthcheck', '/home/pi/.openclaw/skills/bundled/healthcheck', 'bundled', '健康检查', 'v1.1.0', strftime('%s','now') * 1000),
('rpi-work', 'sensor-reader', '/home/pi/.openclaw/workspace/skills/sensor-reader', 'custom', 'IoT传感器读取', 'v1.0.0', strftime('%s','now') * 1000),
('rpi-work', 'gpio-control', '/home/pi/.openclaw/workspace/skills/gpio-control', 'custom', 'GPIO端口控制', 'v0.7.0', strftime('%s','now') * 1000),

-- vps-hk-1 (6 skills)
('vps-hk-1', 'weather', '/opt/openclaw/skills/bundled/weather', 'bundled', '天气查询', 'v1.2.0', strftime('%s','now') * 1000),
('vps-hk-1', 'video-frames', '/opt/openclaw/skills/bundled/video-frames', 'bundled', '视频帧提取', 'v1.0.3', strftime('%s','now') * 1000),
('vps-hk-1', 'healthcheck', '/opt/openclaw/skills/bundled/healthcheck', 'bundled', '健康检查', 'v1.1.0', strftime('%s','now') * 1000),
('vps-hk-1', 'coding-agent', '/opt/openclaw/skills/bundled/coding-agent', 'bundled', '代码助手', 'v2.0.1', strftime('%s','now') * 1000),
('vps-hk-1', 'skill-creator', '/opt/openclaw/skills/bundled/skill-creator', 'bundled', 'Skill创建器', 'v1.3.0', strftime('%s','now') * 1000),
('vps-hk-1', 'cdn-manager', '/opt/openclaw/workspace/skills/cdn-manager', 'custom', 'CDN管理工具', 'v1.0.0', strftime('%s','now') * 1000),

-- dev-local (5 skills)
('dev-local', 'weather', '/Users/dev/.openclaw/skills/bundled/weather', 'bundled', '天气查询', 'v1.2.0', strftime('%s','now') * 1000),
('dev-local', 'healthcheck', '/Users/dev/.openclaw/skills/bundled/healthcheck', 'bundled', '健康检查', 'v1.1.0', strftime('%s','now') * 1000),
('dev-local', 'coding-agent', '/Users/dev/.openclaw/skills/bundled/coding-agent', 'bundled', '代码助手', 'v2.0.1', strftime('%s','now') * 1000),
('dev-local', 'skill-creator', '/Users/dev/.openclaw/skills/bundled/skill-creator', 'bundled', 'Skill创建器', 'v1.3.0', strftime('%s','now') * 1000),
('dev-local', 'test-harness', '/Users/dev/.openclaw/workspace/skills/test-harness', 'custom', '测试框架', 'v0.5.0', strftime('%s','now') * 1000),

-- aws-prod (7 skills)
('aws-prod', 'weather', '/var/openclaw/skills/bundled/weather', 'bundled', '天气查询', 'v1.2.0', strftime('%s','now') * 1000),
('aws-prod', 'video-frames', '/var/openclaw/skills/bundled/video-frames', 'bundled', '视频帧提取', 'v1.0.3', strftime('%s','now') * 1000),
('aws-prod', 'healthcheck', '/var/openclaw/skills/bundled/healthcheck', 'bundled', '健康检查', 'v1.1.0', strftime('%s','now') * 1000),
('aws-prod', 'coding-agent', '/var/openclaw/skills/bundled/coding-agent', 'bundled', '代码助手', 'v2.0.1', strftime('%s','now') * 1000),
('aws-prod', 'skill-creator', '/var/openclaw/skills/bundled/skill-creator', 'bundled', 'Skill创建器', 'v1.3.0', strftime('%s','now') * 1000),
('aws-prod', 'aws-manager', '/var/openclaw/workspace/skills/aws-manager', 'custom', 'AWS资源管理', 'v2.1.0', strftime('%s','now') * 1000),
('aws-prod', 'load-balancer', '/var/openclaw/workspace/skills/load-balancer', 'custom', '负载均衡器管理', 'v1.3.0', strftime('%s','now') * 1000);
