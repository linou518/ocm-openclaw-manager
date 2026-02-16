# OCM CLI - OpenClaw管理命令行界面

BotFather风格的简洁Telegram界面，用于管理OpenClaw节点和Bot。

## ✨ 功能特性

### 🖥️ 节点管理
- **添加节点**: `/newnode` - 引导式添加OpenClaw节点
- **节点列表**: `/mynode` - 查看和管理所有节点
- **状态监控**: 实时检查节点在线状态
- **远程重启**: 一键重启节点OpenClaw服务

### 📦 备份系统
- **完整备份**: 配置文件 + agents + workspace
- **增量备份**: 智能识别变化，节省空间
- **一键还原**: 从历史备份快速恢复
- **完整性校验**: MD5确保备份文件无损

### 🤖 Bot管理
- **Bot检测**: 自动识别节点上运行的Bot
- **状态监控**: 内存使用、运行时长、活动状态
- **重启控制**: 单独重启指定Bot
- **日志查看**: 实时查看Bot运行日志

### 🔐 安全特性
- **SSH密钥认证**: 支持密码和密钥两种认证方式
- **权限控制**: 管理员权限验证
- **操作日志**: 完整记录所有管理操作
- **安全确认**: 危险操作需要二次确认

## 🏗️ 架构设计

```
cli/
├── telegram_cli_handler.py     # 主控制器
├── commands/                   # 命令处理器
├── core/                      # 核心功能
│   ├── ssh_manager.py         # SSH连接管理
│   ├── backup_engine.py       # 备份恢复引擎
│   ├── node_monitor.py        # 节点监控
│   └── bot_detector.py        # Bot检测管理
├── utils/                     # 工具函数
└── templates/                 # 界面模板
```

## 🚀 快速开始

### 1. 环境准备
```bash
# 安装依赖
pip install python-telegram-bot paramiko

# 初始化数据库
cd /home/linou/shared/ocm-project/cli
python telegram_cli_handler.py --init-db
```

### 2. 配置Telegram Bot
```python
# 编辑 telegram_cli_handler.py
BOT_TOKEN = "YOUR_TELEGRAM_BOT_TOKEN"
```

### 3. 启动CLI服务
```bash
python telegram_cli_handler.py
```

### 4. 开始使用
在Telegram中发送:
- `/newnode` - 添加第一个节点
- `/mynode` - 管理现有节点

## 📋 命令参考

### 基础命令
| 命令 | 功能 | 描述 |
|------|------|------|
| `/newnode` | 添加节点 | 引导式添加OpenClaw节点配置 |
| `/mynode` | 节点管理 | 查看节点列表，进入管理界面 |

### 节点操作 (通过按钮界面)
- **📦 备份管理** - 创建/查看/还原节点备份
- **🔄 重启节点** - 远程重启OpenClaw服务
- **📊 系统状态** - 查看节点详细状态信息
- **📝 查看日志** - 实时查看系统日志

### Bot操作
- **🤖 Bot详情** - 查看Bot运行状态和资源使用
- **🔄 重启Bot** - 单独重启指定Bot
- **📋 Bot日志** - 查看Bot专用日志

## 🔧 配置说明

### 节点配置参数
```json
{
    "node_id": "pc-a-main",           // 节点唯一标识
    "node_name": "PC-A主机",          // 显示名称
    "host_ip": "192.168.3.73",        // 主机IP
    "ssh_port": 22,                   // SSH端口
    "ssh_user": "openclaw01",         // SSH用户名
    "openclaw_path": "/usr/bin/openclaw"  // OpenClaw程序路径
}
```

### 备份配置
- **备份目录**: `/home/linou/shared/ocm-project/backups/`
- **保留数量**: 默认显示最新3个备份
- **压缩格式**: tar.gz (支持增量压缩)
- **校验算法**: MD5

## 🛡️ 安全最佳实践

### SSH认证
```bash
# 推荐使用SSH密钥认证
ssh-keygen -t rsa -b 4096 -C "ocm-cli@yourdomain"
ssh-copy-id -p 22 user@host

# 或在配置中指定密钥路径
"ssh_key_path": "/path/to/your/private/key"
```

### 权限控制
```python
# 在telegram_cli_handler.py中配置管理员
ADMIN_USER_IDS = [12345678, 87654321]  # 允许的用户ID列表
```

### 网络安全
- 确保SSH服务配置安全
- 使用防火墙限制SSH访问来源
- 定期更新SSH密钥
- 启用SSH登录日志监控

## 📊 监控和告警

### 节点状态检查
- ✅ 在线: SSH连通 + OpenClaw服务运行 + 端口监听
- ❌ 离线: SSH连接失败或服务停止
- ⚠️ 异常: 部分功能异常，需要人工检查

### 自动告警
- 节点离线超过5分钟发送通知
- 备份失败立即发送告警
- 磁盘空间不足时提醒清理

## 🔄 备份策略

### 自动备份
```bash
# 添加cron任务 (可选)
0 2 * * * cd /home/linou/shared/ocm-project/cli && python backup_scheduler.py
```

### 手动备份
通过 `/mynode` → 选择节点 → 📦 备份管理 → 🆕 创建新备份

### 备份内容
- OpenClaw主配置 (`openclaw.json`)
- 认证配置 (`auth-profiles.json`)
- Agents配置目录 (排除日志和缓存)
- Workspace重要文件 (排除node_modules)

## 🐛 故障排除

### 常见问题

#### SSH连接失败
```bash
# 检查网络连通性
ping target_host

# 检查SSH服务状态
ssh -v user@host -p port
```

#### 备份失败
```bash
# 检查磁盘空间
df -h /home/linou/shared/ocm-project/backups

# 检查权限
ls -la ~/.ssh/
```

#### Bot无响应
- 检查Telegram Bot Token是否有效
- 确认Bot有发送消息权限
- 查看Python进程和端口占用

### 日志位置
- **CLI日志**: `/tmp/ocm-cli.log`
- **备份日志**: 每个备份的 `backup_info.json`
- **系统日志**: `journalctl --user -f`

## 🤝 贡献指南

### 开发环境
```bash
# 克隆代码库
git clone https://github.com/linou518/ocm-openclaw-manager.git
cd ocm-openclaw-manager/cli

# 安装开发依赖
pip install -r requirements-dev.txt
```

### 代码规范
- 遵循PEP 8编码规范
- 添加类型注解 (Type Hints)
- 编写单元测试
- 更新文档

### 提交规范
```
feat: 添加新功能
fix: 修复bug
docs: 更新文档
test: 添加测试
refactor: 代码重构
```

## 📄 许可证

MIT License - 详见 [LICENSE](../LICENSE) 文件

## 🙋 支持

- 📝 提交 [Issue](https://github.com/linou518/ocm-openclaw-manager/issues)
- 💬 讨论 [Discussions](https://github.com/linou518/ocm-openclaw-manager/discussions)
- 📧 邮件: linou518@hotmail.com