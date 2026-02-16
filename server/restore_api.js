// 智能还原API集成到OCM系统

// 诊断节点故障
app.get('/api/nodes/:id/diagnose', async (req, res) => {
  try {
    const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(req.params.id);
    if (!node) return res.status(404).json({ error: 'Node not found' });

    const { spawn } = require('child_process');
    const diagnoseProcess = spawn('python3', ['smart_restore_system.py', 'diagnose', req.params.id], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    diagnoseProcess.stdout.on('data', (data) => stdout += data.toString());
    diagnoseProcess.stderr.on('data', (data) => stderr += data.toString());
    
    diagnoseProcess.on('close', (code) => {
      if (code === 0) {
        // 解析诊断结果
        const lines = stdout.trim().split('\\n');
        const failureType = lines[0].replace('Failure Type: ', '');
        const details = lines[1].replace('Details: ', '');
        const strategy = lines[2].replace('Recommended Strategy: ', '');
        
        res.json({
          success: true,
          failure_type: failureType,
          details: JSON.parse(details.replace(/'/g, '"')),
          recommended_strategy: strategy
        });
      } else {
        res.status(500).json({ 
          error: 'Diagnosis failed', 
          details: stderr 
        });
      }
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取节点的备份列表
app.get('/api/nodes/:id/restore-options', async (req, res) => {
  try {
    const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(req.params.id);
    if (!node) return res.status(404).json({ error: 'Node not found' });

    const { spawn } = require('child_process');
    const listProcess = spawn('python3', ['smart_restore_system.py', 'list', req.params.id], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    listProcess.stdout.on('data', (data) => stdout += data.toString());
    listProcess.stderr.on('data', (data) => stderr += data.toString());
    
    listProcess.on('close', (code) => {
      if (code === 0) {
        // 解析备份列表
        const lines = stdout.trim().split('\\n').slice(1); // 跳过标题行
        const backups = lines.filter(line => line.trim()).map(line => {
          const match = line.match(/ID (\\d+): (.+?) \\((.+?)\\) - (.+)/);
          if (match) {
            return {
              id: parseInt(match[1]),
              filename: match[2],
              type: match[3],
              date: match[4]
            };
          }
          return null;
        }).filter(Boolean);
        
        res.json({
          success: true,
          backups: backups
        });
      } else {
        res.status(500).json({ 
          error: 'Failed to list backups', 
          details: stderr 
        });
      }
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 执行智能还原
app.post('/api/nodes/:id/restore', async (req, res) => {
  try {
    const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(req.params.id);
    if (!node) return res.status(404).json({ error: 'Node not found' });

    const { backup_id, strategy } = req.body;
    if (!backup_id) {
      return res.status(400).json({ error: 'backup_id is required' });
    }

    const args = ['smart_restore_system.py', 'restore', req.params.id, backup_id.toString()];
    if (strategy) {
      args.push(strategy);
    }

    const { spawn } = require('child_process');
    const restoreProcess = spawn('python3', args, {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    restoreProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log(`节点 ${req.params.id} 还原输出:`, data.toString());
    });
    
    restoreProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error(`节点 ${req.params.id} 还原错误:`, data.toString());
    });
    
    restoreProcess.on('close', (code) => {
      if (code === 0) {
        try {
          // 解析Python输出的字典格式结果
          const resultMatch = stdout.match(/Restore Result: ({.*})/s);
          if (resultMatch) {
            // 简单解析Python字典输出
            const resultStr = resultMatch[1]
              .replace(/'/g, '"')
              .replace(/True/g, 'true')
              .replace(/False/g, 'false')
              .replace(/None/g, 'null');
            
            const result = JSON.parse(resultStr);
            
            // 记录还原事件
            db.prepare(`
              INSERT INTO events (node_id, type, severity, message)
              VALUES (?, 'restore', ?, ?)
            `).run(
              req.params.id, 
              result.success ? 'info' : 'error',
              `节点 ${req.params.id} ${result.success ? '还原成功' : '还原失败'}: ${result.message}`
            );
            
            res.json({
              success: result.success,
              message: result.message,
              strategy: result.strategy,
              failure_type: result.failure_type,
              verification: result.verification
            });
          } else {
            res.json({
              success: true,
              message: '还原完成（解析输出失败）',
              raw_output: stdout
            });
          }
        } catch (parseError) {
          res.json({
            success: true,
            message: '还原完成（结果解析失败）',
            raw_output: stdout,
            parse_error: parseError.message
          });
        }
      } else {
        // 记录失败事件
        db.prepare(`
          INSERT INTO events (node_id, type, severity, message)
          VALUES (?, 'restore', 'error', ?)
        `).run(req.params.id, `节点 ${req.params.id} 还原失败: ${stderr.substring(0, 200)}`);
        
        res.status(500).json({ 
          success: false, 
          error: 'Restore failed', 
          details: stderr.trim(),
          output: stdout
        });
      }
    });
    
    // 60秒超时
    setTimeout(() => {
      restoreProcess.kill();
      res.status(408).json({ 
        success: false, 
        error: 'Restore timeout (60s)' 
      });
    }, 60000);
    
  } catch (error) {
    console.error(`节点 ${req.params.id} 还原异常:`, error);
    res.status(500).json({ error: error.message });
  }
});