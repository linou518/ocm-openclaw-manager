# OCM Development Guidelines

## 版本控制流程

### 基本原则
- **每个修改都要提交**: 不管多小的修改，都要commit
- **明确的commit消息**: 说明修改了什么、为什么修改
- **定期推送**: 每次修改完立即推送到GitHub
- **不重复修改**: 已经修改过的问题，通过新的commit来改进，不要重复修改

### 提交规范

```bash
# 1. 修改代码
# 2. 添加到暂存区
git add .

# 3. 提交到本地仓库
git commit -m "类型: 简要描述

详细说明修改了什么，解决了什么问题
可以多行描述"

# 4. 推送到GitHub
git push origin main
```

### Commit 类型
- `feat:` 新功能
- `fix:` Bug修复
- `refactor:` 代码重构
- `style:` 样式修改
- `docs:` 文档更新
- `test:` 测试相关
- `chore:` 构建过程或辅助工具的变动

### 分支管理
- `main`: 稳定分支，随时可以部署
- `dev`: 开发分支，用于新功能开发
- `feature/*`: 功能分支，开发特定功能
- `hotfix/*`: 紧急修复分支

## 开发环境

### 文件结构
```
ocm-project/
├── client/          # React前端
│   ├── src/
│   ├── dist/        # 构建输出
│   └── package.json
├── server/          # Node.js后端
│   ├── index.js     # 主服务器
│   ├── services/    # 服务模块
│   └── db/          # 数据库脚本
├── logs/            # 日志文件
└── database.db      # SQLite数据库
```

### 开发命令
```bash
# 安装依赖
npm install
cd client && npm install && cd ..

# 前端开发
cd client && npm run dev

# 前端构建
cd client && npm run build

# 后端启动
node server/index.js

# 后端重启
pkill -f "node server/index.js"
nohup node server/index.js > ocm.log 2>&1 &
```

## 部署流程

### 生产部署
1. 确保所有修改已提交并推送
2. 在生产环境拉取最新代码
3. 构建前端资源
4. 重启后端服务
5. 验证功能正常

### 快速部署脚本
```bash
./deploy.sh
```

## Bug修复流程

1. **复现问题**: 确认问题存在
2. **定位根因**: 找到问题的根本原因
3. **编写修复**: 最小化修改，只修复问题
4. **测试验证**: 确保修复有效且没有引入新问题
5. **提交推送**: 按规范提交代码
6. **部署验证**: 在生产环境验证修复

## 代码审查

### 提交前检查清单
- [ ] 代码格式正确
- [ ] 没有console.log等调试代码
- [ ] 错误处理完整
- [ ] 测试通过
- [ ] 文档更新（如需要）

### Pull Request流程
1. 创建feature分支
2. 完成开发和测试
3. 提交PR到main分支
4. 代码审查
5. 合并到main分支

## 监控和维护

### 日志监控
```bash
# 查看实时日志
tail -f ocm.log

# 查看错误日志
grep -i error ocm.log

# 查看最近的提交
git log --oneline -10
```

### 性能监控
- 数据库大小监控
- 内存使用监控
- API响应时间监控
- 前端加载时间监控

## 常用命令

### Git快捷命令
```bash
# 快速提交
alias gcm='git add . && git commit -m'
alias gp='git push origin main'

# 查看状态
git status
git log --oneline -5

# 回滚提交（谨慎使用）
git reset --hard HEAD~1
```

### 服务管理
```bash
# 检查OCM服务状态
ps aux | grep "node.*index.js"

# 重启OCM服务
./restart-ocm.sh

# 检查端口占用
ss -tlnp | grep :8001
```