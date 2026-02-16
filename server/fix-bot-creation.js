// 修复Bot创建API - 添加数据库写入逻辑
// 运行: node fix-bot-creation.js

const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'index.js');
let content = fs.readFileSync(indexPath, 'utf8');

// 查找create-bot API的位置，在成功响应前添加数据库写入
const oldApiPattern = /console\.log\(`Bot配置生成完成: \${bundlePath\}`\);\s*\n\s*res\.json\({[\s\S]*?}\);/;

const newApiCode = `console.log(\`Bot配置生成完成: \${bundlePath\}\`);
    
    // 写入数据库
    try {
      const nodeId = getNodeIdByServer(botData.target_server);
      if (nodeId) {
        const result = db.prepare(\`
          INSERT INTO bots (node_id, bot_name, bot_token, platform, workspace_path, model, openclaw_url, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        \`).run(
          nodeId,
          botData.bot_name,
          botData.bot_token,
          'telegram',
          \`/home/\${botData.target_server === 'pc-a' ? 'openclaw01' : 'linou'}/.openclaw/workspace-\${botData.bot_name}\`,
          botData.model || 'claude-sonnet-4',
          \`http://\${getServerIP(botData.target_server)}:18789\`,
          'created',
          Date.now()
        );
        console.log(\`Bot已写入数据库，ID: \${result.lastInsertRowid}\`);
      }
    } catch (dbErr) {
      console.error('数据库写入失败:', dbErr);
      // 继续执行，不阻断响应
    }
    
    res.json({
      success: true,
      message: \`Bot \${botData.display_name || botData.bot_name} 创建成功\`,
      bundle_path: bundlePath,
      template_used: 'joe-technical-expert-v2',
      profession: botData.profession || 'general',
      features: [
        '✅ 基于Joe模板，继承核心技能',
        '✅ 专业化配置已应用',
        '✅ 已去除个人信息',
        '✅ 配置包已生成',
        '✅ 已写入数据库'`;

if (content.match(oldApiPattern)) {
  content = content.replace(oldApiPattern, newApiCode);
  
  // 添加辅助函数
  const helperFunctions = `
// Bot创建辅助函数
function getNodeIdByServer(serverName) {
  try {
    const serverMap = {
      'pc-a': ['pc-a', 'PC-A', '192.168.3.73'],
      't440': ['t440', 'T440', '192.168.3.33'],
      'baota': ['baota', 'Baota', '192.168.3.11'],
      'pc-b': ['pc-b', 'PC-B', '192.168.3.17']
    };
    
    for (const [key, aliases] of Object.entries(serverMap)) {
      if (aliases.some(alias => alias.toLowerCase() === serverName.toLowerCase())) {
        const node = db.prepare('SELECT id FROM nodes WHERE LOWER(node_name) LIKE ?').get(\`%\${key}%\`);
        return node ? node.id : null;
      }
    }
    return null;
  } catch (err) {
    console.error('获取节点ID失败:', err);
    return null;
  }
}

function getServerIP(serverName) {
  const ipMap = {
    'pc-a': '192.168.3.73',
    't440': '192.168.3.33', 
    'baota': '192.168.3.11',
    'pc-b': '192.168.3.17'
  };
  return ipMap[serverName.toLowerCase()] || '192.168.3.33';
}

`;

  // 在API Routes之前插入辅助函数
  content = content.replace('// API Routes', helperFunctions + '// API Routes');
  
  fs.writeFileSync(indexPath + '.backup.bot-fix', fs.readFileSync(indexPath));
  fs.writeFileSync(indexPath, content);
  
  console.log('✅ Bot创建API已修复 - 添加了数据库写入逻辑');
  console.log('📦 备份文件: index.js.backup.bot-fix');
  console.log('🔄 需要重启OCM服务器生效');
} else {
  console.log('❌ 未找到目标代码块，可能已经修复过了');
}