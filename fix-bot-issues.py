#!/usr/bin/env python3
"""
OCM Bot问题修复脚本 - 简化版
1. 修改前端使用增强的Bot创建组件（带token验证）
2. 添加Bot删除功能到后端
"""

import os
import re
import shutil
from datetime import datetime

def backup_file(file_path):
    """创建文件备份"""
    timestamp = datetime.now().strftime("%H%M")
    backup_path = f"{file_path}.backup-{timestamp}"
    shutil.copy2(file_path, backup_path)
    print(f"✅ 已创建备份: {backup_path}")
    return backup_path

def fix_frontend_component():
    """修复前端使用增强的Bot组件"""
    node_detail_path = "/home/linou/shared/ocm-project/client/src/pages/NodeDetail.jsx"
    
    print("🔧 修复前端组件导入...")
    backup_file(node_detail_path)
    
    with open(node_detail_path, "r") as f:
        content = f.read()
    
    # 修改import语句，使用增强组件
    old_import = "import AddBotModal from \"../components/AddBotModal\";"
    new_import = "import AddBotModal from \"../components/enhanced-AddBotModal-with-health\";"
    
    if old_import in content:
        content = content.replace(old_import, new_import)
        
        with open(node_detail_path, "w") as f:
            f.write(content)
        
        print("✅ 已修改NodeDetail.jsx使用增强Bot组件")
        return True
    else:
        print("⚠️ 未找到需要替换的import语句")
        return False

def add_bot_delete_api():
    """添加Bot删除API到后端"""
    index_path = "/home/linou/shared/ocm-project/server/index.js"
    
    print("🔧 添加Bot删除API...")
    backup_file(index_path)
    
    with open(index_path, "r") as f:
        content = f.read()
    
    # 检查是否已经存在删除API
    if "app.delete(\/api/bots/ in content:
        print(⚠️ Bot删除API已存在)
        return True
    
    # 删除API代码
    delete_api = 
