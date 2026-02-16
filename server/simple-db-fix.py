#!/usr/bin/env python3
# 简单的数据库写入修复

import re

# 读取文件
with open('index.js', 'r') as f:
    content = f.read()

# 找到插入位置 - console.log(`Bot配置生成完成: ${bundlePath}`); 之后
pattern = r"(console\.log\(`Bot配置生成完成: \${bundlePath\}`\);)"

# 要添加的代码
insert_code = """$1
    
    // 写入数据库
    try {
      const result = db.prepare(`
        INSERT INTO bots (node_id, bot_name, bot_token, platform, workspace_path, model, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        1,  // node_id = 1 (假设为第一个节点)
        botData.bot_name,
        botData.bot_token,
        'telegram',
        '/tmp/workspace',
        botData.model || 'claude-sonnet-4',
        'created',
        Date.now()
      );
      console.log(`Bot已写入数据库，ID: ${result.lastInsertRowid}`);
    } catch (dbErr) {
      console.error('数据库写入失败:', dbErr);
    }"""

# 替换
new_content = re.sub(pattern, insert_code, content, count=1)

# 写回文件
with open('index.js', 'w') as f:
    f.write(new_content)

print("✅ 数据库写入逻辑已添加")