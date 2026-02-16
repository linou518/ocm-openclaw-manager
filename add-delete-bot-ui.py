#!/usr/bin/env python3
"""
为OCM前端添加删除Bot按钮的脚本
在NodeDetail.jsx中添加删除功能的UI和逻辑
"""

import re

def add_delete_function():
    """在NodeDetail.jsx中添加删除Bot函数"""
    file_path = "/home/linou/shared/ocm-project/client/src/pages/NodeDetail.jsx"
    
    print("🔧 添加删除Bot函数...")
    
    with open(file_path, 'r') as f:
        content = f.read()
    
    # 删除Bot的函数代码
    delete_function = '''
  // 删除Bot函数
  const handleDeleteBot = async (botId, botName) => {
    if (!confirm(`确定要删除Bot "${botName}" 吗？\\n此操作不可撤销！`)) {
      return;
    }
    
    setActionLoading(true);
    try {
      const res = await fetch(`/api/bots/${botId}`, {
        method: 'DELETE',
      });
      
      const result = await res.json();
      
      if (result.success) {
        alert(`Bot "${botName}" 已删除`);
        fetchBots(); // 刷新Bot列表
      } else {
        alert(`删除失败: ${result.error}`);
      }
    } catch (error) {
      console.error('删除Bot错误:', error);
      alert(`删除失败: ${error.message}`);
    } finally {
      setActionLoading(false);
    }
  };
'''
    
    # 找到fetchBots函数的位置，在其前面插入删除函数
    fetch_bots_match = re.search(r'(\s*)(const fetchBots = async \(\) => \{)', content)
    if fetch_bots_match:
        insert_pos = fetch_bots_match.start()
        indent = fetch_bots_match.group(1)
        
        new_content = (
            content[:insert_pos] + 
            delete_function + 
            '\n' + indent + 
            content[insert_pos:]
        )
        
        with open(file_path, 'w') as f:
            f.write(new_content)
        
        print("✅ 已添加删除Bot函数")
        return True
    else:
        print("❌ 未找到fetchBots函数位置")
        return False

def add_delete_button():
    """在Bot状态显示区域添加删除按钮"""
    file_path = "/home/linou/shared/ocm-project/client/src/pages/NodeDetail.jsx"
    
    print("🔧 添加删除按钮UI...")
    
    with open(file_path, 'r') as f:
        content = f.read()
    
    # 找到Bot状态显示的div，在其中添加删除按钮
    # 寻找 '<div className="flex items-center space-x-2">' 后面的 '</span>' 和 '</div>'
    pattern = r'(<div className="flex items-center space-x-2">.*?<span className=.*?>\s*\{bot\.status\}\s*</span>)(\s*</div>)'
    
    replacement = r'''\1
                          <button
                            onClick={() => handleDeleteBot(bot.id, bot.name || bot.bot_name || bot.agent_id)}
                            disabled={actionLoading}
                            className="ml-2 px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 disabled:opacity-50 transition-colors"
                            title="删除此Bot"
                          >
                            🗑️
                          </button>\2'''
    
    new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)
    
    if new_content != content:
        with open(file_path, 'w') as f:
            f.write(new_content)
        print("✅ 已添加删除按钮UI")
        return True
    else:
        print("❌ 未找到Bot状态显示区域，尝试手动定位...")
        
        # 备选方案：直接在status span后添加
        pattern2 = r'(\{bot\.status\}\s*</span>)(\s*</div>\s*</div>)'
        replacement2 = r'''\1
                          <button
                            onClick={() => handleDeleteBot(bot.id, bot.name || bot.bot_name || bot.agent_id)}
                            disabled={actionLoading}
                            className="ml-2 px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 disabled:opacity-50"
                            title="删除此Bot"
                          >
                            🗑️
                          </button>\2'''
        
        new_content2 = re.sub(pattern2, replacement2, content, flags=re.DOTALL)
        
        if new_content2 != content:
            with open(file_path, 'w') as f:
                f.write(new_content2)
            print("✅ 已添加删除按钮UI（备选方案）")
            return True
        else:
            print("❌ 无法自动添加删除按钮，需要手动处理")
            return False

def main():
    print("🚀 开始添加删除Bot的UI功能...")
    print("=" * 40)
    
    try:
        # 1. 添加删除函数
        func_success = add_delete_function()
        print()
        
        # 2. 添加删除按钮UI
        ui_success = add_delete_button()
        print()
        
        if func_success and ui_success:
            print("🎉 删除功能添加完成！")
            print("📋 已添加:")
            print("✅ handleDeleteBot 删除函数")
            print("✅ 🗑️ 删除按钮UI")
            print()
            print("🔄 需要重新构建前端:")
            print("cd /home/linou/shared/ocm-project/client && npm run build")
            return True
        else:
            print("⚠️  部分功能添加失败，可能需要手动处理")
            return False
            
    except Exception as e:
        print(f"❌ 添加过程中出错: {e}")
        return False

if __name__ == "__main__":
    main()