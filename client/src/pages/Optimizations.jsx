import { useState, useEffect } from 'react';
import { Radar } from 'react-chartjs-2';

export default function Optimizations() {
  const [optimizations, setOptimizations] = useState([]);
  const [stats, setStats] = useState({ total: 0, testing: 0, deployed: 0, failed: 0 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedOpt, setSelectedOpt] = useState(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    commands: [''],
    test_node_id: 'macmini-02'
  });

  useEffect(() => {
    fetchOptimizations();
  }, [page, statusFilter]);

  const fetchOptimizations = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/optimizations?page=${page}&limit=20&status=${statusFilter}`);
      const data = await res.json();
      setOptimizations(data.data);
      setTotalPages(data.totalPages);
      
      // 计算统计
      const allRes = await fetch('/api/optimizations?limit=1000');
      const allData = await allRes.json();
      setStats({
        total: allData.total,
        testing: allData.data.filter(o => o.status === 'testing').length,
        deployed: allData.data.filter(o => o.status === 'deployed').length,
        failed: allData.data.filter(o => o.status === 'test_failed' || o.status === 'rollback').length,
      });
    } catch (error) {
      console.error('Failed to fetch optimizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.title.trim() || formData.commands.filter(c => c.trim()).length === 0) {
      alert('请填写标题和至少一条命令');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/optimizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          commands: formData.commands.filter(c => c.trim())
        })
      });
      
      if (res.ok) {
        setShowCreateModal(false);
        setFormData({ title: '', description: '', commands: [''], test_node_id: 'macmini-02' });
        fetchOptimizations();
      }
    } catch (error) {
      console.error('Failed to create optimization:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!formData.title.trim()) {
      alert('请填写标题');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/optimizations/${selectedOpt.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          commands: formData.commands.filter(c => c.trim())
        })
      });
      
      if (res.ok) {
        setShowCreateModal(false);
        setSelectedOpt(null);
        setFormData({ title: '', description: '', commands: [''], test_node_id: 'macmini-02' });
        fetchOptimizations();
      }
    } catch (error) {
      console.error('Failed to update optimization:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('确定删除这个优化任务吗？')) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/optimizations/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchOptimizations();
      } else {
        const data = await res.json();
        alert(data.error || '删除失败');
      }
    } catch (error) {
      console.error('Failed to delete optimization:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async (id) => {
    if (!confirm('确定开始测试吗？这将在测试节点上执行命令并运行智力测试。')) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/optimizations/${id}/test`, { method: 'POST' });
      const data = await res.json();
      
      if (data.success) {
        alert(data.message);
        fetchOptimizations();
      }
    } catch (error) {
      console.error('Failed to test optimization:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeploy = async (id) => {
    if (!confirm('确定部署到生产环境吗？')) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/optimizations/${id}/deploy`, { method: 'POST' });
      const data = await res.json();
      
      if (data.success) {
        alert(data.message);
        fetchOptimizations();
      }
    } catch (error) {
      console.error('Failed to deploy optimization:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async (id) => {
    if (!confirm('确定回滚吗？')) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/optimizations/${id}/rollback`, { method: 'POST' });
      const data = await res.json();
      
      if (data.success) {
        alert(data.message);
        fetchOptimizations();
      }
    } catch (error) {
      console.error('Failed to rollback optimization:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setSelectedOpt(null);
    setFormData({ title: '', description: '', commands: [''], test_node_id: 'macmini-02' });
    setShowCreateModal(true);
  };

  const openEditModal = (opt) => {
    setSelectedOpt(opt);
    setFormData({
      title: opt.title,
      description: opt.description || '',
      commands: JSON.parse(opt.commands),
      test_node_id: opt.test_node_id
    });
    setShowCreateModal(true);
  };

  const openDetailModal = async (opt) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/optimizations/${opt.id}`);
      const data = await res.json();
      setSelectedOpt(data);
      setShowDetailModal(true);
    } catch (error) {
      console.error('Failed to fetch optimization detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const addCommand = () => {
    setFormData({ ...formData, commands: [...formData.commands, ''] });
  };

  const removeCommand = (index) => {
    const newCommands = formData.commands.filter((_, i) => i !== index);
    setFormData({ ...formData, commands: newCommands });
  };

  const updateCommand = (index, value) => {
    const newCommands = [...formData.commands];
    newCommands[index] = value;
    setFormData({ ...formData, commands: newCommands });
  };

  const getStatusBadge = (status) => {
    const styles = {
      draft: 'bg-gray-600 text-gray-200',
      testing: 'bg-yellow-600 text-yellow-100',
      test_passed: 'bg-blue-600 text-blue-100',
      test_failed: 'bg-red-600 text-red-100',
      deploying: 'bg-purple-600 text-purple-100',
      deployed: 'bg-green-600 text-green-100',
      rollback: 'bg-red-700 text-red-100'
    };
    
    const labels = {
      draft: '草稿',
      testing: '测试中',
      test_passed: '测试通过',
      test_failed: '测试失败',
      deploying: '部署中',
      deployed: '已部署',
      rollback: '已回滚'
    };
    
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status] || 'bg-gray-600'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const renderRadarChart = (result) => {
    if (!result) return null;
    
    const data = {
      labels: ['记忆', '逻辑', '工具', '质量', '人格'],
      datasets: [{
        label: '测试得分',
        data: [result.memory, result.logic, result.tool, result.quality, result.personality],
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 2,
      }]
    };
    
    const options = {
      scales: {
        r: {
          beginAtZero: true,
          max: 20,
          ticks: { stepSize: 5, color: '#9ca3af' },
          grid: { color: '#374151' },
          pointLabels: { color: '#9ca3af', font: { size: 11 } }
        }
      },
      plugins: {
        legend: { display: false }
      },
      maintainAspectRatio: false
    };
    
    return (
      <div style={{ height: '200px' }}>
        <Radar data={data} options={options} />
      </div>
    );
  };

  const renderPipeline = (opt) => {
    const steps = [
      { name: '草稿', status: 'draft', icon: '📝' },
      { name: '备份', status: opt.test_backup_id ? 'done' : 'pending', icon: '💾' },
      { name: '测试部署', status: opt.status === 'testing' ? 'active' : opt.test_score ? 'done' : 'pending', icon: '🧪' },
      { name: '智力测试', status: opt.test_score ? 'done' : 'pending', icon: '🧠' },
      { name: opt.status === 'test_failed' ? '失败' : '通过', status: opt.status === 'test_passed' ? 'done' : opt.status === 'test_failed' ? 'failed' : 'pending', icon: opt.status === 'test_passed' ? '✅' : opt.status === 'test_failed' ? '❌' : '⏳' },
      { name: '生产部署', status: opt.status === 'deployed' ? 'done' : opt.status === 'deploying' ? 'active' : 'pending', icon: '🚀' },
      { name: '完成', status: opt.status === 'deployed' ? 'done' : 'pending', icon: '🎉' },
    ];
    
    return (
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {steps.map((step, idx) => (
          <div key={idx} className="flex items-center">
            <div className={`flex flex-col items-center min-w-[60px] ${
              step.status === 'done' ? 'text-green-400' :
              step.status === 'active' ? 'text-yellow-400' :
              step.status === 'failed' ? 'text-red-400' :
              'text-gray-500'
            }`}>
              <div className="text-2xl mb-1">{step.icon}</div>
              <div className="text-xs text-center whitespace-nowrap">{step.name}</div>
            </div>
            {idx < steps.length - 1 && (
              <div className={`h-0.5 w-6 mx-1 ${
                steps[idx + 1].status === 'done' || steps[idx + 1].status === 'active' ? 'bg-blue-500' : 'bg-gray-600'
              }`} />
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* 标题栏 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white">🚀 优化部署</h1>
        <button
          onClick={openCreateModal}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          + 新建优化
        </button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <div className="bg-gray-800 p-3 md:p-4 rounded-lg">
          <div className="text-gray-400 text-xs md:text-sm mb-1">总数</div>
          <div className="text-xl md:text-2xl font-bold text-white">{stats.total}</div>
        </div>
        <div className="bg-gray-800 p-3 md:p-4 rounded-lg">
          <div className="text-gray-400 text-xs md:text-sm mb-1">测试中</div>
          <div className="text-xl md:text-2xl font-bold text-yellow-400">{stats.testing}</div>
        </div>
        <div className="bg-gray-800 p-3 md:p-4 rounded-lg">
          <div className="text-gray-400 text-xs md:text-sm mb-1">已部署</div>
          <div className="text-xl md:text-2xl font-bold text-green-400">{stats.deployed}</div>
        </div>
        <div className="bg-gray-800 p-3 md:p-4 rounded-lg">
          <div className="text-gray-400 text-xs md:text-sm mb-1">失败</div>
          <div className="text-xl md:text-2xl font-bold text-red-400">{stats.failed}</div>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="bg-gray-800 p-3 md:p-4 rounded-lg mb-4">
        <div className="flex flex-wrap gap-2">
          <span className="text-gray-400 text-xs md:text-sm py-1">状态:</span>
          {['all', 'draft', 'testing', 'test_passed', 'test_failed', 'deploying', 'deployed', 'rollback'].map(s => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-2 md:px-3 py-1 rounded text-xs md:text-sm ${
                statusFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {s === 'all' ? '全部' : s}
            </button>
          ))}
        </div>
      </div>

      {/* 优化任务列表 */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">加载中...</div>
        ) : optimizations.length === 0 ? (
          <div className="p-8 text-center text-gray-400">暂无数据</div>
        ) : (
          <>
            {/* 桌面表格 */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">标题</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">状态</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">命令数</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">测试得分</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">部署进度</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">创建时间</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {optimizations.map(opt => (
                    <tr key={opt.id} className="hover:bg-gray-750">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-white">{opt.title}</div>
                        {opt.description && (
                          <div className="text-xs text-gray-400 truncate max-w-xs">{opt.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(opt.status)}</td>
                      <td className="px-4 py-3 text-sm text-gray-300">{opt.command_count}</td>
                      <td className="px-4 py-3">
                        {opt.test_score ? (
                          <span className={`text-sm font-medium ${opt.test_score >= 80 ? 'text-green-400' : 'text-red-400'}`}>
                            {opt.test_score}/100
                          </span>
                        ) : (
                          <span className="text-sm text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {opt.deploy_progress ? (
                          <span className="text-sm text-gray-300">
                            {JSON.parse(opt.deploy_progress).filter(p => p.status === 'deployed').length}/
                            {JSON.parse(opt.deploy_progress).length}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {new Date(opt.created_at).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {opt.status === 'draft' && (
                            <>
                              <button onClick={() => openEditModal(opt)} className="text-blue-400 hover:text-blue-300 text-sm">编辑</button>
                              <button onClick={() => handleTest(opt.id)} className="text-yellow-400 hover:text-yellow-300 text-sm">测试</button>
                              <button onClick={() => handleDelete(opt.id)} className="text-red-400 hover:text-red-300 text-sm">删除</button>
                            </>
                          )}
                          {opt.status === 'testing' && (
                            <button onClick={() => openDetailModal(opt)} className="text-blue-400 hover:text-blue-300 text-sm">查看进度</button>
                          )}
                          {opt.status === 'test_passed' && (
                            <>
                              <button onClick={() => handleDeploy(opt.id)} className="text-green-400 hover:text-green-300 text-sm">部署</button>
                              <button onClick={() => openDetailModal(opt)} className="text-blue-400 hover:text-blue-300 text-sm">详情</button>
                            </>
                          )}
                          {opt.status === 'test_failed' && (
                            <>
                              <button onClick={() => openDetailModal(opt)} className="text-red-400 hover:text-red-300 text-sm">查看失败</button>
                              <button onClick={() => openEditModal(opt)} className="text-blue-400 hover:text-blue-300 text-sm">重试</button>
                              <button onClick={() => handleDelete(opt.id)} className="text-red-400 hover:text-red-300 text-sm">删除</button>
                            </>
                          )}
                          {opt.status === 'deploying' && (
                            <button onClick={() => openDetailModal(opt)} className="text-blue-400 hover:text-blue-300 text-sm">查看进度</button>
                          )}
                          {opt.status === 'deployed' && (
                            <button onClick={() => openDetailModal(opt)} className="text-blue-400 hover:text-blue-300 text-sm">详情</button>
                          )}
                          {opt.status === 'rollback' && (
                            <button onClick={() => openDetailModal(opt)} className="text-gray-400 hover:text-gray-300 text-sm">详情</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 移动端卡片 */}
            <div className="md:hidden divide-y divide-gray-700">
              {optimizations.map(opt => (
                <div key={opt.id} className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{opt.title}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {new Date(opt.created_at).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}
                      </div>
                    </div>
                    {getStatusBadge(opt.status)}
                  </div>
                  
                  <div className="flex gap-4 text-xs text-gray-400 mb-2">
                    <span>命令: {opt.command_count}</span>
                    <span>得分: {opt.test_score ? `${opt.test_score}/100` : '-'}</span>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {opt.status === 'draft' && (
                      <>
                        <button onClick={() => openEditModal(opt)} className="text-blue-400 text-xs">编辑</button>
                        <button onClick={() => handleTest(opt.id)} className="text-yellow-400 text-xs">测试</button>
                        <button onClick={() => handleDelete(opt.id)} className="text-red-400 text-xs">删除</button>
                      </>
                    )}
                    {(opt.status === 'testing' || opt.status === 'deploying') && (
                      <button onClick={() => openDetailModal(opt)} className="text-blue-400 text-xs">查看进度</button>
                    )}
                    {opt.status === 'test_passed' && (
                      <>
                        <button onClick={() => handleDeploy(opt.id)} className="text-green-400 text-xs">部署</button>
                        <button onClick={() => openDetailModal(opt)} className="text-blue-400 text-xs">详情</button>
                      </>
                    )}
                    {opt.status === 'test_failed' && (
                      <>
                        <button onClick={() => openDetailModal(opt)} className="text-red-400 text-xs">查看失败</button>
                        <button onClick={() => openEditModal(opt)} className="text-blue-400 text-xs">重试</button>
                      </>
                    )}
                    {(opt.status === 'deployed' || opt.status === 'rollback') && (
                      <button onClick={() => openDetailModal(opt)} className="text-blue-400 text-xs">详情</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 p-4 border-t border-gray-700">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 bg-gray-700 text-white rounded disabled:opacity-50 text-sm"
            >
              上一页
            </button>
            <span className="text-sm text-gray-400">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 bg-gray-700 text-white rounded disabled:opacity-50 text-sm"
            >
              下一页
            </button>
          </div>
        )}
      </div>

      {/* 创建/编辑 Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 md:p-6">
              <h2 className="text-xl md:text-2xl font-bold text-white mb-4">
                {selectedOpt ? '编辑优化任务' : '新建优化任务'}
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">标题 *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                    placeholder="例: 升级 OpenClaw v1.8.3"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">描述</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                    rows="3"
                    placeholder="详细描述这次优化的目的和内容"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">命令列表 *</label>
                  {formData.commands.map((cmd, idx) => (
                    <div key={idx} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={cmd}
                        onChange={(e) => updateCommand(idx, e.target.value)}
                        className="flex-1 px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-sm font-mono"
                        placeholder="cd ~/.openclaw && git pull"
                      />
                      {formData.commands.length > 1 && (
                        <button
                          onClick={() => removeCommand(idx)}
                          className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
                        >
                          删除
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={addCommand}
                    className="mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                  >
                    + 添加命令
                  </button>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">测试节点</label>
                  <select
                    value={formData.test_node_id}
                    onChange={(e) => setFormData({ ...formData, test_node_id: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                  >
                    <option value="macmini-02">macmini-02</option>
                    <option value="macmini-01">macmini-01</option>
                    <option value="g3s-01">g3s-01</option>
                  </select>
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={selectedOpt ? handleUpdate : handleCreate}
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-medium disabled:opacity-50"
                >
                  {loading ? '保存中...' : selectedOpt ? '保存' : '创建'}
                </button>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setSelectedOpt(null);
                    setFormData({ title: '', description: '', commands: [''], test_node_id: 'macmini-02' });
                  }}
                  className="px-6 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded font-medium"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 详情 Modal */}
      {showDetailModal && selectedOpt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 md:p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl md:text-2xl font-bold text-white mb-2">{selectedOpt.title}</h2>
                  {selectedOpt.description && (
                    <p className="text-sm text-gray-400">{selectedOpt.description}</p>
                  )}
                </div>
                {getStatusBadge(selectedOpt.status)}
              </div>

              {/* 流水线可视化 */}
              <div className="bg-gray-900 p-4 rounded-lg mb-6">
                <h3 className="text-sm font-medium text-gray-300 mb-3">流水线状态</h3>
                {renderPipeline(selectedOpt)}
              </div>

              {/* 命令列表 */}
              <div className="bg-gray-900 p-4 rounded-lg mb-6">
                <h3 className="text-sm font-medium text-gray-300 mb-3">执行命令</h3>
                <div className="space-y-2">
                  {selectedOpt.commands.map((cmd, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="text-xs text-gray-500 mt-1">{idx + 1}.</span>
                      <code className="flex-1 text-xs text-blue-300 bg-gray-800 px-2 py-1 rounded font-mono">
                        {cmd}
                      </code>
                    </div>
                  ))}
                </div>
              </div>

              {/* 测试结果 */}
              {selectedOpt.test_result && (
                <div className="bg-gray-900 p-4 rounded-lg mb-6">
                  <h3 className="text-sm font-medium text-gray-300 mb-3">测试结果</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-3xl font-bold mb-2">
                        <span className={selectedOpt.test_score >= 80 ? 'text-green-400' : 'text-red-400'}>
                          {selectedOpt.test_score}
                        </span>
                        <span className="text-gray-500 text-lg">/100</span>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">记忆:</span>
                          <span className="text-white">{selectedOpt.test_result.memory}/20</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">逻辑:</span>
                          <span className="text-white">{selectedOpt.test_result.logic}/20</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">工具:</span>
                          <span className="text-white">{selectedOpt.test_result.tool}/20</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">质量:</span>
                          <span className="text-white">{selectedOpt.test_result.quality}/20</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">人格:</span>
                          <span className="text-white">{selectedOpt.test_result.personality}/20</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      {renderRadarChart(selectedOpt.test_result)}
                    </div>
                  </div>
                </div>
              )}

              {/* 生产部署进度 */}
              {selectedOpt.deploy_progress && (
                <div className="bg-gray-900 p-4 rounded-lg mb-6">
                  <h3 className="text-sm font-medium text-gray-300 mb-3">生产部署进度</h3>
                  <div className="space-y-2">
                    {selectedOpt.deploy_progress.map((progress, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-gray-800 rounded">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs ${
                            progress.status === 'deployed' ? 'text-green-400' :
                            progress.status === 'deploying' ? 'text-yellow-400' :
                            'text-gray-400'
                          }`}>
                            {progress.status === 'deployed' ? '✅' :
                             progress.status === 'deploying' ? '⏳' : '⏸️'}
                          </span>
                          <span className="text-sm text-white">{progress.node_id}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {progress.score && (
                            <span className="text-xs text-gray-400">得分: {progress.score}</span>
                          )}
                          <span className="text-xs text-gray-500">备份ID: {progress.backup_id || '-'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                {selectedOpt.status === 'test_passed' && (
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      handleDeploy(selectedOpt.id);
                    }}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded font-medium"
                  >
                    部署到生产
                  </button>
                )}
                {(selectedOpt.status === 'deployed' || selectedOpt.status === 'test_failed') && (
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      handleRollback(selectedOpt.id);
                    }}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded font-medium"
                  >
                    回滚
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setSelectedOpt(null);
                  }}
                  className="px-6 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded font-medium"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
