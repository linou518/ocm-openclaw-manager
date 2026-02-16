// 修复超时处理的响应重复发送问题

const fs = require('fs');

// 读取当前index.js文件
let indexContent = fs.readFileSync('/home/linou/shared/ocm-project/server/index.js', 'utf8');

// 修复重启API中的超时处理
const restartTimeoutFix = `    // 30秒超时
    let responseTimeout = setTimeout(() => {
      if (!res.headersSent) {
        testProcess.kill();
        res.status(408).json({ 
          success: false, 
          error: 'Restart timeout (30s)' 
        });
      }
    }, 30000);
    
    restartProcess.on('close', (code) => {
      clearTimeout(responseTimeout);
      if (res.headersSent) return;
      
      if (code === 0) {`;

// 修复智力测试API中的超时处理
const testTimeoutFix = `    // 60秒超时（测试需要更长时间）
    let testTimeout = setTimeout(() => {
      if (!res.headersSent) {
        testProcess.kill();
        res.status(408).json({ 
          success: false, 
          error: 'Intelligence test timeout (60s)' 
        });
      }
    }, 60000);
    
    testProcess.on('close', (code) => {
      clearTimeout(testTimeout);
      if (res.headersSent) return;
      
      if (code === 0) {`;

// 应用修复
indexContent = indexContent.replace(
  /    \/\/ 30秒超时[\s\S]*?restartProcess\.on\('close', \(code\) => \{[\s]*if \(code === 0\) \{/,
  restartTimeoutFix
);

indexContent = indexContent.replace(
  /    \/\/ 60秒超时（测试需要更长时间）[\s\S]*?testProcess\.on\('close', \(code\) => \{[\s]*if \(code === 0\) \{/,
  testTimeoutFix
);

// 写入修复后的文件
fs.writeFileSync('/home/linou/shared/ocm-project/server/index_fixed_timeout.js', indexContent);

console.log('✅ 超时响应重复发送问题已修复');
console.log('修复文件: index_fixed_timeout.js');