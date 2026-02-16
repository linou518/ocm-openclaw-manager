import React, { useState, useEffect } from 'react';

function TokenModal({ isOpen, onClose, node, onTokenUpdate }) {
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchProviders();
      // 如果节点已有token信息，预选择提供商
      if (node?.token_info?.provider && node.token_info.provider !== 'unknown') {
        setSelectedProvider(node.token_info.provider);
      }
    }
  }, [isOpen, node]);

  const fetchProviders = async () => {
    try {
      const res = await fetch('/api/token/providers');
      const result = await res.json();
      if (result.success) {
        setProviders(result.providers);
      }
    } catch (error) {
      console.error('获取提供商列表失败:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProvider || !token) {
      setError('请选择提供商并输入Token');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/nodes/${node.id}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          provider: selectedProvider,
          token: token
        })
      });

      const result = await res.json();

      if (result.success) {
        alert('✅ Token设置成功！');
        if (onTokenUpdate) onTokenUpdate();
        handleClose();
      } else {
        setError(result.error || 'Token设置失败');
      }
    } catch (error) {
      setError(`网络错误: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setToken('');
    setSelectedProvider('');
    setError('');
    onClose();
  };

  const getProviderColor = (providerId) => {
    const colors = {
      anthropic: 'text-orange-400 bg-orange-900/20 border-orange-700',
      openai: 'text-green-400 bg-green-900/20 border-green-700',
      gemini: 'text-blue-400 bg-blue-900/20 border-blue-700',
      openrouter: 'text-purple-400 bg-purple-900/20 border-purple-700'
    };
    return colors[providerId] || 'text-gray-400 bg-gray-900/20 border-gray-700';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">🔑 设置API Token</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white text-xl"
          >
            ×
          </button>
        </div>

        {/* 当前Token状态 */}
        {node?.token_info && (
          <div className="mb-4 p-3 bg-gray-900 rounded border border-gray-600">
            <div className="text-sm text-gray-300 mb-1">当前状态</div>
            <div className="flex items-center space-x-2">
              <div className={`px-2 py-1 rounded text-xs font-medium border ${getProviderColor(node.token_info.provider)}`}>
                {node.token_info.provider?.toUpperCase() || 'UNKNOWN'}
              </div>
              {node.token_info.token_preview && (
                <span className="text-xs text-gray-400 font-mono">
                  {node.token_info.token_preview}
                </span>
              )}
              <div className={`text-xs px-2 py-1 rounded ${
                node.token_info.status === 'active' 
                  ? 'text-green-400 bg-green-900/20' 
                  : 'text-yellow-400 bg-yellow-900/20'
              }`}>
                {node.token_info.status}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* 选择提供商 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              选择提供商
            </label>
            <div className="grid grid-cols-2 gap-2">
              {providers.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => setSelectedProvider(provider.id)}
                  className={`p-3 rounded border text-left transition-all ${
                    selectedProvider === provider.id
                      ? `${getProviderColor(provider.id)} border-2`
                      : 'text-gray-400 bg-gray-900/50 border-gray-600 hover:border-gray-500'
                  }`}
                >
                  <div className="font-medium">{provider.name}</div>
                  <div className="text-xs text-gray-400">{provider.description}</div>
                  <div className="text-xs font-mono mt-1">{provider.token_format}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 输入Token */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              API Token
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={
                selectedProvider 
                  ? providers.find(p => p.id === selectedProvider)?.token_format 
                  : 'Please select a provider first'
              }
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono text-sm"
              disabled={!selectedProvider}
            />
            {selectedProvider && (
              <p className="text-xs text-gray-400 mt-1">
                Token将通过SSH安全传输到节点并保存在OpenClaw配置中
              </p>
            )}
          </div>

          {/* 错误信息 */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-700 rounded">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* 按钮 */}
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 text-gray-400 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
              disabled={loading}
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading || !selectedProvider || !token}
            >
              {loading ? '设置中...' : '设置Token'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TokenModal;