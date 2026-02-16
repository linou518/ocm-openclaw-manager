import React, { useState, useEffect } from 'react';
import NodeCard from '../components/NodeCard';
import AddNodeModal from '../components/AddNodeModal';

function Nodes() {
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, online, offline
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedNodes, setSelectedNodes] = useState(new Set());
  const [batchLoading, setBatchLoading] = useState(null);

  useEffect(() => {
    fetchNodes();
    const interval = setInterval(fetchNodes, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchNodes = async () => {
    try {
      const res = await fetch('/api/nodes');
      const json = await res.json();
      
      // 添加 bot_count
      for (const node of json) {
        try {
          const botsRes = await fetch(`/api/nodes/${node.id}/bots`);
          const bots = await botsRes.json();
          node.bot_count = bots.length;
        } catch (error) {
          console.warn(`Failed to fetch bots for node ${node.id}:`, error);
          node.bot_count = 0;
        }
      }
      
      setNodes(json);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch nodes:', error);
      setLoading(false);
    }
  };

  const handleSelectNode = (nodeId) => {
    const newSelected = new Set(selectedNodes);
    if (newSelected.has(nodeId)) {
      newSelected.delete(nodeId);
    } else {
      newSelected.add(nodeId);
    }
    setSelectedNodes(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedNodes.size === filteredNodes.length) {
      setSelectedNodes(new Set());
    } else {
      setSelectedNodes(new Set(filteredNodes.map(node => node.id)));
    }
  };

  const handleBatchAction = async (action) => {
    if (selectedNodes.size === 0) {
      alert('请先选择要操作的节点');
      return;
    }

    const confirmed = window.confirm(`确认对 ${selectedNodes.size} 个节点执行 "${action}" 操作？`);
    if (!confirmed) return;

    setBatchLoading(action);
    
    try {
      const promises = Array.from(selectedNodes).map(nodeId =>
        fetch(`/api/nodes/${nodeId}/${action}`, { method: 'POST' })
          .then(res => res.json())
          .then(result => ({ nodeId, success: true, result }))
          .catch(error => ({ nodeId, success: false, error: error.message }))
      );

      const results = await Promise.all(promises);
      
      const successes = results.filter(r => r.success);
      const failures = results.filter(r => !r.success);
      
      let message = `批量${action}完成:\n`;
      message += `✅ 成功: ${successes.length} 个节点\n`;
      if (failures.length > 0) {
        message += `❌ 失败: ${failures.length} 个节点\n`;
        message += failures.map(f => `  - ${f.nodeId}: ${f.error}`).join('\n');
      }
      
      alert(message);
      
      // 刷新节点列表
      await fetchNodes();
      setSelectedNodes(new Set());
      
    } catch (error) {
      alert(`批量操作失败: ${error.message}`);
    } finally {
      setBatchLoading(null);
    }
  };

  const filteredNodes = nodes.filter(node => {
    if (filter === 'all') return true;
    if (filter === 'online') return ['online', 'unstable'].includes(node.status);
    if (filter === 'offline') return ['offline', 'error', 'unknown'].includes(node.status);
    return true;
  });

  const onlineCount = nodes.filter(n => ['online', 'unstable'].includes(n.status)).length;
  const offlineCount = nodes.filter(n => ['offline', 'error', 'unknown'].includes(n.status)).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-lg">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">节点管理</h2>
        <div className="flex items-center space-x-3">
          {/* 批量操作按钮 */}
          {selectedNodes.size > 0 && (
            <div className="flex items-center space-x-2 px-3 py-2 bg-gray-700 rounded-lg">
              <span className="text-sm text-gray-300">已选择 {selectedNodes.size} 个</span>
              <button
                onClick={() => handleBatchAction('start')}
                disabled={batchLoading}
                className="px-2 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white text-xs rounded"
              >
                {batchLoading === 'start' ? '...' : '启动'}
              </button>
              <button
                onClick={() => handleBatchAction('stop')}
                disabled={batchLoading}
                className="px-2 py-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white text-xs rounded"
              >
                {batchLoading === 'stop' ? '...' : '停止'}
              </button>
              <button
                onClick={() => handleBatchAction('restart')}
                disabled={batchLoading}
                className="px-2 py-1 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white text-xs rounded"
              >
                {batchLoading === 'restart' ? '...' : '重启'}
              </button>
              <button
                onClick={() => setSelectedNodes(new Set())}
                className="px-2 py-1 bg-gray-600 hover:bg-gray-500 text-white text-xs rounded"
              >
                取消
              </button>
            </div>
          )}
          
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            ➕ 添加节点
          </button>
        </div>
      </div>

      {/* 筛选按钮和批量选择 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button
            onClick={handleSelectAll}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium rounded-lg transition-colors"
          >
            {selectedNodes.size === filteredNodes.length ? '取消全选' : '全选'}
          </button>
          
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            全部 ({nodes.length})
          </button>
          <button
            onClick={() => setFilter('online')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'online'
                ? 'bg-green-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            🟢 在线 ({onlineCount})
          </button>
          <button
            onClick={() => setFilter('offline')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'offline'
                ? 'bg-red-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            🔴 离线 ({offlineCount})
          </button>
        </div>
      </div>

      {/* 节点网格 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredNodes.map(node => (
          <div key={node.id} className="relative">
            {/* 选择框 */}
            <div className="absolute top-2 left-2 z-10">
              <input
                type="checkbox"
                checked={selectedNodes.has(node.id)}
                onChange={() => handleSelectNode(node.id)}
                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
              />
            </div>
            
            <NodeCard 
              key={node.id} 
              node={node} 
              onNodeAction={fetchNodes}
            />
          </div>
        ))}
      </div>

      {filteredNodes.length === 0 && (
        <div className="text-center text-gray-500 py-12 bg-gray-800 rounded-lg border border-gray-700">
          {filter === 'all' ? '暂无节点' : `暂无${filter === 'online' ? '在线' : '离线'}节点`}
        </div>
      )}

      <AddNodeModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={fetchNodes}
      />
    </div>
  );
}

export default Nodes;