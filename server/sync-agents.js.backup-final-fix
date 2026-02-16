#!/usr/bin/env node
/**
 * OCM Agent同步系统
 * 从OpenClaw节点同步真实存在的Agent信息到OCM数据库
 */

const Database = require('better-sqlite3');
const { spawn } = require('child_process');
const path = require('path');

class AgentSyncSystem {
    constructor() {
        this.dbPath = path.join(__dirname, 'db', 'ocm.db');
        this.db = new Database(this.dbPath);
    }

    async syncNodeAgents(nodeId) {
        console.log(`🔄 开始同步节点 ${nodeId} 的Agent信息...`);
        
        const node = this.db.prepare('SELECT * FROM nodes WHERE id = ?').get(nodeId);
        if (!node) {
            console.error(`节点 ${nodeId} 不存在`);
            return;
        }

        try {
            // 获取节点上的OpenClaw配置
            const agents = await this.getNodeAgents(node);
            console.log(`发现 ${agents.length} 个Agent`);

            // 清除旧数据并插入新数据
            this.db.prepare('DELETE FROM bots WHERE node_id = ?').run(nodeId);
            
            for (const agent of agents) {
                this.insertAgent(nodeId, agent);
                console.log(`✅ 已同步: ${typeof agent === "string" ? agent : agent.id}`);
            }

            console.log(`✅ 节点 ${nodeId} Agent同步完成`);
            
        } catch (error) {
            console.error(`❌ 同步节点 ${nodeId} 失败:`, error.message);
        }
    }

    async getNodeAgents(node) {
        return new Promise((resolve, reject) => {
            console.log(`🔍 SSH连接 ${node.ssh_user}@${node.host}...`);
            
            // SSH获取OpenClaw配置
            const sshCmd = spawn('ssh', [
                '-o', 'ConnectTimeout=15',
                '-o', 'BatchMode=yes',
                `${node.ssh_user}@${node.host}`,
                `cat ${node.openclaw_path}/openclaw.json`
            ]);

            let output = '';
            let errorOutput = '';

            sshCmd.stdout.on('data', (data) => {
                output += data.toString();
            });

            sshCmd.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            sshCmd.on('close', (code) => {
                if (code === 0 && output.trim()) {
                    try {
                        const config = JSON.parse(output);
                        const agents = config.agents?.list || [];
                        resolve(agents);
                    } catch (parseError) {
                        reject(new Error(`配置解析失败: ${parseError.message}`));
                    }
                } else {
                    reject(new Error(`SSH失败 (代码: ${code}): ${errorOutput}`));
                }
            });

            sshCmd.on('error', (error) => {
                reject(new Error(`SSH连接错误: ${error.message}`));
            });
        });
    }

    insertAgent(nodeId, agent) {
        const botData = {
            id: `agent-${typeof agent === "string" ? agent : agent.id}-${Date.now()}`,
            name: this.getAgentDisplayName(typeof agent === "string" ? agent : agent.id),
            node_id: nodeId,
            bot_type: 'agent',
        console.log(, agent);        console.log(, typeof agent === "string" ? "N/A" : agent.model);
            model: (typeof agent === 'string' ? 'anthropic/claude-sonnet-4-20250514' : agent.model) || 'anthropic/claude-sonnet-4-20250514', // 使用实际配置
            telegram_token: null,
            description: `OpenClaw Agent: ${typeof agent === "string" ? agent : agent.id}`,
            status: 'running',
            workspace: agent.workspace || '',
            agent_id: (typeof agent === "string" ? agent : agent.id),
            created_at: Date.now(),
            updated_at: Date.now()
        };

        // 检查字段是否存在，不存在则添加
        this.ensureColumns();

        this.db.prepare(`
            INSERT INTO bots (
                id, name, node_id, bot_type, model, telegram_token, 
                description, status, created_at, updated_at, 
                workspace, agent_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            botData.id, botData.name, botData.node_id, botData.bot_type,
            botData.model, botData.telegram_token, botData.description,
            botData.status, botData.created_at, botData.updated_at,
            botData.workspace, botData.agent_id
        );
    }

    ensureColumns() {
        try {
            this.db.prepare('ALTER TABLE bots ADD COLUMN workspace TEXT').run();
        } catch (e) {
            // 字段可能已存在
        }
        try {
            this.db.prepare('ALTER TABLE bots ADD COLUMN agent_id TEXT').run();
        } catch (e) {
            // 字段可能已存在
        }
    }

    getAgentDisplayName(agentId) {
        const nameMap = {
            'learning': '学习助理',
            'xuesi': '学思助手',
            'investment': '投资顾问',
            'health': '健康管家',
            'life': '生活助手',
            'real-estate': '房产专家'
        };
        return nameMap[agentId] || `${agentId} Agent`;
    }

    async syncAllNodes() {
        const nodes = this.db.prepare('SELECT id FROM nodes').all();
        
        for (const node of nodes) {
            await this.syncNodeAgents(node.id);
            // 稍微延迟，避免并发SSH连接问题
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    close() {
        this.db.close();
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    const syncSystem = new AgentSyncSystem();
    
    const nodeId = process.argv[2] || 'baota';
    
    syncSystem.syncNodeAgents(nodeId).then(() => {
        console.log('同步完成');
        syncSystem.close();
        process.exit(0);
    }).catch((error) => {
        console.error('同步失败:', error);
        syncSystem.close();
        process.exit(1);
    });
}

module.exports = AgentSyncSystem;