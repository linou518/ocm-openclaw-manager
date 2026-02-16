-- Mock 账号数据

-- Anthropic 账号
INSERT INTO accounts (provider, account_name, email, plan, monthly_budget, monthly_used, status, note)
VALUES 
  ('anthropic', 'Anthropic 个人账号', 'yano@personal.com', 'pro', 100.0, 45.3, 'active', 'Pro plan - 个人主力账号'),
  ('anthropic', 'Anthropic 公司账号', 'team@company.com', 'team', 500.0, 212.8, 'active', 'Team plan - 公司共用');

-- OpenAI 账号
INSERT INTO accounts (provider, account_name, email, plan, monthly_budget, monthly_used, status, note)
VALUES 
  ('openai', 'OpenAI 个人账号', 'yano@personal.com', 'plus', 20.0, 8.5, 'active', 'ChatGPT Plus 会员'),
  ('openai', 'OpenAI API账号', 'api@company.com', 'pay-as-you-go', 200.0, 67.2, 'active', 'API 按量付费账号');

-- Google AI 账号
INSERT INTO accounts (provider, account_name, email, plan, monthly_budget, monthly_used, status, note)
VALUES 
  ('google', 'Google AI 账号', 'yano@gmail.com', 'free', 0.0, 0.0, 'active', 'Gemini 免费额度');

-- Groq 账号
INSERT INTO accounts (provider, account_name, email, plan, monthly_budget, monthly_used, status, note)
VALUES 
  ('groq', 'Groq 账号', 'yano@personal.com', 'free', 0.0, 0.0, 'active', '免费 tier');

-- Mistral 账号
INSERT INTO accounts (provider, account_name, email, plan, monthly_budget, monthly_used, status, note)
VALUES 
  ('mistral', 'Mistral Pro 账号', 'yano@personal.com', 'pro', 50.0, 12.5, 'active', 'Pro plan');

-- 更新现有 api_keys 表，关联到账号
-- 假设现有的keys按顺序分配给各账号

-- Anthropic keys → account 1, 2
UPDATE api_keys SET account_id = 1 WHERE provider = 'anthropic' AND id IN (
  SELECT id FROM api_keys WHERE provider = 'anthropic' ORDER BY id LIMIT 3
);

UPDATE api_keys SET account_id = 2 WHERE provider = 'anthropic' AND account_id IS NULL;

-- OpenAI keys → account 3, 4
UPDATE api_keys SET account_id = 3 WHERE provider = 'openai' AND id IN (
  SELECT id FROM api_keys WHERE provider = 'openai' ORDER BY id LIMIT 2
);

UPDATE api_keys SET account_id = 4 WHERE provider = 'openai' AND account_id IS NULL;

-- Google keys → account 5
UPDATE api_keys SET account_id = 5 WHERE provider = 'google';

-- Groq keys → account 6
UPDATE api_keys SET account_id = 6 WHERE provider = 'groq';

-- Mistral keys → account 7
UPDATE api_keys SET account_id = 7 WHERE provider = 'mistral';
