import React from 'react';

function PaginationEx({ page, setPage, pageSize, setPageSize, totalItems, filteredItems }) {
  const totalPages = Math.ceil(filteredItems.length / pageSize);

  return (
    <div className="flex items-center justify-between mt-3 text-sm text-gray-400">
      <span>共 {filteredItems.length} 件</span>
      <div className="flex items-center gap-3">
        <select
          value={pageSize}
          onChange={e => {
            setPageSize(Number(e.target.value));
            setPage(1);
          }}
          className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-gray-300 text-xs"
        >
          <option value={10}>10件/页</option>
          <option value={20}>20件/页</option>
          <option value={50}>50件/页</option>
          <option value={100}>100件/页</option>
        </select>
        <span>{page}/{totalPages || 1}页</span>
        <div className="flex gap-1">
          <button
            onClick={() => setPage(1)}
            disabled={page === 1}
            className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50 text-xs"
          >
            «
          </button>
          <button
            onClick={() => setPage(p => p - 1)}
            disabled={page === 1}
            className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50 text-xs"
          >
            ‹
          </button>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= totalPages}
            className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50 text-xs"
          >
            ›
          </button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={page >= totalPages}
            className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50 text-xs"
          >
            »
          </button>
        </div>
      </div>
    </div>
  );
}

export default PaginationEx;
