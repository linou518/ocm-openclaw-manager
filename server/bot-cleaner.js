#!/usr/bin/env node

/**
 * Bot完全清理系统
 * 同时删除OCM数据库记录和OpenClaw节点配置
 */

const { spawn } = require('child_process');
const path = require('path');
const Database = require('better-sqlite3');

class BotCleaner {
  constructor() {
    const dbPath = path.join(__dirname, 'db', 'ocm.db');
    this.db = new Database(dbPath);
    console.log('🧹 Bot完全清理系统初始化完成');
  }

  async deleteBot(botId) {
    console.log(`🗑️ 开始智能删除Bot: ${botId}`);
    
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

      console.log(`📋 删除Bot: ${bot.name} (Agent ID: ${bot.agent_id || 'unknown'})`);

      // 1. 智能地从OpenClaw节点配置中删除指定Agent
      const removed = await this.removeSpecificAgentFromNode(node, bot);
      if (removed > 0) {
        console.log(`🌐 已从节点配置中删除 ${removed} 个匹配的Agent`);
        
        // 2. 重启OpenClaw服务
        await this.restartOpenClaw(node);
        console.log('🔄 OpenClaw服务已重启');
      } else {
        console.log('⚠️ 节点配置中未找到匹配的Agent，跳过重启');
      }

      // 3. 从OCM数据库删除
      this.db.prepare('DELETE FROM bots WHERE id = ?').run(botId);
      console.log('🗄️ 已从数据库删除');

      return {
        success: true,
        message: `Bot ${bot.name} 已完全删除`,
        details: {
          removed_from_node: removed > 0,
          removed_count: removed
        }
      };

    } catch (error) {
      console.error(`❌ Bot删除失败: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async removeSpecificAgentFromNode(node, bot) {
    return new Promise((resolve, reject) => {
      console.log(`🔗 SSH连接到 ${node.ssh_user}@${node.host}`);
      
      // 1. 读取当前OpenClaw配置
      const readConfigCmd = `cat ~/.openclaw/openclaw.json`;
      
      const sshRead = spawn('ssh', [
        '-o', 'ConnectTimeout=15',
        '-o', 'BatchMode=yes',
        `${node.ssh_user}@${node.host}`,
        readConfigCmd
      ]);

      let configData = '';
      let errorData = '';

      sshRead.stdout.on('data', (data) => {
        configData += data.toString();
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
          
          if (!currentConfig.agents || !currentConfig.agents.list) {
            console.log('⚠️ 节点配置中没有agents列表');
            resolve(0);
            return;
          }

          // 智能匹配并删除指定Agent
          const originalCount = currentConfig.agents.list.length;
          let removedCount = 0;
          
          currentConfig.agents.list = currentConfig.agents.list.filter(agent => {
            let shouldRemove = false;
            
            // 匹配策略1: 按agent_id精确匹配
            if (bot.agent_id && agent.id === bot.agent_id) {
              console.log(`🎯 匹配成功 (Agent ID): ${agent.id}`);
              shouldRemove = true;
            }
            
            // 匹配策略2: 按Telegram Token匹配 
            if (!shouldRemove && bot.telegram_token && agent.channels?.telegram?.token === bot.telegram_token) {
              console.log(`🎯 匹配成功 (Token): ${agent.id}`);
              shouldRemove = true;
            }
            
            // 匹配策略3: 按转换后的名称匹配
            if (!shouldRemove && bot.name) {
              const normalizedName = bot.name.toLowerCase().replace(/[^\w\u4e00-\u9fa5]/g, '-').replace(/-+/g, '-');
              if (agent.id === normalizedName) {
                console.log(`🎯 匹配成功 (Name): ${agent.id}`);
                shouldRemove = true;
              }
            }
            
            // 匹配策略4: 按描述匹配（包含Bot名称）
            if (!shouldRemove && agent.description && bot.name) {
              if (agent.description.includes(bot.name)) {
                console.log(`🎯 匹配成功 (Description): ${agent.id}`);
                shouldRemove = true;
              }
            }
            
            if (shouldRemove) {
              removedCount++;
              console.log(`❌ 删除Agent: ${agent.id} (${agent.description || 'no desc'})`);
            }
            
            return !shouldRemove; // 返回true保留，false删除
          });
          
          console.log(`📊 删除统计: ${removedCount}/${originalCount} 个Agent被删除`);
          
          if (removedCount === 0) {
            console.log('⚠️ 未找到匹配的Agent，无需更新配置');
            resolve(0);
            return;
          }
          
          // 2. 写入更新后的配置
          this.writeUpdatedConfigToNode(node, currentConfig, removedCount, resolve, reject);
          
        } catch (parseError) {
          reject(new Error(`配置解析失败: ${parseError.message}`));
        }
      });
    });
  }

  writeUpdatedConfigToNode(node, newConfig, removedCount, resolve, reject) {
    const configJson = JSON.stringify(newConfig, null, 2);
    
    const writeConfigCmd = `
      # 备份当前配置 
      cp ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.backup-delete-$(date +%s)
      
      # 写入更新后的配置
      cat > ~/.openclaw/openclaw.json << 'EOF'
${configJson}
EOF
      
      echo "智能删除完成，已删除 ${removedCount} 个Agent"
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
        console.log(`📝 配置已更新到节点，删除了 ${removedCount} 个Agent`);
        resolve(removedCount);
      }
    });
  }

  async restartOpenClaw(node) {
    return new Promise((resolve) => {
      console.log('🔄 重启OpenClaw服务...');
      
      const restartCmd = `
        pkill -f openclaw || true
        sleep 3
        cd ~/.openclaw
        nohup openclaw-gateway > gateway.log 2>&1 &
        sleep 5
      `;

      const sshRestart = spawn('ssh', [
        '-o', 'ConnectTimeout=30',
        '-o', 'BatchMode=yes',
        `${node.ssh_user}@${node.host}`,
        restartCmd
      ]);

      sshRestart.on('close', () => {
        setTimeout(() => {
          resolve();
        }, 3000);
      });
    });
  }

  // 已移除clearAllBots功能 - 使用智能的单个删除代替批量清理

  close() {
    this.db.close();
  }
}

module.exports = BotCleaner;

// 如果直接运行此脚本
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const cleaner = new BotCleaner();
  
  if (command === 'delete' && args[1]) {
    // 智能删除指定Bot
    cleaner.deleteBot(args[1])
      .then(result => {
        console.log('删除结果:', result);
        cleaner.close();
        process.exit(result.success ? 0 : 1);
      });
  } else {
    console.log('用法:');
    console.log('  智能删除Bot: node bot-cleaner.js delete <botId>');
    console.log('  (自动从OCM数据库和OpenClaw节点配置中删除)');
    cleaner.close();
    process.exit(1);
  }
}