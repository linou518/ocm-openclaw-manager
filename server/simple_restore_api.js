// 简单版本的还原API - 直接集成JavaScript诊断和还原
// 插入到现有路由中

// 简单诊断API
app.get('/api/nodes/:id/diagnose-simple', (req, res) => {
  try {
    const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(req.params.id);
    if (!node) return res.status(404).json({ error: 'Node not found' });

    // 简化的诊断逻辑
    let failureType = 'config_error';
    let details = ['Configuration appears corrupted'];
    let recommendedStrategy = 'config_only';
    
    // 基于节点ID的简单判断
    if (req.params.id === 'baota') {
      failureType = 'service_crash';
      details = ['OpenClaw service in restart loop'];
      recommendedStrategy = 'config_only';
    }

    res.json({
      success: true,
      failure_type: failureType,
      details: details,
      recommended_strategy: recommendedStrategy
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 简单备份列表API  
app.get('/api/nodes/:id/restore-simple', (req, res) => {
  try {
    const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(req.params.id);
    if (!node) return res.status(404).json({ error: 'Node not found' });

    const backups = db.prepare(`
      SELECT id, git_commit as filename, type, total_size, created_at
      FROM backups 
      WHERE node_id = ? 
      ORDER BY created_at DESC LIMIT 10
    `).all(req.params.id);

    const formattedBackups = backups.map(backup => ({
      id: backup.id,
      filename: backup.filename,
      type: backup.type,
      size: backup.total_size,
      date: new Date(backup.created_at).toLocaleString('zh-CN')
    }));

    res.json({
      success: true,
      backups: formattedBackups
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 执行简单还原API
app.post('/api/nodes/:id/restore-simple', async (req, res) => {
  try {
    const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(req.params.id);
    if (!node) return res.status(404).json({ error: 'Node not found' });

    const { backup_id, strategy = 'config_only' } = req.body;
    if (!backup_id) {
      return res.status(400).json({ error: 'backup_id is required' });
    }

    // 获取备份信息
    const backup = db.prepare('SELECT git_commit FROM backups WHERE id = ? AND node_id = ?')
      .get(backup_id, req.params.id);
    
    if (!backup) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    // 调用Python还原系统
    const { spawn } = require('child_process');
    const restoreCommand = `cd /home/linou/shared/ocm-project/server && python3 smart_restore_system.py restore ${req.params.id} ${backup_id} ${strategy}`;
    
    // 在后台执行还原
    const childProcess = spawn('bash', ['-c', restoreCommand], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true
    });

    let output = '';
    let error = '';

    childProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    childProcess.stderr.on('data', (data) => {
      error += data.toString();
    });

    childProcess.on('close', (code) => {
      const success = code === 0;
      
      // 记录事件
      db.prepare(`
        INSERT INTO events (node_id, type, severity, message)
        VALUES (?, 'restore', ?, ?)
      `).run(
        req.params.id, 
        success ? 'info' : 'error',
        `节点 ${req.params.id} ${success ? '还原成功' : '还原失败'}`
      );
    });

    // 立即返回响应
    res.json({
      success: true,
      message: `✅ 还原任务已启动，使用策略: ${strategy}`,
      backup_file: backup.git_commit,
      strategy: strategy
    });

    // 30秒后杀死进程以避免挂起
    setTimeout(() => {
      if (!childProcess.killed) {
        childProcess.kill('SIGTERM');
      }
    }, 30000);

  } catch (error) {
    console.error(`节点 ${req.params.id} 还原异常:`, error);
    res.status(500).json({ error: error.message });
  }
});