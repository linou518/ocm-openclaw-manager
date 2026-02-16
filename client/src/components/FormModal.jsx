import React, { useState, useEffect } from 'react';

/**
 * 统一的表单 Modal 组件
 * @param {boolean} isOpen - 是否打开
 * @param {function} onClose - 关闭回调
 * @param {function} onSubmit - 提交回调
 * @param {string} title - 标题
 * @param {array} fields - 表单字段配置
 * @param {object} initialData - 初始数据（编辑模式）
 * @param {boolean} isDemo - 是否为 Demo 模式（显示实现方法提示）
 */
function FormModal({ isOpen, onClose, onSubmit, title, fields, initialData = {}, isDemo = true }) {
  const [formData, setFormData] = useState(initialData);
  const [showImpl, setShowImpl] = useState(false);

  useEffect(() => {
    setFormData(initialData);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const renderField = (field) => {
    const { name, label, type = 'text', required = false, options = [], placeholder = '' } = field;

    const inputClass = "w-full px-4 py-2 bg-gray-700 dark:bg-gray-700 border border-gray-600 dark:border-gray-600 rounded-lg text-white dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-blue-500";
    const labelClass = "block text-sm font-medium text-gray-300 dark:text-gray-300 mb-2";

    switch (type) {
      case 'select':
        return (
          <div key={name}>
            <label className={labelClass}>
              {label} {required && <span className="text-red-400">*</span>}
            </label>
            <select
              value={formData[name] || ''}
              onChange={(e) => handleChange(name, e.target.value)}
              required={required}
              className={inputClass}
            >
              <option value="">请选择</option>
              {options.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        );

      case 'textarea':
        return (
          <div key={name}>
            <label className={labelClass}>
              {label} {required && <span className="text-red-400">*</span>}
            </label>
            <textarea
              value={formData[name] || ''}
              onChange={(e) => handleChange(name, e.target.value)}
              required={required}
              placeholder={placeholder}
              rows={3}
              className={inputClass}
            />
          </div>
        );

      case 'number':
        return (
          <div key={name}>
            <label className={labelClass}>
              {label} {required && <span className="text-red-400">*</span>}
            </label>
            <input
              type="number"
              value={formData[name] || ''}
              onChange={(e) => handleChange(name, e.target.value)}
              required={required}
              placeholder={placeholder}
              className={inputClass}
            />
          </div>
        );

      case 'checkbox':
        return (
          <div key={name} className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-300 dark:text-gray-300">
              {label}
            </label>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData[name] || false}
                onChange={(e) => handleChange(name, e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-700 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-600 dark:peer-focus:ring-blue-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 dark:peer-checked:bg-blue-600"></div>
            </label>
          </div>
        );

      default:
        return (
          <div key={name}>
            <label className={labelClass}>
              {label} {required && <span className="text-red-400">*</span>}
            </label>
            <input
              type={type}
              value={formData[name] || ''}
              onChange={(e) => handleChange(name, e.target.value)}
              required={required}
              placeholder={placeholder}
              className={inputClass}
            />
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 dark:bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-700 dark:border-gray-700">
        {/* Header */}
        <div className="sticky top-0 bg-gray-800 dark:bg-gray-800 border-b border-gray-700 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-white dark:text-white">{title}</h2>
          <div className="flex items-center gap-2">
            {isDemo && (
              <button
                type="button"
                onClick={() => setShowImpl(!showImpl)}
                className="text-blue-400 dark:text-blue-400 hover:text-blue-300 dark:hover:text-blue-300 text-sm"
              >
                {showImpl ? '隐藏' : '实现方法'} 🔧
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 dark:text-gray-400 hover:text-white dark:hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Implementation Info (if demo mode) */}
        {isDemo && showImpl && (
          <div className="px-6 py-4 bg-blue-900/20 dark:bg-blue-900/20 border-b border-blue-800 dark:border-blue-800">
            <div className="flex items-start gap-2">
              <span className="text-blue-400 dark:text-blue-400 text-lg">💡</span>
              <div className="flex-1 text-sm text-gray-300 dark:text-gray-300">
                <div className="font-medium text-blue-300 dark:text-blue-300 mb-1">实现方法</div>
                <div className="space-y-1 text-xs">
                  <div>1. 验证表单数据</div>
                  <div>2. 调用 API: POST/PUT /api/...</div>
                  <div>3. 更新数据库</div>
                  <div>4. 返回结果</div>
                  <div>5. 刷新列表</div>
                  <div className="text-yellow-400 dark:text-yellow-400 mt-2">🚧 Demo 模式: 数据会写入本地 SQLite</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {fields.map(renderField)}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-700 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 dark:bg-gray-700 text-gray-300 dark:text-gray-300 rounded-lg hover:bg-gray-600 dark:hover:bg-gray-600 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 dark:bg-blue-600 text-white dark:text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-700 transition-colors font-medium"
            >
              {initialData && Object.keys(initialData).length > 0 ? '保存' : '添加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default FormModal;
