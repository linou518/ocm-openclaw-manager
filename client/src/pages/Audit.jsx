import React, { useState, useEffect } from 'react';
import PaginationEx from '../components/PaginationEx';

function Audit() {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filters, setFilters] = useState({
    operator: 'all',
    result: 'all'
  });

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filters, logs]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/audit?page=1&limit=1000`);
      const data = await res.json();
      setLogs(data.data || []);
      setFilteredLogs(data.data || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...logs];
    
    if (filters.operator !== 'all') {
      filtered = filtered.filter(log => log.operator === filters.operator);
    }
    if (filters.result !== 'all') {
      filtered = filtered.filter(log => log.result === filters.result);
    }
    
    setFilteredLogs(filtered);
    setPage(1);
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getOperatorBadge = (operator) => {
    const badges = {
      bot: { color: 'bg-purple-900/30 text-purple-300 border-purple-700', emoji: '🤖' },
      web: { color: 'bg-blue-900/30 text-blue-300 border-blue-700', emoji: '🌐' },
      cron: { color: 'bg-green-900/30 text-green-300 border-green-700', emoji: '⏰' },
      system: { color: 'bg-gray-700 text-gray-300 border-gray-600', emoji: '⚙️' },
    };
    const badge = badges[operator] || badges.system;
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium border ${badge.color} inline-flex items-center space-x-1`}>
        <span>{badge.emoji}</span>
        <span>{operator}</span>
      </span>
    );
  };

  const getResultBadge = (result) => {
    if (result === 'success') {
      return <span className="text-green-400">✓ 成功</span>;
    } else {
      return <span className="text-red-400">✗ 失败</span>;
    }
  };

  const getDurationColor = (ms) => {
    if (ms < 1000) return 'text-green-400';
    if (ms < 5000) return 'text-yellow-400';
    return 'text-red-400';
  };

  const formatDuration = (ms) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div className="flex items-center space-x-3">
          <span className="text-3xl">📝</span>
          <h1 className="text-2xl font-bold text-white">审计日志</h1>
        </div>
        
        {/* Filters */}
        <div className="flex items-center space-x-3">
          <select
            value={filters.operator}
            onChange={(e) => setFilters({ ...filters, operator: e.target.value })}
            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-blue-500"
          >
            <option value="all">全部操作者</option>
            <option value="bot">Bot</option>
            <option value="web">Web</option>
            <option value="cron">Cron</option>
            <option value="system">System</option>
          </select>
          
          <select
            value={filters.result}
            onChange={(e) => setFilters({ ...filters, result: e.target.value })}
            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-blue-500"
          >
            <option value="all">全部结果</option>
            <option value="success">成功</option>
            <option value="failure">失败</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-2xl font-bold text-white">{logs.length}</div>
          <div className="text-sm text-gray-400">总操作数</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-2xl font-bold text-green-400">
            {logs.filter(l => l.result === 'success').length}
          </div>
          <div className="text-sm text-gray-400">成功</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-2xl font-bold text-red-400">
            {logs.filter(l => l.result === 'failure').length}
          </div>
          <div className="text-sm text-gray-400">失败</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-2xl font-bold text-purple-400">
            {logs.filter(l => l.operator === 'bot').length}
          </div>
          <div className="text-sm text-gray-400">Bot 操作</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-400">加载中...</div>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-900 border-b border-gray-700">
                  <tr>
                    <th className="px-3 md:px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase whitespace-nowrap">
                      时间
                    </th>
                    <th className="px-3 md:px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase whitespace-nowrap">
                      操作者
                    </th>
                    <th className="px-3 md:px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase whitespace-nowrap">
                      操作
                    </th>
                    <th className="px-3 md:px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase whitespace-nowrap">
                      目标
                    </th>
                    <th className="px-3 md:px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase whitespace-nowrap">
                      结果
                    </th>
                    <th className="px-3 md:px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase whitespace-nowrap">
                      耗时
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {filteredLogs.slice((page - 1) * pageSize, page * pageSize).map((log) => (
                    <tr key={log.id} className="hover:bg-gray-700/50 transition-colors">
                      <td className="px-3 md:px-4 py-1.5 text-xs text-gray-300 whitespace-nowrap">
                        {formatTime(log.created_at)}
                      </td>
                      <td className="px-3 md:px-4 py-1.5 text-sm whitespace-nowrap">
                        {getOperatorBadge(log.operator)}
                        {log.operator_detail && (
                          <div className="text-xs text-gray-500 mt-0.5 truncate max-w-[100px]" title={log.operator_detail}>{log.operator_detail}</div>
                        )}
                      </td>
                      <td className="px-3 md:px-4 py-1.5 text-sm text-gray-300 font-medium whitespace-nowrap truncate max-w-[150px]" title={log.action}>
                        {log.action}
                      </td>
                      <td className="px-3 md:px-4 py-1.5 text-sm text-gray-400 whitespace-nowrap truncate max-w-[120px]" title={log.target}>
                        {log.target || '-'}
                      </td>
                      <td className="px-3 md:px-4 py-1.5 text-sm font-medium whitespace-nowrap">
                        {getResultBadge(log.result)}
                        {log.error_message && (
                          <div className="text-xs text-red-400 mt-0.5 max-w-xs truncate" title={log.error_message}>
                            {log.error_message}
                          </div>
                        )}
                      </td>
                      <td className={`px-3 md:px-4 py-1.5 text-xs font-mono whitespace-nowrap ${getDurationColor(log.duration_ms)}`}>
                        {formatDuration(log.duration_ms)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-gray-700">
              {filteredLogs.map((log) => (
                <div key={log.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-white mb-1">{log.action}</div>
                      <div className="text-xs text-gray-400">{formatTime(log.created_at)}</div>
                    </div>
                    <div className="ml-2">
                      {getResultBadge(log.result)}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <div>{getOperatorBadge(log.operator)}</div>
                    {log.target && (
                      <div className="text-gray-400 text-xs">{log.target}</div>
                    )}
                  </div>
                  
                  <div className={`text-xs font-mono ${getDurationColor(log.duration_ms)}`}>
                    耗时: {formatDuration(log.duration_ms)}
                  </div>
                  
                  {log.error_message && (
                    <div className="text-xs text-red-400 bg-red-900/20 p-2 rounded">
                      {log.error_message}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {filteredLogs.length > 0 && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <PaginationEx
            page={page}
            setPage={setPage}
            pageSize={pageSize}
            setPageSize={setPageSize}
            totalItems={filteredLogs.length}
            filteredItems={filteredLogs}
          />
        </div>
      )}
    </div>
  );
}

export default Audit;
