#!/bin/bash
# 便捷节点安装脚本
# 用法: ./install-node.sh <host> <user> [password]

if [ $# -lt 2 ]; then
    echo "用法: $0 <host> <user> [password]"
    exit 1
fi

HOST=$1
USER=$2
PASSWORD=${3:-}

echo "🚀 开始安装节点: $HOST (用户: $USER)"

# 构建节点信息JSON
NODE_INFO='{
    "host": "'$HOST'",
    "user": "'$USER'",
    "name": "Node-'$HOST'"'

if [ -n "$PASSWORD" ]; then
    NODE_INFO=$NODE_INFO',"password": "'$PASSWORD'"'
fi

NODE_INFO=$NODE_INFO'}'

# 调用Python安装器
python3 enhanced-node-installer.py "$NODE_INFO"
