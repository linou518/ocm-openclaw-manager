#!/usr/bin/env python3
"""
OCM CLI 配置文件
存储Telegram Bot Token和其他配置信息
"""

import os
from pathlib import Path

# Telegram Bot 配置
# 请在BotFather创建新的Bot并获取Token
# 命令: /newbot -> @OCM_Manager_bot -> 获取Token
TELEGRAM_BOT_TOKEN = os.environ.get("OCM_BOT_TOKEN", "YOUR_BOT_TOKEN_HERE")

# 管理员用户ID列表 (Telegram用户ID)
ADMIN_USER_IDS = [7996447774]  # Linou的用户ID

# 数据库路径
DB_PATH = "/home/linou/shared/ocm-project/ocm.db"

# 备份目录
BACKUP_BASE_DIR = "/home/linou/shared/ocm-project/backups"

# SSH配置
DEFAULT_SSH_PORT = 22
SSH_TIMEOUT = 10

# 节点配置模板
NODE_TEMPLATES = {
    "pc-a-main": {
        "name": "PC-A主机",
        "host_ip": "192.168.3.73",
        "ssh_user": "openclaw01",
        "openclaw_path": "/usr/bin/openclaw"
    },
    "t440-work": {
        "name": "T440工作服务器", 
        "host_ip": "192.168.3.33",
        "ssh_user": "linou",
        "openclaw_path": "/usr/bin/openclaw"
    },
    "baota-server": {
        "name": "Baota服务器",
        "host_ip": "192.168.3.11", 
        "ssh_user": "linou",
        "openclaw_path": "/usr/bin/openclaw"
    }
}

# 日志配置
LOG_LEVEL = "INFO"
LOG_FILE = "/tmp/ocm-cli.log"

# 界面配置
MAX_BACKUP_DISPLAY = 3  # 最多显示的备份数量
OPERATION_TIMEOUT = 30  # 操作超时时间（秒）

def validate_config():
    """验证配置是否正确"""
    issues = []
    
    if TELEGRAM_BOT_TOKEN == "YOUR_BOT_TOKEN_HERE":
        issues.append("❌ 请设置正确的Telegram Bot Token")
    
    if not ADMIN_USER_IDS:
        issues.append("❌ 请设置至少一个管理员用户ID")
    
    db_dir = Path(DB_PATH).parent
    if not db_dir.exists():
        issues.append(f"❌ 数据库目录不存在: {db_dir}")
    
    backup_dir = Path(BACKUP_BASE_DIR)
    if not backup_dir.exists():
        try:
            backup_dir.mkdir(parents=True, exist_ok=True)
            print(f"✅ 创建备份目录: {backup_dir}")
        except Exception as e:
            issues.append(f"❌ 无法创建备份目录: {e}")
    
    return issues

if __name__ == "__main__":
    print("🔧 OCM CLI 配置验证")
    issues = validate_config()
    
    if issues:
        print("\n⚠️ 配置问题:")
        for issue in issues:
            print(f"  {issue}")
        print("\n📝 请修复上述问题后重新运行")
    else:
        print("\n✅ 配置验证通过!")
        print(f"  - Bot Token: {'✅ 已设置' if TELEGRAM_BOT_TOKEN != 'YOUR_BOT_TOKEN_HERE' else '❌ 未设置'}")
        print(f"  - 管理员: {len(ADMIN_USER_IDS)}个用户")
        print(f"  - 数据库: {DB_PATH}")
        print(f"  - 备份目录: {BACKUP_BASE_DIR}")
        print(f"  - 节点模板: {len(NODE_TEMPLATES)}个")