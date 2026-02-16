# OCM - OpenClaw Cluster Manager

管理多台 OpenClaw 节点的 Web 应用。支持节点监控、Git 备份、智力评估、自动回滚。

## 功能特性 (Phase 2 Complete)

### ✅ 已完成
- ✅ **Dashboard** - 节点网格 + 概览统计 + 智力趋势图 + 事件日志
- ✅ **节点管理** - 列表页 + 详情页（4 Tab: 概览/备份/智力/事件）
- ✅ **备份管理** - 全集群备份列表 + 筛选 + 一键备份
- ✅ **智力评分** - 集群雷达图 + 节点对比 + 历史趋势
- ✅ **事件日志** - 全局事件 + 严重程度筛选
- ✅ **设置页面** - GitHub/告警/智力测试配置（预留）
- ✅ **左侧导航栏** - 桌面端侧边栏 + 移动端底部导航
- ✅ **iPhone 适配** - 单列布局 + 9px 字体 + 安全区域
- ✅ **图表可视化** - Recharts（折线图 + 雷达图）

### 🚧 开发中 (Phase 3+)
- [ ] SSH 连接 + 节点 agent
- [ ] Git 备份系统 (GitHub)
- [ ] 智力评估系统（实际测试逻辑）
- [ ] 自动回滚 + 告警通知
- [ ] Web SSH 终端
- [ ] 费用追踪

## 技术栈

| 层 | 技术 |
|----|------|
| **后端** | Node.js + Express + better-sqlite3 |
| **前端** | React 18 + Vite + TailwindCSS |
| **图表** | Recharts |
| **路由** | react-router-dom |
| **数据库** | SQLite3 |
| **端口** | 3001 |

## 快速开始

### 安装

```bash
# 1. 安装依赖
cd ~/.openclaw/ws-ocm/ocm
npm install

cd client
npm install

# 2. 初始化数据库
cd ..
npm run init-db

# 3. 插入 Mock 数据
npm run seed

# 4. 构建前端
cd client
npm run build

# 5. 启动服务器
cd ..
npm start
```

### 访问

打开浏览器访问: **http://localhost:3001**

### 页面导航
- `/` - Dashboard
- `/nodes` - 节点列表
- `/nodes/:id` - 节点详情
- `/backups` - 备份管理
- `/scores` - 智力评分
- `/events` - 事件日志
- `/settings` - 设置

## 开发模式

```bash
# Terminal 1: 启动后端
npm run dev

# Terminal 2: 启动前端开发服务器
cd client
npm run dev
```

前端开发服务器: http://localhost:5173 (自动代理 API 到 3001)

## 目录结构

```
ocm/
├── package.json
├── server/
│   ├── index.js              ← Express 服务器
│   ├── db/
│   │   ├── schema.sql        ← 数据库 schema
│   │   ├── init-db.js        ← 初始化脚本
│   │   ├── seed-mock.js      ← Mock 数据（5维度智力评分）
│   │   └── ocm.db            ← SQLite 数据库
│   ├── routes/               (待扩展)
│   └── services/             (待扩展)
├── client/
│   ├── package.json
│   ├── vite.config.js
│   ├── src/
│   │   ├── App.jsx           ← 路由 + 导航栏
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx    ← 主页（趋势图）
│   │   │   ├── Nodes.jsx        ← 节点列表
│   │   │   ├── NodeDetail.jsx   ← 节点详情
│   │   │   ├── Backups.jsx      ← 备份管理
│   │   │   ├── Scores.jsx       ← 智力评分（雷达图）
│   │   │   ├── Events.jsx       ← 事件日志
│   │   │   └── Settings.jsx     ← 设置
│   │   └── components/
│   │       └── NodeCard.jsx     ← 节点卡片
│   └── dist/                 ← 构建输出
├── README.md
├── PHASE2-REPORT.md          ← Phase 2 完成报告
└── ocm-design.md             ← 完整设计文档
```

## API 端点

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/dashboard` | GET | Dashboard 全量数据（含趋势图） |
| `/api/nodes` | GET | 节点列表 |
| `/api/nodes/:id` | GET | 节点详情 + 备份 + 评分 + 事件 |
| `/api/nodes/:id/backups` | GET | 节点备份历史 |
| `/api/nodes/:id/scores` | GET | 节点智力评分历史 |
| `/api/backups` | GET | 全集群备份列表 |
| `/api/scores/all` | GET | 全集群智力评分历史 |
| `/api/events` | GET | 事件日志 |

## Mock 数据说明

### 节点 (7台)
- **g3s-01~05** - G3S N95 小主机（5台，全部在线）
- **macmini-01** - Mac Mini 主力（在线）
- **macmini-02** - Mac Mini 备用（离线）

### 智力评分（5维度）
- **记忆一致性** (0-20)
- **逻辑推理** (0-20)
- **工具使用** (0-20)
- **回复质量** (0-20)
- **人格一致性** (0-20)

每个节点：
- 10 条历史记录（每 12 小时一次）
- 基准分数不同（强弱项）
- 每次有小波动 (-3 到 +3)
- 基准分数缓慢变化（模拟长期趋势）

### 备份历史
- 每节点 5 条记录（每 6 小时一次）
- 包含：git_commit, score, is_stable, file_count, total_size

### 事件日志
- 10 条混合事件
- 类型：backup, alert, score, config
- 严重程度：info, warn, error, critical

## 数据库 Schema

### nodes 表
```sql
id, name, host, port, ssh_user, openclaw_path, status, 
cpu_usage, ram_usage, disk_usage, openclaw_version, 
last_seen_at, last_backup_at, last_score, last_score_at
```

### backups 表
```sql
id, node_id, git_commit, git_tag, type, score, is_stable, 
file_count, total_size, created_at
```

### scores 表
```sql
id, node_id, total_score, 
memory_score, logic_score, tool_score, quality_score, personality_score,
action_taken, created_at
```

### events 表
```sql
id, node_id, type, severity, message, created_at
```

## 管理命令

```bash
# 重新生成 Mock 数据
npm run seed

# 重新初始化数据库（清空所有数据）
npm run init-db

# 启动服务器
npm start

# 开发模式
npm run dev

# 构建前端
cd client && npm run build
```

## iPhone 适配规范

### 响应式断点
- **Desktop:** > 1024px (侧边栏 + 宽布局)
- **Tablet:** 768-1024px (收窄布局)
- **iPhone:** < 480px (单列 + 底部导航)

### iPhone 优化
- ✅ 节点网格改单列
- ✅ 底部导航只显示图标（9px 文字）
- ✅ 字体缩小（h1: 1.5rem, h2: 1.125rem, 表格: 11px）
- ✅ 间距紧凑（space-y-6 → 1rem）
- ✅ 安全区域底部间距

## 开发进度

| Phase | 内容 | 状态 |
|-------|------|------|
| **Phase 0** | 项目初始化 + DB | ✅ 100% |
| **Phase 1** | 基础 UI（Dashboard + 节点） | ✅ 100% |
| **Phase 2** | 迭代改善（导航 + 图表 + 5页面） | ✅ 100% |
| **Phase 3** | Git 备份系统 | 🚧 待开发 |
| **Phase 4** | 还原系统 + diff | 🚧 待开发 |
| **Phase 5** | 智力评估系统 | 🚧 待开发 |
| **Phase 6** | 自动回滚 + 告警 | 🚧 待开发 |
| **Phase 7** | 一键安装 | 🚧 待开发 |
| **Phase 8** | 费用追踪 + Web 终端 | 🚧 待开发 |
| **Phase 9** | 美化 + 移动端优化 | 🚧 待开发 |

---

## 相关文档

- **PHASE2-REPORT.md** - Phase 2 完成报告
- **ocm-design.md** - 完整设计文档（v0.5）
- **DEPLOYMENT.md** - 部署文档

## License

MIT
