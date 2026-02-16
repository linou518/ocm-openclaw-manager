#!/usr/bin/env python3
"""
OCM CLI 快速设置脚本
自动添加预定义节点模板到数据库
"""

import sqlite3
import sys
from pathlib import Path
from datetime import datetime

# 导入配置
from config import DB_PATH, NODE_TEMPLATES, validate_config

def init_database():
    """初始化数据库"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 创建节点表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS nodes (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            host_ip TEXT NOT NULL,
            ssh_port INTEGER DEFAULT 22,
            ssh_user TEXT NOT NULL,
            openclaw_path TEXT DEFAULT '/usr/bin/openclaw',
            status TEXT DEFAULT 'unknown',
            created_at TEXT NOT NULL,
            last_check TEXT NOT NULL
        )
    ''')
    
    # 创建备份表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS backups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            node_id TEXT NOT NULL,
            backup_name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            checksum TEXT NOT NULL,
            created_at TEXT NOT NULL,
            backup_type TEXT DEFAULT 'full',
            FOREIGN KEY (node_id) REFERENCES nodes (id)
        )
    ''')
    
    # 创建还原日志表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS restore_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            node_id TEXT NOT NULL,
            backup_name TEXT NOT NULL,
            restored_at TEXT NOT NULL,
            status TEXT NOT NULL,
            rollback_path TEXT,
            FOREIGN KEY (node_id) REFERENCES nodes (id)
        )
    ''')
    
    conn.commit()
    conn.close()
    print("✅ 数据库初始化完成")

def add_node_templates():
    """添加预定义节点模板"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    now = datetime.now().isoformat()
    added_count = 0
    
    for node_id, template in NODE_TEMPLATES.items():
        # 检查节点是否已存在
        cursor.execute("SELECT id FROM nodes WHERE id = ?", (node_id,))
        if cursor.fetchone():
            print(f"⚠️  节点已存在，跳过: {node_id} ({template['name']})")
            continue
        
        # 添加新节点
        cursor.execute('''
            INSERT INTO nodes (id, name, host_ip, ssh_port, ssh_user, openclaw_path, 
                              status, created_at, last_check)
            VALUES (?, ?, ?, ?, ?, ?, 'unknown', ?, ?)
        ''', (
            node_id,
            template['name'],
            template['host_ip'],
            template.get('ssh_port', 22),
            template['ssh_user'],
            template.get('openclaw_path', '/usr/bin/openclaw'),
            now,
            now
        ))
        
        print(f"✅ 添加节点: {node_id} ({template['name']}) - {template['host_ip']}")
        added_count += 1
    
    conn.commit()
    conn.close()
    
    print(f"\n🎯 节点模板设置完成，新增 {added_count} 个节点")
    return added_count

def show_current_nodes():
    """显示当前所有节点"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute("SELECT id, name, host_ip, ssh_user, status FROM nodes ORDER BY created_at")
        nodes = cursor.fetchall()
        
        if nodes:
            print("\n📋 当前已配置节点:")
            print("=" * 60)
            for node_id, name, host_ip, ssh_user, status in nodes:
                status_icon = "✅" if status == "active" else "❓" if status == "unknown" else "❌"
                print(f"{status_icon} {name} ({node_id})")
                print(f"   📍 {host_ip} | 👤 {ssh_user} | 状态: {status}")
        else:
            print("\n📋 暂无已配置节点")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ 查询节点失败: {e}")

def main():
    """主函数"""
    print("🔧 OCM CLI 快速设置")
    print("=" * 40)
    
    # 验证配置
    issues = validate_config()
    if issues:
        print("❌ 配置问题:")
        for issue in issues:
            if "Bot Token" not in issue:  # Bot token问题稍后处理
                print(f"  {issue}")
        print()
    
    # 初始化数据库
    init_database()
    
    # 询问是否添加节点模板
    if len(sys.argv) > 1 and sys.argv[1] == "--auto":
        add_templates = True
    else:
        response = input("\n❓ 是否添加预定义节点模板? (y/n): ").lower().strip()
        add_templates = response in ['y', 'yes', '']
    
    if add_templates:
        print(f"\n📦 准备添加 {len(NODE_TEMPLATES)} 个节点模板...")
        for node_id, template in NODE_TEMPLATES.items():
            print(f"   • {template['name']} ({node_id}) - {template['host_ip']}")
        
        add_node_templates()
    
    # 显示当前节点状态
    show_current_nodes()
    
    # 提示后续操作
    print("\n🚀 后续操作:")
    print("1. 配置Telegram Bot Token (编辑 config.py 或设置环境变量)")
    print("2. 运行 ./start_ocm_cli.sh 启动CLI服务")
    print("3. 在Telegram中发送 /newnode 或 /mynode 开始使用")

if __name__ == "__main__":
    main()