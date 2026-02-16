// 真实节点操作API - 替换重启和智力测试的Mock逻辑

// 真实重启节点
app.post('/api/nodes/:id/restart', async (req, res) => {
  try {
    const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(req.params.id);
    if (!node) return res.status(404).json({ error: 'Node not found' });

    const { spawn } = require('child_process');
    const restartProcess = spawn('python3', ['real_node_operations.py', 'restart', req.params.id], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    restartProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log(`节点 ${req.params.id} 重启输出:`, data.toString());
    });
    
    restartProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error(`节点 ${req.params.id} 重启错误:`, data.toString());
    });
    
    restartProcess.on('close', (code) => {
      if (code === 0) {
        try {
          // 解析Python输出的结果
          const resultMatch = stdout.match(/Restart Result: ({.*})/s);
          if (resultMatch) {
            const resultStr = resultMatch[1]
              .replace(/'/g, '"')
              .replace(/True/g, 'true')
              .replace(/False/g, 'false');
            
            const result = JSON.parse(resultStr);
            
            // 记录重启事件
            db.prepare(`
              INSERT INTO events (node_id, type, severity, message)
              VALUES (?, 'restart', ?, ?)
            `).run(
              req.params.id, 
              result.success ? 'info' : 'error',
              `节点 ${req.params.id} ${result.message}`
            );
            
            res.json({
              success: result.success,
              message: result.message,
              service_status: result.service_status
            });
          } else {
            res.json({
              success: true,
              message: '✅ 重启完成（解析输出失败）',
              raw_output: stdout
            });
          }
        } catch (parseError) {
          res.json({
            success: true,
            message: '✅ 重启完成（结果解析失败）',
            raw_output: stdout
          });
        }
      } else {
        // 记录失败事件
        db.prepare(`
          INSERT INTO events (node_id, type, severity, message)
          VALUES (?, 'restart', 'error', ?)
        `).run(req.params.id, `节点 ${req.params.id} 重启失败: ${stderr.substring(0, 200)}`);
        
        res.status(500).json({ 
          success: false, 
          error: 'Restart failed', 
          details: stderr.trim()
        });
      }
    });
    
    // 30秒超时
    setTimeout(() => {
      restartProcess.kill();
      res.status(408).json({ 
        success: false, 
        error: 'Restart timeout (30s)' 
      });
    }, 30000);
    
  } catch (error) {
    console.error(`节点 ${req.params.id} 重启异常:`, error);
    res.status(500).json({ error: error.message });
  }
});

// 真实智力测试节点
app.post('/api/nodes/:id/test', async (req, res) => {
  try {
    const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(req.params.id);
    if (!node) return res.status(404).json({ error: 'Node not found' });

    const { spawn } = require('child_process');
    const testProcess = spawn('python3', ['real_node_operations.py', 'test', req.params.id], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    testProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log(`节点 ${req.params.id} 测试输出:`, data.toString());
    });
    
    testProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error(`节点 ${req.params.id} 测试错误:`, data.toString());
    });
    
    testProcess.on('close', (code) => {
      if (code === 0) {
        try {
          // 解析Python输出的结果
          const resultMatch = stdout.match(/Test Result: ({.*})/s);
          if (resultMatch) {
            const resultStr = resultMatch[1]
              .replace(/'/g, '"')
              .replace(/True/g, 'true')
              .replace(/False/g, 'false');
            
            const result = JSON.parse(resultStr);
            
            if (result.success && result.total_score > 0) {
              // 保存测试结果到数据库
              const scoreResult = db.prepare(`
                INSERT INTO scores (node_id, total_score, memory_score, logic_score, tool_score, quality_score, personality_score, action_taken)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              `).run(
                req.params.id,
                result.total_score,
                result.memory_score || 0,
                result.logic_score || 0,
                result.tool_score || 0,
                result.quality_score || 0,
                result.personality_score || 0,
                result.total_score < 70 ? 'needs_improvement' : 'maintain'
              );
              
              // 记录测试事件
              db.prepare(`
                INSERT INTO events (node_id, type, severity, message)
                VALUES (?, 'intelligence_test', ?, ?)
              `).run(
                req.params.id, 
                result.total_score < 70 ? 'warn' : 'info',
                `节点 ${req.params.id} 真实智力测试完成: ${result.total_score}/100`
              );
              
              const newScore = db.prepare('SELECT * FROM scores WHERE id = ?').get(scoreResult.lastInsertRowid);
              
              res.json({ 
                success: true, 
                score: newScore,
                test_details: {
                  memory: result.memory_score,
                  logic: result.logic_score,
                  tool: result.tool_score,
                  quality: result.quality_score,
                  personality: result.personality_score
                },
                message: `✅ 真实智力测试完成\\n总分: ${result.total_score}/100\\n测试类型: 实际问答评估`
              });
            } else {
              res.status(500).json({
                success: false,
                message: result.message,
                error: 'Intelligence test failed'
              });
            }
          } else {
            res.json({
              success: true,
              message: '✅ 测试完成（解析输出失败）',
              raw_output: stdout
            });
          }
        } catch (parseError) {
          res.json({
            success: true,
            message: '✅ 测试完成（结果解析失败）',
            raw_output: stdout,
            parse_error: parseError.message
          });
        }
      } else {
        // 记录失败事件
        db.prepare(`
          INSERT INTO events (node_id, type, severity, message)
          VALUES (?, 'intelligence_test', 'error', ?)
        `).run(req.params.id, `节点 ${req.params.id} 智力测试失败: ${stderr.substring(0, 200)}`);
        
        res.status(500).json({ 
          success: false, 
          error: 'Intelligence test failed', 
          details: stderr.trim()
        });
      }
    });
    
    // 60秒超时（测试需要更长时间）
    setTimeout(() => {
      testProcess.kill();
      res.status(408).json({ 
        success: false, 
        error: 'Intelligence test timeout (60s)' 
      });
    }, 60000);
    
  } catch (error) {
    console.error(`节点 ${req.params.id} 智力测试异常:`, error);
    res.status(500).json({ error: error.message });
  }
});