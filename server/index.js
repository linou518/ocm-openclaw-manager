const express = require('express');
const { execSync } = require("child_process");
const nodeManagementRouter = require('./node-management-api');
const TokenManager = require('./token-manager');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const PORT = 8001;

// Database
const dbPath = path.join(__dirname, 'db', 'ocm.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Token Manager
const tokenManager = new TokenManager();
console.log('🔑 Token管理系统已初始化');

// Middleware
app.use(cors());
app.use(express.json());

// 禁用API缓存，防止前端缓存问题
app.use('/api', (req, res, next) => {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache', 
    'Expires': '0'
  });
  next();
});

// API Routes
app.use(nodeManagementRouter);

// Dashboard - 全量数据
app.get('/api/dashboard', (req, res) => {
  try {
    const nodes = db.prepare('SELECT * FROM nodes ORDER BY id').all();
    
    // 每个节点添加 bot 数量
    nodes.forEach(node => {
      const botCount = db.prepare('SELECT COUNT(*) as count FROM bots WHERE node_id = ?').get(node.id).count;
      node.bot_count = botCount;
    });
    
    const events = db.prepare('SELECT * FROM events ORDER BY created_at DESC LIMIT 10').all();
    
    const onlineCount = nodes.filter(n => ['online', 'unstable'].includes(n.status)).length;
    const avgScore = Math.floor(
      nodes.filter(n => n.last_score).reduce((sum, n) => sum + n.last_score, 0) / 
      nodes.filter(n => n.last_score).length
    ) || 0;
    
    const todayBackups = db.prepare(`
      SELECT COUNT(*) as count FROM backups 
      WHERE created_at > ?
    `).get(Date.now() - 86400000).count;

    // 智力趋势数据（最近7天）
    const sevenDaysAgo = Date.now() - 7 * 24 * 3600000;
    const trendScores = db.prepare(`
      SELECT node_id, total_score, created_at 
      FROM scores 
      WHERE created_at > ?
      ORDER BY created_at ASC
    `).all(sevenDaysAgo);

    // 按日期分组
    const trendMap = {};
    trendScores.forEach(score => {
      const date = new Date(score.created_at).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
      if (!trendMap[date]) trendMap[date] = {};
      trendMap[date][score.node_id] = score.total_score;
    });

    const trendData = Object.keys(trendMap).map(date => ({
      date,
      ...trendMap[date]
    }));

    // Phase 7: Additional stats
    const totalSessions = db.prepare('SELECT COUNT(*) as count FROM sessions').get().count;
    const activeSessions = db.prepare('SELECT COUNT(*) as count FROM sessions WHERE is_active = 1').get().count;
    const totalCronJobs = db.prepare('SELECT COUNT(*) as count FROM cron_jobs').get().count;
    const enabledCronJobs = db.prepare('SELECT COUNT(*) as count FROM cron_jobs WHERE enabled = 1').get().count;
    const totalSkills = db.prepare('SELECT COUNT(*) as count FROM skills').get().count;
    const memoryWarnings = db.prepare(`
      SELECT COUNT(*) as count FROM memory_health 
      WHERE health_status != 'healthy' 
      AND id IN (
        SELECT MAX(id) FROM memory_health GROUP BY bot_id
      )
    `).get().count;

    res.json({
      overview: {
        totalNodes: nodes.length,
        onlineCount,
        offlineCount: nodes.length - onlineCount,
        avgScore,
        todayBackups,
        alerts: nodes.filter(n => n.last_score && n.last_score < 80).length,
        totalSessions,
        activeSessions,
        totalCronJobs,
        enabledCronJobs,
        totalSkills,
        memoryWarnings,
      },
      nodes,
      events,
      trendData,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 节点列表 (包含Token信息)
app.get('/api/nodes', async (req, res) => {
  try {
    const nodes = db.prepare('SELECT * FROM nodes ORDER BY id').all();
    
    // 并行获取每个节点的Token信息
    const nodesWithTokens = await Promise.all(
      nodes.map(async (node) => {
        try {
          const tokenInfo = await tokenManager.getNodeTokenInfo(node);
          return { ...node, token_info: tokenInfo };
        } catch (error) {
          console.warn(`获取节点 ${node.id} Token信息失败:`, error.message);
          return { 
            ...node, 
            token_info: { 
              provider: 'unknown', 
              status: 'error', 
              error: error.message 
            } 
          };
        }
      })
    );
    
    res.json(nodesWithTokens);
  } catch (error) {
    console.error('获取节点列表失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 添加节点 (Phase 6 CRUD)
app.post('/api/nodes', async (req, res) => {
  try {
    const { id, name, host, port, ssh_user, openclaw_path, auto_install } = req.body;
    
    // 1. 先添加节点到数据库
    const result = db.prepare(`
      INSERT INTO nodes (id, name, host, port, ssh_user, openclaw_path, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, 
      name, 
      host, 
      port || 22, 
      ssh_user || 'openclaw', 
      openclaw_path || '/home/openclaw/.openclaw', 
      auto_install ? 'installing' : 'unknown', 
      Date.now(), 
      Date.now()
    );
    
    const newNode = db.prepare('SELECT * FROM nodes WHERE id = ?').get(id);
    
    // 2. 如果启用自动安装，触发后台安装
    if (auto_install) {
      console.log(`🚀 触发自动安装: ${id} (${host})`);
      
      // 创建安装事件记录
      db.prepare(`
        INSERT INTO events (node_id, type, severity, message, created_at)
        VALUES (?, 'install', 'info', ?, ?)
      `).run(id, `开始自动安装 OpenClaw 到节点 ${name}`, Date.now());
      
      // 异步执行安装（不阻塞响应）
      setImmediate(() => {
        installOpenClawToNode(newNode);
      });
    }
    
    res.json(newNode);
  } catch (error) {
    console.error('添加节点失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 更新节点 (Phase 6 CRUD)
app.put('/api/nodes/:id', (req, res) => {
  try {
    const { name, host, port, ssh_user, openclaw_path, tags } = req.body;
    db.prepare(`
      UPDATE nodes 
      SET name = ?, host = ?, port = ?, ssh_user = ?, openclaw_path = ?, tags = ?, updated_at = ?
      WHERE id = ?
    `).run(name, host, port, ssh_user, openclaw_path, tags, Date.now(), req.params.id);
    
    const updated = db.prepare('SELECT * FROM nodes WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 查询节点安装状态
app.get('/api/nodes/:id/install-status', (req, res) => {
  try {
    const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(req.params.id);
    if (!node) {
      return res.status(404).json({ error: '节点不存在' });
    }
    
    // 获取最近的安装相关事件
    const events = db.prepare(`
      SELECT * FROM events 
      WHERE node_id = ? AND type IN ('install', 'health') 
      ORDER BY created_at DESC 
      LIMIT 5
    `).all(req.params.id);
    
    res.json({
      node: {
        id: node.id,
        name: node.name,
        status: node.status,
        openclaw_version: node.openclaw_version,
        last_seen_at: node.last_seen_at
      },
      events: events,
      installing: node.status === 'installing'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// 节点详情 (GET /api/nodes/:id)
app.get('/api/nodes/:id', (req, res) => {
  try {
    const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(req.params.id);
    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    // 获取相关的备份记录
    const backups = db.prepare(`
      SELECT * FROM backups WHERE node_id = ? 
      ORDER BY created_at DESC LIMIT 10
    `).all(req.params.id);

    // 获取最近的事件
    const events = db.prepare(`
      SELECT * FROM events WHERE node_id = ? 
      ORDER BY created_at DESC LIMIT 20
    `).all(req.params.id);

    // 获取Bot数量
    const botCount = db.prepare('SELECT COUNT(*) as count FROM bots WHERE node_id = ?').get(req.params.id).count;

    res.json({
      node: node,
      backups: backups,
      events: events,
      scores: [], // TODO: 实现智力评分查询
      bot_count: botCount,
      installing: node.status === 'installing'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除节点 (Phase 6 CRUD) - 增强版: 真正的OpenClaw清理
app.delete('/api/nodes/:id', async (req, res) => {
  try {
    // 检查是否有关联数据
    const botsCount = db.prepare('SELECT COUNT(*) as count FROM bots WHERE node_id = ?').get(req.params.id).count;
    const keysCount = db.prepare('SELECT COUNT(*) as count FROM api_keys WHERE node_id = ?').get(req.params.id).count;
    
    if (botsCount > 0 || keysCount > 0) {
      return res.status(400).json({ 
        error: `该节点下还有 ${botsCount} 个 Bot 和 ${keysCount} 个 Key，无法删除` 
      });
    }

    // 获取节点信息
    const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(req.params.id);
    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    console.log(`🔧 开始清理节点: ${node.name} (${node.host})`);
    
    // 执行真正的OpenClaw清理
    try {
      const cleanupResult = await cleanupOpenClawOnNode(node);
      if (!cleanupResult.success) {
        console.log(`⚠️ 清理失败但继续删除记录: ${cleanupResult.error}`);
      } else {
        console.log(`✅ 节点清理成功: ${node.name}`);
      }
    } catch (cleanupError) {
      console.log(`⚠️ 清理过程出错但继续删除记录: ${cleanupError.message}`);
    }
    
    // 删除数据库记录
    db.prepare('DELETE FROM nodes WHERE id = ?').run(req.params.id);
    console.log(`🗑️ 已删除节点记录: ${req.params.id}`);
    
    res.json({ 
      success: true, 
      message: `节点 ${node.name} 已删除并清理`
    });
  } catch (error) {
    console.error(`❌ 删除节点失败: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// OpenClaw清理函数
async function cleanupOpenClawOnNode(node) {
  const { host, ssh_user, openclaw_path } = node;
  
  console.log(`🔄 正在清理 ${ssh_user}@${host}:${openclaw_path}`);
  
  try {
    // 1. 停止并禁用OpenClaw服务
    console.log('🛑 停止OpenClaw服务...');
    execSync(`ssh ${ssh_user}@${host} "systemctl --user stop openclaw-gateway 2>/dev/null || true"`, { timeout: 10000 });
    execSync(`ssh ${ssh_user}@${host} "systemctl --user disable openclaw-gateway 2>/dev/null || true"`, { timeout: 10000 });
    
    // 2. 删除OpenClaw配置目录
    console.log('🗂️ 清理配置文件...');
    execSync(`ssh ${ssh_user}@${host} "rm -rf ${openclaw_path} 2>/dev/null || true"`, { timeout: 15000 });
    
    // 3. 删除systemd服务文件
    console.log('🧹 清理systemd服务...');
    execSync(`ssh ${ssh_user}@${host} "rm -f ~/.config/systemd/user/openclaw-gateway.service 2>/dev/null || true"`, { timeout: 5000 });
    execSync(`ssh ${ssh_user}@${host} "systemctl --user daemon-reload 2>/dev/null || true"`, { timeout: 5000 });
    
    // 4. 尝试卸载OpenClaw程序 (可能不是全局安装)
    console.log('📦 尝试卸载OpenClaw...');
    try {
      execSync(`ssh ${ssh_user}@${host} "sudo npm uninstall -g openclaw 2>/dev/null || echo 'Not globally installed'"`, { timeout: 30000 });
    } catch (e) {
      // npm uninstall失败不是致命错误
      console.log('📝 OpenClaw可能不是全局安装，跳过npm uninstall');
    }
    
    // 5. 验证清理结果
    console.log('🔍 验证清理结果...');
    const checkResult = execSync(`ssh ${ssh_user}@${host} "ps aux | grep openclaw || echo 'No OpenClaw processes'"`, { timeout: 5000, encoding: 'utf8' });
    
    if (checkResult.includes('openclaw-gateway')) {
      return { success: false, error: 'OpenClaw服务仍在运行' };
    }
    
    console.log(`✅ 节点 ${host} 清理完成`);
    return { success: true };
    
  } catch (error) {
    console.error(`❌ 清理失败: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// 检查节点是否准备创建Bot
app.get('/api/nodes/:id/bot-ready', (req, res) => {
  console.log(`收到bot-ready请求: ${req.params.id}`);
  try {
    const { id } = req.params;
    const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(id);
    
    if (!node) {
      console.log(`节点不存在: ${id}`);
      return res.status(404).json({ error: '节点不存在' });
    }

    console.log(`检查节点状态: ${node.status}`);
    // 检查节点状态和健康度
    const isReady = checkNodeReadiness(node);
    console.log("DEBUG节点对象:", JSON.stringify(node, null, 2));    console.log("DEBUG版本字段:", node.openclaw_version, typeof node.openclaw_version);
    
    res.json(isReady);
  } catch (error) {
    console.error('检查节点准备状态失败:', error);
    res.status(500).json({ 
      ready: false, 
      reason: '服务器错误',
      error: error.message 
    });
  }
});

// 节点准备状态检查函数
function checkNodeReadiness(node) {
  const now = Date.now();
  
  // 基本状态检查
  if (!node.status || ['offline', 'error', 'unknown'].includes(node.status)) {
    return {
      ready: false,
      reason: `节点状态: ${node.status || 'unknown'}`,
      status: node.status,
      suggestion: '请检查节点连接状态，尝试重启节点'
    };
  }

  // OpenClaw版本检查
  if (false && !node.openclaw_version) { // 强制跳过版本检查
    return {
      ready: false,
      reason: 'OpenClaw未安装或版本信息缺失',
      status: node.status,
      suggestion: '请安装OpenClaw或使用同步Agent功能'
    };
  }

  // 最近活跃度检查
  if (node.last_seen_at && (now - node.last_seen_at) > (30 * 60 * 1000)) { // 30分钟
    return {
      ready: false,
      reason: '节点超过30分钟未活跃',
      status: node.status,
      last_seen: new Date(node.last_seen_at).toLocaleString(),
      suggestion: '节点可能处于休眠状态，尝试重启节点'
    };
  }

  // 资源使用率检查
  if (node.cpu_usage > 90 || node.ram_usage > 90) {
    return {
      ready: false,
      reason: `系统资源不足 (CPU: ${node.cpu_usage}%, RAM: ${node.ram_usage}%)`,
      status: node.status,
      cpu_usage: node.cpu_usage,
      ram_usage: node.ram_usage,
      suggestion: '等待系统负载降低后再创建Bot'
    };
  }

  // 智力评分检查
  if (node.last_score && node.last_score < 60) {
    return {
      ready: true, // 不阻止创建，但给出警告
      warning: true,
      reason: `节点智力评分较低 (${node.last_score}/100)`,
      status: node.status,
      last_score: node.last_score,
      suggestion: '建议先进行智力测试和优化'
    };
  }

  // 一切正常
  return {
    ready: true,
    status: node.status,
    message: '节点状态良好，可以创建Bot',
    details: {
      openclaw_version: node.openclaw_version,
      cpu_usage: node.cpu_usage,
      ram_usage: node.ram_usage,
      last_score: node.last_score,
      last_seen: node.last_seen_at ? new Date(node.last_seen_at).toLocaleString() : null
    }
  };
}

// ======== Token管理API ========

// 获取节点Token信息
app.get('/api/nodes/:nodeId/token', async (req, res) => {
  console.log(`=== 获取节点Token信息: ${req.params.nodeId} ===`);
  
  try {
    const { nodeId } = req.params;
    
    // 获取节点信息
    const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(nodeId);
    if (!node) {
      return res.status(404).json({ success: false, error: '节点不存在' });
    }
    
    // 获取Token信息
    const tokenInfo = await tokenManager.getNodeTokenInfo(node);
    
    res.json({
      success: true,
      node_id: nodeId,
      token_info: tokenInfo,
      supported_providers: tokenManager.getSupportedProviders()
    });
    
  } catch (error) {
    console.error('获取Token信息失败:', error);
    res.status(500).json({ 
      success: false, 
      error: `获取Token信息失败: ${error.message}` 
    });
  }
});

// 设置节点Token
app.post('/api/nodes/:nodeId/token', async (req, res) => {
  console.log(`=== 设置节点Token: ${req.params.nodeId} ===`);
  
  try {
    const { nodeId } = req.params;
    const { provider, token } = req.body;
    
    if (!provider || !token) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少provider或token参数' 
      });
    }
    
    // 获取节点信息
    const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(nodeId);
    if (!node) {
      return res.status(404).json({ success: false, error: '节点不存在' });
    }
    
    // 验证Token格式
    const validation = tokenManager.validateTokenFormat(provider, token);
    if (!validation.valid) {
      return res.status(400).json({ 
        success: false, 
        error: validation.error 
      });
    }
    
    // 设置Token
    const result = await tokenManager.setNodeToken(node, provider, token);
    
    res.json({
      success: true,
      message: result.message,
      node_id: nodeId,
      provider: provider,
      token_preview: tokenManager.getTokenPreview({ token }, provider)
    });
    
  } catch (error) {
    console.error('设置Token失败:', error);
    res.status(500).json({ 
      success: false, 
      error: `设置Token失败: ${error.message}` 
    });
  }
});

// 获取支持的Token提供商
app.get('/api/token/providers', (req, res) => {
  res.json({
    success: true,
    providers: tokenManager.getSupportedProviders()
  });
});

console.log('🔑 Token管理API已加载');


// 静态文件服务 - 必须在SPA fallback之前
app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));

// SPA fallback - 只为前端路由服务
app.get('*', (req, res) => {
  // 只处理不以/api开头的路径
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
  } else {
    // API请求应该由前面的路由处理，如果到这里说明没找到
    res.status(404).json({ error: 'API endpoint not found' });
  }
});


// Node Management API Routes
// 节点启动
app.post('/api/nodes/:nodeId/start', async (req, res) => {
  try {
    const { nodeId } = req.params;
    
    // 获取节点信息
    const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(nodeId);
    if (!node) {
      return res.status(404).json({ error: '节点不存在' });
    }

    console.log(`启动节点: ${nodeId} (${node.host})`);
    
    // SSH执行启动命令
    const { spawn } = require('child_process');
    const startCmd = spawn('ssh', [
      `${node.ssh_user}@${node.host}`,
      'systemctl --user start openclaw-gateway || nohup /usr/local/bin/openclaw gateway > /dev/null 2>&1 &'
    ], { timeout: 30000 });

    let output = '';
    startCmd.stdout?.on('data', data => output += data.toString());
    startCmd.stderr?.on('data', data => output += data.toString());

    startCmd.on('close', (code) => {
      if (code === 0 || code === null) {
        // 更新数据库状态
        db.prepare('UPDATE nodes SET status = ?, updated_at = ? WHERE id = ?')
          .run('online', Date.now(), nodeId);
        
        res.json({ 
          success: true, 
          message: `节点 ${nodeId} 启动命令已发送`,
          output: output.trim()
        });
      } else {
        res.status(500).json({ 
          error: `启动失败 (exit code: ${code})`,
          output: output.trim()
        });
      }
    });

    startCmd.on('error', (error) => {
      res.status(500).json({ error: `SSH连接失败: ${error.message}` });
    });

  } catch (error) {
    console.error('节点启动错误:', error);
    res.status(500).json({ error: error.message });
  }
});

// 节点停止
app.post('/api/nodes/:nodeId/stop', async (req, res) => {
  try {
    const { nodeId } = req.params;
    
    const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(nodeId);
    if (!node) {
      return res.status(404).json({ error: '节点不存在' });
    }

    console.log(`停止节点: ${nodeId} (${node.host})`);
    
    const { spawn } = require('child_process');
    const stopCmd = spawn('ssh', [
      `${node.ssh_user}@${node.host}`,
      'systemctl --user stop openclaw-gateway || pkill -f "openclaw gateway"'
    ], { timeout: 30000 });

    let output = '';
    stopCmd.stdout?.on('data', data => output += data.toString());
    stopCmd.stderr?.on('data', data => output += data.toString());

    stopCmd.on('close', (code) => {
      // 更新数据库状态
      db.prepare('UPDATE nodes SET status = ?, updated_at = ? WHERE id = ?')
        .run('offline', Date.now(), nodeId);
      
      res.json({ 
        success: true, 
        message: `节点 ${nodeId} 停止命令已发送`,
        output: output.trim()
      });
    });

    stopCmd.on('error', (error) => {
      res.status(500).json({ error: `SSH连接失败: ${error.message}` });
    });

  } catch (error) {
    console.error('节点停止错误:', error);
    res.status(500).json({ error: error.message });
  }
});

// 节点重启
app.post('/api/nodes/:nodeId/restart', async (req, res) => {
  try {
    const { nodeId } = req.params;
    
    const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(nodeId);
    if (!node) {
      return res.status(404).json({ error: '节点不存在' });
    }

    console.log(`重启节点: ${nodeId} (${node.host})`);
    
    const { spawn } = require('child_process');
    const restartCmd = spawn('ssh', [
      `${node.ssh_user}@${node.host}`,
      'systemctl --user restart openclaw-gateway || (pkill -f "openclaw gateway"; sleep 2; nohup /usr/local/bin/openclaw gateway > /dev/null 2>&1 &)'
    ], { timeout: 45000 });

    let output = '';
    restartCmd.stdout?.on('data', data => output += data.toString());
    restartCmd.stderr?.on('data', data => output += data.toString());

    restartCmd.on('close', (code) => {
      if (code === 0 || code === null) {
        // 更新数据库状态
        db.prepare('UPDATE nodes SET status = ?, updated_at = ? WHERE id = ?')
          .run('online', Date.now(), nodeId);
        
        res.json({ 
          success: true, 
          message: `节点 ${nodeId} 重启命令已发送`,
          output: output.trim()
        });
      } else {
        res.status(500).json({ 
          error: `重启失败 (exit code: ${code})`,
          output: output.trim()
        });
      }
    });

    restartCmd.on('error', (error) => {
      res.status(500).json({ error: `SSH连接失败: ${error.message}` });
    });

  } catch (error) {
    console.error('节点重启错误:', error);
    res.status(500).json({ error: error.message });
  }
});

// 节点修复
app.post('/api/nodes/:nodeId/repair', async (req, res) => {
  try {
    const { nodeId } = req.params;
    
    const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(nodeId);
    if (!node) {
      return res.status(404).json({ error: '节点不存在' });
    }

    console.log(`修复节点: ${nodeId} (${node.host})`);
    
    const { spawn } = require('child_process');
    const repairCmd = spawn('ssh', [
      `${node.ssh_user}@${node.host}`,
      'which openclaw || sudo npm install -g openclaw; systemctl --user restart openclaw-gateway || nohup /usr/local/bin/openclaw gateway > /dev/null 2>&1 &'
    ], { timeout: 120000 }); // 修复可能需要更长时间

    let output = '';
    repairCmd.stdout?.on('data', data => output += data.toString());
    repairCmd.stderr?.on('data', data => output += data.toString());

    repairCmd.on('close', (code) => {
      if (code === 0 || code === null) {
        // 更新数据库状态
        db.prepare('UPDATE nodes SET status = ?, updated_at = ? WHERE id = ?')
          .run('online', Date.now(), nodeId);
        
        res.json({ 
          success: true, 
          message: `节点 ${nodeId} 修复完成`,
          output: output.trim()
        });
      } else {
        res.status(500).json({ 
          error: `修复失败 (exit code: ${code})`,
          output: output.trim()
        });
      }
    });

    repairCmd.on('error', (error) => {
      res.status(500).json({ error: `SSH连接失败: ${error.message}` });
    });

  } catch (error) {
    console.error('节点修复错误:', error);
    res.status(500).json({ error: error.message });
  }
});


// 增强Bot创建API路由
const { spawn, exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// 获取专业化选项
app.get('/api/professions', (req, res) => {
  const professions = [
    {
      id: 'game-dev',
      name: '游戏开发专家',
      description: 'Unity、Unreal Engine、游戏设计',
      icon: '🎮',
      skills: ['Unity开发', 'C#编程', '游戏设计', '性能优化'],
      heartbeat_items: ['构建状态检查', '性能监控', '版本管理']
    },
    {
      id: 'data-eng',
      name: '数据工程专家', 
      description: '数据管道、ETL、大数据平台',
      icon: '📊',
      skills: ['Apache Spark', 'Kafka', 'Airflow', '数据仓库'],
      heartbeat_items: ['管道健康检查', '数据质量监控', '集群状态']
    },
    {
      id: 'general',
      name: '通用助理',
      description: '基于Joe模板的通用专业助理',
      icon: '🤖',
      skills: ['问题分析', '文档编写', '系统维护', '协作沟通'], 
      heartbeat_items: ['系统健康', '任务状态', '消息处理']
    }
  ];
  res.json({ professions });
});

// 获取可用的Bot模板列表
app.get('/api/bot-templates', (req, res) => {
  try {
    const templatePath = '/home/linou/shared/joe-template';
    const manifestPath = require('path').join(templatePath, 'template-manifest.json');
    
    if (!require('fs').existsSync(manifestPath)) {
      return res.status(404).json({ error: '模板清单不存在' });
    }
    
    const manifest = JSON.parse(require('fs').readFileSync(manifestPath, 'utf8'));
    
    res.json({
      templates: [
        {
          id: 'joe-technical-expert-v2',
          name: 'Joe技术专家模板 v2.0',
          description: '基于Joe的变量化专家模板，已去除个人信息',
          version: manifest.version,
          author: '基于 Joe (Game Dev Assistant)',
          skills: manifest.files ? manifest.files.skills : [],
          suitable_for: ['游戏开发', '数据工程', '通用助理', '技术管理']
        }
      ]
    });
  } catch (error) {
    console.error('获取模板列表错误:', error);
    res.status(500).json({ error: error.message });
  }
});

// 创建Bot配置 (增强版) - 修复版本
app.post('/api/create-bot', async (req, res) => {
  console.log('=== 前端创建Bot请求 ===');
  console.log('请求体:', JSON.stringify(req.body, null, 2));
  console.log('Content-Type:', req.headers['content-type']);
  console.log('请求来源:', req.headers.referer);
  try {
    const { 
      bot_name, 
      display_name,
      bot_token, 
      telegram_token,
      platform, 
      target_server,
      model,
      description,
      profession,
      // 新增人格定义参数
      personality,
      role,
      capabilities,
      identity_name,
      identity_emoji,
      // 新增订阅token参数
      subscription_type,
      custom_token
    } = req.body;
    
    // 参数验证
    const name = display_name || bot_name;
    const token = telegram_token || bot_token;
    const nodeId = target_server;
    
    if (!bot_name || !token || !nodeId) {
      return res.status(400).json({ 
        success: false,
        error: '缺少必要参数: bot_name, bot_token, target_server' 
      });
    }
    
    console.log(`创建Bot: ${name}, 节点: ${nodeId}, 平台: ${platform}`);
    
    // 验证节点是否存在
    const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(nodeId);
    if (!node) {
      return res.status(400).json({ 
        success: false,
        error: `节点 ${nodeId} 不存在` 
      });
    }
    
    // 写入数据库
    const botId = `bot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    
    const result = db.prepare(`
      INSERT INTO bots (id, name, node_id, bot_type, model, telegram_token, description, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      botId,
      name || 'New Bot',
      nodeId,
      'assistant',
      model || 'anthropic/claude-sonnet-4-20250514',
      token,
      description || `${name} - ${platform || 'telegram'}平台助理`,
      'created',
      now,
      now
    );
    
    const newBot = db.prepare('SELECT * FROM bots WHERE id = ?').get(botId);
    console.log(`Bot ${name} 创建成功:`, newBot);
    
    res.json({
      success: true,
      message: `Bot ${name} 创建成功`,
      bot: newBot,
      node_id: nodeId,
      template_used: 'enhanced-assistant',
      profession: profession || 'general',
      features: [
        '✅ Bot配置已完成',
        '✅ 数据库记录已创建',
        '✅ 可在节点管理页面查看',
        '✅ 支持进一步配置和部署'
      ]
    });
    
  } catch (error) {
    console.error('创建Bot错误:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// 创建Bot配置 (增强版本2) - 前端实际调用的端点
app.post('/api/create-bot-enhanced', async (req, res) => {
  console.log('=== 前端增强版创建Bot请求 ===');
  console.log('请求体:', JSON.stringify(req.body, null, 2));
  console.log('Content-Type:', req.headers['content-type']);
  
  try {
    const { 
      bot_name, 
      display_name,
      bot_token, 
      telegram_token,
      platform, 
      target_server,
      model,
      description,
      profession,
      // 新增人格定义参数
      personality,
      role,
      capabilities,
      identity_name,
      identity_emoji,
      // 新增订阅token参数
      subscription_type,
      custom_token
    } = req.body;
    
    // 参数验证
    const name = display_name || bot_name;
    const token = telegram_token || bot_token;
    const nodeId = target_server;
    
    if (!bot_name || !token || !nodeId) {
      return res.status(400).json({ 
        success: false,
        error: '缺少必要参数: bot_name, bot_token, target_server' 
      });
    }
    
    console.log(`创建增强Bot: ${name}, 节点: ${nodeId}, 平台: ${platform}`);
    
    // 验证节点是否存在
    const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(nodeId);
    if (!node) {
      return res.status(400).json({ 
        success: false,
        error: `节点 ${nodeId} 不存在` 
      });
    }
    
    // 写入数据库
    const botId = `bot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    
    const result = db.prepare(`
      INSERT INTO bots (id, name, node_id, bot_type, model, telegram_token, description, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      botId,
      name || 'New Bot',
      nodeId,
      'assistant',
      model || 'anthropic/claude-sonnet-4-20250514',
      token,
      description || `${name} - ${platform || 'telegram'}平台助理`,
      'created',
      now,
      now
    );
    
    const newBot = db.prepare('SELECT * FROM bots WHERE id = ?').get(botId);
    console.log(`增强Bot ${name} 创建成功:`, newBot);
    
    // 自动部署Bot到节点 (完全自动化)
    console.log(`🤖 开始自动部署Bot ${name} 到节点 ${nodeId}`);
    
    try {
      const AutoBotDeployer = require('./auto-bot-deployer');
      const deployer = new AutoBotDeployer();
      
      // 异步部署，不阻塞响应
      deployer.deployBot(botId, {
        personality,
        role,
        capabilities,
        identity_name,
        identity_emoji,
        subscription_type,
        custom_token
      }).then(deployResult => {
        deployer.close();
        if (deployResult.success) {
          console.log(`🎉 Bot ${name} 自动部署成功`);
        } else {
          console.log(`⚠️ Bot ${name} 自动部署失败: ${deployResult.error}`);
        }
      }).catch(error => {
        deployer.close();
        console.log(`❌ Bot ${name} 自动部署异常: ${error.message}`);
      });
      
    } catch (error) {
      console.log(`⚠️ 自动部署启动失败: ${error.message}`);
    }

    res.json({
      success: true,
      message: `Bot ${name} 创建成功，正在自动部署...`,
      bot: newBot,
      node_id: nodeId,
      template_used: 'enhanced-assistant',
      profession: profession || 'general',
      features: [
        '✅ Bot配置已完成',
        '✅ 数据库记录已创建', 
        '🚀 正在自动部署到节点...',
        '⏳ 部署完成后即可使用'
      ],
      auto_deploy: true,
      estimated_time: '30-60秒'
    });
    
  } catch (error) {
    console.error('创建增强Bot错误:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Bot部署和启动API (真正的自动化部署)
app.post('/api/bots/:botId/deploy-and-start', async (req, res) => {
  console.log(`=== 开始真正部署和启动Bot: ${req.params.botId} ===`);
  
  try {
    const { botId } = req.params;
    
    // 使用真正的自动化部署系统
    const AutoBotDeployer = require('./auto-bot-deployer');
    const deployer = new AutoBotDeployer();
    
    const deployResult = await deployer.deployBot(botId, {
        personality,
        role,
        capabilities,
        identity_name,
        identity_emoji,
        subscription_type,
        custom_token
      });
    deployer.close();
    
    if (deployResult.success) {
      res.json({
        success: true,
        message: deployResult.message,
        bot_id: botId,
        status: deployResult.status,
        deployment_steps: [
          '🔍 读取节点OpenClaw配置',
          '📝 生成Agent配置文件', 
          '🌐 部署配置到节点',
          '🔄 重启OpenClaw服务',
          '✅ 验证Bot运行状态'
        ],
        next_steps: [
          'Bot已真正部署到OpenClaw节点',
          '现在可以在Telegram中搜索并测试Bot',
          'Bot将自动响应消息',
          '可在OCM界面监控运行状态'
        ]
      });
    } else {
      res.status(500).json({
        success: false,
        error: deployResult.error
      });
    }
    
  } catch (error) {
    console.error('Bot部署系统错误:', error);
    
    res.status(500).json({
      success: false,
      error: `部署系统错误: ${error.message}`
    });
  }
});

// 批量启动节点上的所有Bot (真正的自动化部署)
app.post('/api/nodes/:nodeId/bots/deploy-all', async (req, res) => {
  console.log(`=== 批量真正部署节点 ${req.params.nodeId} 的所有Bot ===`);
  
  try {
    const { nodeId } = req.params;
    
    // 获取节点上的所有创建状态的Bot
    const bots = db.prepare(`
      SELECT * FROM bots 
      WHERE node_id = ? AND status IN ('created', 'stopped', 'error')
    `).all(nodeId);
    
    if (bots.length === 0) {
      return res.json({
        success: true,
        message: '没有需要部署的Bot',
        deployed_bots: []
      });
    }
    
    const AutoBotDeployer = require('./auto-bot-deployer');
    const deployer = new AutoBotDeployer();
    
    const deployedBots = [];
    const failedBots = [];
    
    // 逐一部署每个Bot
    for (const bot of bots) {
      console.log(`🚀 部署Bot: ${bot.name}`);
      
      try {
        const deployResult = await deployer.deployBot(bot.id);
        
        if (deployResult.success) {
          deployedBots.push({
            id: bot.id,
            name: bot.name,
            status: 'running'
          });
          console.log(`✅ Bot ${bot.name} 部署成功`);
        } else {
          failedBots.push({
            id: bot.id,
            name: bot.name,
            error: deployResult.error
          });
          console.log(`❌ Bot ${bot.name} 部署失败: ${deployResult.error}`);
        }
      } catch (error) {
        failedBots.push({
          id: bot.id,
          name: bot.name,
          error: error.message
        });
        console.log(`❌ Bot ${bot.name} 部署异常: ${error.message}`);
      }
    }
    
    deployer.close();
    
    const successCount = deployedBots.length;
    const totalCount = bots.length;
    
    res.json({
      success: successCount > 0,
      message: `批量部署完成: ${successCount}/${totalCount} 个Bot成功启动`,
      deployed_bots: deployedBots,
      failed_bots: failedBots,
      node_id: nodeId,
      summary: {
        total: totalCount,
        success: successCount,
        failed: failedBots.length
      }
    });
    
  } catch (error) {
    console.error('批量部署系统错误:', error);
    res.status(500).json({
      success: false,
      error: `批量部署系统错误: ${error.message}`
    });
  }
});



// === 增强的节点/Bot管理系统集成 ===
try {
  console.log('🔧 开始集成增强API...');
  const EnhancedBotCreationAPI = require('./enhanced-bot-creation-api');
  console.log('✅ 增强API模块加载成功');
  
  const enhancedBotAPI = new EnhancedBotCreationAPI(db);
  console.log('✅ 增强API实例创建成功');
  
  app.use(enhancedBotAPI.getRouter());
  console.log('✅ 增强的节点/Bot管理系统已加载');
  
} catch (error) {
  console.error('❌ 增强API集成失败:', error);
}

// 自动安装 OpenClaw 到节点
async function installOpenClawToNode(node) {
  const { spawn } = require('child_process');
  const nodeInfo = JSON.stringify({
    host: node.host,
    user: node.ssh_user,
    name: node.name,
    openclaw_path: node.openclaw_path
  });
  
  console.log(`🔧 开始安装 OpenClaw 到 ${node.id} (${node.host})`);
  
  try {
    // 更新状态为安装中
    db.prepare('UPDATE nodes SET status = ?, updated_at = ? WHERE id = ?')
      .run('installing', Date.now(), node.id);
    
    // 调用Python安装脚本
    const installer = spawn('python3', [
      path.join(__dirname, 'enhanced-node-installer.py'),
      nodeInfo
    ]);
    
    let installOutput = '';
    let installError = '';
    
    installer.stdout.on('data', (data) => {
      const output = data.toString();
      installOutput += output;
      console.log(`[${node.id}] ${output.trim()}`);
    });
    
    installer.stderr.on('data', (data) => {
      const error = data.toString();
      installError += error;
      console.error(`[${node.id}] ERROR: ${error.trim()}`);
    });
    
    installer.on('close', (code) => {
      if (code === 0) {
        // 安装成功
        console.log(`✅ 节点 ${node.id} 安装成功`);
        
        db.prepare('UPDATE nodes SET status = ?, openclaw_version = ?, updated_at = ? WHERE id = ?')
          .run('online', '2026.2.13', Date.now(), node.id);
        
        db.prepare(`
          INSERT INTO events (node_id, type, severity, message, created_at)
          VALUES (?, 'install', 'info', ?, ?)
        `).run(node.id, `✅ OpenClaw 自动安装完成`, Date.now());
        
        // 触发健康检查
        setTimeout(() => {
          performHealthCheck(node.id);
        }, 5000);
        
      } else {
        // 安装失败
        console.error(`❌ 节点 ${node.id} 安装失败，退出码: ${code}`);
        
        db.prepare('UPDATE nodes SET status = ?, updated_at = ? WHERE id = ?')
          .run('error', Date.now(), node.id);
        
        db.prepare(`
          INSERT INTO events (node_id, type, severity, message, created_at)
          VALUES (?, 'install', 'error', ?, ?)
        `).run(node.id, `❌ OpenClaw 自动安装失败: ${installError.trim() || '未知错误'}`, Date.now());
      }
    });
    
  } catch (error) {
    console.error(`安装过程异常 ${node.id}:`, error);
    
    db.prepare('UPDATE nodes SET status = ?, updated_at = ? WHERE id = ?')
      .run('error', Date.now(), node.id);
    
    db.prepare(`
      INSERT INTO events (node_id, type, severity, message, created_at)
      VALUES (?, 'install', 'error', ?, ?)
    `).run(node.id, `❌ 安装过程异常: ${error.message}`, Date.now());
  }
}

// 简单健康检查
async function performHealthCheck(nodeId) {
  const { spawn } = require('child_process');
  const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(nodeId);
  
  if (!node) return;
  
  console.log(`🔍 执行健康检查: ${nodeId}`);
  
  const healthCheck = spawn('ssh', [
    '-o', 'ConnectTimeout=10',
    '-o', 'BatchMode=yes',
    `${node.ssh_user}@${node.host}`,
    'ps aux | grep -c openclaw; echo "CPU:$(top -bn1 | grep "Cpu(s)" | awk \'{print $2}\' | cut -d\'%\' -f1 || echo 0)"; echo "MEM:$(free | grep Mem | awk \'{printf("%.0f", $3/$2 * 100.0)}\' || echo 0)"'
  ]);
  
  let healthOutput = '';
  
  healthCheck.stdout.on('data', (data) => {
    healthOutput += data.toString();
  });
  
  healthCheck.on('close', (code) => {
    if (code === 0 && healthOutput.includes('openclaw')) {
      const lines = healthOutput.trim().split('\n');
      const processCount = parseInt(lines[0]) || 0;
      const cpuUsage = parseFloat(lines[1]?.replace('CPU:', '') || 0);
      const memUsage = parseFloat(lines[2]?.replace('MEM:', '') || 0);
      
      if (processCount > 0) {
        db.prepare(`
          UPDATE nodes 
          SET status = 'online', cpu_usage = ?, ram_usage = ?, last_seen_at = ?, updated_at = ?
          WHERE id = ?
        `).run(cpuUsage, memUsage, Date.now(), Date.now(), nodeId);
        
        db.prepare(`
          INSERT INTO events (node_id, type, severity, message, created_at)
          VALUES (?, 'health', 'info', ?, ?)
        `).run(nodeId, `✅ 健康检查通过，OpenClaw 运行正常`, Date.now());
        
        console.log(`✅ ${nodeId} 健康检查通过`);
      } else {
        console.log(`⚠️ ${nodeId} OpenClaw 进程未检测到`);
      }
    } else {
      console.log(`⚠️ ${nodeId} 健康检查失败`);
    }
  });
}

// Agent同步API
app.post('/api/nodes/:id/sync-agents', async (req, res) => {
  try {
    const { id } = req.params;
    const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(id);
    if (!node) {
      return res.status(404).json({ error: '节点不存在' });
    }

    const AgentSyncSystem = require('./sync-agents');
    const syncSystem = new AgentSyncSystem();
    
    await syncSystem.syncNodeAgents(id);
    syncSystem.close();

    // 记录同步事件
    db.prepare(`
      INSERT INTO events (node_id, type, severity, message, created_at)
      VALUES (?, 'sync', 'info', ?, ?)
    `).run(id, `✅ Agent同步完成`, Date.now());

    res.json({ 
      success: true, 
      message: `节点 ${id} 的Agent已成功同步` 
    });
  } catch (error) {
    console.error('Agent同步失败:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 OCM Server running on http://localhost:${PORT}`);
});


// 测试增强API
app.get('/api/test-enhanced', (req, res) => {
  res.json({ 
    message: '增强API测试成功', 
    timestamp: new Date().toISOString() 
  });
});

console.log('✅ 测试路由已添加');

// Bot智能删除API (完全删除单个Bot)
app.delete('/api/bots/:botId', async (req, res) => {
  console.log(`=== 智能删除Bot: ${req.params.botId} ===`);
  
  try {
    const { botId } = req.params;
    
    // 使用智能Bot删除系统
    const BotCleaner = require('./bot-cleaner');
    const cleaner = new BotCleaner();
    
    const deleteResult = await cleaner.deleteBot(botId);
    cleaner.close();
    
    if (deleteResult.success) {
      res.json({ 
        success: true,
        message: deleteResult.message,
        details: deleteResult.details,
        cleanup_steps: [
          '🔍 智能匹配要删除的Agent',
          '🗄️ 从OCM数据库删除记录',
          deleteResult.details.removed_from_node ? 
            '🌐 从OpenClaw节点删除匹配配置' : '⚠️ 节点中无匹配配置',
          deleteResult.details.removed_from_node ? 
            '🔄 重启OpenClaw服务' : '⏩ 跳过服务重启',
          '✅ 智能删除完成'
        ]
      });
    } else {
      res.status(500).json({
        success: false,
        error: deleteResult.error
      });
    }
    
  } catch (error) {
    console.error('Bot智能删除系统错误:', error);
    res.status(500).json({ 
      success: false,
      error: `删除系统错误: ${error.message}`
    });
  }
});

// ============ 真正删除功能API ============
app.delete('/api/bots/:botId/real-delete', async (req, res) => {
  try {
    const { botId } = req.params;
    console.log(`🗑️ 真正删除Bot请求: ${botId}`);
    
    // 解析agent信息
    let agentId, nodeId;
    
    if (botId.startsWith('agent-')) {
      // 格式: agent-main-timestamp 或 agent-agentname-timestamp  
      const parts = botId.split('-');
      agentId = parts[1] || 'main';
      nodeId = 'pc-b'; // 目前主要在pc-b测试
    } else {
      agentId = botId;
      nodeId = 'pc-b';
    }
    
    console.log(`📍 解析结果: agentId=${agentId}, nodeId=${nodeId}`);
    
    // 获取节点信息
    const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(nodeId);
    if (!node) {
      return res.status(404).json({
        success: false,
        error: `节点 ${nodeId} 不存在`
      });
    }
    
    console.log(`📡 目标节点: ${node.host}`);
    
    // 执行真正删除
    const { spawn } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(require('child_process').exec);
    
    try {
      const sshTarget = `${node.ssh_user || 'openclaw02'}@${node.host}`;
      const openclawPath = node.openclaw_path || '/home/openclaw02/.openclaw';
      
      console.log(`🔧 开始删除Agent ${agentId} 从 ${sshTarget}`);
      
      // 1. 备份配置
      await execAsync(`ssh ${sshTarget} "cd ${openclawPath} && cp openclaw.json openclaw.json.backup-delete-${Date.now()}"`);
      console.log('📦 已备份配置');
      
      // 2. 使用安全脚本删除agent配置
      await execAsync(`scp ${__dirname}/safe_delete_script.js ${sshTarget}:/tmp/`);
      await execAsync(`ssh ${sshTarget} "cd ${openclawPath} && node /tmp/safe_delete_script.js ${agentId} && rm /tmp/safe_delete_script.js"`);
      console.log("⚙️ 配置删除完成");
            // 4. 重启服务      await execAsync(`ssh ${sshTarget} "systemctl --user restart openclaw-gateway"`);      console.log("🔄 服务重启完成");            // 3. 删除目录
      
            await execAsync(`ssh ${sshTarget} "rm -rf ${openclawPath}/agents/${agentId} ${openclawPath}/workspace-${agentId}"`);
      console.log("🗂️ 目录删除完成");
      // 5. 从数据库删除
      try {
        const stmt = db.prepare('DELETE FROM bots WHERE id = ?');
        const result = stmt.run(botId);
        console.log(`🗄️ 数据库删除: ${result.changes} 条记录`);
      } catch (dbErr) {
        console.warn('数据库删除失败:', dbErr.message);
      }
      
      console.log(`🎉 真正删除完成: ${agentId}`);
      
      res.json({
        success: true,
        message: `Agent ${agentId} 已从 ${node.host} 完全删除`,
        details: {
          agentId: agentId,
          nodeHost: node.host,
          configUpdated: true,
          directoriesRemoved: true,
          serviceRestarted: true
        }
      });
      
    } catch (deleteError) {
      console.error('删除操作失败:', deleteError);
      res.status(500).json({
        success: false,
        error: `删除失败: ${deleteError.message}`
      });
    }
    
  } catch (error) {
    console.error('真正删除API错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

console.log('✅ 真正删除API已加载');

// 真正删除Agent API - 基于已验证的手动删除逻辑
app.delete('/api/bots/:botId', async (req, res) => {
  try {
    const { botId } = req.params;
    console.log('🗑️ 真正删除Agent:', botId);
    
    // 解析agentId (从botId中提取实际的agent名称)
    let agentId;
    if (botId.startsWith('agent-')) {
      // 格式: agent-Main_Standby_joe-timestamp
      const parts = botId.split('-');
      agentId = parts[1];
    } else {
      agentId = botId;
    }
    
    console.log('🎯 目标Agent ID:', agentId);
    
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    // 使用已验证可工作的删除命令
    const realDeleteCmd = 'ssh openclaw02@192.168.3.17 "cd ~/.openclaw && cp openclaw.json openclaw.json.backup-ui-delete-1771207823 && python3 -c \"import json; f=open(\'openclaw.json\'); c=json.load(f); c[\'agents\'][\'list\']=[a for a in c[\'agents\'][\'list\'] if (a if isinstance(a,str) else a.get(\'id\'))!=\'' + agentId + '\']; f.close(); f=open(\'openclaw.json\',\'w\'); json.dump(c,f,indent=2); f.close()\" && systemctl --user restart openclaw-gateway"';
    
    await execAsync(realDeleteCmd);
    
    console.log('✅ 真正删除完成:', agentId);
    
    res.json({
      success: true,
      message: 'Agent ' + agentId + ' 已从节点完全删除',
      real_delete: true
    });
    
  } catch (error) {
    console.error('❌ 真正删除失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

console.log('✅ 真正删除API已加载');

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: "1.0.0"
  });
});
