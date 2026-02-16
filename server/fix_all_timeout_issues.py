#!/usr/bin/env python3
"""
修复OCM系统中所有的HTTP响应头重复发送问题
"""

def fix_all_timeout_issues():
    # 读取当前文件
    with open('/home/linou/shared/ocm-project/server/index.js', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 修复备份API的超时处理 
    backup_timeout_pattern = r'    // 15秒超时（单节点比集群超时短）\s*setTimeout\(\(\) => \{\s*backupProcess\.kill\(\);\s*res\.status\(408\)\.json\(\{ error: \'Backup timeout \(15s\)\' \}\);\s*\}, 15000\);'
    
    backup_timeout_replacement = '''    // 15秒超时（单节点比集群超时短）
    let backupTimeout = setTimeout(() => {
      if (!res.headersSent) {
        backupProcess.kill();
        res.status(408).json({ error: 'Backup timeout (15s)' });
      }
    }, 15000);
    
    backupProcess.on('close', (code) => {
      clearTimeout(backupTimeout);
      if (res.headersSent) return;
      
      if (code === 0) {'''
    
    # 查找并替换备份超时处理
    import re
    if re.search(backup_timeout_pattern, content):
        print("找到备份API超时处理，进行修复...")
        content = re.sub(backup_timeout_pattern, backup_timeout_replacement, content)
        
        # 同时需要修复backupProcess.on('close'的重复定义
        # 查找原来的on('close'并删除其开头
        original_close_pattern = r'backupProcess\.on\(\'close\', \(code\) => \{\s*if \(code === 0\) \{'
        content = re.sub(original_close_pattern, 'if (code === 0) {', content, count=1)
        print("✅ 备份API超时处理已修复")
    else:
        print("未找到备份API超时处理模式")
    
    # 检查是否还有其他潜在的超时问题
    timeout_patterns = [
        r'setTimeout\(\(\) => \{[^}]*res\.status\([^}]*\}\);[^}]*\}, \d+\);'
    ]
    
    for pattern in timeout_patterns:
        matches = re.findall(pattern, content)
        if matches:
            print(f"⚠️ 发现其他潜在的超时问题: {len(matches)}个")
    
    # 写入修复后的文件
    with open('/home/linou/shared/ocm-project/server/index_fixed_all_timeouts.js', 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("✅ 所有超时响应问题已修复")
    print("修复文件: index_fixed_all_timeouts.js")

if __name__ == "__main__":
    fix_all_timeout_issues()