#!/usr/bin/env node
/**
 * 完全自动化的节点退役API
 * 零人工干预的节点清理系统
 */

const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const Database = require('better-sqlite3');

class AutomatedNodeRetirementAPI {
    constructor(db) {
        this.db = db;
        this.router = express.Router();
        this.setupRoutes();
    }

    setupRoutes() {
        // 完全自动化的节点退役 - 零人工干预
        this.router.post('/api/nodes/:nodeId/retire-automated', this.retireNodeAutomated.bind(this));
        
        // 检查退役状态
        this.router.get('/api/nodes/:nodeId/retirement-status', this.getRetirementStatus.bind(this));
        
        // 批量退役多个节点
        this.router.post('/api/nodes/batch-retire', this.batchRetireNodes.bind(this));
    }

    async retireNodeAutomated(req, res) {
        const { nodeId } = req.params;
        const { force = false } = req.body;

        try {
            console.log(`🚀 启动自动化退役流程: ${nodeId}`);
            
            // 1. 从数据库获取节点信息
            const node = this.db.prepare('SELECT * FROM nodes WHERE id = ?').get(nodeId);
            if (!node) {
                return res.status(404).json({
                    success: false,
                    error: `节点 ${nodeId} 不存在`
                });
            }

            // 2. 准备自动化清理参数
            const cleanupParams = {
                host: node.host,
                user: node.ssh_user,
                password: process.env.NODE_SSH_PASSWORD || 'Niejing0221', // 从环境变量获取
                port: node.port || 22
            };

            // 3. 执行完全自动化的清理
            const cleanupResult = await this.executeAutomatedCleanup(cleanupParams);
            
            // 4. 如果清理成功，从数据库删除节点
            if (cleanupResult.success || force) {
                await this.removeNodeFromDatabase(nodeId);
                
                return res.json({
                    success: true,
                    message: `节点 ${nodeId} (${node.host}) 已完全自动化退役`,
                    details: {
                        cleanup_result: cleanupResult,
                        database_cleanup: true,
                        automation_level: '100% - 零人工干预'
                    }
                });
            } else {
                return res.status(500).json({
                    success: false,
                    error: '自动化清理失败',
                    details: cleanupResult,
                    suggestion: '考虑使用 force=true 强制删除数据库记录'
                });
            }

        } catch (error) {
            console.error('自动化退役失败:', error);
            return res.status(500).json({
                success: false,
                error: '自动化退役过程异常',
                details: error.message
            });
        }
    }

    async executeAutomatedCleanup(params) {
        return new Promise((resolve) => {
            const cleanupScript = path.join(__dirname, 'enhanced-node-cleanup.py');
            const args = [cleanupScript, JSON.stringify(params)];
            
            console.log(`🧹 执行自动化清理: python3 ${cleanupScript}`);
            
            const cleanup = spawn('python3', args, {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: __dirname
            });

            let stdout = '';
            let stderr = '';

            cleanup.stdout.on('data', (data) => {
                stdout += data.toString();
                console.log(`清理输出: ${data.toString().trim()}`);
            });

            cleanup.stderr.on('data', (data) => {
                stderr += data.toString();
                console.error(`清理错误: ${data.toString().trim()}`);
            });

            cleanup.on('close', (code) => {
                try {
                    if (code === 0) {
                        const result = JSON.parse(stdout);
                        resolve(result);
                    } else {
                        resolve({
                            success: false,
                            error: '清理脚本执行失败',
                            exit_code: code,
                            stdout: stdout,
                            stderr: stderr
                        });
                    }
                } catch (parseError) {
                    resolve({
                        success: false,
                        error: '清理结果解析失败',
                        raw_output: stdout,
                        parse_error: parseError.message
                    });
                }
            });

            // 10分钟超时
            setTimeout(() => {
                cleanup.kill('SIGTERM');
                resolve({
                    success: false,
                    error: '自动化清理超时 (10分钟)',
                    timeout: true
                });
            }, 600000);
        });
    }

    async removeNodeFromDatabase(nodeId) {
        // 完整的数据库清理 - 级联删除相关记录
        const deleteQueries = [
            'DELETE FROM bots WHERE node_id = ?',
            'DELETE FROM keys WHERE node_id = ?', 
            'DELETE FROM node_backups WHERE node_id = ?',
            'DELETE FROM nodes WHERE id = ?'
        ];

        for (const query of deleteQueries) {
            try {
                this.db.prepare(query).run(nodeId);
            } catch (error) {
                console.warn(`数据库清理警告 (${query}):`, error.message);
            }
        }

        console.log(`✅ 节点 ${nodeId} 的数据库记录已完全清理`);
    }

    async getRetirementStatus(req, res) {
        const { nodeId } = req.params;
        
        // 检查节点是否还存在于数据库
        const nodeExists = this.db.prepare('SELECT COUNT(*) as count FROM nodes WHERE id = ?').get(nodeId);
        
        res.json({
            node_id: nodeId,
            exists_in_database: nodeExists.count > 0,
            retirement_complete: nodeExists.count === 0,
            timestamp: new Date().toISOString()
        });
    }

    async batchRetireNodes(req, res) {
        const { nodeIds, force = false } = req.body;
        
        if (!Array.isArray(nodeIds) || nodeIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: '需要提供节点ID数组'
            });
        }

        console.log(`🚀 批量自动化退役: ${nodeIds.join(', ')}`);
        
        const results = [];
        
        for (const nodeId of nodeIds) {
            try {
                // 模拟单个节点退役调用
                const result = await this.retireNodeAutomated({ params: { nodeId } }, { json: () => null });
                results.push({ nodeId, ...result });
            } catch (error) {
                results.push({
                    nodeId,
                    success: false,
                    error: error.message
                });
            }
        }

        const successful = results.filter(r => r.success).length;
        
        res.json({
            success: successful > 0,
            message: `批量退役完成: ${successful}/${nodeIds.length} 个节点成功`,
            results: results,
            automation_level: '100% - 零人工干预批量操作'
        });
    }

    getRouter() {
        return this.router;
    }
}

module.exports = AutomatedNodeRetirementAPI;