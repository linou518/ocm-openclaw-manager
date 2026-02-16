const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'ocm.db');
const db = new Database(dbPath);

console.log('🌱 Seeding Phase 3 data (API Keys + Bots)...');

// Mock API Keys
const providers = ['anthropic', 'openai', 'google', 'groq', 'mistral', 'cohere'];
const nodes = db.prepare('SELECT id FROM nodes').all();

const insertKey = db.prepare(`
  INSERT INTO api_keys (node_id, provider, key_name, api_key, is_active, last_verified_at, status, monthly_limit, monthly_used, note)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const randomStatus = () => {
  const statuses = ['valid', 'valid', 'valid', 'unknown', 'invalid'];
  return statuses[Math.floor(Math.random() * statuses.length)];
};

const randomKey = (provider) => {
  const prefixes = {
    anthropic: 'sk-ant-',
    openai: 'sk-',
    google: 'AIza',
    groq: 'gsk_',
    mistral: 'mst_',
    cohere: 'co_',
  };
  const prefix = prefixes[provider] || 'key_';
  const suffix = Math.random().toString(36).substring(2, 15).toUpperCase();
  return prefix + suffix;
};

nodes.forEach(node => {
  // 每个节点必有 Anthropic
  const anthropicKey = randomKey('anthropic');
  insertKey.run(
    node.id,
    'anthropic',
    'Anthropic主Key',
    anthropicKey,
    1,
    Date.now() - Math.floor(Math.random() * 86400000),
    randomStatus(),
    500,
    Math.random() * 100,
    'Primary API key for Claude'
  );

  // 随机添加 1-2 个其他 provider
  const otherProviders = providers.filter(p => p !== 'anthropic');
  const count = Math.floor(Math.random() * 2) + 1;
  const selected = otherProviders.sort(() => 0.5 - Math.random()).slice(0, count);

  selected.forEach((provider, idx) => {
    const keyName = idx === 0 ? `${provider.charAt(0).toUpperCase() + provider.slice(1)}主Key` : `${provider}备用`;
    insertKey.run(
      node.id,
      provider,
      keyName,
      randomKey(provider),
      idx === 0 ? 1 : 0,
      Date.now() - Math.floor(Math.random() * 86400000),
      randomStatus(),
      300,
      Math.random() * 50,
      ''
    );
  });

  console.log(`✅ Added API keys for ${node.id}`);
});

// Mock Bots
const botConfigs = {
  'g3s-01': [
    { name: '@yn_agent_01_bot', status: 'running', openclaw_url: 'http://192.168.20.101:3000' },
    { name: '@yn_test_bot', status: 'stopped', openclaw_url: 'http://192.168.20.101:3000' },
  ],
  'g3s-02': [
    { name: '@yn_agent_02_bot', status: 'running', openclaw_url: 'http://192.168.20.102:3000' },
  ],
  'g3s-03': [
    { name: '@yn_agent_03_bot', status: 'running', openclaw_url: 'http://192.168.20.103:3000' },
    { name: '@yn_monitor_bot', status: 'running', openclaw_url: 'http://192.168.20.103:3000' },
  ],
  'g3s-04': [
    { name: '@yn_agent_04_bot', status: 'error', openclaw_url: 'http://192.168.20.104:3000' },
  ],
  'g3s-05': [
    { name: '@yn_agent_05_bot', status: 'running', openclaw_url: 'http://192.168.20.105:3000' },
  ],
  'macmini-01': [
    { name: '@yn_work_bot', status: 'running', openclaw_url: 'http://192.168.20.127:3000' },
    { name: '@yn_personal_bot', status: 'running', openclaw_url: 'http://192.168.20.127:3000' },
  ],
  'macmini-02': [
    { name: '@yn_test_env_bot', status: 'running', openclaw_url: 'http://192.168.20.128:3000' },
  ],
};

const insertBot = db.prepare(`
  INSERT INTO bots (node_id, bot_name, bot_token, platform, workspace_path, status, session_count, cron_count, model, openclaw_url)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const models = ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'gpt-4-turbo'];

Object.entries(botConfigs).forEach(([nodeId, bots]) => {
  bots.forEach(botConfig => {
    const token = `${Math.random().toString(36).substring(2, 15)}:${Math.random().toString(36).substring(2, 35)}`;
    const workspacePath = `/home/ocm/.openclaw/workspace`;
    const sessionCount = botConfig.status === 'running' ? Math.floor(Math.random() * 20) + 1 : 0;
    const cronCount = botConfig.status === 'running' ? Math.floor(Math.random() * 5) : 0;
    const model = models[Math.floor(Math.random() * models.length)];

    insertBot.run(
      nodeId,
      botConfig.name,
      token,
      'telegram',
      workspacePath,
      botConfig.status,
      sessionCount,
      cronCount,
      model,
      botConfig.openclaw_url
    );
  });
  console.log(`✅ Added bots for ${nodeId}`);
});

console.log('✅ Phase 3 data seeded successfully!');
db.close();
