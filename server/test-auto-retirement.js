const AutomatedRetirementAPI = require('./automated-node-retirement-api');
const Database = require('better-sqlite3');

// 测试自动化退役系统
const db = new Database('./db/ocm.db');
const retirementAPI = new AutomatedRetirementAPI(db);

console.log('✅ 自动化退役API系统加载成功');
console.log('📋 可用的自动化端点:');
console.log('  POST /api/nodes/:nodeId/retire-automated - 完全自动化退役');
console.log('  GET /api/nodes/:nodeId/retirement-status - 检查退役状态');  
console.log('  POST /api/nodes/batch-retire - 批量自动化退役');
console.log('');
console.log('🎯 系统特性: 100% 自动化，零人工干预');
