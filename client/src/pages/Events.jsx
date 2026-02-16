import React, { useState, useEffect } from 'react';
import PaginationEx from '../components/PaginationEx';
import ImplementationModal from '../components/ImplementationModal';
import ConfirmDialog from '../components/ConfirmDialog';

function Events() {
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalData, setModalData] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [filters, setFilters] = useState({ type: 'all', severity: 'all' });
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filters, events]);

  const fetchEvents = async () => {
    try {
      const res = await fetch(`/api/events?page=1&limit=1000`);
      const json = await res.json();
      setEvents(json.data || []);
      setFilteredEvents(json.data || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch events:', error);
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...events];
    
    if (filters.type !== 'all') {
      filtered = filtered.filter(e => e.type === filters.type);
    }
    if (filters.severity !== 'all') {
      filtered = filtered.filter(e => e.severity === filters.severity);
    }
    
    setFilteredEvents(filtered);
    setPage(1);
  };

  const handleClearLogs = async () => {
    setClearLoading(true);
    try {
      const res = await fetch('/api/events?days=30', { method: 'DELETE' });
      const result = await res.json();
      if (res.ok) {
        alert(result.message || '✅ 日志已清除');
        fetchEvents();
        setPage(1);
        setShowClearDialog(false);
      } else {
        alert('❌ 清除失败: ' + result.error);
      }
    } catch (error) {
      alert('❌ 清除失败: ' + error.message);
    } finally {
      setClearLoading(false);
    }
  };

  const getSeverityConfig = (severity) => {
    const configs = {
      critical: { 
        icon: '🔴', 
        text: '严重', 
        class: 'bg-red-900/30 text-red-400 border-red-700'
      },
      error: { 
        icon: '🟠', 
        text: '错误', 
        class: 'bg-orange-900/30 text-orange-400 border-orange-700'
      },
      warn: { 
        icon: '🟡', 
        text: '警告', 
        class: 'bg-yellow-900/30 text-yellow-400 border-yellow-700'
      },
      info: { 
        icon: '🟢', 
        text: '信息', 
        class: 'bg-blue-900/30 text-blue-400 border-blue-700'
      },
    };
    return configs[severity] || configs.info;
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', { 
      month: '2-digit', 
      day: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-3 sm:space-y-0">
        <h1 className="text-2xl font-bold text-white">📋 事件日志</h1>
        <div className="flex items-center space-x-2">
          <select 
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-blue-500"
          >
            <option value="all">全部类型</option>
            <option value="backup">backup</option>
            <option value="score">score</option>
            <option value="alert">alert</option>
            <option value="config">config</option>
            <option value="restart">restart</option>
            <option value="restore">restore</option>
          </select>
          <select 
            value={filters.severity}
            onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-blue-500"
          >
            <option value="all">全部严重度</option>
            <option value="critical">critical</option>
            <option value="error">error</option>
            <option value="warn">warn</option>
            <option value="info">info</option>
          </select>
          <button
            onClick={() => setShowClearDialog(true)}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            🗑️ 清除日志
          </button>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-lg overflow-hidden">
        <div className="divide-y divide-gray-700">
          {filteredEvents.slice((page - 1) * pageSize, page * pageSize).map((event, idx) => {
            const config = getSeverityConfig(event.severity);
            return (
              <div 
                key={event.id}
                className={`p-4 hover:bg-gray-700/50 transition-colors ${
                  idx % 2 === 0 ? 'bg-gray-800' : 'bg-gray-850'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <span className="text-2xl">{config.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded border ${config.class}`}>
                          {config.text}
                        </span>
                        <span className="text-sm font-medium text-white">
                          {event.node_id || '全局'}
                        </span>
                        <span className="text-xs text-gray-500">{event.type}</span>
                      </div>
                      <div className="text-sm text-gray-300 mb-1">
                        {event.message}
                      </div>
                      {event.details && (
                        <div className="text-xs text-gray-500 font-mono bg-gray-900 rounded px-2 py-1 mt-2 max-w-2xl overflow-x-auto">
                          {event.details}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 ml-4 whitespace-nowrap">
                    {formatTime(event.created_at)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredEvents.length === 0 && (
          <div className="text-center text-gray-500 py-12">
            暂无事件
          </div>
        )}

        {filteredEvents.length > 0 && (
          <div className="p-4 border-t border-gray-700">
            <PaginationEx
              page={page}
              setPage={setPage}
              pageSize={pageSize}
              setPageSize={setPageSize}
              totalItems={filteredEvents.length}
              filteredItems={filteredEvents}
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

      {/* Clear Confirm Dialog */}
      <ConfirmDialog
        isOpen={showClearDialog}
        onClose={() => setShowClearDialog(false)}
        onConfirm={handleClearLogs}
        title="确认清除日志"
        message="确定要清除30天前的事件日志吗？此操作不可恢复。"
        confirmText="确认清除"
        confirmColor="red"
        loading={clearLoading}
      />
    </div>
  );
}

export default Events;
