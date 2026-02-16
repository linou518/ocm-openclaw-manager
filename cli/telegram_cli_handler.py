#!/usr/bin/env python3
"""
OCM CLI - Telegram命令行界面处理器
BotFather风格的简洁操作界面

作者: Joe (OpenClaw Manager)
创建: 2026-02-16
"""

import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes
import sqlite3
import json
from datetime import datetime
from pathlib import Path
import sys
import os

# 添加当前目录到Python路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from config import TELEGRAM_BOT_TOKEN, ADMIN_USER_IDS, DB_PATH, NODE_TEMPLATES, validate_config
from core.ssh_manager import SSHConnectionManager
from core.backup_engine import BackupEngine

# 配置日志
logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO)
logger = logging.getLogger(__name__)

class OCMTelegramCLI:
    def __init__(self, db_path=None):
        self.db_path = db_path or DB_PATH
        self.ssh_manager = SSHConnectionManager()
        self.backup_engine = BackupEngine(self.db_path)
        self.init_database()
    
    def is_admin(self, user_id: int) -> bool:
        """检查用户是否为管理员"""
        return user_id in ADMIN_USER_IDS
    
    def init_database(self):
        """初始化数据库表结构"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # 节点表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS nodes (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                host_ip TEXT NOT NULL,
                ssh_port INTEGER DEFAULT 22,
                ssh_user TEXT NOT NULL,
                openclaw_path TEXT DEFAULT '/usr/bin/openclaw',
                status TEXT DEFAULT 'active',
                created_at TEXT NOT NULL,
                last_check TEXT NOT NULL
            )
        ''')
        
        # 备份表
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
        
        conn.commit()
        conn.close()
    
    async def newnode_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """处理/newnode命令 - 添加新节点"""
        # 权限检查
        if not self.is_admin(update.effective_user.id):
            await update.message.reply_text("❌ 权限不足，仅管理员可使用此功能")
            return
            
        keyboard = [
            [InlineKeyboardButton("🆕 开始添加节点", callback_data="newnode_start")],
            [InlineKeyboardButton("📖 查看帮助", callback_data="newnode_help")]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        text = """
🖥️ **添加新OpenClaw节点**

点击下方按钮开始添加节点配置：
• 节点ID (英文标识)
• 节点名称 (中文显示)  
• 主机IP地址
• SSH端口和用户
• OpenClaw程序路径

系统将自动测试连接并注册节点。
        """
        
        await update.message.reply_text(text, reply_markup=reply_markup)
    
    async def mynode_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """处理/mynode命令 - 节点管理界面"""
        # 权限检查
        if not self.is_admin(update.effective_user.id):
            await update.message.reply_text("❌ 权限不足，仅管理员可使用此功能")
            return
            
        # 从数据库获取所有节点
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, host_ip, status FROM nodes ORDER BY created_at DESC")
        nodes = cursor.fetchall()
        conn.close()
        
        if not nodes:
            keyboard = [[InlineKeyboardButton("➕ 添加第一个节点", callback_data="newnode_start")]]
            reply_markup = InlineKeyboardMarkup(keyboard)
            await update.message.reply_text(
                "🖥️ **OCM节点管理**\n\n暂无已注册节点\n\n点击下方添加您的第一个OpenClaw节点:", 
                reply_markup=reply_markup
            )
            return
        
        # 构建节点列表键盘
        keyboard = []
        text = "🖥️ **OCM节点管理**\n\n"
        
        for node_id, name, host_ip, status in nodes:
            status_icon = "✅" if status == "active" else "❌"
            text += f"{status_icon} **{name}** ({host_ip})\n"
            keyboard.append([InlineKeyboardButton(
                f"{status_icon} {name}",
                callback_data=f"node_detail_{node_id}"
            )])
        
        keyboard.append([InlineKeyboardButton("➕ 添加新节点", callback_data="newnode_start")])
        keyboard.append([InlineKeyboardButton("🔄 刷新状态", callback_data="refresh_nodes")])
        
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_text(text, reply_markup=reply_markup)
    
    async def callback_handler(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """处理内联键盘回调"""
        query = update.callback_query
        
        # 权限检查
        if not self.is_admin(query.from_user.id):
            await query.answer("❌ 权限不足", show_alert=True)
            return
            
        await query.answer()
        
        data = query.data
        
        if data == "newnode_start":
            await self.start_newnode_wizard(query)
        elif data == "newnode_help":
            await self.show_newnode_help(query)
        elif data.startswith("node_detail_"):
            node_id = data.replace("node_detail_", "")
            await self.show_node_detail(query, node_id)
        elif data == "refresh_nodes":
            await self.refresh_node_status(query)
        elif data.startswith("backup_"):
            await self.handle_backup_operation(query, data)
        elif data.startswith("bot_"):
            await self.handle_bot_operation(query, data)
    
    async def start_newnode_wizard(self, query):
        """开始添加节点向导"""
        keyboard = [
            [InlineKeyboardButton("📝 手动输入", callback_data="newnode_manual")],
            [InlineKeyboardButton("🔧 快速配置", callback_data="newnode_quick")],
            [InlineKeyboardButton("🔙 返回", callback_data="back_main")]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        text = """
🆕 **添加节点方式**

**📝 手动输入**: 逐步输入完整配置
**🔧 快速配置**: 使用预设模板快速添加

选择您偏好的方式：
        """
        
        await query.edit_message_text(text, reply_markup=reply_markup)
    
    async def show_node_detail(self, query, node_id):
        """显示节点详情页面"""
        # 从数据库获取节点信息
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM nodes WHERE id = ?", (node_id,))
        node = cursor.fetchone()
        
        if not node:
            await query.edit_message_text("❌ 节点不存在或已被删除")
            return
        
        # 获取节点上的Bot列表 (模拟)
        bots = ["@Main_Joe_bot", "@customer_service_bot", "@book_review_bot"]  # 实际需要SSH检测
        
        # 构建详情页面
        text = f"""
🖥️ **{node[1]}** ({node[2]})
状态: ✅ 在线 | 最后检查: 2分钟前

🤖 **运行中的Bot ({len(bots)}个)**:
        """
        
        for bot in bots:
            text += f"├── {bot}\n"
        
        # 构建操作键盘
        keyboard = [
            [
                InlineKeyboardButton("📦 备份管理", callback_data=f"backup_list_{node_id}"),
                InlineKeyboardButton("🔄 重启节点", callback_data=f"restart_node_{node_id}")
            ],
            [
                InlineKeyboardButton("📊 系统状态", callback_data=f"status_{node_id}"),
                InlineKeyboardButton("📝 查看日志", callback_data=f"logs_{node_id}")
            ],
            [InlineKeyboardButton("🔙 返回节点列表", callback_data="back_nodelist")]
        ]
        
        # 添加Bot管理按钮
        for i, bot in enumerate(bots):
            keyboard.append([InlineKeyboardButton(
                f"🤖 {bot}",
                callback_data=f"bot_detail_{node_id}_{i}"
            )])
        
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.edit_message_text(text, reply_markup=reply_markup)
        conn.close()
    
    async def handle_backup_operation(self, query, data):
        """处理备份相关操作"""
        parts = data.split("_")
        operation = parts[1]
        node_id = parts[2] if len(parts) > 2 else None
        
        if operation == "list":
            await self.show_backup_list(query, node_id)
        elif operation == "create":
            await self.create_backup(query, node_id)
        elif operation == "restore":
            backup_name = parts[3] if len(parts) > 3 else None
            await self.restore_backup(query, node_id, backup_name)
    
    async def show_backup_list(self, query, node_id):
        """显示备份列表"""
        # 从数据库获取备份历史
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT backup_name, file_size, created_at 
            FROM backups 
            WHERE node_id = ? 
            ORDER BY created_at DESC 
            LIMIT 3
        """, (node_id,))
        backups = cursor.fetchall()
        conn.close()
        
        # 获取节点名称
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM nodes WHERE id = ?", (node_id,))
        node_name = cursor.fetchone()[0]
        conn.close()
        
        text = f"📦 **{node_name} - 备份管理**\n\n"
        
        keyboard = [
            [InlineKeyboardButton("🆕 创建新备份", callback_data=f"backup_create_{node_id}")]
        ]
        
        if backups:
            text += "📁 **最新备份 (最多显示3个)**:\n\n"
            for backup_name, file_size, created_at in backups:
                size_mb = file_size / (1024 * 1024)
                size_str = f"{size_mb:.1f}MB" if size_mb < 1024 else f"{size_mb/1024:.1f}GB"
                
                # 计算时间差
                created_time = datetime.fromisoformat(created_at)
                time_diff = datetime.now() - created_time
                if time_diff.days > 0:
                    time_str = f"{time_diff.days}天前"
                elif time_diff.seconds > 3600:
                    time_str = f"{time_diff.seconds//3600}小时前"
                else:
                    time_str = f"{time_diff.seconds//60}分钟前"
                
                text += f"🗂️ **{backup_name}**\n"
                text += f"   ├── 大小: {size_str} | 创建: {time_str}\n"
                text += f"   └── 🔄 还原 | 📊 详情\n\n"
                
                keyboard.append([
                    InlineKeyboardButton("🔄 还原", callback_data=f"backup_restore_{node_id}_{backup_name}"),
                    InlineKeyboardButton("📊 详情", callback_data=f"backup_info_{node_id}_{backup_name}")
                ])
        else:
            text += "📁 暂无备份记录\n\n点击上方按钮创建第一个备份"
        
        keyboard.append([InlineKeyboardButton("🔙 返回节点详情", callback_data=f"node_detail_{node_id}")])
        
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.edit_message_text(text, reply_markup=reply_markup)
    
    def run(self, token):
        """运行Telegram Bot"""
        app = Application.builder().token(token).build()
        
        # 注册命令处理器
        app.add_handler(CommandHandler("newnode", self.newnode_command))
        app.add_handler(CommandHandler("mynode", self.mynode_command))
        app.add_handler(CallbackQueryHandler(self.callback_handler))
        
        # 启动Bot
        logger.info("OCM CLI Bot starting...")
        app.run_polling()

if __name__ == "__main__":
    # 验证配置
    config_issues = validate_config()
    if config_issues:
        print("❌ 配置验证失败:")
        for issue in config_issues:
            print(f"  {issue}")
        print("\n📝 请修复配置问题后重新运行")
        sys.exit(1)
    
    print("✅ 配置验证通过，启动OCM CLI Bot...")
    print(f"📊 管理员用户: {ADMIN_USER_IDS}")
    print(f"🗄️ 数据库: {DB_PATH}")
    
    cli = OCMTelegramCLI()
    cli.run(TELEGRAM_BOT_TOKEN)