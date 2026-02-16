#!/bin/bash

echo "🔄 重启OCM服务..."

# 颜色输出
RED="\033[0;31m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
NC="\033[0m"

# 停止服务
echo -e "${YELLOW}⏹️  停止OCM服务...${NC}"
pkill -f "node.*server/index.js" || true
sleep 2

# 启动服务
echo -e "${GREEN}🚀 启动OCM服务...${NC}"
nohup node server/index.js > ocm.log 2>&1 &
sleep 3

# 检查状态
if pgrep -f "node.*server/index.js" > /dev/null; then
    echo -e "${GREEN}✅ OCM服务重启成功${NC}"
    echo -e "${GREEN}🌐 访问地址: http://192.168.3.33:8001${NC}"
else
    echo -e "${RED}❌ OCM服务启动失败${NC}"
    tail -10 ocm.log
    exit 1
fi
