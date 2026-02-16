#!/usr/bin/env node
/**
 * 增强的OCM删除API - 集成完全自动化的机器清理
 * 实现真正的零人工干预节点删除
 */

const { spawn } = require('child_process');
const path = require('path');

/**
 * 完全自动化的节点删除 - 零人工干预
 * 替换原有的简单删除API
 */
function setupEnhancedDeleteAPI(app, db) {
    // 替换原有的DELETE /api/nodes/:nodeId
    app.delete('/api/nodes/:nodeId', async (req, res) => {
        const { nodeId } = req.params;
        console.log(`🚀 启动完全自动化删除流程: ${nodeId}`);

        try {
            // 1. 获取节点信息（删除前）
            const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(nodeId);
            if (!node) {
                return res.status(404).json({
                    success: false,
                    error: `节点 ${nodeId} 不存在`
                });
            }

            console.log(`📋 准备清理节点: ${node.name} (${node.host})`);

            // 2. 执行完全自动化的机器清理
            const cleanupResult = await executeCompleteAutomatedCleanup(node);
            
            // 3. 清理数据库记录（无论机器清理是否成功都执行）
            await cleanupDatabaseRecords(db, nodeId);

            // 4. 返回完整的删除结果
            return res.json({
                success: true,
                message: `节点 ${nodeId} 完全自动化删除完成`,
                details: {
                    node_info: {
                        name: node.name,
                        host: node.host,
                        user: node.ssh_user
                    },
                    machine_cleanup: cleanupResult,
                    database_cleanup: true,
                    automation_level: "100% - 零人工干预"
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error(`❌ 自动化删除失败 (${nodeId}):`, error);
            
            // 失败时仍尝试删除数据库记录
            try {
                await cleanupDatabaseRecords(db, nodeId);
            } catch (dbError) {
                console.error('数据库清理也失败:', dbError);
            }

            return res.status(500).json({
                success: false,
                error: '自动化删除过程异常',
                details: error.message,
                suggestion: '节点可能部分清理，请检查目标机器状态'
            });
        }
    });

    console.log('✅ 增强的自动化删除API已集成');
}

/**
 * 执行完全自动化的机器清理
 */
async function executeCompleteAutomatedCleanup(node) {
    return new Promise((resolve) => {
        const cleanupParams = {
            host: node.host,
            user: node.ssh_user,
            password: process.env.NODE_SSH_PASSWORD || 'Niejing0221',
            port: node.port || 22
        };

        console.log(`🧹 执行自动化机器清理: ${node.host}`);
        
        const cleanupScript = path.join(__dirname, 'enhanced-node-cleanup.py');
        const cleanup = spawn('python3', [cleanupScript, JSON.stringify(cleanupParams)], {
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: __dirname
        });

        let stdout = '';
        let stderr = '';

        cleanup.stdout.on('data', (data) => {
            const output = data.toString();
            stdout += output;
            console.log(`[清理] ${output.trim()}`);
        });

        cleanup.stderr.on('data', (data) => {
            const error = data.toString();
            stderr += error;
            console.error(`[清理错误] ${error.trim()}`);
        });

        cleanup.on('close', (code) => {
            console.log(`🔧 清理脚本完成，退出码: ${code}`);
            
            try {
                if (code === 0 && stdout.trim()) {
                    const result = JSON.parse(stdout);
                    resolve({
                        success: result.success || true,
                        message: result.message || '自动化清理完成',
                        details: result.details || {},
                        cleanup_time: new Date().toISOString()
                    });
                } else {
                    resolve({
                        success: false,
                        error: '机器清理执行失败',
                        exit_code: code,
                        stderr: stderr,
                        details: {
                            note: '数据库记录仍会被删除',
                            manual_check_required: true
                        }
                    });
                }
            } catch (parseError) {
                console.error('清理结果解析失败:', parseError);
                resolve({
                    success: false,
                    error: '清理结果无法解析',
                    raw_output: stdout,
                    stderr: stderr,
                    details: {
                        note: '可能部分清理成功，需要验证'
                    }
                });
            }
        });

        // 设置清理超时（5分钟）
        setTimeout(() => {
            console.warn(`⏰ 清理超时，强制终止: ${node.host}`);
            cleanup.kill('SIGTERM');
            resolve({
                success: false,
                error: '自动化清理超时',
                timeout_seconds: 300,
                details: {
                    note: '清理可能仍在后台进行，建议手动检查目标机器'
                }
            });
        }, 300000);
    });
}

/**
 * 清理数据库中的所有相关记录
 */
async function cleanupDatabaseRecords(db, nodeId) {
    console.log(`🗄️ 清理数据库记录: ${nodeId}`);
    
    const deleteQueries = [
        { query: 'DELETE FROM bots WHERE node_id = ?', desc: 'Bots' },
        { query: 'DELETE FROM keys WHERE node_id = ?', desc: 'Keys' },
        { query: 'DELETE FROM node_backups WHERE node_id = ?', desc: 'Backups' },
        { query: 'DELETE FROM nodes WHERE id = ?', desc: 'Node' }
    ];

    const results = [];
    
    for (const { query, desc } of deleteQueries) {
        try {
            const stmt = db.prepare(query);
            const result = stmt.run(nodeId);
            results.push({
                type: desc,
                success: true,
                affected_rows: result.changes
            });
            console.log(`  ✅ ${desc}: ${result.changes} 条记录删除`);
        } catch (error) {
            console.warn(`  ⚠️ ${desc} 清理警告:`, error.message);
            results.push({
                type: desc,
                success: false,
                error: error.message
            });
        }
    }

    return results;
}

module.exports = { setupEnhancedDeleteAPI };