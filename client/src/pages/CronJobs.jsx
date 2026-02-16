import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PaginationEx from '../components/PaginationEx';

function CronJobs() {
  const [jobs, setJobs] = useState([]);
  const [allJobs, setAllJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState([]);
  const [bots, setBots] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  // 筛选
  const [filters, setFilters] = useState({
    node_id: 'all',
    bot_id: 'all',
    enabled: 'all',
    schedule_type: 'all',
  });

  useEffect(() => {
    fetchNodes();
    fetchBots();
    fetchJobs();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filters, allJobs]);

  const fetchNodes = async () => {
    try {
      const res = await fetch('/api/nodes');
      const json = await res.json();
      setNodes(json);
    } catch (error) {
      console.error('Failed to fetch nodes:', error);
    }
  };

  const fetchBots = async () => {
    try {
      const res = await fetch('/api/bots');
      const json = await res.json();
      setBots(json);
    } catch (error) {
      console.error('Failed to fetch bots:', error);
    }
  };

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/cron-jobs?page=1&limit=1000`);
      const json = await res.json();
      setAllJobs(json.data || []);
      setJobs(json.data || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch cron jobs:', error);
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...allJobs];
    
    if (filters.node_id !== 'all') {
      filtered = filtered.filter(j => j.node_id === filters.node_id);
    }
    if (filters.bot_id !== 'all') {
      filtered = filtered.filter(j => j.bot_id === parseInt(filters.bot_id));
    }
    if (filters.enabled !== 'all') {
      filtered = filtered.filter(j => j.enabled === (filters.enabled === '1'));
    }
    if (filters.schedule_type !== 'all') {
      filtered = filtered.filter(j => j.schedule_type === filters.schedule_type);
    }
    
    setJobs(filtered);
    setPage(1);
  };

  const handleToggleJob = async (jobId) => {
    try {
      await fetch(`/api/cron-jobs/${jobId}/toggle`, { method: 'PUT' });
      fetchJobs();
    } catch (error) {
      console.error('Failed to toggle job:', error);
    }
  };

  const getScheduleTypeLabel = (type) => {
    const labels = {
      cron: '定时',
      interval: '间隔',
      once: '一次性',
      heartbeat: '心跳',
    };
    return labels[type] || type;
  };

  const getScheduleTypeColor = (type) => {
    const colors = {
      cron: 'bg-blue-100 text-blue-800',
      interval: 'bg-green-100 text-green-800',
      once: 'bg-purple-100 text-purple-800',
      heartbeat: 'bg-pink-100 text-pink-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const formatLastRun = (timestamp) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时前`;
    return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const formatNextRun = (timestamp) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = date - now;
    if (diff < 0) return '已过期';
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}分钟后`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时后`;
    const days = Math.floor(hours / 24);
    return `${days}天后`;
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">⏰ Cron Jobs</h1>
        <div className="text-sm text-gray-400">
          共 {jobs.length} 个任务，{jobs.filter(j => j.enabled).length} 个已启用
        </div>
      </div>

      {/* 筛选器 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">节点</label>
            <select
              value={filters.node_id}
              onChange={(e) => setFilters({ ...filters, node_id: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">全部节点</option>
              {nodes.map(node => (
                <option key={node.id} value={node.id}>{node.id}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Bot</label>
            <select
              value={filters.bot_id}
              onChange={(e) => setFilters({ ...filters, bot_id: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">全部 Bot</option>
              {bots.map(bot => (
                <option key={bot.id} value={bot.id}>{bot.bot_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">状态</label>
            <select
              value={filters.enabled}
              onChange={(e) => setFilters({ ...filters, enabled: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">全部</option>
              <option value="1">已启用</option>
              <option value="0">已禁用</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">类型</label>
            <select
              value={filters.schedule_type}
              onChange={(e) => setFilters({ ...filters, schedule_type: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">全部类型</option>
              <option value="cron">定时</option>
              <option value="interval">间隔</option>
              <option value="once">一次性</option>
              <option value="heartbeat">心跳</option>
            </select>
          </div>
        </div>
      </div>

      {/* 任务列表 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        {loading ? (
          <div className="text-center py-8 text-gray-400">加载中...</div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-8 text-gray-400">没有找到任务</div>
        ) : (
          <>
            {/* 桌面端表格 */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-900 text-xs text-gray-400 uppercase border-b border-gray-700">
                  <tr>
                    <th className="px-3 md:px-4 py-2 text-left whitespace-nowrap">任务名</th>
                    <th className="px-3 md:px-4 py-2 text-left whitespace-nowrap">Bot</th>
                    <th className="px-3 md:px-4 py-2 text-center whitespace-nowrap">类型</th>
                    <th className="px-3 md:px-4 py-2 text-left whitespace-nowrap">计划</th>
                    <th className="px-3 md:px-4 py-2 text-center whitespace-nowrap">上次运行</th>
                    <th className="px-3 md:px-4 py-2 text-center whitespace-nowrap">下次运行</th>
                    <th className="px-3 md:px-4 py-2 text-center whitespace-nowrap">状态</th>
                    <th className="px-3 md:px-4 py-2 text-center whitespace-nowrap">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {jobs.slice((page - 1) * pageSize, page * pageSize).map(job => (
                    <tr key={job.id} className="hover:bg-gray-700/50 transition-colors">
                      <td className="px-3 md:px-4 py-1.5 whitespace-nowrap">
                        <div className="font-medium text-white truncate max-w-[180px]" title={job.job_name}>{job.job_name}</div>
                        <div className="text-xs text-gray-400">{job.node_id}</div>
                      </td>
                      <td className="px-3 md:px-4 py-1.5 whitespace-nowrap">
                        <div className="flex items-center space-x-1 truncate max-w-[120px]" title={job.bot_name}>
                          {job.agent_emoji && <span>{job.agent_emoji}</span>}
                          <span className="text-white truncate">{job.bot_name}</span>
                        </div>
                      </td>
                      <td className="px-3 md:px-4 py-1.5 text-center whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs ${getScheduleTypeColor(job.schedule_type)}`}>
                          {getScheduleTypeLabel(job.schedule_type)}
                        </span>
                      </td>
                      <td className="px-3 md:px-4 py-1.5 whitespace-nowrap">
                        <div className="text-white font-mono text-xs truncate max-w-[150px]" title={
                          job.schedule_type === 'cron' ? job.cron_expression : 
                          job.schedule_type === 'interval' ? `每 ${job.interval_seconds}s` :
                          job.schedule_type === 'heartbeat' ? `心跳 ${job.interval_seconds}s` :
                          job.run_at ? new Date(job.run_at).toLocaleString('zh-CN') : '-'
                        }>
                          {job.schedule_type === 'cron' ? job.cron_expression : 
                           job.schedule_type === 'interval' ? `每 ${job.interval_seconds}s` :
                           job.schedule_type === 'heartbeat' ? `心跳 ${job.interval_seconds}s` :
                           job.run_at ? new Date(job.run_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) :
                           '-'}
                        </div>
                      </td>
                      <td className="px-3 md:px-4 py-1.5 text-center text-xs text-gray-400 whitespace-nowrap">
                        {formatLastRun(job.last_run_at)}
                      </td>
                      <td className="px-3 md:px-4 py-1.5 text-center text-xs text-gray-400 whitespace-nowrap">
                        {formatNextRun(job.next_run_at)}
                      </td>
                      <td className="px-3 md:px-4 py-1.5 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleToggleJob(job.id)}
                          className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                            job.enabled
                              ? 'bg-green-900/30 text-green-400 hover:bg-green-900/50'
                              : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                          }`}
                        >
                          {job.enabled ? '✓' : '✗'}
                        </button>
                      </td>
                      <td className="px-3 md:px-4 py-1.5 text-center whitespace-nowrap">
                        <button className="text-blue-400 hover:text-blue-300 text-xs">
                          编辑
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 移动端卡片 */}
            <div className="md:hidden divide-y divide-gray-700">
              {jobs.map(job => (
                <div key={job.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="font-medium text-white mb-1">{job.job_name}</div>
                      <div className="flex items-center space-x-2 text-xs text-gray-400">
                        <span>{job.node_id}</span>
                        <span>•</span>
                        <span className="flex items-center space-x-1">
                          {job.agent_emoji && <span>{job.agent_emoji}</span>}
                          <span>{job.bot_name}</span>
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleJob(job.id)}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                        job.enabled
                          ? 'bg-green-900/30 text-green-400'
                          : 'bg-gray-700 text-gray-400'
                      }`}
                    >
                      {job.enabled ? '✓' : '✗'}
                    </button>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-0.5 rounded ${getScheduleTypeColor(job.schedule_type)}`}>
                        {getScheduleTypeLabel(job.schedule_type)}
                      </span>
                      <span className="text-gray-400 font-mono">
                        {job.schedule_type === 'cron' ? job.cron_expression : 
                         job.schedule_type === 'interval' ? `每 ${job.interval_seconds}s` :
                         job.schedule_type === 'heartbeat' ? `心跳 ${job.interval_seconds}s` :
                         '-'}
                      </span>
                    </div>
                    <div className="text-gray-400">
                      上次: {formatLastRun(job.last_run_at)} · 下次: {formatNextRun(job.next_run_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 分页 */}
      {jobs.length > 0 && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <PaginationEx
            page={page}
            setPage={setPage}
            pageSize={pageSize}
            setPageSize={setPageSize}
            totalItems={jobs.length}
            filteredItems={jobs}
          />
        </div>
      )}
    </div>
  );
}

export default CronJobs;
