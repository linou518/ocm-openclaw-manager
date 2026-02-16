import React, { useState } from 'react';
import ImplementationModal from '../components/ImplementationModal';

function Settings() {
  const [modalData, setModalData] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [settings, setSettings] = useState({
    autoBackup: true,
    backupInterval: 6,
    autoScore: true,
    scoreInterval: 12,
    scoreThreshold: 70,
    autoRollback: true,
    rollbackThreshold: 50,
    telegram: {
      enabled: true,
      chatId: '',
    },
    github: {
      repo: 'ocm-backups',
      branch: 'main',
    },
  });

  const handleSave = () => {
    setModalData({
      feature: '保存设置',
      description: '更新 OCM 配置文件并重启相关服务',
      steps: [
        '验证输入值的合法性',
        '读取 OCM 配置文件 ~/.openclaw/ws-ocm/config.json',
        '更新对应的配置项',
        '保存配置文件',
        '重启 OCM 调度器 (cron jobs)',
        '更新数据库中的配置缓存',
        '如果 telegram 设置变化，重新连接 Bot',
        '如果 github 设置变化，验证仓库访问权限',
        '发送通知：设置已更新'
      ],
      tech: ['fs', 'json', 'pm2', 'cron'],
      api: { method: 'PUT', endpoint: '/api/settings' },
      note: '某些设置需要重启 OCM Server 才能生效'
    });
    setModalOpen(true);
  };

  const showConfigImpl = (setting) => {
    const implementations = {
      watchdog_interval: {
        feature: '看门狗检查间隔',
        description: '设置看门狗多久检查一次节点状态',
        steps: [
          '更新 OCM 配置中的 watchdog.check_interval',
          '重启看门狗定时任务',
          '新间隔立即生效',
          '建议：60s 适合生产环境，30s 适合测试'
        ],
        tech: ['cron', 'setInterval'],
        api: { method: 'PUT', endpoint: '/api/settings/watchdog' },
        note: '间隔过短会增加系统负载，过长会延迟故障发现'
      },
      github_check: {
        feature: 'GitHub 检查间隔',
        description: '多久检查一次 GitHub Push 是否正常',
        steps: [
          '更新 watchdog.github_check_interval',
          '重启 GitHub 监控任务',
          '每次检查会尝试 git fetch',
          '如果失败，发送告警'
        ],
        tech: ['simple-git', 'cron'],
        api: { method: 'PUT', endpoint: '/api/settings/watchdog' },
        note: '推荐 5 分钟，避免 GitHub API 限制'
      },
      restart_threshold: {
        feature: '自动重启阈值',
        description: '节点在一定时间内重启次数过多时停止自动重启',
        steps: [
          '更新 watchdog.auto_restart_threshold',
          '格式：次数/小时，如 3/1 = 1小时内最多3次',
          '超过阈值后停止自动重启',
          '发送危急告警通知人工介入'
        ],
        tech: ['redis', 'counter'],
        api: { method: 'PUT', endpoint: '/api/settings/watchdog' },
        note: '防止无限重启循环，保护系统资源'
      },
      operation_timeout: {
        feature: '操作超时时间',
        description: '单个 SSH 操作的最长执行时间',
        steps: [
          '更新 queue.operation_timeout',
          '应用到所有 SSH 操作',
          '超时后强制终止连接',
          '标记操作为失败',
          '释放队列锁'
        ],
        tech: ['setTimeout', 'ssh2'],
        api: { method: 'PUT', endpoint: '/api/settings/queue' },
        note: '推荐 5 分钟，大备份可能需要更长'
      },
      max_concurrent: {
        feature: '最大并发节点数',
        description: '同时操作的节点数量上限',
        steps: [
          '更新 queue.max_concurrent_nodes',
          '限制并发 SSH 连接数',
          '超出时排队等待',
          '避免网络拥塞'
        ],
        tech: ['queue', 'semaphore'],
        api: { method: 'PUT', endpoint: '/api/settings/queue' },
        note: 'Master 机器配置较低时建议设为 3-5'
      }
    };

    const impl = implementations[setting];
    if (impl) {
      setModalData(impl);
      setModalOpen(true);
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <h1 className="text-2xl font-bold text-white">⚙️ 系统设置</h1>

      {/* 备份设置 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700 bg-gray-850">
          <h2 className="text-lg font-bold text-white">💾 备份设置</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-white mb-1">自动备份</div>
              <div className="text-xs text-gray-400">定期自动备份所有节点</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={settings.autoBackup}
                onChange={(e) => setSettings({...settings, autoBackup: e.target.checked})}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div>
            <label className="text-sm font-medium text-white mb-2 block">备份间隔（小时）</label>
            <input
              type="number"
              value={settings.backupInterval}
              onChange={(e) => setSettings({...settings, backupInterval: parseInt(e.target.value)})}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* 智力评估设置 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700 bg-gray-850">
          <h2 className="text-lg font-bold text-white">🧠 智力评估设置</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-white mb-1">自动评估</div>
              <div className="text-xs text-gray-400">定期运行智力测试</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={settings.autoScore}
                onChange={(e) => setSettings({...settings, autoScore: e.target.checked})}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div>
            <label className="text-sm font-medium text-white mb-2 block">评估间隔（小时）</label>
            <input
              type="number"
              value={settings.scoreInterval}
              onChange={(e) => setSettings({...settings, scoreInterval: parseInt(e.target.value)})}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-white mb-2 block">告警阈值</label>
            <input
              type="number"
              value={settings.scoreThreshold}
              onChange={(e) => setSettings({...settings, scoreThreshold: parseInt(e.target.value)})}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            />
            <div className="text-xs text-gray-400 mt-1">评分低于此值时触发告警</div>
          </div>
        </div>
      </div>

      {/* 自动回滚设置 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700 bg-gray-850">
          <h2 className="text-lg font-bold text-white">🔄 自动回滚设置</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-white mb-1">启用自动回滚</div>
              <div className="text-xs text-gray-400">评分过低时自动回滚到稳定版本</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={settings.autoRollback}
                onChange={(e) => setSettings({...settings, autoRollback: e.target.checked})}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div>
            <label className="text-sm font-medium text-white mb-2 block">回滚阈值</label>
            <input
              type="number"
              value={settings.rollbackThreshold}
              onChange={(e) => setSettings({...settings, rollbackThreshold: parseInt(e.target.value)})}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            />
            <div className="text-xs text-gray-400 mt-1">评分低于此值时触发自动回滚</div>
          </div>
        </div>
      </div>

      {/* GitHub 设置 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700 bg-gray-850">
          <h2 className="text-lg font-bold text-white">📦 GitHub 备份</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-white mb-2 block">仓库名称</label>
            <input
              type="text"
              value={settings.github.repo}
              onChange={(e) => setSettings({...settings, github: {...settings.github, repo: e.target.value}})}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-white mb-2 block">分支</label>
            <input
              type="text"
              value={settings.github.branch}
              onChange={(e) => setSettings({...settings, github: {...settings.github, branch: e.target.value}})}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* 看门狗设置 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700 bg-gray-850">
          <h2 className="text-lg font-bold text-white">🐕 看门狗设置</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-white mb-2 flex items-center justify-between">
                <span>节点检查间隔</span>
                <button
                  onClick={() => showConfigImpl('watchdog_interval')}
                  className="text-blue-400 hover:text-blue-300 text-lg"
                >
                  🔧
                </button>
              </label>
              <select className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500">
                <option value="30">30秒</option>
                <option value="60" selected>60秒</option>
                <option value="120">120秒</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-white mb-2 flex items-center justify-between">
                <span>GitHub检查间隔</span>
                <button
                  onClick={() => showConfigImpl('github_check')}
                  className="text-blue-400 hover:text-blue-300 text-lg"
                >
                  🔧
                </button>
              </label>
              <select className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500">
                <option value="5" selected>5分钟</option>
                <option value="10">10分钟</option>
                <option value="15">15分钟</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-white mb-2 flex items-center justify-between">
                <span>自动重启阈值</span>
                <button
                  onClick={() => showConfigImpl('restart_threshold')}
                  className="text-blue-400 hover:text-blue-300 text-lg"
                >
                  🔧
                </button>
              </label>
              <select className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500">
                <option value="3/1" selected>3次/小时</option>
                <option value="5/1">5次/小时</option>
                <option value="10/1">10次/小时</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 操作队列设置 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700 bg-gray-850">
          <h2 className="text-lg font-bold text-white">📋 操作队列</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-white mb-2 flex items-center justify-between">
                <span>单操作超时</span>
                <button
                  onClick={() => showConfigImpl('operation_timeout')}
                  className="text-blue-400 hover:text-blue-300 text-lg"
                >
                  🔧
                </button>
              </label>
              <select className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500">
                <option value="3">3分钟</option>
                <option value="5" selected>5分钟</option>
                <option value="10">10分钟</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-white mb-2 flex items-center justify-between">
                <span>最大并发节点数</span>
                <button
                  onClick={() => showConfigImpl('max_concurrent')}
                  className="text-blue-400 hover:text-blue-300 text-lg"
                >
                  🔧
                </button>
              </label>
              <select className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500">
                <option value="3">3</option>
                <option value="5" selected>5</option>
                <option value="10">10</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 告警升级设置 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700 bg-gray-850">
          <h2 className="text-lg font-bold text-white">⚠️ 告警升级</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-white mb-2 block">离线→警告</label>
              <select className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500">
                <option value="3">3分钟</option>
                <option value="5" selected>5分钟</option>
                <option value="10">10分钟</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-white mb-2 block">警告→严重</label>
              <select className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500">
                <option value="10">10分钟</option>
                <option value="15" selected>15分钟</option>
                <option value="30">30分钟</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-white mb-2 block">严重→危急</label>
              <select className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500">
                <option value="30">30分钟</option>
                <option value="60" selected>1小时</option>
                <option value="120">2小时</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 保存按钮 */}
      <div className="flex justify-end">
        <button 
          onClick={handleSave}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          保存设置
        </button>
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

export default Settings;
