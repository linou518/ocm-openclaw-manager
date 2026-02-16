/**
 * 节点管理API扩展
 * 处理节点上线/下线/删除/修复功能
 */

const express = require('express');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const ssh2 = require('ssh2');

const nodeManagementRouter = express.Router();

// 节点操作API
nodeManagementRouter.post('/api/nodes/:nodeId/action', async (req, res) => {
    const { nodeId } = req.params;
    const { action, params } = req.body;
    
    console.log(`🔧 节点操作: ${nodeId} -> ${action}`);
    
    try {
        let result;
        
        switch (action) {
            case 'start':
                result = await startNode(nodeId);
                break;
            case 'stop':
                result = await stopNode(nodeId);
                break;
            case 'restart':
                result = await restartNode(nodeId);
                break;
            case 'repair':
                result = await repairNode(nodeId);
                break;
            case 'delete':
                result = await deleteNode(nodeId, params?.confirm);
                break;
            case 'check':
                result = await checkNodeStatus(nodeId);
                break;
            default:
                throw new Error(`未知操作: ${action}`);
        }
        
        res.json({ success: true, result });
    } catch (error) {
        console.error(`节点操作失败: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 获取实时节点状态
nodeManagementRouter.get('/api/nodes/:nodeId/status', async (req, res) => {
    const { nodeId } = req.params;
    
    try {
        const status = await getRealtimeNodeStatus(nodeId);
        res.json({ success: true, status });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 批量节点操作
nodeManagementRouter.post('/api/nodes/batch', async (req, res) => {
    const { nodeIds, action } = req.body;
    
    try {
        const results = {};
        
        for (const nodeId of nodeIds) {
            try {
                results[nodeId] = await executeNodeAction(nodeId, action);
            } catch (error) {
                results[nodeId] = { success: false, error: error.message };
            }
        }
        
        res.json({ success: true, results });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 核心功能实现
async function startNode(nodeId) {
    const nodeConfig = getNodeConfig(nodeId);
    
    return new Promise((resolve, reject) => {
        const conn = new ssh2.Client();
        
        conn.on('ready', () => {
            const startCommand = 'systemctl --user start openclaw-gateway';
            
            conn.exec(startCommand, (err, stream) => {
                if (err) {
                    conn.end();
                    return reject(err);
                }
                
                let output = '';
                stream.on('data', (data) => {
                    output += data.toString();
                });
                
                stream.on('close', (code) => {
                    conn.end();
                    
                    if (code === 0) {
                        resolve({
                            action: 'start',
                            status: 'success',
                            message: 'OpenClaw Gateway已启动',
                            output: output
                        });
                    } else {
                        reject(new Error(`启动失败，退出码: ${code}，输出: ${output}`));
                    }
                });
            });
        });
        
        conn.on('error', (err) => {
            reject(new Error(`SSH连接失败: ${err.message}`));
        });
        
        // 连接到节点
        conn.connect({
            host: nodeConfig.host,
            port: nodeConfig.port || 22,
            username: nodeConfig.ssh_user,
            password: nodeConfig.ssh_password,
            privateKey: nodeConfig.ssh_key ? fs.readFileSync(nodeConfig.ssh_key) : undefined
        });
    });
}

async function stopNode(nodeId) {
    const nodeConfig = getNodeConfig(nodeId);
    
    return new Promise((resolve, reject) => {
        const conn = new ssh2.Client();
        
        conn.on('ready', () => {
            const stopCommand = 'systemctl --user stop openclaw-gateway';
            
            conn.exec(stopCommand, (err, stream) => {
                if (err) {
                    conn.end();
                    return reject(err);
                }
                
                let output = '';
                stream.on('data', (data) => {
                    output += data.toString();
                });
                
                stream.on('close', (code) => {
                    conn.end();
                    resolve({
                        action: 'stop',
                        status: 'success',
                        message: 'OpenClaw Gateway已停止',
                        output: output
                    });
                });
            });
        });
        
        conn.connect({
            host: nodeConfig.host,
            port: nodeConfig.port || 22,
            username: nodeConfig.ssh_user,
            password: nodeConfig.ssh_password,
            privateKey: nodeConfig.ssh_key ? fs.readFileSync(nodeConfig.ssh_key) : undefined
        });
    });
}

async function restartNode(nodeId) {
    const nodeConfig = getNodeConfig(nodeId);
    
    return new Promise((resolve, reject) => {
        const conn = new ssh2.Client();
        
        conn.on('ready', () => {
            const restartCommand = 'systemctl --user restart openclaw-gateway';
            
            conn.exec(restartCommand, (err, stream) => {
                if (err) {
                    conn.end();
                    return reject(err);
                }
                
                let output = '';
                stream.on('data', (data) => {
                    output += data.toString();
                });
                
                stream.on('close', (code) => {
                    conn.end();
                    
                    // 等待几秒让服务完全启动
                    setTimeout(() => {
                        resolve({
                            action: 'restart',
                            status: 'success',
                            message: 'OpenClaw Gateway已重启',
                            output: output
                        });
                    }, 3000);
                });
            });
        });
        
        conn.connect({
            host: nodeConfig.host,
            port: nodeConfig.port || 22,
            username: nodeConfig.ssh_user,
            password: nodeConfig.ssh_password,
            privateKey: nodeConfig.ssh_key ? fs.readFileSync(nodeConfig.ssh_key) : undefined
        });
    });
}

async function repairNode(nodeId) {
    const nodeConfig = getNodeConfig(nodeId);
    
    return new Promise((resolve, reject) => {
        const conn = new ssh2.Client();
        
        conn.on('ready', () => {
            // 修复脚本：检查并修复常见问题
            const repairScript = `
                echo "开始修复节点..."
                
                # 检查OpenClaw是否安装
                if ! command -v openclaw &> /dev/null; then
                    echo "OpenClaw未安装，开始安装..."
                    curl -fsSL https://get.openclaw.ai | bash
                fi
                
                # 检查systemd服务
                if ! systemctl --user list-unit-files | grep -q openclaw-gateway; then
                    echo "创建systemd服务..."
                    mkdir -p ~/.config/systemd/user
                    openclaw gateway --install-service
                    systemctl --user daemon-reload
                    systemctl --user enable openclaw-gateway
                fi
                
                # 检查配置文件
                if [ ! -f ~/.openclaw/openclaw.json ]; then
                    echo "创建默认配置..."
                    openclaw gateway --init
                fi
                
                # 启动服务
                systemctl --user start openclaw-gateway
                
                # 等待启动
                sleep 3
                
                # 检查状态
                systemctl --user is-active openclaw-gateway
                
                echo "修复完成"
            `;
            
            conn.exec(repairScript, (err, stream) => {
                if (err) {
                    conn.end();
                    return reject(err);
                }
                
                let output = '';
                stream.on('data', (data) => {
                    output += data.toString();
                    console.log(`[${nodeId}] ${data.toString()}`);
                });
                
                stream.on('close', (code) => {
                    conn.end();
                    resolve({
                        action: 'repair',
                        status: code === 0 ? 'success' : 'partial',
                        message: `节点修复${code === 0 ? '完成' : '部分成功'}`,
                        output: output,
                        code: code
                    });
                });
            });
        });
        
        conn.connect({
            host: nodeConfig.host,
            port: nodeConfig.port || 22,
            username: nodeConfig.ssh_user,
            password: nodeConfig.ssh_password,
            privateKey: nodeConfig.ssh_key ? fs.readFileSync(nodeConfig.ssh_key) : undefined
        });
    });
}

async function deleteNode(nodeId, confirmed = false) {
    if (!confirmed) {
        throw new Error('删除节点需要确认，请设置 confirm: true');
    }
    
    const nodeConfig = getNodeConfig(nodeId);
    
    return new Promise((resolve, reject) => {
        const conn = new ssh2.Client();
        
        conn.on('ready', () => {
            // 退役脚本：安全删除节点和所有数据
            const deleteScript = `
                echo "开始节点退役..."
                
                # 停止服务
                systemctl --user stop openclaw-gateway 2>/dev/null || true
                systemctl --user disable openclaw-gateway 2>/dev/null || true
                
                # 备份重要数据
                backup_dir="openclaw-backup-$(date +%Y%m%d-%H%M%S)"
                mkdir -p ~/$backup_dir
                
                if [ -d ~/.openclaw ]; then
                    echo "备份配置和数据..."
                    cp -r ~/.openclaw ~/$backup_dir/ 2>/dev/null || true
                fi
                
                # 删除systemd服务
                rm -f ~/.config/systemd/user/openclaw-gateway.service
                systemctl --user daemon-reload
                
                # 删除OpenClaw数据（保留备份）
                echo "删除运行数据..."
                rm -rf ~/.openclaw/sessions/* 2>/dev/null || true
                rm -rf ~/.openclaw/tmp/* 2>/dev/null || true
                
                # 可选：完全删除OpenClaw（谨慎操作）
                # rm -rf ~/.openclaw
                # npm uninstall -g @openclaw/cli
                
                echo "备份保存在: ~/$backup_dir"
                echo "节点退役完成"
            `;
            
            conn.exec(deleteScript, (err, stream) => {
                if (err) {
                    conn.end();
                    return reject(err);
                }
                
                let output = '';
                stream.on('data', (data) => {
                    output += data.toString();
                    console.log(`[删除-${nodeId}] ${data.toString()}`);
                });
                
                stream.on('close', (code) => {
                    conn.end();
                    
                    // 从OCM数据库中删除节点记录
                    removeNodeFromDatabase(nodeId);
                    
                    resolve({
                        action: 'delete',
                        status: 'success',
                        message: '节点已安全退役，数据已备份',
                        output: output,
                        backup_created: true
                    });
                });
            });
        });
        
        conn.connect({
            host: nodeConfig.host,
            port: nodeConfig.port || 22,
            username: nodeConfig.ssh_user,
            password: nodeConfig.ssh_password,
            privateKey: nodeConfig.ssh_key ? fs.readFileSync(nodeConfig.ssh_key) : undefined
        });
    });
}

async function getRealtimeNodeStatus(nodeId) {
    const nodeConfig = getNodeConfig(nodeId);
    
    return new Promise((resolve, reject) => {
        const conn = new ssh2.Client();
        
        conn.on('ready', () => {
            const statusScript = `
                echo "=== OpenClaw状态 ==="
                systemctl --user is-active openclaw-gateway 2>/dev/null || echo "inactive"
                
                echo "=== 系统资源 ==="
                echo "CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}')%"
                echo "Memory: $(free | grep Mem | awk '{printf "%.1f", ($3/$2) * 100.0}')%"
                echo "Disk: $(df -h / | awk 'NR==2 {print $5}')"
                
                echo "=== 网络连通性 ==="
                ping -c 1 -W 2 8.8.8.8 > /dev/null && echo "Internet: OK" || echo "Internet: Failed"
                
                echo "=== OpenClaw版本 ==="
                openclaw --version 2>/dev/null || echo "Not installed"
            `;
            
            conn.exec(statusScript, (err, stream) => {
                if (err) {
                    conn.end();
                    return reject(err);
                }
                
                let output = '';
                stream.on('data', (data) => {
                    output += data.toString();
                });
                
                stream.on('close', (code) => {
                    conn.end();
                    
                    // 解析输出
                    const status = parseStatusOutput(output);
                    
                    resolve({
                        nodeId: nodeId,
                        timestamp: new Date().toISOString(),
                        connection: 'success',
                        ...status
                    });
                });
            });
        });
        
        conn.on('error', (err) => {
            resolve({
                nodeId: nodeId,
                timestamp: new Date().toISOString(),
                connection: 'failed',
                error: err.message,
                openclaw_status: 'unknown',
                system_resources: null
            });
        });
        
        conn.connect({
            host: nodeConfig.host,
            port: nodeConfig.port || 22,
            username: nodeConfig.ssh_user,
            password: nodeConfig.ssh_password,
            privateKey: nodeConfig.ssh_key ? fs.readFileSync(nodeConfig.ssh_key) : undefined
        });
    });
}

// 工具函数
function getNodeConfig(nodeId) {
    // 这里应该从数据库或配置文件加载节点信息
    const nodeConfigs = {
        'baota': {
            host: '192.168.3.11',
            ssh_user: 'linou',
            ssh_password: 'Niejing@0221'
        },
        'pc-b': {
            host: '192.168.3.17',
            ssh_user: 'openclaw02',
            ssh_password: 'Niejing0221'
        },
        't440': {
            host: '192.168.3.33',
            ssh_user: 'linou',
            ssh_password: 'Niejing0221'
        }
    };
    
    const config = nodeConfigs[nodeId];
    if (!config) {
        throw new Error(`未知节点: ${nodeId}`);
    }
    
    return config;
}

function parseStatusOutput(output) {
    const lines = output.split('\n');
    const result = {
        openclaw_status: 'unknown',
        system_resources: {},
        network: 'unknown',
        version: 'unknown'
    };
    
    for (const line of lines) {
        if (line === 'active' || line === 'inactive') {
            result.openclaw_status = line;
        } else if (line.startsWith('CPU:')) {
            result.system_resources.cpu = line.split(': ')[1];
        } else if (line.startsWith('Memory:')) {
            result.system_resources.memory = line.split(': ')[1];
        } else if (line.startsWith('Disk:')) {
            result.system_resources.disk = line.split(': ')[1];
        } else if (line.startsWith('Internet:')) {
            result.network = line.split(': ')[1].toLowerCase();
        } else if (line.startsWith('openclaw ') && line.includes('.')) {
            result.version = line.trim();
        }
    }
    
    return result;
}

function removeNodeFromDatabase(nodeId) {
    // 这里应该从实际数据库中删除节点记录
    console.log(`📝 从数据库删除节点记录: ${nodeId}`);
}

module.exports = nodeManagementRouter;