#!/bin/bash
# 便捷健康检查脚本

echo "🔍 开始健康检查..."
python3 node-health-monitor.py check

echo ""
echo "📊 生成健康报告..."
curl -s http://localhost:8001/api/nodes/health/summary | python3 -m json.tool
