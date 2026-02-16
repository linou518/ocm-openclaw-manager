import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import Dashboard from './pages/Dashboard';
import Nodes from './pages/Nodes';
import NodeDetail from './pages/NodeDetail';
import Backups from './pages/Backups';
import Scores from './pages/Scores';
import Events from './pages/Events';
import Keys from './pages/Keys';
import Settings from './pages/Settings';
import BotControl from './pages/BotControl';
import Audit from './pages/Audit';
import CronJobs from './pages/CronJobs';
import Optimizations from './pages/Optimizations';

function AppContent() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isDark, toggleTheme } = useTheme();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: '🏠' },
    { path: '/bot-control', label: 'Bot控制', icon: '🤖' },
    { path: '/nodes', label: '节点', icon: '🖥️' },
    { path: '/keys', label: 'Keys', icon: '🔑' },
    { path: '/cron-jobs', label: 'Cron Jobs', icon: '⏰' },
    { path: '/optimizations', label: '优化部署', icon: '🚀' },
    { path: '/backups', label: '备份', icon: '💾' },
    { path: '/scores', label: '智力', icon: '🧠' },
    { path: '/events', label: '事件', icon: '📋' },
    { path: '/audit', label: '审计', icon: '📝' },
    { path: '/settings', label: '设置', icon: '⚙️' },
  ];

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  // 获取当前页面标题
  const getCurrentTitle = () => {
    const item = navItems.find(item => isActive(item.path));
    return item ? `${item.icon} ${item.label}` : '🚀 OCM';
  };

  // 面包屑导航
  const getBreadcrumb = () => {
    const paths = location.pathname.split('/').filter(Boolean);
    if (paths.length === 0) return null;
    
    const crumbs = [{ label: 'Dashboard', path: '/' }];
    let currentPath = '';
    
    paths.forEach((segment, idx) => {
      currentPath += `/${segment}`;
      const item = navItems.find(n => n.path === currentPath);
      if (item) {
        crumbs.push({ label: item.label, path: currentPath });
      } else if (idx === paths.length - 1) {
        // 详情页，显示 ID
        crumbs.push({ label: segment, path: currentPath });
      }
    });
    
    return crumbs;
  };

  const breadcrumb = getBreadcrumb();

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex">
      {/* 桌面侧边栏 */}
      <aside className="hidden md:flex md:flex-shrink-0">
        <div className="flex flex-col w-64 bg-gray-800 border-r border-gray-700">
          {/* Logo */}
          <div className="flex items-center h-16 px-6 border-b border-gray-700 bg-gray-900">
            <span className="text-2xl mr-2">🚀</span>
            <h1 className="text-xl font-bold text-white">OCM</h1>
            <span className="ml-auto text-xs text-gray-500">v0.5</span>
          </div>
          
          {/* 导航 */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive(item.path)
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <span className="text-xl mr-3">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>
          
          {/* 集群状态 */}
          <div className="p-4 border-t border-gray-700 bg-gray-900">
            <div className="text-xs text-gray-400 mb-2">集群状态</div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-green-400">🟢 6/7 在线</span>
              <span className="text-xs text-gray-500">99.2% uptime</span>
            </div>
          </div>
        </div>
      </aside>

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 顶部栏 */}
        <header className="bg-gray-800 border-b border-gray-700 shadow-md">
          <div className="flex items-center justify-between px-4 md:px-6 py-3">
            {/* 移动端汉堡菜单 + 标题 */}
            <div className="flex items-center space-x-3">
              <button 
                className="md:hidden text-gray-300 hover:text-white"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              
              {/* 移动端显示当前页标题 */}
              <h2 className="md:hidden text-lg font-bold">{getCurrentTitle()}</h2>
              
              {/* 桌面端显示面包屑 */}
              {breadcrumb && breadcrumb.length > 1 && (
                <div className="hidden md:flex items-center space-x-2 text-sm">
                  {breadcrumb.map((crumb, idx) => (
                    <React.Fragment key={crumb.path}>
                      {idx > 0 && <span className="text-gray-600">›</span>}
                      <Link
                        to={crumb.path}
                        className={`hover:text-blue-400 transition-colors ${
                          idx === breadcrumb.length - 1 
                            ? 'text-white font-medium' 
                            : 'text-gray-400'
                        }`}
                      >
                        {crumb.label}
                      </Link>
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
            
            {/* 右侧操作区 */}
            <div className="flex items-center space-x-4">
              {/* 全局搜索 (桌面端) */}
              <div className="hidden md:block">
                <input
                  type="text"
                  placeholder="搜索节点、Keys..."
                  className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-64"
                />
              </div>
              
              {/* 主题切换 */}
              <button
                onClick={toggleTheme}
                className="text-gray-300 hover:text-white transition-colors text-2xl"
                title={isDark ? '切换到浅色主题' : '切换到深色主题'}
              >
                {isDark ? '☀️' : '🌙'}
              </button>
              
              {/* 通知 */}
              <button className="relative text-gray-300 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
              
              {/* 用户头像 */}
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                Y
              </div>
            </div>
          </div>
        </header>

        {/* 页面内容 */}
        <main className="flex-1 overflow-y-auto bg-gray-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/bot-control" element={<BotControl />} />
              <Route path="/nodes" element={<Nodes />} />
              <Route path="/nodes/:id" element={<NodeDetail />} />
              <Route path="/backups" element={<Backups />} />
              <Route path="/scores" element={<Scores />} />
              <Route path="/keys" element={<Keys />} />
              <Route path="/cron-jobs" element={<CronJobs />} />
              <Route path="/optimizations" element={<Optimizations />} />
              <Route path="/events" element={<Events />} />
              <Route path="/audit" element={<Audit />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </div>
        </main>

        {/* 移动端底部导航 */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 safe-area-bottom z-50">
          <div className="grid grid-cols-5 gap-0.5">
            {[navItems[0], navItems[1], navItems[2], navItems[4], navItems[9]].map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center py-2 px-1 transition-colors ${
                  isActive(item.path)
                    ? 'text-blue-400'
                    : 'text-gray-400'
                }`}
              >
                <span className="text-xl mb-0.5">{item.icon}</span>
                <span className="text-[9px] leading-tight text-center truncate w-full">{item.label}</span>
              </Link>
            ))}
          </div>
        </nav>
      </div>

      {/* 移动端侧边栏遮罩 */}
      {sidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="bg-gray-800 w-64 h-full shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="text-2xl mr-2">🚀</span>
                  <h1 className="text-xl font-bold">OCM</h1>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="text-gray-400">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <nav className="p-4 space-y-1">
              {navItems.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    isActive(item.path)
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  <span className="text-xl mr-3">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
