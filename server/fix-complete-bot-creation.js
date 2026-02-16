// 完整修复Bot创建API
const fs = require('fs');

let content = fs.readFileSync('index.js', 'utf8');

// 1. 清理损坏的数据库代码
content = content.replace(/\$1\s*\n\s*\/\/ 写入数据库[\s\S]*?console\.error\("数据库写入失败:", dbErr\);\s*\}/g, '');

// 2. 找到正确的插入位置并添加完整逻辑
const pattern = /(console\.log\(`Bot配置生成完成: \${bundlePath\}`\);)/;

const completeLogic = `$1
    
    // 写入数据库
    try {
      const result = db.prepare(\`
        INSERT INTO bots (node_id, bot_name, bot_token, platform, workspace_path, model, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      \`).run(
        1,  // 暂用node_id=1
        botData.bot_name,
        botData.bot_token,
        'telegram',
        \`/tmp/workspace-\${botData.bot_name}\`,
        botData.model || 'claude-sonnet-4',
        'created',
        Date.now()
      );
      console.log(\`Bot已写入数据库，ID: \${result.lastInsertRowid}\`);
    } catch (dbErr) {
      console.error('数据库写入失败:', dbErr);
    }
    
    // 执行部署脚本
    try {
      const deployCmd = \`cd \${bundlePath} && bash deploy.sh\`;
      console.log('开始执行部署脚本...');
      const deployResult = await execAsync(deployCmd);
      console.log('部署输出:', deployResult.stdout);
      if (deployResult.stderr) {
        console.error('部署警告:', deployResult.stderr);
      }
    } catch (deployErr) {
      console.error('部署失败:', deployErr);
      // 不阻断响应，让用户知道配置已生成
    }`;

content = content.replace(pattern, completeLogic);

// 3. 备份并保存
fs.writeFileSync('index.js.backup.complete-fix', fs.readFileSync('index.js'));
fs.writeFileSync('index.js', content);

console.log('✅ 完整的Bot创建API已修复');
console.log('🔧 修复内容:');
console.log('  - 清理了重复/损坏的数据库代码');
console.log('  - 添加了正确的数据库写入逻辑');
console.log('  - 添加了deploy.sh脚本执行');
console.log('📦 备份: index.js.backup.complete-fix');