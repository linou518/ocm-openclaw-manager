import React, { useState } from 'react';
import ImplementationModal from '../components/ImplementationModal';

function SettingsTabbed() {
  const [activeTab, setActiveTab] = useState('general');
  const [modalData, setModalData] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  
  const [settings, setSettings] = useState({
    // 一般设置
    clusterName: 'YN OpenClaw Cluster',
    admin: 'YN',
    timezone: 'Asia/Tokyo',
    
    // 备份设置
    autoBackup: true,
    backupInterval: 6,
    backupRetentionDays: 30,
    
    // 智力测试
    autoScore: true,
    scoreInterval: 12,
    scoreThreshold: 70,
    
    // 看门狗
    watchdogInterval: 60,
    githubCheckInterval: 5,
    autoRestartThreshold: '3/1',
    
    // 告警
    alertOfflineToWarn: 5,
    alertWarnToCritical: 15,
    alertCriticalToEmergency: 60,
    
    // 自动回滚
    autoRollback: true,
    rollbackThreshold: 50,
    
    // GitHub
    githubRepo: 'ocm-backups',
    githubBranch: 'main',
    
    // Google Drive
    driveEnabled: false,
    driveFolder: '',
  });

  const tabs = [
    { key: 'general', label: '一般', icon: '⚙️' },
    { key: 'backup', label: '备份', icon: '💾' },
    { key: 'intelligence', label: '智力测试', icon: '🧠' },
    { key: 'watchdog', label: '看门狗', icon: '🐕' },
    { key: 'alert', label: '告警', icon: '⚠️' },
    { key: 'github', label: 'GitHub', icon: '📦' },
    { key: 'drive', label: 'Google Drive', icon: '☁️' },
  ];

  const [saveLoading, setSaveLoading] = useState(false);

  const handleSave = async () => {
    setSaveLoading(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const result = await res.json();
      if (res.ok) {
        alert(result.message || '✅ 设置已保存');
      } else {
        alert('❌ 保存失败: ' + result.error);
      }
    } catch (error) {
      alert('❌ 保存失败: ' + error.message);
    } finally {
      setSaveLoading(false);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">集群名称</label>
              <input
                type="text"
                value={settings.clusterName}
                onChange={(e) => setSettings({...settings, clusterName: e.target.value})}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">管理员</label>
              <input
                type="text"
                value={settings.admin}
                onChange={(e) => setSettings({...settings, admin: e.target.value})}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">时区</label>
              <select
                value={settings.timezone}
                onChange={(e) => setSettings({...settings, timezone: e.target.value})}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                <option value="Asia/Tokyo">Asia/Tokyo (东京)</option>
                <option value="Asia/Shanghai">Asia/Shanghai (上海)</option>
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New_York (纽约)</option>
              </select>
            </div>
          </div>
        );

      case 'backup':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-white text-white mb-1">自动备份</div>
                <div className="text-xs text-gray-400 text-gray-500">定期自动备份所有节点</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={settings.autoBackup}
                  onChange={(e) => setSettings({...settings, autoBackup: e.target.checked})}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-600 peer-focus:ring-blue-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-white text-white mb-2">备份间隔（小时）</label>
              <input
                type="number"
                value={settings.backupInterval}
                onChange={(e) => setSettings({...settings, backupInterval: parseInt(e.target.value)})}
                className="w-full px-4 py-2 bg-gray-700 bg-gray-700 border border-gray-600 border-gray-600 rounded-lg text-white text-white focus:outline-none focus:border-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white text-white mb-2">备份保留天数</label>
              <input
                type="number"
                value={settings.backupRetentionDays}
                onChange={(e) => setSettings({...settings, backupRetentionDays: parseInt(e.target.value)})}
                className="w-full px-4 py-2 bg-gray-700 bg-gray-700 border border-gray-600 border-gray-600 rounded-lg text-white text-white focus:outline-none focus:border-blue-500 focus:border-blue-500"
              />
              <div className="text-xs text-gray-400 text-gray-500 mt-1">超过此天数的备份会被自动删除</div>
            </div>
          </div>
        );

      case 'intelligence':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-white text-white mb-1">自动智力测试</div>
                <div className="text-xs text-gray-400 text-gray-500">定期运行智力测试</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={settings.autoScore}
                  onChange={(e) => setSettings({...settings, autoScore: e.target.checked})}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-600 peer-focus:ring-blue-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-white text-white mb-2">测试间隔（小时）</label>
              <input
                type="number"
                value={settings.scoreInterval}
                onChange={(e) => setSettings({...settings, scoreInterval: parseInt(e.target.value)})}
                className="w-full px-4 py-2 bg-gray-700 bg-gray-700 border border-gray-600 border-gray-600 rounded-lg text-white text-white focus:outline-none focus:border-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white text-white mb-2">告警阈值</label>
              <input
                type="number"
                value={settings.scoreThreshold}
                onChange={(e) => setSettings({...settings, scoreThreshold: parseInt(e.target.value)})}
                className="w-full px-4 py-2 bg-gray-700 bg-gray-700 border border-gray-600 border-gray-600 rounded-lg text-white text-white focus:outline-none focus:border-blue-500 focus:border-blue-500"
              />
              <div className="text-xs text-gray-400 text-gray-500 mt-1">评分低于此值时触发告警</div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-700 border-gray-700">
              <div>
                <div className="text-sm font-medium text-white text-white mb-1">自动回滚</div>
                <div className="text-xs text-gray-400 text-gray-500">评分过低时自动回滚到稳定版本</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={settings.autoRollback}
                  onChange={(e) => setSettings({...settings, autoRollback: e.target.checked})}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-600 peer-focus:ring-blue-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-white text-white mb-2">回滚阈值</label>
              <input
                type="number"
                value={settings.rollbackThreshold}
                onChange={(e) => setSettings({...settings, rollbackThreshold: parseInt(e.target.value)})}
                className="w-full px-4 py-2 bg-gray-700 bg-gray-700 border border-gray-600 border-gray-600 rounded-lg text-white text-white focus:outline-none focus:border-blue-500 focus:border-blue-500"
              />
              <div className="text-xs text-gray-400 text-gray-500 mt-1">评分低于此值时触发自动回滚</div>
            </div>
          </div>
        );

      case 'watchdog':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white text-white mb-2">节点检查间隔（秒）</label>
              <select
                value={settings.watchdogInterval}
                onChange={(e) => setSettings({...settings, watchdogInterval: parseInt(e.target.value)})}
                className="w-full px-4 py-2 bg-gray-700 bg-gray-700 border border-gray-600 border-gray-600 rounded-lg text-white text-white focus:outline-none focus:border-blue-500 focus:border-blue-500"
              >
                <option value="30">30秒</option>
                <option value="60">60秒</option>
                <option value="120">120秒</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-white text-white mb-2">GitHub 检查间隔（分钟）</label>
              <select
                value={settings.githubCheckInterval}
                onChange={(e) => setSettings({...settings, githubCheckInterval: parseInt(e.target.value)})}
                className="w-full px-4 py-2 bg-gray-700 bg-gray-700 border border-gray-600 border-gray-600 rounded-lg text-white text-white focus:outline-none focus:border-blue-500 focus:border-blue-500"
              >
                <option value="5">5分钟</option>
                <option value="10">10分钟</option>
                <option value="15">15分钟</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-white text-white mb-2">自动重启阈值</label>
              <select
                value={settings.autoRestartThreshold}
                onChange={(e) => setSettings({...settings, autoRestartThreshold: e.target.value})}
                className="w-full px-4 py-2 bg-gray-700 bg-gray-700 border border-gray-600 border-gray-600 rounded-lg text-white text-white focus:outline-none focus:border-blue-500 focus:border-blue-500"
              >
                <option value="3/1">3次/小时</option>
                <option value="5/1">5次/小时</option>
                <option value="10/1">10次/小时</option>
              </select>
              <div className="text-xs text-gray-400 text-gray-500 mt-1">超过阈值后停止自动重启，防止无限循环</div>
            </div>
          </div>
        );

      case 'alert':
        return (
          <div className="space-y-4">
            <div className="text-sm text-gray-400 text-gray-500 mb-4">
              告警会根据持续时间自动升级严重程度
            </div>
            
            <div>
              <label className="block text-sm font-medium text-white text-white mb-2">离线 → 警告（分钟）</label>
              <select
                value={settings.alertOfflineToWarn}
                onChange={(e) => setSettings({...settings, alertOfflineToWarn: parseInt(e.target.value)})}
                className="w-full px-4 py-2 bg-gray-700 bg-gray-700 border border-gray-600 border-gray-600 rounded-lg text-white text-white focus:outline-none focus:border-blue-500 focus:border-blue-500"
              >
                <option value="3">3分钟</option>
                <option value="5">5分钟</option>
                <option value="10">10分钟</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-white text-white mb-2">警告 → 严重（分钟）</label>
              <select
                value={settings.alertWarnToCritical}
                onChange={(e) => setSettings({...settings, alertWarnToCritical: parseInt(e.target.value)})}
                className="w-full px-4 py-2 bg-gray-700 bg-gray-700 border border-gray-600 border-gray-600 rounded-lg text-white text-white focus:outline-none focus:border-blue-500 focus:border-blue-500"
              >
                <option value="10">10分钟</option>
                <option value="15">15分钟</option>
                <option value="30">30分钟</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-white text-white mb-2">严重 → 危急（分钟）</label>
              <select
                value={settings.alertCriticalToEmergency}
                onChange={(e) => setSettings({...settings, alertCriticalToEmergency: parseInt(e.target.value)})}
                className="w-full px-4 py-2 bg-gray-700 bg-gray-700 border border-gray-600 border-gray-600 rounded-lg text-white text-white focus:outline-none focus:border-blue-500 focus:border-blue-500"
              >
                <option value="30">30分钟</option>
                <option value="60">1小时</option>
                <option value="120">2小时</option>
              </select>
            </div>
          </div>
        );

      case 'github':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white text-white mb-2">仓库名称</label>
              <input
                type="text"
                value={settings.githubRepo}
                onChange={(e) => setSettings({...settings, githubRepo: e.target.value})}
                className="w-full px-4 py-2 bg-gray-700 bg-gray-700 border border-gray-600 border-gray-600 rounded-lg text-white text-white focus:outline-none focus:border-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white text-white mb-2">分支</label>
              <input
                type="text"
                value={settings.githubBranch}
                onChange={(e) => setSettings({...settings, githubBranch: e.target.value})}
                className="w-full px-4 py-2 bg-gray-700 bg-gray-700 border border-gray-600 border-gray-600 rounded-lg text-white text-white focus:outline-none focus:border-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="pt-4 border-t border-gray-700 border-gray-700">
              <button className="px-4 py-2 bg-gray-700 bg-gray-700 text-gray-300 text-gray-300 rounded-lg hover:bg-gray-600 hover:bg-gray-600 transition-colors">
                测试连接
              </button>
            </div>
          </div>
        );

      case 'drive':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-white text-white mb-1">启用 Google Drive 备份</div>
                <div className="text-xs text-gray-400 text-gray-500">将备份同步到 Google Drive</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={settings.driveEnabled}
                  onChange={(e) => setSettings({...settings, driveEnabled: e.target.checked})}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-600 peer-focus:ring-blue-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {settings.driveEnabled && (
              <>
                <div>
                  <label className="block text-sm font-medium text-white text-white mb-2">Drive 文件夹 ID</label>
                  <input
                    type="text"
                    value={settings.driveFolder}
                    onChange={(e) => setSettings({...settings, driveFolder: e.target.value})}
                    placeholder="1a2b3c4d5e6f..."
                    className="w-full px-4 py-2 bg-gray-700 bg-gray-700 border border-gray-600 border-gray-600 rounded-lg text-white text-white focus:outline-none focus:border-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="pt-4 border-t border-gray-700 border-gray-700">
                  <button className="px-4 py-2 bg-gray-700 bg-gray-700 text-gray-300 text-gray-300 rounded-lg hover:bg-gray-600 hover:bg-gray-600 transition-colors">
                    授权 Google Drive
                  </button>
                </div>
              </>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white text-white">⚙️ 系统设置</h1>
        <button 
          onClick={handleSave}
          disabled={saveLoading}
          className="px-6 py-2 bg-blue-600 dark:bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-700 text-white text-white rounded-lg font-medium transition-colors disabled:opacity-50 min-w-[120px]"
        >
          {saveLoading ? '保存中...' : '保存设置'}
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-gray-800 bg-gray-800 rounded-lg border border-gray-700 border-gray-700 shadow-lg overflow-hidden">
        {/* Tab Headers */}
        <div className="border-b border-gray-700 border-gray-700 overflow-x-auto">
          <nav className="flex -mb-px">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 md:px-6 py-3 text-xs md:text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.key
                    ? 'border-b-2 border-blue-600 dark:border-blue-600 text-blue-600 dark:text-blue-600 bg-gray-850 bg-gray-850'
                    : 'text-gray-400 text-gray-400 hover:text-gray-300 dark:hover:text-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {renderTabContent()}
        </div>
      </div>

      {/* Implementation Modal */}
      <ImplementationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        data={modalData}
      />
    </div>
  );
}

export default SettingsTabbed;
