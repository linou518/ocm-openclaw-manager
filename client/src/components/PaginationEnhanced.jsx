import React, { useState, useEffect } from 'react';

function PaginationEnhanced({ page, totalPages, total, limit, onPageChange, onLimitChange, storageKey = 'ocm-pageSize' }) {
  const [pageSize, setPageSize] = useState(() => {
    const stored = localStorage.getItem(storageKey);
    return stored ? parseInt(stored) : (limit || 20);
  });

  useEffect(() => {
    if (pageSize !== limit) {
      localStorage.setItem(storageKey, pageSize.toString());
      onLimitChange && onLimitChange(pageSize);
    }
  }, [pageSize]);

  if (totalPages <= 1 && total <= Math.min(...[10, 20, 50, 100])) {
    return (
      <div className="flex items-center justify-end py-4 px-2">
        <div className="text-sm text-gray-400 dark:text-gray-500">
          共 {total} 条
        </div>
      </div>
    );
  }

  const pages = [];
  const maxVisible = 7;
  
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
    <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-4 px-2 border-t border-gray-700 dark:border-gray-700">
      {/* 移动端简化版 */}
      <div className="flex md:hidden items-center gap-2 w-full justify-between">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="px-3 py-1.5 text-sm bg-gray-700 dark:bg-gray-700 text-gray-300 dark:text-gray-300 rounded hover:bg-gray-600 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          ← 前
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400 dark:text-gray-500">
            {page}/{totalPages}
          </span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(parseInt(e.target.value))}
            className="px-2 py-1 text-xs bg-gray-700 dark:bg-gray-700 border border-gray-600 dark:border-gray-600 rounded text-gray-300 dark:text-gray-300"
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="px-3 py-1.5 text-sm bg-gray-700 dark:bg-gray-700 text-gray-300 dark:text-gray-300 rounded hover:bg-gray-600 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          后 →
        </button>
      </div>

      {/* 桌面版完整版 */}
      <div className="hidden md:flex items-center gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="px-3 py-1.5 text-sm bg-gray-700 dark:bg-gray-700 text-gray-300 dark:text-gray-300 rounded hover:bg-gray-600 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          ← 前
        </button>
        
        {startPage > 1 && (
          <>
            <button
              onClick={() => onPageChange(1)}
              className="px-3 py-1.5 text-sm bg-gray-700 dark:bg-gray-700 text-gray-300 dark:text-gray-300 rounded hover:bg-gray-600 dark:hover:bg-gray-600 transition-colors"
            >
              1
            </button>
            {startPage > 2 && (
              <span className="text-gray-500 dark:text-gray-600">...</span>
            )}
          </>
        )}
        
        {pages.map(p => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`px-3 py-1.5 text-sm rounded transition-colors ${
              p === page
                ? 'bg-blue-600 dark:bg-blue-600 text-white dark:text-white font-medium'
                : 'bg-gray-700 dark:bg-gray-700 text-gray-300 dark:text-gray-300 hover:bg-gray-600 dark:hover:bg-gray-600'
            }`}
          >
            {p}
          </button>
        ))}
        
        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && (
              <span className="text-gray-500 dark:text-gray-600">...</span>
            )}
            <button
              onClick={() => onPageChange(totalPages)}
              className="px-3 py-1.5 text-sm bg-gray-700 dark:bg-gray-700 text-gray-300 dark:text-gray-300 rounded hover:bg-gray-600 dark:hover:bg-gray-600 transition-colors"
            >
              {totalPages}
            </button>
          </>
        )}
        
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="px-3 py-1.5 text-sm bg-gray-700 dark:bg-gray-700 text-gray-300 dark:text-gray-300 rounded hover:bg-gray-600 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          后 →
        </button>
      </div>

      <div className="hidden md:flex items-center gap-3 text-sm text-gray-400 dark:text-gray-500">
        <span>共 {total} 条</span>
        <span>·</span>
        <span>每页</span>
        <select
          value={pageSize}
          onChange={(e) => setPageSize(parseInt(e.target.value))}
          className="px-2 py-1 bg-gray-700 dark:bg-gray-700 border border-gray-600 dark:border-gray-600 rounded text-gray-300 dark:text-gray-300 focus:outline-none focus:border-blue-500 dark:focus:border-blue-500"
        >
          <option value="10">10</option>
          <option value="20">20</option>
          <option value="50">50</option>
          <option value="100">100</option>
        </select>
        <span>条</span>
      </div>
    </div>
  );
}

export default PaginationEnhanced;
