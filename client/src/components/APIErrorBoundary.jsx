
import React from 'react';

class APIErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('React Error Boundary:', error, errorInfo);
    
    // 特殊处理JSON解析错误
    if (error.message && error.message.includes('JSON')) {
      console.warn('检测到JSON解析错误，可能是API返回了HTML');
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary p-4 bg-red-900/20 border border-red-700 rounded-lg">
          <h3 className="text-red-400 font-bold mb-2">⚠️ 页面加载错误</h3>
          <p className="text-red-300 text-sm mb-3">
            {this.state.error?.message || '页面遇到了技术问题'}
          </p>
          <div className="space-x-2">
            <button 
              onClick={() => window.location.reload()}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded"
            >
              🔄 刷新页面
            </button>
            <button 
              onClick={() => window.location.href = '/'}
              className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded"
            >
              🏠 返回首页
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default APIErrorBoundary;
