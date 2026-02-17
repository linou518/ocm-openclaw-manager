import React, { useState, useEffect } from 'react';

const BADGE_COLOR = (days) => {
  if (days === 0) return 'bg-green-500 text-white';
  if (days < 7) return 'bg-red-500 text-white';
  if (days < 30) return 'bg-yellow-500 text-black';
  return 'bg-blue-500 text-white';
};

export default function Family() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard-data/family')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-gray-400">読み込み中...</div></div>;
  if (!data) return <div className="flex items-center justify-center h-64"><div className="text-red-400">データ取得失敗</div></div>;

  const { members = [], anniversaries = [], upcoming = [], gifts = [] } = data;

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <h1 className="text-2xl font-bold text-white">👨‍👩‍👧‍👦 家庭</h1>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-white mb-3">🎉 近日イベント</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {upcoming.map((item, i) => (
              <div key={i} className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex items-center gap-3 hover:border-gray-600 transition-colors">
                <span className="text-3xl">{item.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium">{item.name}</div>
                  <div className="text-sm text-gray-400">{item.info || item.date}</div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${BADGE_COLOR(item.days)}`}>
                  {item.days === 0 ? '今日!' : `${item.days}日後`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Members */}
      <div>
        <h2 className="text-lg font-bold text-white mb-3">👥 家族メンバー</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {members.map((m, i) => (
            <div key={i} className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center hover:border-gray-600 transition-colors">
              <div className="text-4xl mb-2">{m.emoji}</div>
              <div className="text-white font-medium">{m.name}</div>
              <div className="text-sm text-gray-400">{m.age}歳</div>
              <div className="text-xs text-gray-500 mt-1">🎂 {m.birthday}</div>
              {m.daysUntil !== undefined && (
                <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${BADGE_COLOR(m.daysUntil)}`}>
                  {m.daysUntil === 0 ? '🎂 今日!' : `あと${m.daysUntil}日`}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Anniversaries */}
      {anniversaries.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-white mb-3">💍 記念日</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {anniversaries.map((a, i) => (
              <div key={i} className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex items-center gap-3">
                <span className="text-3xl">{a.emoji}</span>
                <div className="flex-1">
                  <div className="text-white font-medium">{a.name}</div>
                  <div className="text-sm text-gray-400">{a.date} · {a.years}年</div>
                </div>
                {a.daysUntil !== undefined && (
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${BADGE_COLOR(a.daysUntil)}`}>
                    {a.daysUntil === 0 ? '今日!' : `${a.daysUntil}日後`}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
