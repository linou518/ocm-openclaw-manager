#!/usr/bin/env python3
"""
改进OCM界面显示：区分现有agents和新创建的bots
"""

def improve_bots_display():
    """改进Bots显示，区分agents和bots"""
    
    node_detail_path = "/home/linou/shared/ocm-project/client/src/pages/NodeDetail.jsx"
    
    print("🔧 改进OCM Bots显示...")
    
    # 备份文件
    import datetime
    import shutil
    backup_path = f"{node_detail_path}.backup-display-{datetime.datetime.now().strftime('%H%M')}"
    shutil.copy2(node_detail_path, backup_path)
    print(f"✅ 已创建备份: {backup_path}")
    
    with open(node_detail_path, 'r') as f:
        content = f.read()
    
    # 在Bot显示区域添加类型区分
    agent_label_addition = '''
                      {/* Agent类型标识 */}
                      {bot.bot_type === 'agent' && (
                        <span className="ml-2 px-2 py-1 bg-blue-500/30 text-blue-400 text-xs rounded">
                          现有Agent
                        </span>
                      )}
                      {bot.bot_type === 'bot' && (
                        <span className="ml-2 px-2 py-1 bg-green-500/30 text-green-400 text-xs rounded">
                          Telegram Bot
                        </span>
                      )}'''
    
    # 查找Bot名称显示的位置并添加标识
    import re
    pattern = r'(<div className="font-bold text-lg text-white">\s*\{bot\.name.*?\}\s*</div>)'
    replacement = r'\1' + agent_label_addition
    
    new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)
    
    if new_content != content:
        with open(node_detail_path, 'w') as f:
            f.write(new_content)
        print("✅ 已添加Agent/Bot类型区分标识")
        return True
    else:
        print("⚠️ 未找到合适位置添加标识，需要手动处理")
        return False

def improve_error_handling():
    """改进Bot创建失败时的错误处理"""
    
    enhanced_api_path = "/home/linou/shared/ocm-project/server/enhanced-bot-creation-api.js"
    
    print("🔧 改进创建失败错误处理...")
    
    with open(enhanced_api_path, 'r') as f:
        content = f.read()
    
    # 在token验证失败后添加清理逻辑
    cleanup_code = '''
            // 清理失败创建的残留文件
            if (configResult && configResult.bundle_path) {
                try {
                    require('fs').rmSync(configResult.bundle_path, { recursive: true, force: true });
                    console.log(`🧹 已清理失败的配置包: ${configResult.bundle_path}`);
                } catch (cleanupError) {
                    console.warn(`清理文件失败: ${cleanupError.message}`);
                }
            }'''
    
    # 在token验证失败的return语句前插入清理代码
    pattern = r'(return res\.status\(400\)\.json\(\{\s*success: false,\s*error: tokenValidation\.error,\s*error_type: [\'"]invalid_token[\'"].*?\}\);)'
    replacement = cleanup_code + '\n            ' + r'\1'
    
    new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)
    
    if new_content != content:
        with open(enhanced_api_path, 'w') as f:
            f.write(new_content)
        print("✅ 已添加创建失败清理逻辑")
        return True
    else:
        print("⚠️ 未找到token验证位置，需要手动添加清理逻辑")
        return False

def main():
    print("🚀 开始改进OCM显示和错误处理...")
    print("=" * 50)
    
    try:
        # 1. 改进显示
        display_success = improve_bots_display()
        print()
        
        # 2. 改进错误处理  
        error_success = improve_error_handling()
        print()
        
        if display_success or error_success:
            print("=" * 50)
            print("🎉 改进完成！")
            print()
            print("📋 改进内容:")
            if display_success:
                print("✅ 添加了Agent/Bot类型区分标识")
            if error_success:
                print("✅ 添加了创建失败清理逻辑")
            print()
            print("🔄 需要重新构建:")
            print("1. 前端: cd /home/linou/shared/ocm-project/client && npm run build")
            if error_success:
                print("2. 后端: 重启OCM服务器")
            
        else:
            print("⚠️ 未进行任何修改，可能需要手动处理")
            
    except Exception as e:
        print(f"❌ 改进过程中出错: {e}")
        return False
    
    return True

if __name__ == "__main__":
    main()