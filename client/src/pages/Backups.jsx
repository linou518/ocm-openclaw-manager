import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import PaginationEx from '../components/PaginationEx';
import ImplementationModal from '../components/ImplementationModal';
import ConfirmDialog from '../components/ConfirmDialog';

function Backups() {
  const [backups, setBackups] = useState([]);
  const [filteredBackups, setFilteredBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalData, setModalData] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [clusterBackupLoading, setClusterBackupLoading] = useState(false);
  const [restoreDialog, setRestoreDialog] = useState({ isOpen: false, backup: null, loading: false });
  
  // URL参数处理 - 支持节点过滤
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedNode, setSelectedNode] = useState(searchParams.get('node') || 'all');
  const navigate = useNavigate();

  // 获取节点列表用于过滤器
  const [nodes, setNodes] = useState([]);

  useEffect(() => {
    fetchBackups();
    fetchNodes();
  }, []);

  useEffect(() => {
    // 根据选中的节点过滤备份
    if (selectedNode === 'all') {
      setFilteredBackups(backups);
    } else {
      setFilteredBackups(backups.filter(backup => backup.node_id === selectedNode));
    }
    setPage(1); // 重置到第一页
  }, [backups, selectedNode]);

  const fetchNodes = async () => {
    try {
      const res = await fetch('/api/dashboard');
      const json = await res.json();
      setNodes(json.nodes || []);
    } catch (error) {
      console.error('Failed to fetch nodes:', error);
    }
  };

  const fetchBackups = async () => {
    try {
      const res = await fetch(`/api/backups?page=1&limit=1000`);
      const json = await res.json();
      setBackups(json.data || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch backups:', error);
      setLoading(false);
    }
  };

  const handleClusterBackup = async () => {
    setClusterBackupLoading(true);
    try {
      const res = await fetch('/api/cluster/backup', { method: 'POST' });
      const result = await res.json();
      if (res.ok) {
        alert(result.message || '✅ 全集群备份完成');
        fetchBackups();
      } else {
        alert('❌ 备份失败: ' + result.error);
      }
    } catch (error) {
      alert('❌ 备份失败: ' + error.message);
    } finally {
      setClusterBackupLoading(false);
    }
  };

  // 新增：处理还原操作
  const handleRestoreClick = (backup) => {
    setRestoreDialog({
      isOpen: true,
      backup: backup,
      loading: false
    });
  };

  const executeRestore = async () => {
    if (!restoreDialog.backup) return;
    
    setRestoreDialog(prev => ({ ...prev, loading: true }));
    
    try {
      const response = await fetch(`/api/nodes/${restoreDialog.backup.node_id}/restore`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          backup_id: restoreDialog.backup.id
        }),
      });

      const result = await response.json();

      if (response.ok) {
        alert(`✅ 还原操作已提交: ${result.message}\n\n请等待1-2分钟后检查节点状态。如仍有问题，请重启OpenClaw服务。`);
        setRestoreDialog({ isOpen: false, backup: null, loading: false });
        // 可选：刷新页面数据或跳转到节点详情页
        // navigate(`/nodes/${restoreDialog.backup.node_id}`);
      } else {
        alert(`❌ 还原失败: ${result.error || '未知错误'}`);
      }
    } catch (error) {
      alert(`❌ 还原失败: ${error.message}`);
    } finally {
      setRestoreDialog(prev => ({ ...prev, loading: false }));
    }
  };

  // 处理节点过滤
  const handleNodeFilterChange = (nodeId) => {
    setSelectedNode(nodeId);
    if (nodeId === 'all') {
      searchParams.delete('node');
    } else {
      searchParams.set('node', nodeId);
    }
    setSearchParams(searchParams);
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString('zh-CN');
  };

  const formatSize = (bytes) => {
    if (!bytes) return '--';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const getTypeColor = (type) => {
    const colors = {
      manual: 'bg-blue-900/30 text-blue-400 border-blue-700',
      auto: 'bg-green-900/30 text-green-400 border-green-700',
      scheduled: 'bg-purple-900/30 text-purple-400 border-purple-700',
      emergency: 'bg-red-900/30 text-red-400 border-red-700'
    };
    return colors[type] || 'bg-gray-900/30 text-gray-400 border-gray-700';
  };

  const getTypeName = (type) => {
    const names = {
      manual: '手动',
      auto: '自动',
      scheduled: '定时',
      emergency: '紧急'
    };
    return names[type] || type;
  };

  const getScoreColor = (score) => {
    if (!score) return 'text-gray-400';
    if (score >= 90) return 'text-green-400';
    if (score >= 80) return 'text-yellow-400';
    if (score >= 70) return 'text-orange-400';
    return 'text-red-400';
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-700 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">备份管理</h1>
          <p className="text-gray-400 mt-1">管理节点备份和还原操作</p>
        </div>
        <button
          onClick={handleClusterBackup}
          disabled={clusterBackupLoading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {clusterBackupLoading ? '备份中...' : '🌐 全集群备份'}
        </button>
      </div>

      {/* 节点过滤器 */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <label className="text-sm font-medium text-gray-300">节点过滤:</label>
          <select
            value={selectedNode}
            onChange={(e) => handleNodeFilterChange(e.target.value)}
            className="bg-gray-700 border border-gray-600 text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全部节点</option>
            {nodes.map(node => (
              <option key={node.id} value={node.id}>
                {node.name} ({node.id})
              </option>
            ))}
          </select>
          {selectedNode !== 'all' && (
            <div className="text-sm text-gray-400">
              显示 {filteredBackups.length} / {backups.length} 个备份
            </div>
          )}
        </div>
      </div>

      {/* 备份列表 */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-3 md:px-4 py-2 text-left whitespace-nowrap">节点</th>
                <th className="px-3 md:px-4 py-2 text-left whitespace-nowrap">类型</th>
                <th className="px-3 md:px-4 py-2 text-left whitespace-nowrap hidden md:table-cell">Git Commit</th>
                <th className="px-3 md:px-4 py-2 text-left whitespace-nowrap hidden lg:table-cell">Tag</th>
                <th className="px-3 md:px-4 py-2 text-center whitespace-nowrap">智力评分</th>
                <th className="px-3 md:px-4 py-2 text-right whitespace-nowrap hidden md:table-cell">大小</th>
                <th className="px-3 md:px-4 py-2 text-right whitespace-nowrap">时间</th>
                <th className="px-3 md:px-4 py-2 text-right whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredBackups.slice((page - 1) * pageSize, page * pageSize).map((backup, idx) => (
                <tr 
                  key={backup.id}
                  className={`hover:bg-gray-700/50 transition-colors ${
                    idx % 2 === 0 ? 'bg-gray-800' : 'bg-gray-850'
                  }`}
                >
                  <td className="px-3 md:px-4 py-1.5 text-sm font-medium text-white whitespace-nowrap" title={backup.node_id}>
                    <div className="flex items-center gap-2">
                      <span className="truncate max-w-[120px]">{backup.node_id}</span>
                      {backup.is_stable && (
                        <span className="px-1.5 py-0.5 bg-green-900/30 text-green-400 border border-green-700 rounded text-xs whitespace-nowrap">
                          ✓ stable
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 md:px-4 py-1.5">
                    <span className={`px-2 py-1 text-xs font-medium rounded border whitespace-nowrap ${getTypeColor(backup.type)}`}>
                      {getTypeName(backup.type)}
                    </span>
                  </td>
                  <td className="px-3 md:px-4 py-1.5 text-xs font-mono text-gray-400 hidden md:table-cell whitespace-nowrap">
                    {backup.git_commit ? backup.git_commit.substring(0, 7) : '--'}
                  </td>
                  <td className="px-3 md:px-4 py-1.5 text-xs text-gray-400 hidden lg:table-cell whitespace-nowrap truncate max-w-[150px]" title={backup.git_tag}>
                    {backup.git_tag || '--'}
                  </td>
                  <td className="px-3 md:px-4 py-1.5 text-center whitespace-nowrap">
                    <span className={`text-sm font-bold ${getScoreColor(backup.score)}`}>
                      {backup.score || '--'}
                    </span>
                  </td>
                  <td className="px-3 md:px-4 py-1.5 text-sm text-right text-gray-300 hidden md:table-cell whitespace-nowrap">
                    {formatSize(backup.total_size)}
                  </td>
                  <td className="px-3 md:px-4 py-1.5 text-xs text-right text-gray-400 whitespace-nowrap">
                    {formatTime(backup.created_at)}
                  </td>
                  <td className="px-3 md:px-4 py-1.5 text-right whitespace-nowrap">
                    <button 
                      onClick={() => handleRestoreClick(backup)}
                      className="text-green-400 hover:text-green-300 text-xs mr-2 hover:underline"
                      title={`还原 ${backup.node_id} 到此备份`}
                    >
                      🔄 还原
                    </button>
                    <button
                      onClick={() => navigate(`/nodes/${backup.node_id}`)}
                      className="text-blue-400 hover:text-blue-300 text-xs mr-2 hover:underline"
                      title={`查看 ${backup.node_id} 详情`}
                    >
                      📋 详情
                    </button>
                    <button
                      onClick={() => alert('Diff 功能开发中')}
                      className="text-gray-400 hover:text-gray-300 text-xs hover:underline"
                    >
                      Diff
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredBackups.length === 0 && (
          <div className="text-center text-gray-500 py-12">
            {selectedNode === 'all' ? '暂无备份' : `节点 ${selectedNode} 暂无备份`}
          </div>
        )}

        {filteredBackups.length > 0 && (
          <div className="p-4 border-t border-gray-700">
            <PaginationEx
              page={page}
              setPage={setPage}
              pageSize={pageSize}
              setPageSize={setPageSize}
              totalItems={filteredBackups.length}
              filteredItems={filteredBackups}
            />
          </div>
        )}
      </div>

      {/* 还原确认对话框 */}
      {restoreDialog.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-white mb-4">确认还原操作</h3>
            <div className="space-y-3 text-sm text-gray-300 mb-6">
              <p><span className="font-medium">节点:</span> {restoreDialog.backup?.node_id}</p>
              <p><span className="font-medium">备份时间:</span> {formatTime(restoreDialog.backup?.created_at)}</p>
              <p><span className="font-medium">备份大小:</span> {formatSize(restoreDialog.backup?.total_size)}</p>
              {restoreDialog.backup?.git_tag && (
                <p><span className="font-medium">标签:</span> {restoreDialog.backup.git_tag}</p>
              )}
              <div className="bg-yellow-900/30 border border-yellow-700 rounded p-3 mt-4">
                <p className="text-yellow-400 text-xs">
                  ⚠️ 此操作将覆盖节点当前配置，强烈建议先手动备份当前状态。\\n\\n还原过程约需要1-2分钟，完成后请检查节点状态并在必要时重启服务。
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setRestoreDialog({ isOpen: false, backup: null, loading: false })}
                disabled={restoreDialog.loading}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={executeRestore}
                disabled={restoreDialog.loading}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors disabled:opacity-50"
              >
                {restoreDialog.loading ? '还原中...' : '确认还原'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Implementation Modal */}
      <ImplementationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        data={modalData}
      />
    </div>
  );
}

export default Backups;