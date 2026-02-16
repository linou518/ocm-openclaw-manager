import React, { useState, useEffect } from 'react';
import PaginationEx from '../components/PaginationEx';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import ImplementationModal from '../components/ImplementationModal';

function Scores() {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalData, setModalData] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [testLoading, setTestLoading] = useState(false);

  useEffect(() => {
    fetchScores();
  }, []);

  const fetchScores = async () => {
    try {
      const res = await fetch(`/api/scores/all?page=1&limit=1000`);
      const json = await res.json();
      setScores(json.data || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch scores:', error);
      setLoading(false);
    }
  };

  const handleClusterTest = async () => {
    setTestLoading(true);
    try {
      const res = await fetch('/api/cluster/test', { method: 'POST' });
      const result = await res.json();
      if (res.ok) {
        alert(result.message || '✅ 全集群测试完成');
        fetchScores();
      } else {
        alert('❌ 测试失败: ' + result.error);
      }
    } catch (error) {
      alert('❌ 测试失败: ' + error.message);
    } finally {
      setTestLoading(false);
    }
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

  const getScoreColor = (score) => {
    if (score >= 90) return 'text-green-400';
    if (score >= 70) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getActionBadge = (action) => {
    const configs = {
      none: { text: '无', class: 'bg-gray-700 text-gray-400 border-gray-600' },
      alert: { text: '⚠️ 告警', class: 'bg-yellow-900/30 text-yellow-400 border-yellow-700' },
      rollback: { text: '🔄 回滚', class: 'bg-red-900/30 text-red-400 border-red-700' },
    };
    const config = configs[action] || configs.none;
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded border ${config.class}`}>
        {config.text}
      </span>
    );
  };

  const renderRadarChart = (score) => {
    const radarData = [
      { dimension: '记忆', value: score.memory_score || 0 },
      { dimension: '逻辑', value: score.logic_score || 0 },
      { dimension: '工具', value: score.tool_score || 0 },
      { dimension: '质量', value: score.quality_score || 0 },
      { dimension: '人格', value: score.personality_score || 0 },
    ];

    return (
      <ResponsiveContainer width="100%" height={200}>
        <RadarChart data={radarData}>
          <PolarGrid stroke="#374151" />
          <PolarAngleAxis dataKey="dimension" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
          <PolarRadiusAxis domain={[0, 20]} tick={{ fill: '#6B7280' }} />
          <Radar 
            dataKey="value" 
            stroke="#3B82F6" 
            fill="#3B82F6" 
            fillOpacity={0.5}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1F2937', 
              border: '1px solid #374151',
              borderRadius: '8px',
              color: '#F3F4F6'
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    );
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
        <h1 className="text-2xl font-bold text-white">🧠 智力评分</h1>
        <button
          onClick={handleClusterTest}
          disabled={testLoading}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 min-w-[180px]"
        >
          {testLoading ? '测试中...' : '🧪 触发全集群测试'}
        </button>
      </div>

      {/* 概览统计 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {['平均总分', '记忆', '逻辑', '工具', '质量'].map((label, idx) => {
          const avgScores = scores.length > 0 
            ? scores.reduce((sum, s) => {
                if (idx === 0) return sum + (s.total_score || 0);
                if (idx === 1) return sum + (s.memory_score || 0);
                if (idx === 2) return sum + (s.logic_score || 0);
                if (idx === 3) return sum + (s.tool_score || 0);
                if (idx === 4) return sum + (s.quality_score || 0);
                return sum;
              }, 0) / scores.length
            : 0;
          
          return (
            <div key={idx} className="bg-gray-800 rounded-lg border border-gray-700 p-4 shadow-lg">
              <div className={`text-2xl font-bold mb-1 ${getScoreColor(avgScores)}`}>
                {avgScores.toFixed(0)}
              </div>
              <div className="text-sm text-gray-400">{label}</div>
            </div>
          );
        })}
      </div>

      {/* 评分列表 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-lg overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
          {scores.slice((page - 1) * pageSize, page * pageSize).map((score) => (
            <div 
              key={score.id}
              className="bg-gray-850 rounded-lg border border-gray-700 p-4 hover:border-gray-600 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">{score.node_id}</h3>
                  <div className="text-xs text-gray-500">{formatTime(score.created_at)}</div>
                </div>
                <div className="text-right">
                  <div className={`text-3xl font-bold ${getScoreColor(score.total_score)}`}>
                    {score.total_score}
                  </div>
                  <div className="text-xs text-gray-500">总分</div>
                </div>
              </div>

              <div className="mb-4">
                {renderRadarChart(score)}
              </div>

              <div className="grid grid-cols-5 gap-2 mb-3 text-center text-xs">
                <div>
                  <div className={`font-bold ${getScoreColor(score.memory_score)}`}>
                    {score.memory_score || '--'}
                  </div>
                  <div className="text-gray-500">记忆</div>
                </div>
                <div>
                  <div className={`font-bold ${getScoreColor(score.logic_score)}`}>
                    {score.logic_score || '--'}
                  </div>
                  <div className="text-gray-500">逻辑</div>
                </div>
                <div>
                  <div className={`font-bold ${getScoreColor(score.tool_score)}`}>
                    {score.tool_score || '--'}
                  </div>
                  <div className="text-gray-500">工具</div>
                </div>
                <div>
                  <div className={`font-bold ${getScoreColor(score.quality_score)}`}>
                    {score.quality_score || '--'}
                  </div>
                  <div className="text-gray-500">质量</div>
                </div>
                <div>
                  <div className={`font-bold ${getScoreColor(score.personality_score)}`}>
                    {score.personality_score || '--'}
                  </div>
                  <div className="text-gray-500">人格</div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                {getActionBadge(score.action_taken)}
                <button 
                  onClick={() => alert('详情功能开发中')}
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  查看详情 →
                </button>
              </div>
            </div>
          ))}
        </div>

        {scores.length === 0 && (
          <div className="text-center text-gray-500 py-12">
            暂无评分记录
          </div>
        )}

        {scores.length > 0 && (
          <div className="p-4 border-t border-gray-700">
            <PaginationEx
              page={page}
              setPage={setPage}
              pageSize={pageSize}
              setPageSize={setPageSize}
              totalItems={scores.length}
              filteredItems={scores}
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
    </div>
  );
}

export default Scores;
