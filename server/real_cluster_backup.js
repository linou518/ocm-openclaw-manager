// 全集群备份 (真实版本)
app.post('/api/cluster/backup', async (req, res) => {
  try {
    const nodes = db.prepare('SELECT * FROM nodes WHERE status = ?').all('online');
    const count = nodes.length;
    
    if (count === 0) {
      return res.json({ success: false, message: '没有在线节点可备份' });
    }
    
    let successCount = 0;
    let failedNodes = [];
    const results = [];
    
    // 并行执行所有节点的真实备份
    const backupPromises = nodes.map(node => {
      return new Promise((resolve) => {
        const { spawn } = require('child_process');
        const backupProcess = spawn('python3', ['real_backup_system.py', 'backup', node.id, 'auto', `集群备份-${new Date().toISOString()}`], {
          cwd: __dirname,
          stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let stdout = '';
        let stderr = '';
        
        backupProcess.stdout.on('data', (data) => stdout += data.toString());
        backupProcess.stderr.on('data', (data) => stderr += data.toString());
        
        backupProcess.on('close', (code) => {
          if (code === 0) {
            successCount++;
            console.log(`节点 ${node.id} 备份成功`);
            resolve({ node: node.id, success: true, message: '备份成功' });
          } else {
            failedNodes.push(node.id);
            console.error(`节点 ${node.id} 备份失败: ${stderr}`);
            resolve({ node: node.id, success: false, error: stderr.trim() });
          }
        });
        
        // 30秒超时
        setTimeout(() => {
          backupProcess.kill();
          failedNodes.push(node.id);
          resolve({ node: node.id, success: false, error: 'Backup timeout (30s)' });
        }, 30000);
      });
    });
    
    // 等待所有备份完成
    const backupResults = await Promise.all(backupPromises);
    
    // 添加事件记录
    if (successCount > 0) {
      db.prepare(`
        INSERT INTO events (type, severity, message)
        VALUES ('backup', 'info', ?)
      `).run(`全集群备份完成: ${successCount}/${count} 节点成功`);
    }
    
    if (failedNodes.length > 0) {
      db.prepare(`
        INSERT INTO events (type, severity, message)
        VALUES ('backup', 'warning', ?)
      `).run(`部分节点备份失败: ${failedNodes.join(', ')}`);
    }
    
    res.json({ 
      success: successCount > 0,
      total: count,
      success_count: successCount,
      failed_count: failedNodes.length,
      failed_nodes: failedNodes,
      results: backupResults,
      message: `✅ 真实集群备份完成\\n成功: ${successCount}/${count} 节点\\n${failedNodes.length > 0 ? `失败: ${failedNodes.join(', ')}` : ''}` 
    });
    
  } catch (error) {
    console.error('集群备份错误:', error);
    res.status(500).json({ error: error.message });
  }
});