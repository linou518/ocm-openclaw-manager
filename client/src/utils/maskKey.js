/**
 * 脱敏显示 API Key
 * 只显示前6位和后3位，中间用 ••• 替代
 */
export function maskKey(key) {
  if (!key || key.length < 10) return '•••';
  const prefix = key.substring(0, 6);
  const suffix = key.substring(key.length - 3);
  return `${prefix}•••${suffix}`;
}

/**
 * 获取 Provider 显示名
 */
export function getProviderName(provider) {
  const map = {
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    google: 'Google',
    groq: 'Groq',
    mistral: 'Mistral',
    cohere: 'Cohere',
    custom: 'Custom',
  };
  return map[provider] || provider;
}

/**
 * 获取 Provider 颜色
 */
export function getProviderColor(provider) {
  const map = {
    anthropic: 'text-orange-600 bg-orange-50',
    openai: 'text-green-600 bg-green-50',
    google: 'text-blue-600 bg-blue-50',
    groq: 'text-purple-600 bg-purple-50',
    mistral: 'text-pink-600 bg-pink-50',
    cohere: 'text-indigo-600 bg-indigo-50',
    custom: 'text-gray-600 bg-gray-50',
  };
  return map[provider] || 'text-gray-600 bg-gray-50';
}

/**
 * 获取状态图标
 */
export function getStatusIcon(status) {
  const map = {
    valid: '✅',
    invalid: '❌',
    expired: '⏰',
    unknown: '⏳',
    running: '🟢',
    stopped: '🔴',
    error: '⚠️',
  };
  return map[status] || '❓';
}

/**
 * 获取平台图标
 */
export function getPlatformIcon(platform) {
  const map = {
    telegram: '✈️',
    discord: '💬',
    slack: '📢',
  };
  return map[platform] || '🤖';
}
