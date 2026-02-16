import React, { useState } from 'react';

/**
 * 通用筛选栏组件
 * @param {array} filters - 筛选项配置
 * @param {object} values - 当前筛选值
 * @param {function} onChange - 筛选变化回调
 * @param {function} onReset - 重置回调
 */
function FilterBar({ filters, values, onChange, onReset }) {
  const [isExpanded, setIsExpanded] = useState(true);

  const renderFilter = (filter) => {
    const { name, label, type = 'select', options = [], placeholder = '' } = filter;

    const inputClass = "px-3 py-2 bg-gray-700 dark:bg-gray-700 border border-gray-600 dark:border-gray-600 rounded-lg text-sm text-white dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-blue-500";

    switch (type) {
      case 'select':
        return (
          <div key={name} className="flex flex-col gap-1">
            <label className="text-xs text-gray-400 dark:text-gray-500">{label}</label>
            <select
              value={values[name] || 'all'}
              onChange={(e) => onChange(name, e.target.value)}
              className={inputClass}
            >
              <option value="all">全部</option>
              {options.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        );

      case 'date':
        return (
          <div key={name} className="flex flex-col gap-1">
            <label className="text-xs text-gray-400 dark:text-gray-500">{label}</label>
            <input
              type="date"
              value={values[name] || ''}
              onChange={(e) => onChange(name, e.target.value)}
              className={inputClass}
            />
          </div>
        );

      case 'dateRange':
        return (
          <div key={name} className="flex flex-col gap-1">
            <label className="text-xs text-gray-400 dark:text-gray-500">{label}</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={values[`${name}_from`] || ''}
                onChange={(e) => onChange(`${name}_from`, e.target.value)}
                className={inputClass}
                placeholder="从"
              />
              <span className="text-gray-500 dark:text-gray-600">-</span>
              <input
                type="date"
                value={values[`${name}_to`] || ''}
                onChange={(e) => onChange(`${name}_to`, e.target.value)}
                className={inputClass}
                placeholder="到"
              />
            </div>
          </div>
        );

      case 'number':
        return (
          <div key={name} className="flex flex-col gap-1">
            <label className="text-xs text-gray-400 dark:text-gray-500">{label}</label>
            <input
              type="number"
              value={values[name] || ''}
              onChange={(e) => onChange(name, e.target.value)}
              placeholder={placeholder}
              className={inputClass}
            />
          </div>
        );

      case 'numberRange':
        return (
          <div key={name} className="flex flex-col gap-1">
            <label className="text-xs text-gray-400 dark:text-gray-500">{label}</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={values[`${name}_min`] || ''}
                onChange={(e) => onChange(`${name}_min`, e.target.value)}
                placeholder="最低"
                className={inputClass}
              />
              <span className="text-gray-500 dark:text-gray-600">-</span>
              <input
                type="number"
                value={values[`${name}_max`] || ''}
                onChange={(e) => onChange(`${name}_max`, e.target.value)}
                placeholder="最高"
                className={inputClass}
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-gray-800 dark:bg-gray-800 rounded-lg border border-gray-700 dark:border-gray-700 p-4 shadow-lg mb-6">
      {/* Mobile Toggle */}
      <div className="md:hidden mb-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between w-full text-white dark:text-white font-medium"
        >
          <span className="flex items-center gap-2">
            🔍 筛选
            {Object.values(values).filter(v => v && v !== 'all').length > 0 && (
              <span className="px-2 py-0.5 bg-blue-600 dark:bg-blue-600 text-white dark:text-white text-xs rounded-full">
                {Object.values(values).filter(v => v && v !== 'all').length}
              </span>
            )}
          </span>
          <svg 
            className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Filters Grid */}
      <div className={`${isExpanded ? 'block' : 'hidden md:block'}`}>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filters.map(renderFilter)}
          
          {/* Reset Button */}
          <div className="flex flex-col gap-1 justify-end">
            <label className="text-xs text-transparent">-</label>
            <button
              onClick={onReset}
              className="px-4 py-2 bg-gray-700 dark:bg-gray-700 text-gray-300 dark:text-gray-300 rounded-lg hover:bg-gray-600 dark:hover:bg-gray-600 transition-colors text-sm"
            >
              重置
            </button>
          </div>
        </div>

        {/* Active Filters Display (Mobile) */}
        {Object.values(values).filter(v => v && v !== 'all').length > 0 && (
          <div className="md:hidden mt-3 flex flex-wrap gap-2">
            {Object.entries(values).filter(([k, v]) => v && v !== 'all').map(([key, value]) => {
              const filter = filters.find(f => f.name === key || key.startsWith(f.name));
              if (!filter) return null;
              return (
                <span
                  key={key}
                  className="px-2 py-1 bg-blue-900/30 dark:bg-blue-900/30 text-blue-300 dark:text-blue-300 text-xs rounded-full border border-blue-700 dark:border-blue-700"
                >
                  {filter.label}: {
                    filter.options?.find(o => o.value === value)?.label || value
                  }
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default FilterBar;
