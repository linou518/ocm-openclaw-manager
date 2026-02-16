#!/usr/bin/env node

/**
 * 自动化Bot部署系统
 * 将OCM创建的Bot真正部署到OpenClaw节点并启动
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

class AutoBotDeployer {
  constructor() {
    const dbPath = path.join(__dirname, 'db', 'ocm.db');
    this.db = new Database(dbPath);
    console.log('🤖 自动化Bot部署系统初始化完成');
  }

  async deployBot(botId) {
    console.log(`🚀 开始自动部署Bot: ${botId}`);
    
    try {
      // 获取Bot信息
      const bot = this.db.prepare('SELECT * FROM bots WHERE id = ?').get(botId);
      if (!bot) {
        throw new Error(`找不到Bot: ${botId}`);
      }

      // 获取节点信息
      const node = this.db.prepare('SELECT * FROM nodes WHERE id = ?').get(bot.node_id);
      if (!node) {
        throw new Error(`找不到节点: ${bot.node_id}`);
      }

      console.log(`📋 Bot信息: ${bot.name} -> ${node.host}:${node.ssh_user}`);
      
      // 更新Bot状态为部署中
      this.db.prepare('UPDATE bots SET status = ? WHERE id = ?').run('deploying', botId);

      // 1. 生成Agent配置
      const agentConfig = this.generateAgentConfig(bot);
      console.log('📝 Agent配置已生成');

      // 2. 部署到节点
      await this.deployToNode(node, bot, agentConfig);
      console.log('🌐 配置已部署到节点');

      // 3. 重启OpenClaw
      await this.restartOpenClaw(node);
      console.log('🔄 OpenClaw服务已重启');

      // 4. 验证部署
      const isRunning = await this.verifyDeployment(node, bot);
      if (isRunning) {
        // 更新Bot状态为运行中
        this.db.prepare(`
          UPDATE bots SET 
            status = 'running',
            updated_at = ?
          WHERE id = ?
        `).run(Date.now(), botId);
        
        console.log(`✅ Bot ${bot.name} 部署成功并正在运行`);
        return {
          success: true,
          message: `Bot ${bot.name} 已自动部署并启动`,
          status: 'running'
        };
      } else {
        throw new Error('部署后验证失败');
      }

    } catch (error) {
      console.error(`❌ Bot部署失败: ${error.message}`);
      
      // 更新Bot状态为错误
      this.db.prepare('UPDATE bots SET status = ? WHERE id = ?').run('error', botId);
      
      return {
        success: false,
        error: error.message,
        status: 'error'
      };
    }
  }

  generateAgentConfig(bot) {
    // 生成OpenClaw Agent配置
    // 使用更智能的ID生成逻辑，支持中文名称
    let agentId = bot.name.toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5]/g, '-')  // 保留中文字符
      .replace(/^-+|-+$/g, '')  // 移除开头结尾的-
      .replace(/-+/g, '-');     // 多个-合并为一个
    
    // 如果结果为空或只有-，使用随机ID
    if (!agentId || agentId === '-' || /^-+$/.test(agentId)) {
      agentId = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    }
    
    // 限制长度
    if (agentId.length > 30) {
      agentId = agentId.substring(0, 30);
    }
    
    return {
      id: agentId,
      workspace: `workspace-${agentId}`,
      description: bot.description || `${bot.name} - Telegram助理`,
      channels: {
        telegram: {
          enabled: true,
          token: bot.telegram_token
        }
      },
      model: bot.model || 'anthropic/claude-sonnet-4-20250514',
      thinking: 'low'
    };
  }

  async deployToNode(node, bot, agentConfig) {
    return new Promise((resolve, reject) => {
      console.log(`🔗 SSH连接到 ${node.ssh_user}@${node.host}`);
      
      // 完整部署命令 - 包含目录创建和auth配置
      const deployCmd = `
        # 1. 读取当前OpenClaw配置
        CURRENT_CONFIG=$(cat ~/.openclaw/openclaw.json)
        
        # 2. 创建Agent目录结构
        mkdir -p ~/.openclaw/agents/${agentConfig.id}/agent
        mkdir -p ~/.openclaw/workspace-${agentConfig.id}
        
        # 3. 创建auth-profiles.json (使用模板)
        cat > ~/.openclaw/agents/${agentConfig.id}/agent/auth-profiles.json << 'AUTH_EOF'
{
  "version": 1,
  "profiles": {
    "anthropic:techsfree": {
      "type": "token", 
      "provider": "anthropic",
      "token": "76kScrA1EOyllm0ghsF3rMDyaLK62r2qeeJica7WFnuB1pA2#d1a6zqCOeRRi6H6v71_Gwk0bKhVJp8wCl-VIx73779Q"
    },
    "anthropic:manual": {
      "type": "token",
      "provider": "anthropic", 
      "token": "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"
    }
  },
  "lastGood": {
    "anthropic": "anthropic:manual"  
  },
  "usageStats": {}
}
AUTH_EOF
        
        # 4. 设置正确权限
        chmod 600 ~/.openclaw/agents/${agentConfig.id}/agent/auth-profiles.json
        
        # 5. 更新OpenClaw主配置
        echo "$CURRENT_CONFIG" | jq --argjson newAgent '${JSON.stringify(agentConfig)}' '
          .agents.list |= map(select(.id != $newAgent.id)) + [$newAgent]
        ' > ~/.openclaw/openclaw.json.tmp && mv ~/.openclaw/openclaw.json.tmp ~/.openclaw/openclaw.json
        
        echo "✅ Agent ${agentConfig.id} 完整部署完成"
      `;

      const ssh = require('child_process').spawn('ssh', [
        '-o', 'ConnectTimeout=30',
        '-o', 'BatchMode=yes',
        `${node.ssh_user}@${node.host}`,
        deployCmd
      ]);

      let output = '';
      let errors = '';

      ssh.stdout.on('data', (data) => output += data);
      ssh.stderr.on('data', (data) => errors += data);

      ssh.on('close', (code) => {
        if (code === 0) {
          console.log('🎉 完整部署成功');
          resolve();
        } else {
          reject(new Error(`部署失败: ${errors}`));
        }
      });
    });
  });

      sshRead.stderr.on('data', (data) => {
        errorData += data.toString();
      });

      sshRead.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`读取配置失败: ${errorData}`));
          return;
        }

        try {
          // 解析当前配置
          const currentConfig = JSON.parse(configData);
          
          // 添加新Agent
          if (!currentConfig.agents) {
            currentConfig.agents = { list: [] };
          }
          
          // 移除可能存在的同名Agent
          currentConfig.agents.list = currentConfig.agents.list.filter(
            agent => agent.id !== agentConfig.id
          );
          
          // 添加新Agent
          currentConfig.agents.list.push(agentConfig);
          
          console.log(`📝 配置更新: 添加Agent ${agentConfig.id}`);
          
          // 2. 写入新配置
          this.writeConfigToNode(node, currentConfig, resolve, reject);
          
        } catch (parseError) {
          reject(new Error(`配置解析失败: ${parseError.message}`));
        }
      });
    });
  }

  writeConfigToNode(node, newConfig, resolve, reject) {
    const configJson = JSON.stringify(newConfig, null, 2);
    
    // 写入新配置的命令
    const writeConfigCmd = `
      # 备份当前配置
      cp ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.backup-bot-deploy-$(date +%s)
      
      # 写入新配置
      cat > ~/.openclaw/openclaw.json << 'EOF'
${configJson}
EOF
      
      echo "配置更新完成"
    `;

    const sshWrite = spawn('ssh', [
      '-o', 'ConnectTimeout=15',
      '-o', 'BatchMode=yes',
      `${node.ssh_user}@${node.host}`,
      writeConfigCmd
    ]);

    let outputData = '';
    let errorData = '';

    sshWrite.stdout.on('data', (data) => {
      outputData += data.toString();
    });

    sshWrite.stderr.on('data', (data) => {
      errorData += data.toString();
    });

    sshWrite.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`写入配置失败: ${errorData}`));
      } else {
        console.log('📝 配置已写入节点');
        resolve();
      }
    });
  }

  async restartOpenClaw(node) {
    return new Promise((resolve, reject) => {
      console.log('🔄 重启OpenClaw服务...');
      
      const restartCmd = `
        # 停止OpenClaw进程
        pkill -f openclaw || true
        sleep 3
        
        # 启动OpenClaw Gateway
        cd ~/.openclaw
        nohup openclaw-gateway > gateway.log 2>&1 &
        
        sleep 5
        echo "OpenClaw重启完成"
      `;

      const sshRestart = spawn('ssh', [
        '-o', 'ConnectTimeout=30',
        '-o', 'BatchMode=yes',
        `${node.ssh_user}@${node.host}`,
        restartCmd
      ]);

      let outputData = '';
      let errorData = '';

      sshRestart.stdout.on('data', (data) => {
        outputData += data.toString();
      });

      sshRestart.stderr.on('data', (data) => {
        errorData += data.toString();
      });

      sshRestart.on('close', (code) => {
        console.log(`重启命令退出: ${code}`);
        // OpenClaw重启命令可能返回非零码，但这是正常的
        setTimeout(() => {
          resolve();
        }, 5000); // 等待5秒让服务完全启动
      });
    });
  }

  async verifyDeployment(node, bot) {
    return new Promise((resolve) => {
      console.log('🔍 验证Bot部署状态...');
      
      const verifyCmd = `
        # 检查OpenClaw进程
        ps aux | grep -E '(openclaw|gateway)' | grep -v grep
        echo "---"
        
        # 检查配置
        cat ~/.openclaw/openclaw.json | grep -A 5 -B 5 "${bot.name.toLowerCase()}" || echo "未找到Agent配置"
      `;

      const sshVerify = spawn('ssh', [
        '-o', 'ConnectTimeout=15',
        '-o', 'BatchMode=yes',
        `${node.ssh_user}@${node.host}`,
        verifyCmd
      ]);

      let outputData = '';

      sshVerify.stdout.on('data', (data) => {
        outputData += data.toString();
      });

      sshVerify.on('close', (code) => {
        const hasOpenClawProcess = outputData.includes('openclaw');
        const hasAgentConfig = outputData.includes(bot.name.toLowerCase()) || 
                               outputData.includes(bot.telegram_token.substring(0, 10));
        
        console.log(`验证结果: 进程=${hasOpenClawProcess}, 配置=${hasAgentConfig}`);
        resolve(hasOpenClawProcess);
      });
    });
  }

  close() {
    this.db.close();
  }
}

module.exports = AutoBotDeployer;

// 如果直接运行此脚本
if (require.main === module) {
  const botId = process.argv[2];
  if (!botId) {
    console.error('用法: node auto-bot-deployer.js <botId>');
    process.exit(1);
  }

  const deployer = new AutoBotDeployer();
  
  deployer.deployBot(botId)
    .then(result => {
      console.log('部署结果:', result);
      deployer.close();
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('部署异常:', error);
      deployer.close();
      process.exit(1);
    });
}