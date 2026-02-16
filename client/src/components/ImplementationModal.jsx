import React from 'react';

function ImplementationModal({ isOpen, onClose, data }) {
  if (!isOpen || !data) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-700">
        {/* Header */}
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">🔧</span>
            <h2 className="text-xl font-bold text-white">实现方法</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-5">
          {/* Feature Name */}
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">功能</div>
            <div className="text-lg font-semibold text-white">{data.feature}</div>
          </div>

          {/* Description */}
          {data.description && (
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">描述</div>
              <div className="text-sm text-gray-300 leading-relaxed">{data.description}</div>
            </div>
          )}

          {/* Implementation Steps */}
          {data.steps && data.steps.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">实现步骤</div>
              <div className="bg-gray-900 rounded-lg p-4 space-y-2">
                {data.steps.map((step, index) => (
                  <div key={index} className="flex space-x-3">
                    <span className="text-blue-400 font-mono text-sm flex-shrink-0">{index + 1}.</span>
                    <span className="text-gray-300 text-sm">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Technology Stack */}
          {data.tech && data.tech.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">技术栈</div>
              <div className="flex flex-wrap gap-2">
                {data.tech.map((tech, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-blue-900/30 text-blue-300 rounded-full text-xs font-medium border border-blue-800"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* API Endpoint */}
          {data.api && (
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">API 端点</div>
              <div className="bg-gray-900 rounded-lg p-3 font-mono text-sm">
                <span className="text-green-400">{data.api.method || 'POST'}</span>
                <span className="text-gray-300 ml-2">{data.api.endpoint}</span>
              </div>
            </div>
          )}

          {/* Status Badge */}
          <div className="pt-2 border-t border-gray-700">
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-500 uppercase tracking-wider">状态</div>
              <div className="flex items-center space-x-2">
                <span className="text-2xl">🚧</span>
                <span className="text-yellow-400 font-semibold">Demo (未实现)</span>
              </div>
            </div>
          </div>

          {/* Additional Note */}
          {data.note && (
            <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <span className="text-blue-400 text-lg">💡</span>
                <div className="flex-1">
                  <div className="text-xs text-blue-300 uppercase tracking-wider mb-1">提示</div>
                  <div className="text-sm text-gray-300">{data.note}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-800 border-t border-gray-700 px-6 py-4">
          <button
            onClick={onClose}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors"
          >
            了解
          </button>
        </div>
      </div>
    </div>
  );
}

export default ImplementationModal;
