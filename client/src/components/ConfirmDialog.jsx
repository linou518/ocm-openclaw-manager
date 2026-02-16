import React from 'react';

function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmText = '确认', confirmColor = 'red', loading = false }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-xl max-w-md w-full">
        <div className="p-6">
          <h3 className="text-lg font-bold text-white mb-3">{title}</h3>
          <p className="text-gray-300 text-sm mb-6">{message}</p>
          
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              取消
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`px-4 py-2 ${
                confirmColor === 'red' 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : confirmColor === 'blue'
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-green-600 hover:bg-green-700'
              } text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 min-w-[80px]`}
            >
              {loading ? '处理中...' : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
