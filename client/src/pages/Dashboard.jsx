import React, { useState, useEffect } from 'react';
import NodeCard from '../components/NodeCard';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ImplementationModal from '../components/ImplementationModal';

function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalData, setModalData] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await fetch('/api/dashboard');
      const json = await res.json();
      setData(json);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-lg">加载中...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-400 text-lg">加载失败</div>
      </div>
    );
  }

  const { overview, nodes, events, trendData } = data;

  const statCards = [
    { 
      label: '在线节点', 
      value: `${overview.onlineCount}/${overview.totalNodes}`, 
      icon: '🖥️', 
      color: 'text-green-400',
      bg: 'bg-green-900/20',
      trend: '+0',
    },
    { 
      label: 'Sessions', 
      value: `${overview.activeSessions}/${overview.totalSessions}`, 
      icon: '💬', 
      color: 'text-blue-400',
      bg: 'bg-blue-900/20',
      trend: 'active',
      subtitle: '活跃会话'
    },
    { 
      label: 'Cron Jobs', 
      value: `${overview.enabledCronJobs}/${overview.totalCronJobs}`, 
      icon: '⏰', 
      color: 'text-cyan-400',
      bg: 'bg-cyan-900/20',
      trend: 'enabled',
      subtitle: '启用任务'
    },
    { 
      label: 'Skills', 
      value: overview.totalSkills, 
      icon: '🛠️', 
      color: 'text-purple-400',
      bg: 'bg-purple-900/20',
      trend: '+2',
      subtitle: '技能总数'
    },
    { 
      label: 'Memory', 
      value: overview.memoryWarnings > 0 ? `⚠️ ${overview.memoryWarnings}` : '✅', 
      icon: '📝', 
      color: overview.memoryWarnings > 0 ? 'text-yellow-400' : 'text-green-400',
      bg: overview.memoryWarnings > 0 ? 'bg-yellow-900/20' : 'bg-green-900/20',
      trend: overview.memoryWarnings > 0 ? 'warn' : 'ok',
      subtitle: '记忆健康'
    },
  ];

  const formatEventTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const hours = Math.floor(diff / 3600000);
    if (hours > 24) return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
    if (hours > 0) return `${hours}小时前`;
    const minutes = Math.floor(diff / 60000);
    if (minutes > 0) return `${minutes}分钟前`;
    return '刚刚';
  };

  const getSeverityColor = (severity) => {
    const colors = {
      critical: 'text-red-400 bg-red-900/30 border-red-700',
      error: 'text-orange-400 bg-orange-900/30 border-orange-700',
      warn: 'text-yellow-400 bg-yellow-900/30 border-yellow-700',
      info: 'text-blue-400 bg-blue-900/30 border-blue-700',
    };
    return colors[severity] || colors.info;
  };

  const showClusterBackupImpl = () => {
    setModalData({
      feature: '全集群备份',
      description: '一键备份所有在线节点的配置和 workspace 到 GitHub',
      steps: [
        '遍历所有在线节点',
        '并行执行各节点备份（每节点串行）',
        'SSH 连接到节点，执行 ocm-agent backup',
        '打包 ~/.openclaw/ 配置文件和 workspace/',
        'SCP 下载到 Master 节点的 ocm-backups/ 目录',
        'git add nodes/<node-name>/ && git commit',
        'git push 到 GitHub (ocm-backups 仓库)',
        '可选：压缩上传到 Google Drive',
        '更新数据库备份记录',
        '发送完成通知到 Bot'
      ],
      tech: ['ssh2', 'node-scp', 'simple-git', 'googleapis', 'sqlite3'],
      api: { method: 'POST', endpoint: '/api/cluster/backup' },
      note: '备份是并行的，但每个节点内部操作是串行的。失败的节点会跳过并记录。'
    });
    setModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-3 sm:space-y-0">
        <h1 className="text-2xl font-bold text-white">集群概览</h1>
        <button
          onClick={showClusterBackupImpl}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
        >
          <span>💾</span>
          <span>全集群备份</span>
        </button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
        {statCards.map((stat, idx) => (
          <div 
            key={idx} 
            className={`${stat.bg} rounded-lg border border-gray-700 p-3 md:p-4 shadow-lg hover:shadow-xl transition-all`}
          >
            <div className="flex items-start justify-between mb-2">
              <span className="text-2xl md:text-3xl">{stat.icon}</span>
              {stat.trend && (
                <span className="text-[9px] md:text-xs text-gray-400">{stat.trend}</span>
              )}
            </div>
            <div className={`text-xl md:text-2xl font-bold ${stat.color} mb-1`}>
              {stat.value}
            </div>
            <div className="text-[10px] md:text-xs text-gray-400">{stat.subtitle || stat.label}</div>
          </div>
        ))}
      </div>

      {/* 节点网格 */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">节点状态</h2>
          <Link to="/nodes" className="text-sm text-blue-400 hover:text-blue-300">
            查看全部 →
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {nodes.map(node => (
            <NodeCard key={node.id} node={node} />
          ))}
        </div>
      </div>

      {/* 底部双栏 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 智力趋势图 */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 shadow-lg">
          <h2 className="text-lg font-bold text-white mb-4">智力趋势（最近7天）</h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={trendData || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12, fill: '#9CA3AF' }} 
                stroke="#4B5563"
              />
              <YAxis 
                domain={[0, 100]} 
                tick={{ fontSize: 12, fill: '#9CA3AF' }}
                stroke="#4B5563"
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1F2937', 
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#F3F4F6'
                }}
              />
              <Legend wrapperStyle={{ color: '#9CA3AF' }} />
              {nodes.filter(n => n.status === 'online').slice(0, 4).map((node, idx) => (
                <Line
                  key={node.id}
                  type="monotone"
                  dataKey={node.id}
                  name={node.id}
                  stroke={['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'][idx % 4]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 最近事件 */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">最近事件</h2>
            <Link to="/events" className="text-sm text-blue-400 hover:text-blue-300">
              查看全部 →
            </Link>
          </div>
          <div className="space-y-3 max-h-[250px] overflow-y-auto">
            {events.slice(0, 5).map((event, idx) => (
              <div 
                key={event.id}
                className={`p-3 rounded-lg border ${getSeverityColor(event.severity)} text-sm`}
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="font-medium">{event.node_id || '全局'}</span>
                  <span className="text-xs text-gray-500">{formatEventTime(event.created_at)}</span>
                </div>
                <div className="text-gray-300">{event.message}</div>
              </div>
            ))}
            {events.length === 0 && (
              <div className="text-center text-gray-500 py-8">暂无事件</div>
            )}
          </div>
        </div>
      </div>

      {/* Implementation Modal */}
      <ImplementationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        data={modalData}
      />
    </div>
  );
}

export default Dashboard;
