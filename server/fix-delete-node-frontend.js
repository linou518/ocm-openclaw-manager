// 修复前端删除节点错误处理
// 运行: ssh linou@192.168.3.33 "cd /home/linou/shared/ocm-project/server && node fix-delete-node-frontend.js"

const fs = require('fs');
const path = require('path');

// 1. 修复index.js中的 $1 错误
const indexPath = '/home/linou/shared/ocm-project/server/index.js';
let indexContent = fs.readFileSync(indexPath, 'utf8');

// 移除损坏的$1引用
indexContent = indexContent.replace(/\$1[\s\S]*?console\.error\("数据库写入失败:", dbErr\);\s*\}/g, '');

// 添加节点存在性检查API
const nodeExistsAPI = `
// 检查节点是否存在
app.get('/api/nodes/:id/exists', (req, res) => {
  try {
    const node = db.prepare('SELECT id, name FROM nodes WHERE id = ?').get(req.params.id);
    res.json({ 
      exists: !!node,
      node: node || null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

`;

// 在其他节点API前添加存在性检查
indexContent = indexContent.replace('// 节点详情', nodeExistsAPI + '// 节点详情');

// 增强节点详情API的错误处理
indexContent = indexContent.replace(
  /(app\.get\('\/api\/nodes\/:id', \(req, res\) => \{[\s\S]*?try \{)/,
  `$1
    const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(req.params.id);
    if (!node) {
      return res.status(404).json({ 
        error: 'Node not found', 
        message: '节点不存在或已被删除',
        node_id: req.params.id
      });
    }
    res.json(node);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 修复后的节点详情API
app.get('/api/nodes/:id/fixed', (req, res) => {
  try {`
);

// 备份并保存
fs.writeFileSync(indexPath + '.backup.delete-fix', fs.readFileSync(indexPath));
fs.writeFileSync(indexPath, indexContent);

// 2. 添加前端错误处理中间件
const errorHandlerMiddleware = `
// 前端错误处理中间件
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  
  // 如果已经发送了响应，不要再发送
  if (res.headersSent) {
    return next(err);
  }
  
  // 总是返回JSON格式的错误
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || '服务器内部错误',
    timestamp: new Date().toISOString()
  });
});

// 404处理 - 总是返回JSON
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: \`API端点不存在: \${req.originalUrl}\`,
    available_endpoints: [
      'GET /api/nodes',
      'GET /api/nodes/:id', 
      'DELETE /api/nodes/:id',
      'GET /api/dashboard'
    ]
  });
});

`;

// 在app.listen之前添加错误处理
indexContent = indexContent.replace(
  /(app\.listen\(PORT)/,
  errorHandlerMiddleware + '$1'
);

fs.writeFileSync(indexPath, indexContent);

console.log('✅ 节点删除错误处理已修复');
console.log('🔧 修复内容:');
console.log('  - 移除了损坏的$1引用');
console.log('  - 添加了节点存在性检查API');
console.log('  - 增强了404错误处理，总是返回JSON');
console.log('  - 添加了错误处理中间件');
console.log('📦 备份文件: index.js.backup.delete-fix');
console.log('🔄 需要重启服务器生效');