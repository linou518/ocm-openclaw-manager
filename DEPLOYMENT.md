# OCM 部署文档

## ✅ 已完成 (Phase 0-2)

### 1. 项目初始化
- ✅ package.json (server + client)
- ✅ 目录结构
- ✅ 依赖安装

### 2. 数据库
- ✅ SQLite schema (nodes, backups, scores, events)
- ✅ 初始化脚本
- ✅ Mock 数据生成

### 3. 后端 API (Express)
- ✅ `/api/dashboard` - Dashboard 全量数据
- ✅ `/api/nodes` - 节点列表
- ✅ `/api/nodes/:id` - 节点详情
- ✅ `/api/nodes/:id/backups` - 备份历史
- ✅ `/api/nodes/:id/scores` - 智力评分
- ✅ `/api/events` - 事件日志

### 4. 前端 (React + Vite + TailwindCSS)
- ✅ Dashboard 页面 (节点网格 + 概览统计)
- ✅ 节点列表页 (表格视图)
- ✅ 节点详情页 (状态 + 备份 + 智力评分 + 事件)
- ✅ NodeCard 组件 (状态可视化)
- ✅ iPhone 自适应 (< 480px)

### 5. Mock 数据
- ✅ 7台节点 (g3s-01~05, macmini-01~02)
- ✅ 随机 CPU/RAM/状态
- ✅ 智力评分 70-98
- ✅ 备份历史 (每节点5条)
- ✅ 事件日志 (10条)

## 🚀 启动服务

```bash
# 1. 确保数据库已初始化
cd ~/.openclaw/ws-ocm/ocm
npm run init-db
npm run seed

# 2. 确保前端已构建
cd client
npm run build

# 3. 启动服务器
cd ..
npm start
```

访问: http://localhost:3001

## 📱 测试端点

```bash
# Dashboard 数据
curl http://localhost:3001/api/dashboard | jq

# 节点列表
curl http://localhost:3001/api/nodes | jq

# 节点详情
curl http://localhost:3001/api/nodes/g3s-01 | jq
```

## 🔧 开发模式

```bash
# Terminal 1: 后端
cd ~/.openclaw/ws-ocm/ocm
npm run dev

# Terminal 2: 前端
cd ~/.openclaw/ws-ocm/ocm/client
npm run dev
```

前端开发服务器: http://localhost:5173

## 📦 生产部署

### 使用 PM2

```bash
cd ~/.openclaw/ws-ocm/ocm
npm install -g pm2
pm2 start server/index.js --name ocm
pm2 save
pm2 startup
```

### 使用 systemd

创建 `/etc/systemd/system/ocm.service`:

```ini
[Unit]
Description=OCM Server
After=network.target

[Service]
Type=simple
User=ocm
WorkingDirectory=/home/ocm/.openclaw/ws-ocm/ocm
ExecStart=/usr/bin/node server/index.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

启动:
```bash
sudo systemctl enable ocm
sudo systemctl start ocm
```

## 📋 下一步 (Phase 3+)

- [ ] SSH 连接池
- [ ] 节点 agent 脚本
- [ ] Git 备份 (GitHub)
- [ ] 智力评估系统
- [ ] 自动回滚
- [ ] Telegram 告警
- [ ] WebSocket 实时推送
- [ ] Web SSH 终端

## 🔒 安全注意事项

- [ ] 添加身份验证 (JWT/Session)
- [ ] 配置 HTTPS
- [ ] 限制 API 访问 (内网 only)
- [ ] SSH key 管理
- [ ] 环境变量加密

## 🐛 已知问题

- Dashboard 每10秒轮询（未来改为 WebSocket）
- 节点状态为 Mock 数据（需集成真实 SSH 连接）
- 无权限管理（未来添加多用户支持）

## 📞 维护

### 重置数据库
```bash
cd ~/.openclaw/ws-ocm/ocm
rm server/db/ocm.db
npm run init-db
npm run seed
```

### 查看日志
```bash
# PM2
pm2 logs ocm

# systemd
journalctl -u ocm -f
```

### 备份数据库
```bash
cp server/db/ocm.db server/db/ocm.db.backup
```
