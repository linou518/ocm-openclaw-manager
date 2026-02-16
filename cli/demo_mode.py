#!/usr/bin/env python3
"""
OCM CLI 演示模式
在没有真实Telegram Bot Token的情况下演示功能
"""

import sys
import sqlite3
from datetime import datetime
from config import DB_PATH, NODE_TEMPLATES
from core.ssh_manager import SSHConnectionManager

def demo_newnode():
    """演示添加节点功能"""
    print("🆕 演示: /newnode 命令")
    print("=" * 40)
    
    print("📝 用户发送: /newnode")
    print("🤖 Bot回复:")
    print("""
🖥️ **添加新OpenClaw节点**

点击下方按钮开始添加节点配置：
• 节点ID (英文标识)
• 节点名称 (中文显示)  
• 主机IP地址
• SSH端口和用户
• OpenClaw程序路径

系统将自动测试连接并注册节点。

[🆕 开始添加节点] [📖 查看帮助]
    """)

def demo_mynode():
    """演示节点管理界面"""
    print("\n🖥️ 演示: /mynode 命令")
    print("=" * 40)
    
    # 从数据库获取实际节点状态
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, host_ip, status FROM nodes ORDER BY created_at")
    nodes = cursor.fetchall()
    conn.close()
    
    print("📝 用户发送: /mynode")
    print("🤖 Bot回复:")
    print("\n🖥️ **OCM节点管理**\n")
    
    for node_id, name, host_ip, status in nodes:
        status_icon = "✅" if status == "active" else "❌" if status == "offline" else "⚠️"
        print(f"{status_icon} **{name}** ({host_ip})")
    
    print("\n[✅ T440工作服务器] [❌ PC-A主机] [✅ Baota服务器]")
    print("[➕ 添加新节点] [🔄 刷新状态]")

def demo_node_detail():
    """演示节点详情页面"""
    print("\n📍 演示: 点击 T440工作服务器")
    print("=" * 40)
    
    print("🤖 Bot回复:")
    print("""
🖥️ **T440工作服务器** (192.168.3.33)
状态: ✅ 在线 | 最后检查: 2分钟前

🤖 **运行中的Bot (3个)**:
├── @youtube_cho_bot
├── @learning_bot
└── @health_bot

━━━━━━━━━━━━━━━━━━
[📦 备份管理] [🔄 重启节点]
[📊 系统状态] [📝 查看日志]

🤖 Bot管理:
[🤖 @youtube_cho_bot]
[🤖 @learning_bot] 
[🤖 @health_bot]

[🔙 返回节点列表]
    """)

def demo_backup_management():
    """演示备份管理"""
    print("\n📦 演示: 点击 备份管理")
    print("=" * 40)
    
    print("🤖 Bot回复:")
    print("""
📦 **T440工作服务器 - 备份管理**

[🆕 创建新备份]
━━━━━━━━━━━━━━━━━━
📁 **最新备份 (最多显示3个)**:

🗂️ **backup-20260216-194523**
   ├── 大小: 45.2MB | 创建: 2小时前
   └── [🔄 还原] [📊 详情]

🗂️ **backup-20260216-120834**  
   ├── 大小: 44.8MB | 创建: 8小时前
   └── [🔄 还原] [📊 详情]

🗂️ **backup-20260215-235917**
   ├── 大小: 43.9MB | 创建: 昨天
   └── [🔄 还原] [📊 详情]

[🔙 返回节点详情]
    """)

def demo_bot_detail():
    """演示Bot详情"""
    print("\n🤖 演示: 点击 @youtube_cho_bot")
    print("=" * 40)
    
    print("🤖 Bot回复:")
    print("""
🤖 **@youtube_cho_bot**
状态: ✅ 运行中 | PID: 12345

📋 **Bot信息**:
├── Agent ID: youtube-cho
├── 内存使用: 234MB  
├── 运行时长: 2天15小时
└── 最后消息: 3分钟前

━━━━━━━━━━━━━━━━━━
[🔄 重启Bot] [📊 查看日志]
[⚠️ 删除Bot] [📦 Bot备份]

[🔙 返回节点详情]
    """)

def demo_ssh_test():
    """演示SSH连接测试"""
    print("\n🔗 演示: 实际SSH连接测试")
    print("=" * 40)
    
    ssh_manager = SSHConnectionManager()
    
    # 测试T440连接
    print("📍 测试T440服务器连接...")
    result = ssh_manager.test_connection("192.168.3.33", 22, "linou")
    if result['status'] == 'success':
        print("  ✅ SSH连接正常")
        
        # 检查OpenClaw状态
        openclaw_result = ssh_manager.check_openclaw_installation("192.168.3.33", 22, "linou")
        if openclaw_result['status'] == 'success':
            print(f"  🎯 OpenClaw版本: {openclaw_result['openclaw_version']}")
            print(f"  📊 服务状态: {openclaw_result['service_status']}")
            print(f"  🎮 综合状态: {openclaw_result['overall_status']}")
    else:
        print(f"  ❌ 连接失败: {result['message']}")

def demo_complete_workflow():
    """完整工作流演示"""
    print("\n🎯 完整工作流演示")
    print("=" * 50)
    
    print("👤 用户: 想要查看所有节点状态")
    demo_mynode()
    
    print("\n👤 用户: 点击T440工作服务器查看详情")
    demo_node_detail()
    
    print("\n👤 用户: 点击备份管理")
    demo_backup_management()
    
    print("\n👤 用户: 点击查看Bot详情")
    demo_bot_detail()
    
    print("\n🔗 后台: 实际SSH连接测试")
    demo_ssh_test()

def main():
    """主演示函数"""
    print("🎭 OCM CLI 功能演示")
    print("=" * 50)
    print("这是OCM CLI系统的完整功能演示")
    print("展示BotFather风格的Telegram界面交互")
    print("=" * 50)
    
    # 选择演示模式
    if len(sys.argv) > 1:
        mode = sys.argv[1]
        if mode == "newnode":
            demo_newnode()
        elif mode == "mynode":
            demo_mynode()
        elif mode == "detail":
            demo_node_detail()
        elif mode == "backup":
            demo_backup_management()
        elif mode == "bot":
            demo_bot_detail()
        elif mode == "ssh":
            demo_ssh_test()
        else:
            print("❌ 未知演示模式")
    else:
        # 完整演示
        demo_complete_workflow()
    
    print("\n🚀 实装状态:")
    print("  ✅ 数据库: 已初始化，3个节点")
    print("  ✅ SSH管理器: 已测试，2/3节点连接正常")
    print("  ✅ 备份引擎: 已实现，待测试")
    print("  ✅ Telegram界面: 已编码，待Bot Token")
    print("  ⏳ 需要配置: Telegram Bot Token")
    
    print("\n📝 下一步:")
    print("  1. 在BotFather创建Bot获取Token")
    print("  2. 编辑 config.py 设置Token")
    print("  3. 运行 ./start_ocm_cli.sh 启动服务")

if __name__ == "__main__":
    main()