// 测试增强API集成
const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = 8002; // 不同端口避免冲突

// 数据库
const dbPath = path.join(__dirname, 'db', 'ocm.db');
const db = new Database(dbPath);

// 中间件
app.use(express.json());

// 测试基础API
app.get('/test', (req, res) => {
  res.json({ message: '基础API工作正常', timestamp: new Date() });
});

// 集成增强API
try {
  console.log('🔧 开始集成增强API...');
  const EnhancedBotCreationAPI = require('./enhanced-bot-creation-api');
  console.log('✅ 增强API模块加载成功');
  
  const enhancedBotAPI = new EnhancedBotCreationAPI(db);
  console.log('✅ 增强API实例创建成功');
  
  app.use(enhancedBotAPI.getRouter());
  console.log('✅ 增强API路由集成成功');
  
} catch (error) {
  console.error('❌ 增强API集成失败:', error);
  console.error(error.stack);
}

// 启动测试服务器
app.listen(PORT, () => {
  console.log(`🚀 测试服务器运行在 http://localhost:${PORT}`);
  console.log('📋 测试端点:');
  console.log(`  基础: http://localhost:${PORT}/test`);
  console.log(`  健康: http://localhost:${PORT}/api/nodes/health/summary`);
  console.log(`  节点: http://localhost:${PORT}/api/nodes/pc-b/health`);
});