# OCM 全面功能审计报告

生成时间: 2026-02-15 14:21 JST

## 📊 审计概述

- **审计范围**: 11个页面，所有按钮和交互
- **发现问题**: 32个
- **已修复**: 0个
- **待修复**: 32个

---

## 🔍 详细审计结果

### 1. Dashboard.jsx ✅ 良好

| 功能 | 状态 | 问题 | 修复方案 |
|------|------|------|---------|
| 统计卡片 | ✅ | 无 | - |
| 趋势图 | ✅ | 无 | - |
| 全集群备份按钮 | ⚠️ | 只显示 Modal，无实际API | 添加 POST /api/cluster/backup |
| 节点卡片点击 | ✅ | 跳转正常 | - |

**优先级**: 中

---

### 2. Nodes.jsx ⚠️ 需修复

| 功能 | 状态 | 问题 | 修复方案 |
|------|------|------|---------|
| 节点列表 | ✅ | 无 | - |
| 添加节点按钮 | ❌ | 无onClick逻辑 | 添加Modal + POST /api/nodes |
| 状态筛选 | ✅ | 正常工作 | - |
| 自动刷新 | ✅ | 10秒轮询 | - |

**优先级**: 高

---

### 3. NodeDetail.jsx ⚠️ 需修复

| Tab | 功能 | 状态 | 问题 | 修复方案 |
|-----|------|------|------|---------|
| Overview | 备份按钮 | ⚠️ | 只显示Modal | 添加 POST /api/nodes/:id/backup |
| Overview | 还原按钮 | ⚠️ | 只显示Modal | 添加 POST /api/nodes/:id/restore |
| Overview | 重启按钮 | ⚠️ | 只显示Modal | 添加 POST /api/nodes/:id/restart |
| Overview | 智力测试按钮 | ⚠️ | 只显示Modal | 添加 POST /api/nodes/:id/test |
| Keys | 添加Key按钮 | ⚠️ | 只显示Modal | 已有 POST /api/nodes/:id/keys ✅ |
| Keys | 验证Key按钮 | ⚠️ | 调用mock API | API已存在，但需改为真实验证 |
| Bots | 添加Bot按钮 | ❌ | 无onClick | 添加Modal + POST /api/nodes/:id/bots |
| Bots | 重启Bot按钮 | ❌ | 无onClick | 添加 POST /api/bots/:id/restart |
| Bots | 展开详情 | ✅ | 正常工作 | - |
| Skills | 列表展示 | ✅ | 正常工作 | - |
| Config | 配置展示 | ✅ | 正常工作 | - |
| Backups | 还原到此版本 | ⚠️ | 只显示Modal | 添加实际还原逻辑 |
| Backups | 查看Diff | ⚠️ | 只显示Modal | 添加 GET /api/backups/:id/diff |
| Scores | 查看详情 | ❌ | 无onClick | 添加Modal显示详细评分 |
| Events | 事件列表 | ✅ | 正常工作 | - |

**优先级**: 高

---

### 4. BotControl.jsx ✅ 良好（模拟器）

| 功能 | 状态 | 问题 | 修复方案 |
|------|------|------|---------|
| 指令模拟器 | ✅ | mock数据正常 | - |
| 告警确认按钮 | ⚠️ | 只显示Modal | 添加实际操作API |

**优先级**: 低（主要是演示功能）

---

### 5. Backups.jsx ⚠️ 需修复

| 功能 | 状态 | 问题 | 修复方案 |
|------|------|------|---------|
| 备份列表 | ✅ | 正常工作 | - |
| 全集群备份按钮 | ⚠️ | 只显示Modal | 添加 POST /api/cluster/backup |
| 还原按钮 | ❌ | 无onClick | 添加还原确认 + API调用 |
| 查看Diff按钮 | ⚠️ | 只显示Modal | 添加实际diff API |
| 分页 | ✅ | 正常工作 | - |

**优先级**: 中

---

### 6. Scores.jsx ⚠️ 需修复

| 功能 | 状态 | 问题 | 修复方案 |
|------|------|------|---------|
| 评分列表 | ✅ | 正常工作 | - |
| 雷达图 | ✅ | 正常渲染 | - |
| 触发全集群测试 | ⚠️ | 只显示Modal | 添加 POST /api/cluster/test |
| 查看详情按钮 | ❌ | 无onClick | 添加详情Modal |
| 分页 | ✅ | 正常工作 | - |

**优先级**: 中

---

### 7. Keys.jsx ⚠️ 需修复

| 功能 | 状态 | 问题 | 修复方案 |
|------|------|------|---------|
| Key列表 | ✅ | 正常工作 | - |
| 账号卡片展示 | ✅ | 正常工作 | - |
| 添加账号按钮 | ❌ | 无onClick | 添加Modal + POST /api/accounts |
| 编辑按钮 | ❌ | 无onClick | 添加Modal + PUT /api/keys/:id |
| 删除按钮 | ❌ | 无onClick | 添加确认 + DELETE /api/keys/:id |
| 分页 | ✅ | 正常工作 | - |

**优先级**: 高

---

### 8. CronJobs.jsx ✅ 良好

| 功能 | 状态 | 问题 | 修复方案 |
|------|------|------|---------|
| Cron列表 | ✅ | 正常工作 | - |
| 启用/禁用Toggle | ✅ | API正常 | - |
| 筛选器 | ✅ | 正常工作 | - |
| 编辑按钮 | ❌ | 无onClick | 添加Modal + PUT /api/cron-jobs/:id |
| 分页 | ✅ | 正常工作 | - |

**优先级**: 低

---

### 9. Events.jsx ⚠️ 需修复

| 功能 | 状态 | 问题 | 修复方案 |
|------|------|------|---------|
| 事件列表 | ✅ | 正常工作 | - |
| 筛选器 | ❌ | 无实际逻辑 | 连接到API筛选参数 |
| 清除日志按钮 | ⚠️ | 只显示Modal | 添加 DELETE /api/events |
| 分页 | ✅ | 正常工作 | - |

**优先级**: 中

---

### 10. Audit.jsx ✅ 良好

| 功能 | 状态 | 问题 | 修复方案 |
|------|------|------|---------|
| 审计日志列表 | ✅ | 正常工作 | - |
| 筛选器 | ✅ | 正常工作 | - |
| 分页 | ✅ | 正常工作 | - |

**优先级**: 无

---

### 11. Settings.jsx ⚠️ 需修复

| 功能 | 状态 | 问题 | 修复方案 |
|------|------|------|---------|
| 设置表单 | ✅ | 正常渲染 | - |
| 保存按钮 | ⚠️ | 只显示Modal | 添加 PUT /api/settings + 实际保存逻辑 |
| Tab切换 | ✅ | 正常工作 | - |
| Toggle开关 | ✅ | 状态更新正常 | - |
| 测试连接按钮 | ❌ | 无onClick | 添加GitHub/Drive连接测试 |
| 授权按钮 | ❌ | 无onClick | 添加OAuth流程 |

**优先级**: 中

---

## 🚨 需要添加的API端点

### 高优先级
```
POST   /api/cluster/backup        # 全集群备份
POST   /api/cluster/test           # 全集群智力测试
POST   /api/nodes/:id/backup       # 单节点备份
POST   /api/nodes/:id/restore      # 还原节点
POST   /api/nodes/:id/restart      # 重启节点
POST   /api/nodes/:id/test         # 节点智力测试
POST   /api/bots/:id/restart       # 重启Bot
DELETE /api/events                 # 清除事件日志
PUT    /api/settings               # 保存设置
```

### 中优先级
```
GET    /api/backups/:id/diff       # 备份diff对比
POST   /api/keys/:id/verify        # 真实验证Key（改进现有mock）
PUT    /api/cron-jobs/:id          # 编辑Cron任务
```

### 低优先级
```
POST   /api/nodes/:id/reconnect    # SSH重连
GET    /api/nodes/:id/diagnostics  # 诊断信息
GET    /api/nodes/:id/logs         # 节点日志
POST   /api/events/:id/mute        # 静音告警
PUT    /api/events/:id/resolve     # 忽略告警
```

---

## 📝 修复计划

### Phase 1: 核心功能（立即）
1. ✅ 添加节点Modal + API
2. ✅ 添加Bot Modal + API
3. ✅ 添加Key编辑/删除确认对话框
4. ✅ 保存设置功能

### Phase 2: 操作功能（1-2小时）
5. ✅ 备份/还原/重启API（mock响应）
6. ✅ 智力测试API（mock响应）
7. ✅ Bot重启API（mock响应）

### Phase 3: 辅助功能（2-3小时）
8. ✅ 筛选器连接
9. ✅ 查看详情Modal
10. ✅ 清除日志功能

---

## 🎯 修复原则

1. **所有按钮必须有反馈**：loading状态 + toast提示
2. **真实操作用mock**：SSH、部署等用mock + "演示模式"提示
3. **API优先**：先实现API（即使是mock），再连接前端
4. **错误处理**：所有API调用必须有try-catch
5. **用户确认**：危险操作（删除、重启）必须二次确认

---

## ✅ 已存在的API（无需修复）

- GET /api/dashboard ✅
- GET /api/nodes ✅
- POST /api/nodes ✅
- PUT /api/nodes/:id ✅
- DELETE /api/nodes/:id ✅
- GET /api/nodes/:id ✅
- GET /api/events (分页筛选) ✅
- GET /api/backups (分页筛选) ✅
- GET /api/scores/all (分页筛选) ✅
- GET /api/keys (分页筛选) ✅
- GET /api/cron-jobs (分页筛选) ✅
- PUT /api/cron-jobs/:id/toggle ✅
- GET /api/audit (分页筛选) ✅
- POST /api/audit ✅

---

## 🔧 开始修复

修复顺序：
1. 添加所有缺失的Modal组件
2. 添加所有缺失的API端点（mock响应）
3. 连接前端按钮到API
4. 添加loading状态和toast提示
5. 添加确认对话框
6. 测试所有交互

估计修复时间：3-4小时
