import React, { useState, useEffect } from 'react';
import ImplementationModal from '../components/ImplementationModal';

function BotControl() {
  const [nodes, setNodes] = useState([]);
  const [events, setEvents] = useState([]);
  const [command, setCommand] = useState('');
  const [output, setOutput] = useState('');
  const [modalData, setModalData] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [nodesRes, eventsRes] = await Promise.all([
        fetch('/api/nodes'),
        fetch('/api/events?limit=5')
      ]);
      const nodesData = await nodesRes.json();
      const eventsData = await eventsRes.json();
      setNodes(nodesData);
      setEvents(eventsData.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  };

  const showImplementation = (data) => {
    setModalData(data);
    setModalOpen(true);
  };

  const executeCommand = async (cmd) => {
    setCommand(cmd);
    
    // Simulate command execution
    let result = '';
    
    if (cmd === '/status') {
      const onlineCount = nodes.filter(n => n.status === 'online').length;
      const offlineCount = nodes.length - onlineCount;
      const avgScore = Math.floor(
        nodes.filter(n => n.last_score).reduce((sum, n) => sum + n.last_score, 0) / 
        nodes.filter(n => n.last_score).length
      ) || 0;
      const alertCount = nodes.filter(n => n.last_score && n.last_score < 80).length;
      
      result = `📊 集群状态\n\n`;
      result += `🟢 在线: ${onlineCount}/${nodes.length} | 🔴 离线: ${offlineCount}\n`;
      result += `🧠 平均智力: ${avgScore} | ⚠️ 告警: ${alertCount}\n`;
      result += `💰 本月: $0 | 📦 今日备份: 14\n\n`;
      result += `节点状态:\n`;
      
      nodes.forEach(node => {
        const emoji = node.status === 'online' ? '🟢' : '🔴';
        const status = node.status === 'online' ? `CPU:${Math.floor(Math.random() * 30 + 5)}%` : 'OFFLINE';
        const score = node.last_score ? `🧠${node.last_score}` : '';
        const warning = node.last_score && node.last_score < 80 ? '⚠️' : '';
        result += `${emoji} ${node.name.padEnd(10)} ${status.padEnd(10)} ${score} ${warning}\n`;
      });
    } else if (cmd === '/nodes') {
      result = `🖥️ 节点列表 (${nodes.length}台)\n\n`;
      nodes.forEach(node => {
        const emoji = node.status === 'online' ? '🟢' : '🔴';
        result += `${emoji} ${node.name}\n`;
        result += `   IP: ${node.ip}\n`;
        result += `   版本: ${node.version || 'v1.8.2'}\n`;
        result += `   智力: ${node.last_score || 'N/A'}\n\n`;
      });
    } else if (cmd === '/scores') {
      result = `🧠 智力评分概览\n\n`;
      nodes.forEach(node => {
        if (node.last_score) {
          const bar = '█'.repeat(Math.floor(node.last_score / 10)) + '░'.repeat(10 - Math.floor(node.last_score / 10));
          result += `${node.name}: ${node.last_score}/100 ${bar}\n`;
        }
      });
    } else if (cmd === '/costs') {
      result = `💰 费用统计\n\n`;
      result += `本月总计: $0\n`;
      result += `本周: $0\n`;
      result += `今日: $0\n\n`;
      result += `节点明细:\n`;
      nodes.forEach(node => {
        result += `${node.name}: $${(Math.random() * 50).toFixed(2)}\n`;
      });
    } else {
      result = `🚧 此指令将在生产环境中实现\n\n指令: ${cmd}`;
    }
    
    setOutput(result);
  };

  const quickCommands = [
    { 
      category: '📊 查看类', 
      commands: [
        { label: '/status', cmd: '/status' },
        { label: '/nodes', cmd: '/nodes' },
        { label: '/scores', cmd: '/scores' },
        { label: '/costs', cmd: '/costs' },
      ]
    },
    { 
      category: '💾 备份类', 
      commands: [
        { label: '/backup all', cmd: '/backup all' },
        { label: '/backup g3s-01', cmd: '/backup g3s-01' },
      ]
    },
    { 
      category: '🔄 操作类', 
      commands: [
        { label: '/restart', cmd: '/restart' },
        { label: '/update all', cmd: '/update all' },
        { label: '/model 切换', cmd: '/model' },
        { label: '/sync-config', cmd: '/sync-config' },
      ]
    },
    { 
      category: '🧠 智力类', 
      commands: [
        { label: '/test all', cmd: '/test all' },
        { label: '/test g3s-01', cmd: '/test g3s-01' },
      ]
    },
  ];

  const alerts = events.filter(e => e.severity === 'warning' || e.severity === 'critical').slice(0, 2);

  const handleAlertAction = (event, action) => {
    const implementations = {
      '自动回滚': {
        feature: '自动回滚',
        description: '将节点还原到最近的稳定版本',
        steps: [
          '检测当前节点状态和最近稳定备份点',
          '创建当前配置快照 (rollback-pre)',
          'SSH 停止 OpenClaw 服务',
          '从 Git 还原配置文件和 workspace',
          '重启 OpenClaw 服务',
          '等待 30s 后进行健康检查',
          '触发智力测试验证恢复效果',
          '记录回滚操作到审计日志'
        ],
        tech: ['ssh2', 'simple-git', 'systemctl'],
        api: { method: 'POST', endpoint: `/api/nodes/${event.node_id}/rollback` },
        note: '回滚后会自动触发智力测试，确保节点恢复正常'
      },
      '手动检查': {
        feature: '手动检查节点',
        description: '通过 SSH 连接查看节点日志和状态',
        steps: [
          'SSH 连接到目标节点',
          '查看 OpenClaw 服务状态: systemctl status openclaw',
          '查看最近日志: journalctl -u openclaw -n 100',
          '检查磁盘空间: df -h',
          '检查内存使用: free -h',
          '查看进程状态: ps aux | grep openclaw',
          '显示结果到 Web 终端'
        ],
        tech: ['ssh2', 'node-pty', 'xterm.js'],
        api: { method: 'GET', endpoint: `/api/nodes/${event.node_id}/diagnostics` },
        note: '结果会在 Web 终端显示，支持实时交互'
      },
      'SSH重连': {
        feature: 'SSH 重新连接',
        description: '尝试重新建立 SSH 连接并重启服务',
        steps: [
          '从 SSH 连接池移除旧连接',
          '使用新连接尝试 SSH 到节点',
          '如果连接成功，执行 systemctl restart openclaw',
          '等待服务启动（最多 30s）',
          '执行健康检查',
          '更新节点状态为 online',
          '发送恢复通知'
        ],
        tech: ['ssh2', 'connection-pool', 'systemctl'],
        api: { method: 'POST', endpoint: `/api/nodes/${event.node_id}/reconnect` },
        note: '连接失败会触发告警升级'
      },
      '查看日志': {
        feature: '查看节点日志',
        description: '获取节点最近的运行日志',
        steps: [
          'SSH 连接到节点',
          '执行: journalctl -u openclaw -n 200 --no-pager',
          '解析日志，提取错误和警告',
          '格式化显示到 Web UI',
          '支持下载完整日志文件'
        ],
        tech: ['ssh2', 'journalctl'],
        api: { method: 'GET', endpoint: `/api/nodes/${event.node_id}/logs` },
        note: '日志会自动高亮错误和警告信息'
      },
      '静音1h': {
        feature: '静音告警',
        description: '暂时忽略此节点的告警通知',
        steps: [
          '在数据库中记录静音状态',
          '设置过期时间（当前时间 + 1小时）',
          '停止发送该节点的告警到 Bot',
          'Web UI 显示静音图标',
          '到期后自动恢复告警'
        ],
        tech: ['SQLite', 'Cron'],
        api: { method: 'POST', endpoint: `/api/events/${event.id}/mute` },
        note: '静音期间节点仍会被监控，只是不发送通知'
      },
      '忽略': {
        feature: '忽略告警',
        description: '标记此告警为已处理，不再显示',
        steps: [
          '更新事件状态为 resolved',
          '记录处理人和处理时间',
          '从未处理列表中移除',
          '保留在事件日志中供审计'
        ],
        tech: ['SQLite'],
        api: { method: 'PUT', endpoint: `/api/events/${event.id}/resolve` },
        note: '忽略不等于修复，只是标记为已知'
      }
    };

    const implData = implementations[action];
    if (implData) {
      showImplementation(implData);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="flex items-center space-x-3 mb-4">
          <span className="text-3xl">🤖</span>
          <h1 className="text-2xl font-bold text-white">OCM Bot 控制中心</h1>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-400 mb-1">Bot 状态</div>
            <div className="text-lg font-semibold text-green-400">🟢 运行中 (@yn_ocm_bot)</div>
          </div>
          <div>
            <div className="text-sm text-gray-400 mb-1">上次活动</div>
            <div className="text-lg font-semibold text-gray-300">3分钟前</div>
          </div>
        </div>
      </div>

      {/* Quick Commands */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 className="text-lg font-bold text-white mb-4">快捷指令</h2>
        
        <div className="space-y-4">
          {quickCommands.map((group, idx) => (
            <div key={idx}>
              <div className="text-sm font-medium text-gray-400 mb-2">{group.category}</div>
              <div className="flex flex-wrap gap-2">
                {group.commands.map((cmd, cmdIdx) => (
                  <button
                    key={cmdIdx}
                    onClick={() => executeCommand(cmd.cmd)}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg text-sm font-mono transition-colors border border-gray-600"
                  >
                    {cmd.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Command Simulator */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 className="text-lg font-bold text-white mb-4">指令模拟器</h2>
        
        {/* Output Display */}
        <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm text-gray-300 mb-4 min-h-[300px] max-h-[400px] overflow-y-auto whitespace-pre-wrap">
          {command && <div className="text-blue-400 mb-2">&gt; {command}</div>}
          {output || '等待输入指令...'}
        </div>
        
        {/* Input */}
        <div className="flex space-x-2">
          <input
            type="text"
            placeholder="输入指令... (如: /status)"
            className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && command.trim()) {
                executeCommand(command.trim());
              }
            }}
          />
          <button
            onClick={() => {
              if (command.trim()) {
                executeCommand(command.trim());
              }
            }}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            发送
          </button>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-lg font-bold text-white mb-4">告警确认</h2>
          
          <div className="space-y-4">
            {alerts.map((alert) => {
              const severityEmoji = alert.severity === 'critical' ? '🔴' : '🟠';
              const node = nodes.find(n => n.id === alert.node_id);
              
              return (
                <div key={alert.id} className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-start space-x-3 mb-3">
                    <span className="text-2xl">{severityEmoji}</span>
                    <div className="flex-1">
                      <div className="font-semibold text-white mb-1">{alert.message}</div>
                      <div className="text-xs text-gray-400">
                        {node?.name} • {new Date(alert.created_at).toLocaleString('zh-CN')}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {alert.message.includes('智力') ? (
                      <>
                        <button
                          onClick={() => handleAlertAction(alert, '自动回滚')}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                        >
                          自动回滚
                        </button>
                        <button
                          onClick={() => handleAlertAction(alert, '手动检查')}
                          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm rounded transition-colors"
                        >
                          手动检查
                        </button>
                        <button
                          onClick={() => handleAlertAction(alert, '忽略')}
                          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-400 text-sm rounded transition-colors"
                        >
                          忽略
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleAlertAction(alert, 'SSH重连')}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                        >
                          SSH重连
                        </button>
                        <button
                          onClick={() => handleAlertAction(alert, '查看日志')}
                          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm rounded transition-colors"
                        >
                          查看日志
                        </button>
                        <button
                          onClick={() => handleAlertAction(alert, '静音1h')}
                          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-400 text-sm rounded transition-colors"
                        >
                          静音1h
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Implementation Modal */}
      <ImplementationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        data={modalData}
      />
    </div>
  );
}

export default BotControl;
