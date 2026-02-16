import React from 'react';

function Pagination({ page, totalPages, total, limit, onPageChange }) {
  if (totalPages <= 1) return null;

  const pages = [];
  const maxVisible = 7; // 最多显示页码数量
  
  let startPage = Math.max(1, page - 3);
  let endPage = Math.min(totalPages, page + 3);
  
  if (endPage - startPage < maxVisible - 1) {
    if (startPage === 1) {
      endPage = Math.min(totalPages, maxVisible);
    } else {
      startPage = Math.max(1, totalPages - maxVisible + 1);
    }
  }
  
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-4 px-2">
      {/* 移动端简化版 */}
      <div className="flex md:hidden items-center gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="px-3 py-1 text-sm bg-gray-700 text-gray-300 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ← 前
        </button>
        <span className="text-sm text-gray-400">
          第 {page}/{totalPages} 页
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="px-3 py-1 text-sm bg-gray-700 text-gray-300 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          后 →
        </button>
      </div>

      {/* 桌面版完整版 */}
      <div className="hidden md:flex items-center gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="px-3 py-1 text-sm bg-gray-700 text-gray-300 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          ← 前
        </button>
        
        {startPage > 1 && (
          <>
            <button
              onClick={() => onPageChange(1)}
              className="px-3 py-1 text-sm bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
            >
              1
            </button>
            {startPage > 2 && (
              <span className="text-gray-500">...</span>
            )}
          </>
        )}
        
        {pages.map(p => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              p === page
                ? 'bg-blue-600 text-white font-medium'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {p}
          </button>
        ))}
        
        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && (
              <span className="text-gray-500">...</span>
            )}
            <button
              onClick={() => onPageChange(totalPages)}
              className="px-3 py-1 text-sm bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
            >
              {totalPages}
            </button>
          </>
        )}
        
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="px-3 py-1 text-sm bg-gray-700 text-gray-300 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          后 →
        </button>
      </div>

      <div className="text-sm text-gray-400">
        共 {total} 条 · 每页 {limit} 条
      </div>
    </div>
  );
}

export default Pagination;
