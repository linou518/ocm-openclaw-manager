#!/bin/bash
# OCM自动化系统停止脚本

OCM_DIR="/home/linou/shared/ocm-project"
LOG_DIR="$OCM_DIR/logs"

echo "🛑 停止OCM自动化系统..."

# 从PID文件读取并停止服务
if [ -f "$LOG_DIR/ocm-server.pid" ]; then
    OCM_PID=$(cat "$LOG_DIR/ocm-server.pid")
    kill $OCM_PID 2>/dev/null && echo "  ✅ OCM Server stopped (PID: $OCM_PID)" || echo "  ⚠️ OCM Server可能已停止"
    rm -f "$LOG_DIR/ocm-server.pid"
fi

if [ -f "$LOG_DIR/health-monitor.pid" ]; then
    HEALTH_PID=$(cat "$LOG_DIR/health-monitor.pid")
    kill $HEALTH_PID 2>/dev/null && echo "  ✅ 健康监控 stopped (PID: $HEALTH_PID)" || echo "  ⚠️ 健康监控可能已停止"
    rm -f "$LOG_DIR/health-monitor.pid"
fi

if [ -f "$LOG_DIR/auto-recovery.pid" ]; then
    RECOVERY_PID=$(cat "$LOG_DIR/auto-recovery.pid")
    kill $RECOVERY_PID 2>/dev/null && echo "  ✅ 自动恢复 stopped (PID: $RECOVERY_PID)" || echo "  ⚠️ 自动恢复可能已停止"
    rm -f "$LOG_DIR/auto-recovery.pid"
fi

# 强制清理残留进程
pkill -f "node.*index.js" 2>/dev/null || true
pkill -f "node-health-monitor" 2>/dev/null || true  
pkill -f "auto-recovery" 2>/dev/null || true

echo ""
echo "✅ OCM自动化系统已完全停止"
echo ""
echo "💡 重新启动: ./start-automation.sh"