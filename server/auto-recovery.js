#!/usr/bin/env node
/**
 * OCM自动恢复系统
 * 零人工干预的故障检测和自动修复
 */

const Database = require('better-sqlite3');
const { spawn } = require('child_process');
const path = require('path');

class AutoRecoverySystem {
    constructor() {
        this.dbPath = path.join(__dirname, 'db', 'ocm.db');
        this.db = new Database(this.dbPath);
        this.recoveryInterval = 10 * 60 * 1000; // 10分钟检查一次
        this.maxRecoveryAttempts = 3; // 最大恢复尝试次数
        this.running = false;
    }

    start() {
        console.log('🤖 启动自动恢复系统...');
        this.running = true;
        this.runRecoveryLoop();
    }

    stop() {
        console.log('⏹️ 停止自动恢复系统');
        this.running = false;
    }

    async runRecoveryLoop() {
        while (this.running) {
            try {
                await this.checkAndRecoverNodes();
                await this.sleep(this.recoveryInterval);
            } catch (error) {
                console.error('自动恢复异常:', error);
                await this.sleep(60000); // 异常时等待1分钟
            }
        }
    }

    async checkAndRecoverNodes() {
        const problematicNodes = this.getProblematicNodes();
        
        for (const node of problematicNodes) {
            console.log(`🔧 检测到问题节点: ${node.id} (状态: ${node.status})`);
            
            if (this.shouldAttemptRecovery(node)) {
                await this.attemptRecovery(node);
            }
        }
    }

    getProblematicNodes() {
        const cutoffTime = Date.now() - (15 * 60 * 1000); // 15分钟前
        
        return this.db.prepare(`
            SELECT * FROM nodes 
            WHERE status IN ('offline', 'error', 'unknown') 
            AND (last_seen_at IS NULL OR last_seen_at < ?)
            AND (
                recovery_attempts IS NULL 
                OR recovery_attempts < ? 
                OR last_recovery_at < ?
            )
        `).all(cutoffTime, this.maxRecoveryAttempts, Date.now() - (60 * 60 * 1000)); // 1小时冷却期
    }

    shouldAttemptRecovery(node) {
        // 检查是否应该尝试恢复
        const recoveryAttempts = node.recovery_attempts || 0;
        const lastRecoveryAt = node.last_recovery_at || 0;
        const cooldownPeriod = 60 * 60 * 1000; // 1小时冷却

        return recoveryAttempts < this.maxRecoveryAttempts && 
               (Date.now() - lastRecoveryAt) > cooldownPeriod;
    }

    async attemptRecovery(node) {
        console.log(`🚑 开始自动恢复节点: ${node.id}`);
        
        // 更新恢复尝试计数
        const recoveryAttempts = (node.recovery_attempts || 0) + 1;
        this.db.prepare(`
            UPDATE nodes 
            SET recovery_attempts = ?, last_recovery_at = ?, status = 'recovering'
            WHERE id = ?
        `).run(recoveryAttempts, Date.now(), node.id);

        // 记录恢复事件
        this.db.prepare(`
            INSERT INTO events (node_id, type, severity, message, created_at)
            VALUES (?, 'recovery', 'info', ?, ?)
        `).run(node.id, `开始第${recoveryAttempts}次自动恢复尝试`, Date.now());

        try {
            // 执行恢复操作
            const success = await this.executeRecovery(node);
            
            if (success) {
                console.log(`✅ 节点 ${node.id} 恢复成功`);
                
                // 重置恢复计数器
                this.db.prepare(`
                    UPDATE nodes 
                    SET recovery_attempts = 0, status = 'online'
                    WHERE id = ?
                `).run(node.id);

                this.db.prepare(`
                    INSERT INTO events (node_id, type, severity, message, created_at)
                    VALUES (?, 'recovery', 'info', ?, ?)
                `).run(node.id, `✅ 自动恢复成功`, Date.now());

            } else {
                console.log(`❌ 节点 ${node.id} 恢复失败`);
                
                this.db.prepare(`
                    UPDATE nodes SET status = 'error' WHERE id = ?
                `).run(node.id);

                this.db.prepare(`
                    INSERT INTO events (node_id, type, severity, message, created_at)
                    VALUES (?, 'recovery', 'error', ?, ?)
                `).run(node.id, `❌ 第${recoveryAttempts}次自动恢复失败`, Date.now());
            }

        } catch (error) {
            console.error(`节点 ${node.id} 恢复异常:`, error);
            
            this.db.prepare(`
                UPDATE nodes SET status = 'error' WHERE id = ?
            `).run(node.id);

            this.db.prepare(`
                INSERT INTO events (node_id, type, severity, message, created_at)
                VALUES (?, 'recovery', 'error', ?, ?)
            `).run(node.id, `恢复过程异常: ${error.message}`, Date.now());
        }
    }

    async executeRecovery(node) {
        return new Promise((resolve) => {
            console.log(`🔧 执行SSH修复命令: ${node.host}`);
            
            const recoveryCmd = spawn('ssh', [
                '-o', 'ConnectTimeout=15',
                '-o', 'BatchMode=yes',
                `${node.ssh_user}@${node.host}`,
                [
                    'echo "开始自动修复..."',
                    'which openclaw || (curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt install -y nodejs && sudo npm install -g openclaw)',
                    'systemctl --user status openclaw-gateway || systemctl --user start openclaw-gateway || nohup /usr/local/bin/openclaw gateway > /dev/null 2>&1 &',
                    'sleep 5',
                    'pgrep -f openclaw && echo "RECOVERY_SUCCESS" || echo "RECOVERY_FAILED"'
                ].join(' && ')
            ]);

            let output = '';
            recoveryCmd.stdout?.on('data', (data) => {
                output += data.toString();
                console.log(`[${node.id}] ${data.toString().trim()}`);
            });

            recoveryCmd.stderr?.on('data', (data) => {
                console.error(`[${node.id}] ERROR: ${data.toString().trim()}`);
            });

            recoveryCmd.on('close', (code) => {
                const success = output.includes('RECOVERY_SUCCESS') && code === 0;
                resolve(success);
            });

            recoveryCmd.on('error', (error) => {
                console.error(`SSH连接失败 ${node.id}:`, error);
                resolve(false);
            });
        });
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 如果直接运行此文件
if (require.main === module) {
    const autoRecovery = new AutoRecoverySystem();
    
    // 处理退出信号
    process.on('SIGINT', () => {
        console.log('\n收到退出信号，正在停止自动恢复系统...');
        autoRecovery.stop();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        autoRecovery.stop();
        process.exit(0);
    });

    autoRecovery.start();
}

module.exports = AutoRecoverySystem;