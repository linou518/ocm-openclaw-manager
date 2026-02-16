import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import TokenModal from './TokenModal';

function NodeCard({ node, onNodeAction }) {
  const [actionLoading, setActionLoading] = useState(null);
  const [showTokenModal, setShowTokenModal] = useState(false);
  
  const statusConfig = {
    online: { color: 'text-green-400', bg: 'bg-green-900/30', border: 'border-green-700', dot: 'bg-green-400' },
    unstable: { color: 'text-yellow-400', bg: 'bg-yellow-900/30', border: 'border-yellow-700', dot: 'bg-yellow-400' },
    offline: { color: 'text-red-400', bg: 'bg-red-900/30', border: 'border-red-700', dot: 'bg-red-400' },
    error: { color: 'text-orange-400', bg: 'bg-orange-900/30', border: 'border-orange-700', dot: 'bg-orange-400' },
    unknown: { color: 'text-gray-400', bg: 'bg-gray-900/30', border: 'border-gray-700', dot: 'bg-gray-400' },
    installing: { color: 'text-blue-400', bg: 'bg-blue-900/30', border: 'border-blue-700', dot: 'bg-blue-400' }
  };

  const config = statusConfig[node.status] || statusConfig.error;

  const getScoreColor = (score) => {
    if (score >= 90) return 'text-green-400';
    if (score >= 70) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getProgressColor = (usage) => {
    if (usage >= 80) return 'bg-red-500';
    if (usage >= 60) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '--';
    const now = Date.now();
    const diff = now - timestamp;
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor(diff / 60000);
    if (hours > 0) return `${hours}h前`;
    if (minutes > 0) return `${minutes}min前`;
    return '刚刚';
  };

  const handleAction = async (action) => {
    if (actionLoading) return;
    
    setActionLoading(action);
    try {
      const res = await fetch(`/api/nodes/${node.id}/${action}`, { method: 'POST' });
      const result = await res.json();
      
      if (res.ok) {
        alert(`✅ ${action} 操作成功: ${result.message}`);
        if (onNodeAction) onNodeAction();
      } else {
        alert(`❌ ${action} 操作失败: ${result.error}`);
      }
    } catch (error) {
      alert(`❌ ${action} 操作失败: ${error.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Token相关辅助函数
  const getTokenColor = (tokenInfo) => {
    if (!tokenInfo) return 'text-gray-400 bg-gray-900/20 border-gray-700';
    
    switch (tokenInfo.status) {
      case 'active':
        switch (tokenInfo.provider) {
          case 'anthropic':
            return 'text-orange-400 bg-orange-900/20 border-orange-700';
          case 'openai':
            return 'text-green-400 bg-green-900/20 border-green-700';
          case 'gemini':
            return 'text-blue-400 bg-blue-900/20 border-blue-700';
          case 'openrouter':
            return 'text-purple-400 bg-purple-900/20 border-purple-700';
          default:
            return 'text-blue-400 bg-blue-900/20 border-blue-700';
        }
      case 'no_auth':
        return 'text-yellow-400 bg-yellow-900/20 border-yellow-700';
      case 'error':
        return 'text-red-400 bg-red-900/20 border-red-700';
      default:
        return 'text-gray-400 bg-gray-900/20 border-gray-700';
    }
  };

  const getTokenDisplay = (tokenInfo) => {
    if (!tokenInfo) return 'UNKNOWN';
    
    switch (tokenInfo.status) {
      case 'active':
        return tokenInfo.provider?.toUpperCase() || 'ACTIVE';
      case 'no_auth':
        return 'NO AUTH';
      case 'error':
        return 'ERROR';
      default:
        return 'UNKNOWN';
    }
  };

  const handleTokenUpdate = () => {
    if (onNodeAction) onNodeAction();
  };

  return (
    <div className={`bg-gray-800 rounded-lg border ${config.border} shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] overflow-hidden`}>
      {/* 顶部状态条 */}
      <div className={`h-1 ${config.dot}`}></div>
      
      <div className="p-4">
        {/* 标题栏 */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${config.dot} animate-pulse`}></div>
            <h3 className="font-bold text-white text-lg">{node.id}</h3>
          </div>
          <span className="text-xs text-gray-500">{node.openclaw_version || 'v1.8.2'}</span>
        </div>
        
        {/* IP地址 */}
        <div className="text-sm text-gray-400 mb-3 font-mono">{node.host}</div>
        
        {/* CPU & RAM 进度条 */}
        <div className="space-y-2 mb-3">
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-400">CPU</span>
              <span className="text-gray-300 font-medium">{Math.round(node.cpu_usage)}%</span>
            </div>
            <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className={`h-full ${getProgressColor(node.cpu_usage)} transition-all duration-300`}
                style={{ width: `${node.cpu_usage}%` }}
              ></div>
            </div>
          </div>
          
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-400">RAM</span>
              <span className="text-gray-300 font-medium">{Math.round(node.ram_usage)}%</span>
            </div>
            <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className={`h-full ${getProgressColor(node.ram_usage)} transition-all duration-300`}
                style={{ width: `${node.ram_usage}%` }}
              ></div>
            </div>
          </div>
        </div>
        
        {/* 统计信息 */}
        <div className="flex items-center justify-between text-sm mb-4 pt-3 border-t border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1">
              <span>🧠</span>
              <span className={`font-bold ${getScoreColor(node.last_score)}`}>
                {node.last_score || '--'}
              </span>
            </div>
            <div className="flex items-center space-x-1 text-gray-400">
              <span>🤖</span>
              <span>{node.bot_count || 0}</span>
            </div>
            <div className="flex items-center space-x-1 text-gray-400">
              <span>💾</span>
              <span className="text-xs">{formatTime(node.last_backup_at)}</span>
            </div>
          </div>
        </div>

        {/* Token信息 */}
        {node.token_info && (
          <div className="mb-4 pt-3 border-t border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-400">🔑 API:</span>
                <div className={`px-2 py-1 rounded text-xs font-medium border ${getTokenColor(node.token_info)}`}>
                  {getTokenDisplay(node.token_info)}
                </div>
                {node.token_info.token_preview && (
                  <span className="text-xs text-gray-500 font-mono">
                    {node.token_info.token_preview}
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowTokenModal(true)}
                className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                title="管理Token"
              >
                🔧
              </button>
            </div>
          </div>
        )}
        
        {/* 操作按钮 - 增强版 */}
        <div className="space-y-2">
          {/* 第一行：详情和外部链接 */}
          <div className="flex items-center gap-2">
            <Link
              to={`/nodes/${node.id}`}
              className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors text-center"
            >
              详情
            </Link>
            <a
              href={`http://${node.host}:3000`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium rounded-md transition-colors"
              title="打开 OpenClaw 界面"
            >
              ↗
            </a>
          </div>
          
          {/* 第二行：节点操作按钮 */}
          <div className="flex items-center gap-1">
            {node.status === 'online' ? (
              <>
                <button
                  onClick={() => handleAction('restart')}
                  disabled={actionLoading}
                  className="flex-1 px-2 py-1.5 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white text-xs font-medium rounded transition-colors"
                >
                  {actionLoading === 'restart' ? '...' : '🔄 重启'}
                </button>
                <button
                  onClick={() => handleAction('stop')}
                  disabled={actionLoading}
                  className="flex-1 px-2 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white text-xs font-medium rounded transition-colors"
                >
                  {actionLoading === 'stop' ? '...' : '⏹ 停止'}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleAction('start')}
                  disabled={actionLoading}
                  className="flex-1 px-2 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white text-xs font-medium rounded transition-colors"
                >
                  {actionLoading === 'start' ? '...' : '▶ 启动'}
                </button>
                <button
                  onClick={() => handleAction('repair')}
                  disabled={actionLoading}
                  className="flex-1 px-2 py-1.5 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white text-xs font-medium rounded transition-colors"
                >
                  {actionLoading === 'repair' ? '...' : '🔧 修复'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Token管理Modal */}
      <TokenModal
        isOpen={showTokenModal}
        onClose={() => setShowTokenModal(false)}
        node={node}
        onTokenUpdate={handleTokenUpdate}
      />
    </div>
  );
}

export default NodeCard;