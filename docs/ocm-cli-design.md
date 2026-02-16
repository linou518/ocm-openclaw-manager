# OCM CLI系统设计文档

## 🎯 系统概述
基于Telegram内联按钮的OCM命令行界面，实现简洁的节点和Bot管理功能

## 📋 核心命令设计

### 1. `/newnode` - 添加节点
**触发**: 用户发送 `/newnode`
**流程**: 
```
步骤1: 收集节点信息 (内联表单)
├── 节点ID (英文，唯一标识)
├── 节点名称 (中文显示名)
├── 主机IP (如: 192.168.3.17)
├── SSH端口 (默认: 22)
├── SSH用户 (如: openclaw01)
└── OpenClaw路径 (默认: /usr/bin/openclaw)

步骤2: 连接测试
├── SSH连通性测试
├── OpenClaw程序检查
└── 目录权限验证

步骤3: 节点注册
├── 保存到数据库
├── 创建备份目录
└── 返回成功/失败状态
```

**所需脚本**:
- `ssh_connectivity_test.py` - SSH连接测试
- `openclaw_presence_check.py` - OpenClaw程序检查
- `node_registration.py` - 节点数据库注册

### 2. `/mynode` - 节点管理主界面
**触发**: 用户发送 `/mynode`
**界面**: 
```
🖥️ OCM节点管理

【PC-A主机】 ✅
【T440工作服务器】 ✅  
【Baota服务器】 ❌

━━━━━━━━━━━━━━━━━━
➕ 添加新节点
```

**点击节点后显示**:
```
🖥️ PC-A主机 (192.168.3.73)
状态: ✅ 在线 | 最后检查: 2分钟前

🤖 运行中的Bot (3个):
├── @Main_Joe_bot
├── @customer_service_bot  
└── @book_review_bot

━━━━━━━━━━━━━━━━━━
📦 备份管理 | 🔄 重启节点
```

**所需脚本**:
- `node_status_check.py` - 节点状态实时检查
- `bot_list_detector.py` - 扫描节点上的Bot列表
- `node_health_monitor.py` - 健康状态监控

### 3. 备份管理功能
**点击"📦 备份管理"后**:
```
📦 PC-A主机 - 备份管理

🆕 创建新备份
━━━━━━━━━━━━━━━━━━
📁 最新备份 (最多显示3个):

🗂️ backup-20260216-194523
   ├── 大小: 45.2MB | 创建: 2小时前
   └── 🔄 还原 | 📊 详情

🗂️ backup-20260216-120834  
   ├── 大小: 44.8MB | 创建: 8小时前
   └── 🔄 还原 | 📊 详情

🗂️ backup-20260215-235917
   ├── 大小: 43.9MB | 创建: 昨天
   └── 🔄 还原 | 📊 详情
```

**所需脚本**:
- `create_node_backup.py` - 创建节点完整备份
- `list_node_backups.py` - 列出节点备份历史
- `restore_node_backup.py` - 从备份还原节点
- `backup_size_calculator.py` - 计算备份文件大小

### 4. Bot级别操作
**点击具体Bot后**:
```
🤖 @Main_Joe_bot
状态: ✅ 运行中 | PID: 12345

📋 Bot信息:
├── Agent ID: main
├── 内存使用: 234MB  
├── 运行时长: 2天15小时
└── 最后消息: 3分钟前

━━━━━━━━━━━━━━━━━━
🔄 重启Bot | 📊 查看日志
⚠️ 删除Bot | 📦 Bot备份
```

**所需脚本**:
- `bot_status_monitor.py` - Bot运行状态检查
- `bot_restart_manager.py` - Bot重启控制
- `bot_log_viewer.py` - Bot日志查看
- `bot_backup_manager.py` - Bot级别备份/还原

## 🔧 技术实现架构

### A. Telegram Bot集成
**文件**: `telegram_cli_handler.py`
**功能**:
- 命令解析和路由
- 内联键盘生成和管理
- 回调数据处理和状态管理
- 用户权限验证

### B. SSH连接管理
**文件**: `ssh_connection_manager.py`
**功能**:
- SSH连接池管理
- 认证信息安全存储
- 连接超时和重试机制
- 并发连接控制

### C. 备份系统核心
**文件**: `backup_engine.py`
**功能**:
- 增量备份算法
- 压缩和加密
- 备份完整性校验
- 自动清理过期备份

### D. 数据库层
**文件**: `ocm_database.py`
**功能**:
- 节点信息存储
- 备份记录管理
- 操作历史日志
- 用户权限管理

## 📦 文件结构设计
```
/home/linou/shared/ocm-project/cli/
├── telegram_cli_handler.py      # Telegram集成主控制器
├── commands/
│   ├── newnode_handler.py       # /newnode命令处理
│   ├── mynode_handler.py        # /mynode命令处理
│   ├── backup_handler.py        # 备份操作处理
│   └── bot_handler.py           # Bot操作处理
├── core/
│   ├── ssh_manager.py           # SSH连接管理
│   ├── backup_engine.py         # 备份核心引擎
│   ├── node_monitor.py          # 节点监控
│   └── bot_detector.py          # Bot检测和管理
├── utils/
│   ├── database.py              # 数据库操作
│   ├── security.py              # 安全认证
│   └── config.py                # 配置管理
└── templates/
    ├── node_keyboards.py        # 节点操作键盘模板
    └── backup_keyboards.py      # 备份操作键盘模板
```

## 🚀 部署和集成计划

### 1. 添加到现有OCM系统
- 在现有OCM项目中添加 `cli/` 目录
- 与Web界面共享数据库和核心功能
- 通过环境变量控制CLI功能开关

### 2. Telegram Bot配置
- 复用现有的Telegram配置
- 添加CLI命令到Bot菜单
- 设置管理员权限控制

### 3. GitHub集成
- 所有代码纳入现有的ocm-openclaw-manager仓库
- 建立独立的CLI分支进行开发
- 制定CLI功能的测试和部署流程

## 💡 用户体验优化建议

### A. 状态指示优化
- ✅ 在线 ❌ 离线 ⚠️ 异常 🔄 重启中 📦 备份中
- 实时状态更新，避免过时信息

### B. 操作反馈增强
- 进度条显示长时间操作
- 操作成功/失败的明确提示
- 错误信息的用户友好显示

### C. 快捷操作支持
- 常用操作的快捷按钮
- 批量操作功能 (批量重启、批量备份)
- 操作历史记录和撤销

### D. 安全控制
- 危险操作二次确认
- 操作权限分级控制
- 操作日志完整记录