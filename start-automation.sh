#!/bin/bash
# OCM完全自动化启动脚本
# 启动所有必要的自动化服务

set -e

OCM_DIR="/home/linou/shared/ocm-project"
LOG_DIR="$OCM_DIR/logs"

# 创建日志目录
mkdir -p "$LOG_DIR"

echo "🚀 启动OCM完全自动化系统..."

# 检查并停止现有服务
echo "📋 检查现有服务..."
pkill -f "node.*index.js" 2>/dev/null || echo "  - OCM Server未运行"
pkill -f "node-health-monitor" 2>/dev/null || echo "  - 健康监控未运行" 
pkill -f "auto-recovery" 2>/dev/null || echo "  - 自动恢复未运行"

sleep 2

# 启动OCM主服务器
echo "🌟 启动OCM主服务器..."
cd "$OCM_DIR"
nohup node server/index.js > "$LOG_DIR/ocm-server.log" 2>&1 & 
OCM_PID=$!
echo "  - OCM Server started (PID: $OCM_PID)"

# 等待服务器启动
echo "⏳ 等待服务器就绪..."
for i in {1..10}; do
    if curl -s http://localhost:8001/api/dashboard > /dev/null 2>&1; then
        echo "  ✅ OCM Server API响应正常"
        break
    fi
    echo "  ⏳ 等待中... ($i/10)"
    sleep 2
done

# 启动健康监控
echo "📊 启动节点健康监控..."
cd "$OCM_DIR/server"
nohup python3 node-health-monitor.py > "$LOG_DIR/health-monitor.log" 2>&1 &
HEALTH_PID=$!
echo "  - 健康监控 started (PID: $HEALTH_PID)"

# 启动自动恢复系统
echo "🤖 启动自动恢复系统..."
nohup node auto-recovery.js > "$LOG_DIR/auto-recovery.log" 2>&1 &
RECOVERY_PID=$!
echo "  - 自动恢复 started (PID: $RECOVERY_PID)"

# 记录所有PID
echo "$OCM_PID" > "$LOG_DIR/ocm-server.pid"
echo "$HEALTH_PID" > "$LOG_DIR/health-monitor.pid" 
echo "$RECOVERY_PID" > "$LOG_DIR/auto-recovery.pid"

echo ""
echo "✅ OCM完全自动化系统启动完成！"
echo ""
echo "📊 服务状态:"
echo "  - OCM Server: http://localhost:8001 (PID: $OCM_PID)"
echo "  - 健康监控: 5分钟检查周期 (PID: $HEALTH_PID)"
echo "  - 自动恢复: 10分钟检查周期 (PID: $RECOVERY_PID)"
echo ""
echo "📝 日志文件:"
echo "  - OCM Server: $LOG_DIR/ocm-server.log"
echo "  - 健康监控: $LOG_DIR/health-monitor.log"
echo "  - 自动恢复: $LOG_DIR/auto-recovery.log"
echo ""
echo "🛑 停止所有服务: ./stop-automation.sh"
echo ""
echo "🎯 系统现在完全自动化运行，无需人工干预！"