import React, { useState, useEffect } from 'react';
import PaginationEx from '../components/PaginationEx';
import ImplementationModal from '../components/ImplementationModal';
import ConfirmDialog from '../components/ConfirmDialog';

function Keys() {
  const [accounts, setAccounts] = useState([]);
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalData, setModalData] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, keyId: null, keyName: '' });
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    fetchAccounts();
    fetchKeys();
  }, []);

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/accounts');
      const json = await res.json();
      setAccounts(json);
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
    }
  };

  const fetchKeys = async () => {
    try {
      const res = await fetch(`/api/keys?page=1&limit=1000`);
      const json = await res.json();
      setKeys(json.data || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch keys:', error);
      setLoading(false);
    }
  };

  const maskKey = (key) => {
    if (!key) return '***';
    if (key.length < 8) return '***';
    return key.substring(0, 4) + '...' + key.substring(key.length - 4);
  };

  const getProviderColor = (provider) => {
    const colors = {
      anthropic: 'text-orange-400',
      openai: 'text-green-400',
      google: 'text-blue-400',
      groq: 'text-purple-400',
      mistral: 'text-yellow-400',
      cohere: 'text-pink-400',
    };
    return colors[provider] || 'text-gray-400';
  };

  const getStatusBadge = (status) => {
    const configs = {
      valid: { text: '✓ 有效', class: 'bg-green-900/30 text-green-400 border-green-700' },
      invalid: { text: '✗ 无效', class: 'bg-red-900/30 text-red-400 border-red-700' },
      expired: { text: '⏰ 过期', class: 'bg-orange-900/30 text-orange-400 border-orange-700' },
      unknown: { text: '? 未知', class: 'bg-gray-700 text-gray-400 border-gray-600' },
    };
    const config = configs[status] || configs.unknown;
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded border ${config.class}`}>
        {config.text}
      </span>
    );
  };

  const groupByProvider = () => {
    const groups = {};
    accounts.forEach(account => {
      if (!groups[account.provider]) {
        groups[account.provider] = [];
      }
      groups[account.provider].push(account);
    });
    return groups;
  };

  const providerGroups = groupByProvider();

  const getProviderName = (provider) => {
    const names = {
      anthropic: 'Anthropic',
      openai: 'OpenAI',
      google: 'Google AI',
      groq: 'Groq',
      mistral: 'Mistral',
      cohere: 'Cohere',
    };
    return names[provider] || provider;
  };

  const handleDeleteKey = async () => {
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/keys/${confirmDialog.keyId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        alert('✅ Key 已删除');
        fetchKeys();
        fetchAccounts();
        setConfirmDialog({ isOpen: false, keyId: null, keyName: '' });
      } else {
        const error = await res.json();
        alert('❌ 删除失败: ' + error.error);
      }
    } catch (error) {
      alert('❌ 删除失败: ' + error.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-lg">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">🔑 API Key 管理</h1>
        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
          + 添加账号
        </button>
      </div>

      {/* 账号卡片横向排列 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Object.entries(providerGroups).map(([provider, providerAccounts]) => {
          const totalKeys = providerAccounts.reduce((sum, acc) => sum + acc.key_count, 0);
          const totalBudget = providerAccounts.reduce((sum, acc) => sum + (acc.monthly_budget || 0), 0);
          const totalUsed = providerAccounts.reduce((sum, acc) => sum + (acc.monthly_used || 0), 0);
          const usagePercent = totalBudget > 0 ? (totalUsed / totalBudget) * 100 : 0;

          return (
            <div 
              key={provider}
              className="bg-gray-800 rounded-lg border border-gray-700 p-4 shadow-lg hover:shadow-xl transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-lg font-bold ${getProviderColor(provider)}`}>
                  {getProviderName(provider)}
                </h3>
                <span className="text-xs text-gray-500">
                  {providerAccounts.length} 账号
                </span>
              </div>
              
              <div className="space-y-2 mb-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Keys</span>
                  <span className="text-white font-medium">{totalKeys}</span>
                </div>
                
                {totalBudget > 0 && (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">本月</span>
                      <span className="text-white font-medium">
                        ${totalUsed.toFixed(1)} / ${totalBudget.toFixed(0)}
                      </span>
                    </div>
                    
                    <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-300 ${
                          usagePercent >= 90 ? 'bg-red-500' :
                          usagePercent >= 70 ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(usagePercent, 100)}%` }}
                      ></div>
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-1 text-xs">
                {providerAccounts.map(account => (
                  <div key={account.id} className="flex items-center justify-between text-gray-400">
                    <span className="truncate flex-1">{account.account_name}</span>
                    <span className="ml-2">{account.key_count} keys</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Keys 列表 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700 bg-gray-850">
          <h2 className="text-lg font-bold text-white">全部 Keys</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-850 text-xs text-gray-400 uppercase border-b border-gray-700">
              <tr>
                <th className="px-3 md:px-4 py-2 text-left whitespace-nowrap">节点</th>
                <th className="px-3 md:px-4 py-2 text-left whitespace-nowrap">Provider</th>
                <th className="px-3 md:px-4 py-2 text-left whitespace-nowrap">账号</th>
                <th className="px-3 md:px-4 py-2 text-left whitespace-nowrap">Key名称</th>
                <th className="px-3 md:px-4 py-2 text-left whitespace-nowrap hidden md:table-cell">API Key</th>
                <th className="px-3 md:px-4 py-2 text-center whitespace-nowrap">状态</th>
                <th className="px-3 md:px-4 py-2 text-right whitespace-nowrap hidden lg:table-cell">月用量</th>
                <th className="px-3 md:px-4 py-2 text-right whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {keys.slice((page - 1) * pageSize, page * pageSize).map((key, idx) => (
                <tr 
                  key={key.id} 
                  className={`hover:bg-gray-700/50 transition-colors ${
                    idx % 2 === 0 ? 'bg-gray-800' : 'bg-gray-850'
                  }`}
                >
                  <td className="px-3 md:px-4 py-1.5 text-sm font-medium text-white whitespace-nowrap truncate max-w-[120px]" title={key.node_id}>
                    {key.node_id}
                  </td>
                  <td className="px-3 md:px-4 py-1.5 text-sm whitespace-nowrap">
                    <span className={`font-medium ${getProviderColor(key.provider)}`}>
                      {getProviderName(key.provider)}
                    </span>
                  </td>
                  <td className="px-3 md:px-4 py-1.5 text-sm text-gray-300 whitespace-nowrap truncate max-w-[150px]" title={key.account_name}>
                    {key.account_name || '--'}
                    {key.plan && (
                      <span className="ml-1 text-xs text-gray-500">({key.plan})</span>
                    )}
                  </td>
                  <td className="px-3 md:px-4 py-1.5 text-sm text-gray-300 whitespace-nowrap truncate max-w-[150px]" title={key.key_name}>
                    {key.key_name}
                  </td>
                  <td className="px-3 md:px-4 py-1.5 text-xs font-mono text-gray-400 hidden md:table-cell whitespace-nowrap">
                    {maskKey(key.api_key)}
                  </td>
                  <td className="px-3 md:px-4 py-1.5 text-center whitespace-nowrap">
                    {getStatusBadge(key.status)}
                  </td>
                  <td className="px-3 md:px-4 py-1.5 text-sm text-right text-gray-300 hidden lg:table-cell whitespace-nowrap">
                    {key.monthly_used ? `$${key.monthly_used.toFixed(2)}` : '--'}
                    {key.monthly_limit && ` / $${key.monthly_limit}`}
                  </td>
                  <td className="px-3 md:px-4 py-1.5 text-right whitespace-nowrap">
                    <button 
                      onClick={() => alert('编辑功能开发中')}
                      className="text-blue-400 hover:text-blue-300 text-xs mr-2"
                    >
                      编辑
                    </button>
                    <button 
                      onClick={() => setConfirmDialog({
                        isOpen: true,
                        keyId: key.id,
                        keyName: key.key_name
                      })}
                      className="text-red-400 hover:text-red-300 text-xs"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {keys.length === 0 && (
          <div className="text-center text-gray-500 py-12">
            暂无 Keys
          </div>
        )}

        {keys.length > 0 && (
          <div className="p-4 border-t border-gray-700">
            <PaginationEx
              page={page}
              setPage={setPage}
              pageSize={pageSize}
              setPageSize={setPageSize}
              totalItems={keys.length}
              filteredItems={keys}
            />
          </div>
        )}
      </div>

      {/* Implementation Modal */}
      <ImplementationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        data={modalData}
      />

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, keyId: null, keyName: '' })}
        onConfirm={handleDeleteKey}
        title="确认删除 Key"
        message={`确定要删除 Key "${confirmDialog.keyName}" 吗？此操作不可恢复。`}
        confirmText="确认删除"
        confirmColor="red"
        loading={deleteLoading}
      />
    </div>
  );
}

export default Keys;
