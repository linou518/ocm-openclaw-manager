// 修复单个节点备份API为真实功能
app.post('/api/nodes/:id/backup', async (req, res) => {
  try {
    const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(req.params.id);
    if (!node) return res.status(404).json({ error: 'Node not found' });

    const { type = 'manual', note = '' } = req.body;
    
    // 调用真实的Python备份系统
    const { spawn } = require('child_process');
    const backupProcess = spawn('python3', ['real_backup_system.py', 'backup', req.params.id, type, note || '手动备份'], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    backupProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log(`节点 ${req.params.id} 备份输出:`, data.toString());
    });
    
    backupProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error(`节点 ${req.params.id} 备份错误:`, data.toString());
    });
    
    backupProcess.on('close', (code) => {
      if (code === 0) {
        // 添加成功事件
        db.prepare(`
          INSERT INTO events (node_id, type, severity, message)
          VALUES (?, 'backup', 'info', ?)
        `).run(req.params.id, `节点 ${req.params.id} 手动备份完成`);
        
        // 获取最新备份记录
        const newBackup = db.prepare('SELECT * FROM backups WHERE node_id = ? ORDER BY created_at DESC LIMIT 1').get(req.params.id);
        res.json({ success: true, backup: newBackup, message: '✅ 真实备份完成' });
      } else {
        // 添加错误事件
        db.prepare(`
          INSERT INTO events (node_id, type, severity, message)
          VALUES (?, 'backup', 'error', ?)
        `).run(req.params.id, `节点 ${req.params.id} 备份失败: ${stderr.substring(0, 200)}`);
        
        res.status(500).json({ error: 'Backup failed', details: stderr.trim() });
      }
    });
    
    // 15秒超时（单节点比集群超时短）
    setTimeout(() => {
      backupProcess.kill();
      res.status(408).json({ error: 'Backup timeout (15s)' });
    }, 15000);
    
  } catch (error) {
    console.error(`节点 ${req.params.id} 备份异常:`, error);
    res.status(500).json({ error: error.message });
  }
});