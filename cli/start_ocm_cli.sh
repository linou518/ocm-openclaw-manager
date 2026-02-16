#!/bin/bash
# OCM CLI 启动脚本

echo "🚀 启动OCM CLI系统..."

# 设置环境变量
export OCM_BOT_TOKEN="${OCM_BOT_TOKEN:-YOUR_BOT_TOKEN_HERE}"

# 检查依赖
echo "📋 检查Python依赖..."
python3 -c "import telegram, paramiko; print('✅ 依赖检查通过')" || {
    echo "❌ 依赖检查失败，请运行: pip3 install -r requirements.txt --user --break-system-packages"
    exit 1
}

# 验证配置
echo "🔧 验证配置..."
python3 config.py || {
    echo "❌ 配置验证失败"
    echo "📝 请按照以下步骤配置Telegram Bot:"
    echo "   1. 打开Telegram，找到 @BotFather"
    echo "   2. 发送 /newbot"
    echo "   3. 输入Bot名称，如: OCM Manager"
    echo "   4. 输入Bot用户名，如: @ocm_manager_bot"
    echo "   5. 获取Token后，设置环境变量:"
    echo "      export OCM_BOT_TOKEN='你的Bot Token'"
    echo "   或直接编辑 config.py 文件中的 TELEGRAM_BOT_TOKEN"
    exit 1
}

# 启动服务
echo "🎯 启动OCM CLI Bot..."
python3 telegram_cli_handler.py