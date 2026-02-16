# OCM - OpenClaw Cluster Manager

🚀 **简洁高效的OpenClaw集群管理系统**

基于BotFather设计理念，提供Web界面和CLI命令行两种管理方式，让OpenClaw节点和Bot管理变得简单。

## ✨ 核心功能

### 🖥️ 节点管理
- **一键添加** - 自动检测和配置OpenClaw节点
- **实时监控** - 节点状态、资源使用、连接健康
- **远程控制** - 重启服务、查看日志、执行命令
- **批量操作** - 同时管理多个节点

### 🤖 Bot管理  
- **智能识别** - 自动发现节点上的AI助理
- **个性定制** - 🎭 Bot身份配置，🔑 订阅token管理
- **状态监控** - 运行状态、内存使用、消息统计
- **生命周期** - 创建、配置、重启、删除Bot

### 📦 备份恢复
- **完整备份** - 配置、代码、数据全量备份
- **增量备份** - 智能识别变化，节省存储空间  
- **一键恢复** - 历史版本快速回滚
- **跨节点迁移** - 配置在不同服务器间迁移

### 🔐 安全特性
- **SSH密钥** - 安全的远程连接认证
- **权限控制** - 分级管理，操作审计
- **数据加密** - 敏感信息加密存储
- **操作日志** - 完整的操作追踪记录

## 🏗️ 系统架构

```
OCM系统
├── Web界面 (React + Node.js)
│   ├── 节点管理面板
│   ├── Bot配置界面  
│   ├── 备份恢复控制台
│   └── 系统监控仪表板
│
├── CLI界面 (Python + Telegram)
│   ├── /newnode - 添加节点
│   ├── /mynode - 节点管理
│   └── BotFather风格操作
│
└── 核心引擎
    ├── SSH连接管理
    ├── 备份恢复引擎
    ├── 节点状态监控
    └── Bot检测控制
```

## 🚀 快速开始

### 方式一: Web界面
```bash
# 启动OCM服务
cd /home/linou/shared/ocm-project/server
npm start

# 访问 http://192.168.3.33:8001
```

### 方式二: Telegram CLI
```bash  
# 启动CLI服务
cd /home/linou/shared/ocm-project/cli
python telegram_cli_handler.py

# 在Telegram中发送 /newnode 开始使用
```

## 📋 使用指南

### 添加第一个节点

#### Web界面操作
1. 访问 http://192.168.3.33:8001
2. 点击 "➕ 添加节点"
3. 填写节点信息:
   - 节点ID: `pc-a-main`
   - 节点名称: `PC-A主机`
   - 主机IP: `192.168.3.73`
   - SSH用户: `openclaw01`
4. 点击 "测试连接" → "保存节点"

#### CLI操作
1. 发送 `/newnode` 到Telegram Bot
2. 选择 "📝 手动输入"
3. 按提示逐步填写配置
4. 系统自动测试并注册节点

### 创建备份
- **Web**: 节点详情页 → "📦 创建备份"
- **CLI**: `/mynode` → 选择节点 → "📦 备份管理" → "🆕 创建新备份"

### 管理Bot
- 系统自动检测节点上的OpenClaw agents
- 支持单独重启、查看日志、配置管理
- 可创建新Bot并自动部署到指定节点

## 🛠️ 技术栈

### 后端
- **Node.js + Express** - Web服务框架
- **Python + Paramiko** - SSH连接和自动化
- **SQLite** - 轻量级数据存储
- **Telegram Bot API** - CLI界面支持

### 前端  
- **React + Vite** - 现代化Web界面
- **Tailwind CSS** - 响应式设计
- **Socket.io** - 实时状态更新

### 基础设施
- **SSH密钥认证** - 安全的节点连接
- **Systemd服务** - 后台服务管理
- **Nginx反向代理** - 生产环境部署
- **备份调度** - Cron定时任务

## 📦 部署指南

### 开发环境
```bash
# 克隆仓库
git clone https://github.com/linou518/ocm-openclaw-manager.git
cd ocm-openclaw-manager

# 安装依赖
npm install
pip install -r requirements.txt

# 启动开发服务器
npm run dev  # Web界面
python cli/telegram_cli_handler.py  # CLI服务
```

### 生产环境
```bash
# 构建前端
npm run build

# 配置系统服务
sudo cp deploy/ocm-web.service /etc/systemd/system/
sudo cp deploy/ocm-cli.service /etc/systemd/system/
sudo systemctl enable ocm-web ocm-cli

# 启动服务
sudo systemctl start ocm-web ocm-cli
```

## 🔧 配置参考

### 环境变量
```bash
# .env 文件
OCM_DB_PATH=/home/linou/shared/ocm-project/ocm.db
OCM_BACKUP_DIR=/home/linou/shared/ocm-project/backups
TELEGRAM_BOT_TOKEN=your_bot_token_here
ADMIN_USER_IDS=12345678,87654321
```

### SSH配置
```bash
# 生成SSH密钥
ssh-keygen -t rsa -b 4096 -C "ocm@yourdomain"

# 分发到目标节点
ssh-copy-id -p 22 user@host
```

## 📊 监控和维护

### 系统监控
- **节点状态**: 实时显示在线/离线状态
- **资源使用**: CPU、内存、磁盘使用情况  
- **网络健康**: SSH连接、端口监听状态
- **服务状态**: OpenClaw Gateway运行状况

### 备份策略
- **自动备份**: 每日凌晨2点自动备份所有节点
- **增量备份**: 只备份变化的文件，节省空间
- **保留策略**: 保留最近30天的备份
- **异地备份**: 支持上传到云存储

### 告警机制
- **节点离线**: 超过5分钟发送Telegram通知
- **备份失败**: 立即发送告警消息
- **磁盘空间**: 使用率超过85%时提醒
- **异常错误**: 系统异常自动收集和上报

## 🤝 贡献指南

### 开发规范
- 遵循 [Conventional Commits](https://conventionalcommits.org/) 提交规范
- 使用 TypeScript (前端) 和 Python Type Hints (后端)
- 编写单元测试和集成测试
- 更新相关文档

### 提交类型
```
feat: 新功能
fix: Bug修复  
docs: 文档更新
test: 测试相关
refactor: 代码重构
perf: 性能优化
style: 代码格式
ci: CI/CD相关
```

### 开发流程
1. Fork 仓库并创建feature分支
2. 开发新功能并编写测试
3. 确保所有测试通过
4. 提交PR并描述变更内容

## 🐛 问题反馈

### 常见问题
- [FAQ文档](docs/FAQ.md)
- [故障排除指南](docs/troubleshooting.md)
- [性能优化建议](docs/performance.md)

### 获取帮助
- 📝 [提交Issue](https://github.com/linou518/ocm-openclaw-manager/issues)
- 💬 [讨论区](https://github.com/linou518/ocm-openclaw-manager/discussions)  
- 📧 邮件: linou518@hotmail.com
- 💬 Telegram: @linou518

## 📜 更新日志

### v1.0.0 (2026-02-16)
- ✨ 初始版本发布
- 🎯 Web界面和CLI双模式支持
- 📦 完整的备份恢复系统
- 🤖 智能Bot管理功能
- 🔐 安全的SSH连接管理

### 路线图
- [ ] 集群负载均衡
- [ ] 容器化部署支持
- [ ] 多租户管理
- [ ] API接口开放
- [ ] 移动端App

## 📄 许可证

[MIT License](LICENSE) - 自由使用，商业友好

## 🌟 致谢

感谢以下项目和技术:
- [OpenClaw](https://openclaw.ai) - 强大的AI助理平台
- [React](https://reactjs.org) - 用户界面库
- [Telegram Bot API](https://core.telegram.org/bots/api) - 便捷的Bot接口
- [Paramiko](https://www.paramiko.org) - Python SSH库

---

**让OpenClaw管理变得简单高效！** 🚀