#!/bin/bash
# 真正删除Agent脚本
AGENT_ID=$1
if [ -z "$AGENT_ID" ]; then
  echo "ERROR: 需要提供agent ID"
  exit 1
fi

echo "🗑️ 开始删除agent: $AGENT_ID"

# 备份配置
ssh openclaw02@192.168.3.17 "cd ~/.openclaw && cp openclaw.json openclaw.json.backup-auto-$(date +%s)"
echo "📦 配置已备份"

# 删除配置 (使用已验证的Python命令)
ssh openclaw02@192.168.3.17 "cd ~/.openclaw && python3 -c '
import json
with open("openclaw.json", "r") as f:
    config = json.load(f)
config["agents"]["list"] = [agent for agent in config["agents"]["list"] if agent.get("id") != "$AGENT_ID"]
with open("openclaw.json", "w") as f:
    json.dump(config, f, indent=2)
print("Config updated")
'"
echo "⚙️ 配置已删除"

# 删除目录
ssh openclaw02@192.168.3.17 "rm -rf ~/.openclaw/agents/$AGENT_ID ~/.openclaw/workspace-$AGENT_ID"
echo "🗂️ 目录已删除"

# 重启服务
ssh openclaw02@192.168.3.17 "systemctl --user restart openclaw-gateway"
echo "🔄 服务已重启"

echo "✅ Agent $AGENT_ID 删除完成"
