#!/bin/bash

echo "🚀 OCM 部署脚本启动..."

# 颜色输出
RED="\033[0;31m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
BLUE="\033[0;34m"
NC="\033[0m" # No Color

# 检查是否在项目根目录
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ 请在OCM项目根目录执行此脚本${NC}"
    exit 1
fi

# 1. 拉取最新代码
echo -e "${BLUE}📥 拉取最新代码...${NC}"
git pull origin main
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 拉取代码失败${NC}"
    exit 1
fi

# 2. 安装后端依赖（如果有新依赖）
echo -e "${BLUE}📦 检查后端依赖...${NC}"
npm install --production

# 3. 安装前端依赖并构建
echo -e "${BLUE}🔨 构建前端...${NC}"
cd client
npm install --production
npm run build
cd ..

if [ ! -d "client/dist" ]; then
    echo -e "${RED}❌ 前端构建失败${NC}"
    exit 1
fi

# 4. 停止旧服务
echo -e "${YELLOW}⏹️  停止旧服务...${NC}"
pkill -f "node.*server/index.js" || true
sleep 2

# 5. 启动新服务
echo -e "${GREEN}🚀 启动OCM服务...${NC}"
nohup node server/index.js > ocm.log 2>&1 &
sleep 3

# 6. 检查服务状态
if pgrep -f "node.*server/index.js" > /dev/null; then
    echo -e "${GREEN}✅ OCM服务启动成功${NC}"
    echo -e "${GREEN}🌐 访问地址: http://192.168.3.33:8001${NC}"
    
    # 显示最近的日志
    echo -e "${BLUE}📋 最近日志:${NC}"
    tail -10 ocm.log
else
    echo -e "${RED}❌ OCM服务启动失败${NC}"
    echo -e "${RED}🔍 错误日志:${NC}"
    tail -20 ocm.log
    exit 1
fi

echo -e "${GREEN}🎉 部署完成！${NC}"
