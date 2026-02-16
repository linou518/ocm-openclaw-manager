#!/usr/bin/env python3
"""
增强的节点退役清理系统
彻底清理节点环境，包括OpenClaw、配置、服务等
"""

import paramiko
import json
import subprocess
import time

class EnhancedNodeCleanup:
    def __init__(self):
        self.cleanup_commands = {
            'ubuntu': [
                # 停止OpenClaw服务
                'systemctl --user stop openclaw-gateway 2>/dev/null || true',
                'systemctl --user disable openclaw-gateway 2>/dev/null || true',
                'pkill -f openclaw 2>/dev/null || true',
                
                # 卸载OpenClaw
                'npm uninstall -g openclaw 2>/dev/null || true',
                'sudo npm uninstall -g openclaw 2>/dev/null || true',
                'rm -f /usr/local/bin/openclaw /usr/bin/openclaw',
                
                # 清理配置和数据
                'rm -rf ~/.openclaw',
                'rm -rf ~/.config/systemd/user/openclaw*',
                'rm -rf ~/shared',
                'rm -rf /tmp/bot-config-*',
                
                # 清理进程和端口
                'sudo netstat -tlnp | grep :18789 | awk \'{print $7}\' | cut -d\'/\' -f1 | xargs sudo kill -9 2>/dev/null || true',
                
                # 重新加载systemd
                'systemctl --user daemon-reload',
                
                # 清理日志
                'rm -rf ~/openclaw*.log ~/.openclaw*.log',
            ]
        }
    
    def cleanup_node_completely(self, node_info):
        """完全清理节点"""
        try:
            print(f"🧹 开始完全清理节点: {node_info['host']}")
            
            # 1. SSH连接检查
            ssh = self.get_ssh_connection(node_info)
            if not ssh:
                return {'success': False, 'error': 'SSH连接失败'}
            
            # 2. 检测环境
            env_info = self.detect_environment(ssh)
            print(f"📋 检测到环境: {env_info.get('os', 'unknown')}")
            
            # 3. 执行清理命令
            cleanup_commands = self.cleanup_commands.get(env_info.get('os', 'ubuntu'), self.cleanup_commands['ubuntu'])
            
            results = []
            for cmd in cleanup_commands:
                try:
                    print(f"  执行: {cmd}")
                    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=30)
                    exit_status = stdout.channel.recv_exit_status()
                    
                    result = {
                        'command': cmd,
                        'exit_status': exit_status,
                        'stdout': stdout.read().decode()[:200],
                        'stderr': stderr.read().decode()[:200]
                    }
                    results.append(result)
                    
                    if exit_status != 0 and 'rm -f' not in cmd and 'pkill' not in cmd:
                        print(f"    ⚠️ 警告: {cmd} 退出状态 {exit_status}")
                        
                except Exception as e:
                    print(f"    ❌ 命令执行失败: {str(e)}")
                    results.append({'command': cmd, 'error': str(e)})
            
            # 4. 验证清理结果
            verification = self.verify_cleanup(ssh)
            
            ssh.close()
            
            return {
                'success': True,
                'message': f"✅ 节点 {node_info['host']} 清理完成",
                'details': {
                    'commands_executed': len(results),
                    'verification': verification,
                    'cleanup_results': results
                }
            }
            
        except Exception as e:
            return {'success': False, 'error': f"清理过程异常: {str(e)}"}
    
    def verify_cleanup(self, ssh):
        """验证清理结果"""
        verifications = {}
        
        try:
            # 检查OpenClaw程序
            stdin, stdout, stderr = ssh.exec_command('which openclaw 2>/dev/null')
            verifications['openclaw_removed'] = stdout.channel.recv_exit_status() != 0
            
            # 检查进程
            stdin, stdout, stderr = ssh.exec_command('ps aux | grep openclaw | grep -v grep')
            verifications['no_processes'] = len(stdout.read().decode().strip()) == 0
            
            # 检查端口
            stdin, stdout, stderr = ssh.exec_command('ss -tlnp | grep :18789')
            verifications['port_free'] = len(stdout.read().decode().strip()) == 0
            
            # 检查配置目录
            stdin, stdout, stderr = ssh.exec_command('ls ~/.openclaw 2>/dev/null')
            verifications['config_removed'] = stdout.channel.recv_exit_status() != 0
            
            # 检查systemd服务
            stdin, stdout, stderr = ssh.exec_command('systemctl --user is-active openclaw-gateway 2>/dev/null')
            verifications['service_removed'] = 'inactive' in stdout.read().decode() or stdout.channel.recv_exit_status() != 0
            
        except Exception as e:
            verifications['error'] = str(e)
        
        return verifications
    
    def detect_environment(self, ssh):
        """检测目标环境"""
        try:
            stdin, stdout, stderr = ssh.exec_command('cat /etc/os-release')
            os_release = stdout.read().decode()
            
            os_info = {}
            for line in os_release.split('\\n'):
                if '=' in line and not line.startswith('#'):
                    key, value = line.split('=', 1)
                    os_info[key] = value.strip('"')
            
            return {
                'os': os_info.get('ID', 'ubuntu').lower(),
                'version': os_info.get('VERSION_ID', 'unknown'),
                'pretty_name': os_info.get('PRETTY_NAME', 'Unknown OS')
            }
        except Exception as e:
            return {'os': 'ubuntu', 'error': str(e)}
    
    def get_ssh_connection(self, node_info):
        """获取SSH连接"""
        try:
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            connect_params = {
                'hostname': node_info['host'],
                'username': node_info['user'],
                'port': node_info.get('port', 22),
                'timeout': 30
            }
            
            if 'password' in node_info:
                connect_params['password'] = node_info['password']
            elif 'key_file' in node_info:
                connect_params['key_filename'] = node_info['key_file']
            
            ssh.connect(**connect_params)
            return ssh
            
        except Exception as e:
            print(f"❌ SSH连接失败: {str(e)}")
            return None
    
    def cleanup_from_database(self, node_id):
        """从数据库中清理节点记录"""
        try:
            import requests
            
            # 删除节点（这会触发级联删除相关的bots、keys等）
            response = requests.delete(f'http://localhost:8001/api/nodes/{node_id}')
            
            if response.status_code == 200:
                return {'success': True, 'message': '数据库记录已清理'}
            else:
                return {'success': False, 'error': f'数据库清理失败: {response.status_code}'}
                
        except Exception as e:
            return {'success': False, 'error': f'数据库清理异常: {str(e)}'}

# 命令行接口
if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("用法: python3 enhanced-node-cleanup.py '{\"host\": \"IP\", \"user\": \"username\", \"password\": \"pass\"}'")
        sys.exit(1)
    
    try:
        node_info = json.loads(sys.argv[1])
        
        cleanup = EnhancedNodeCleanup()
        result = cleanup.cleanup_node_completely(node_info)
        
        print(json.dumps(result, indent=2, ensure_ascii=False))
        
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}, indent=2, ensure_ascii=False))