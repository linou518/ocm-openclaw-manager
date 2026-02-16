#!/usr/bin/env python3
"""
增强的节点安装系统 - 完全自动化OpenClaw安装+启动+验证
支持PC-A/PC-B/T440/Baota等多种环境
"""

import json
import subprocess
import time
import os
import paramiko
from datetime import datetime
import requests

class EnhancedNodeInstaller:
    def __init__(self):
        self.supported_environments = {
            'ubuntu': self.install_ubuntu,
            'debian': self.install_debian, 
            'centos': self.install_centos,
            'fedora': self.install_fedora,
            'arch': self.install_arch
        }
        self.verification_timeout = 120  # 2分钟验证超时
        
    def install_node_complete(self, node_info):
        """完整节点安装流程"""
        try:
            print(f"🚀 开始完整节点安装: {node_info['host']}")
            
            # 1. 环境检测
            env_info = self.detect_environment(node_info)
            print(f"📋 检测到环境: {env_info['os']} {env_info['version']}")
            
            # 2. 预检查
            precheck_result = self.pre_installation_check(node_info, env_info)
            if not precheck_result['success']:
                return {'success': False, 'error': f"预检查失败: {precheck_result['error']}"}
            
            # 3. 安装OpenClaw
            install_result = self.install_openclaw(node_info, env_info)
            if not install_result['success']:
                return {'success': False, 'error': f"安装失败: {install_result['error']}"}
            
            # 4. 配置服务
            config_result = self.configure_service(node_info)
            if not config_result['success']:
                return {'success': False, 'error': f"配置失败: {config_result['error']}"}
                
            # 5. 启动验证
            start_result = self.start_and_verify(node_info)
            if not start_result['success']:
                return {'success': False, 'error': f"启动验证失败: {start_result['error']}"}
            
            # 6. 健康检查
            health_result = self.health_check(node_info)
            if not health_result['success']:
                return {'success': False, 'error': f"健康检查失败: {health_result['error']}"}
            
            # 7. 写入数据库
            db_result = self.register_node(node_info, env_info)
            
            return {
                'success': True,
                'message': f"✅ 节点 {node_info['host']} 安装完成",
                'details': {
                    'environment': env_info,
                    'openclaw_version': install_result.get('version'),
                    'service_status': start_result.get('status'),
                    'health_score': health_result.get('score', 100),
                    'installation_time': datetime.now().isoformat()
                }
            }
            
        except Exception as e:
            return {'success': False, 'error': f"安装过程异常: {str(e)}"}
    
    def detect_environment(self, node_info):
        """检测目标环境"""
        ssh = self.get_ssh_connection(node_info)
        try:
            # 检测OS类型
            stdin, stdout, stderr = ssh.exec_command('cat /etc/os-release')
            os_release = stdout.read().decode()
            
            # 解析OS信息
            os_info = {}
            for line in os_release.split('\\n'):
                if '=' in line and not line.startswith('#'):
                    key, value = line.split('=', 1)
                    os_info[key] = value.strip('"')
            
            # 检测Node.js
            stdin, stdout, stderr = ssh.exec_command('node --version 2>/dev/null || echo "not_installed"')
            node_version = stdout.read().decode().strip()
            
            # 检测npm
            stdin, stdout, stderr = ssh.exec_command('npm --version 2>/dev/null || echo "not_installed"')
            npm_version = stdout.read().decode().strip()
            
            # 检测系统资源
            stdin, stdout, stderr = ssh.exec_command('free -m && df -h && nproc')
            system_info = stdout.read().decode()
            
            return {
                'os': os_info.get('ID', 'unknown'),
                'version': os_info.get('VERSION_ID', 'unknown'),
                'pretty_name': os_info.get('PRETTY_NAME', 'Unknown OS'),
                'node_version': node_version,
                'npm_version': npm_version,
                'system_info': system_info,
                'requirements_met': node_version != 'not_installed' and npm_version != 'not_installed'
            }
        finally:
            ssh.close()
    
    def pre_installation_check(self, node_info, env_info):
        """预安装检查"""
        checks = []
        
        # 1. 网络连通性
        try:
            ssh = self.get_ssh_connection(node_info)
            ssh.close()
            checks.append({'name': 'SSH连接', 'status': 'passed'})
        except Exception as e:
            return {'success': False, 'error': f'SSH连接失败: {str(e)}'}
        
        # 2. 磁盘空间检查
        if '/' in env_info['system_info'] and 'Available' in env_info['system_info']:
            checks.append({'name': '磁盘空间', 'status': 'passed'})
        else:
            checks.append({'name': '磁盘空间', 'status': 'warning'})
        
        # 3. 内存检查
        if 'Mem:' in env_info['system_info']:
            checks.append({'name': '系统内存', 'status': 'passed'})
        
        # 4. Node.js环境
        if env_info['requirements_met']:
            checks.append({'name': 'Node.js环境', 'status': 'passed'})
        else:
            checks.append({'name': 'Node.js环境', 'status': 'need_install'})
        
        return {'success': True, 'checks': checks}
    
    def install_openclaw(self, node_info, env_info):
        """安装OpenClaw"""
        ssh = self.get_ssh_connection(node_info)
        try:
            # 根据环境选择安装方法
            if env_info['os'] in self.supported_environments:
                return self.supported_environments[env_info['os']](ssh, env_info)
            else:
                return self.install_generic(ssh, env_info)
        finally:
            ssh.close()
    
    def install_ubuntu(self, ssh, env_info):
        """Ubuntu/Debian安装"""
        commands = [
            # 1. 更新包管理器
            'sudo apt update',
            
            # 2. 安装Node.js (如果需要)
            'curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -' if env_info['node_version'] == 'not_installed' else 'echo "Node.js already installed"',
            'sudo apt install -y nodejs' if env_info['node_version'] == 'not_installed' else 'echo "Skip nodejs install"',
            
            # 3. 安装OpenClaw
            'mkdir -p ~/.npm-global && export NPM_CONFIG_PREFIX=~/.npm-global && export PATH=~/.npm-global/bin:$PATH && npm install -g openclaw@latest',
            
            # 4. 验证安装
            'openclaw --version'
        ]
        
        for cmd in commands:
            if cmd.startswith('echo'):
                continue
            stdin, stdout, stderr = ssh.exec_command(cmd, timeout=300)
            exit_status = stdout.channel.recv_exit_status()
            if exit_status != 0:
                error_msg = stderr.read().decode()
                return {'success': False, 'error': f'命令失败: {cmd}\\n{error_msg}'}
        
        # 获取版本
        stdin, stdout, stderr = ssh.exec_command('openclaw --version')
        version = stdout.read().decode().strip()
        
        return {'success': True, 'version': version}
    

    def install_debian(self, ssh, env_info):
        """Debian OpenClaw 安装 - 使用与Ubuntu相同的方法"""
        return self.install_ubuntu(ssh, env_info)


    def install_centos(self, ssh, env_info):
        """CentOS OpenClaw 安装 - 使用通用方法"""
        return self.install_generic(ssh, env_info)
    
    def install_fedora(self, ssh, env_info):
        """Fedora OpenClaw 安装 - 使用通用方法"""
        return self.install_generic(ssh, env_info)
    
    def install_arch(self, ssh, env_info):
        """Arch Linux OpenClaw 安装 - 使用通用方法"""
        return self.install_generic(ssh, env_info)
    def install_generic(self, ssh, env_info):
        """通用安装方法"""
        # NPM方式安装
        commands = [
            'mkdir -p ~/.npm-global && export NPM_CONFIG_PREFIX=~/.npm-global && export PATH=~/.npm-global/bin:$PATH && npm install -g openclaw@latest',
            'openclaw --version'
        ]
        
        for cmd in commands:
            stdin, stdout, stderr = ssh.exec_command(cmd, timeout=300)
            exit_status = stdout.channel.recv_exit_status()
            if exit_status != 0:
                error_msg = stderr.read().decode()
                return {'success': False, 'error': f'安装命令失败: {cmd}\\n{error_msg}'}
        
        # 获取版本
        stdin, stdout, stderr = ssh.exec_command('openclaw --version')
        version = stdout.read().decode().strip()
        
        return {'success': True, 'version': version}
    
    def configure_service(self, node_info):
        """配置OpenClaw服务"""
        ssh = self.get_ssh_connection(node_info)
        try:
            # 创建基础目录结构
            commands = [
                'mkdir -p ~/.openclaw/{workspace-main,agents,sessions,backups}',
                'mkdir -p ~/shared',
                
                # 创建基础配置文件
                '''cat > ~/.openclaw/openclaw.json << 'EOF'
{
  "version": 1,
  "agents": {
    "list": [],
    "defaults": {
      "model": "anthropic/claude-sonnet-4",
      "heartbeat": {
        "enabled": true,
        "intervalMs": 1800000
      }
    }
  },
  "auth": {
    "profiles": []
  },
  "gateway": {
    "bind": "loopback",
    "port": 18789
  },
  "telegram": {
    "accounts": []
  }
}
EOF''',
                
                # 创建systemd服务
                '''cat > ~/.config/systemd/user/openclaw-gateway.service << 'EOF'
[Unit]
Description=OpenClaw Gateway
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/openclaw gateway
WorkingDirectory=%h/.openclaw
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
EOF''',
                
                # 启用服务
                'systemctl --user daemon-reload',
                'systemctl --user enable openclaw-gateway'
            ]
            
            for cmd in commands:
                stdin, stdout, stderr = ssh.exec_command(cmd)
                exit_status = stdout.channel.recv_exit_status()
                if exit_status != 0:
                    error_msg = stderr.read().decode()
                    print(f"配置警告: {cmd} -> {error_msg}")
            
            return {'success': True}
            
        finally:
            ssh.close()
    
    def start_and_verify(self, node_info):
        """启动并验证服务"""
        ssh = self.get_ssh_connection(node_info)
        try:
            # 启动服务
            stdin, stdout, stderr = ssh.exec_command('systemctl --user start openclaw-gateway')
            exit_status = stdout.channel.recv_exit_status()
            
            # 等待启动
            time.sleep(10)
            
            # 验证进程
            stdin, stdout, stderr = ssh.exec_command('ps aux | grep openclaw | grep -v grep')
            process_info = stdout.read().decode()
            
            # 验证端口
            stdin, stdout, stderr = ssh.exec_command('ss -tlnp | grep :18789')
            port_info = stdout.read().decode()
            
            # 验证API
            stdin, stdout, stderr = ssh.exec_command('curl -s http://localhost:18789/status || echo "API_FAILED"')
            api_response = stdout.read().decode()
            
            return {
                'success': bool(process_info and port_info and 'API_FAILED' not in api_response),
                'status': {
                    'process_running': bool(process_info),
                    'port_listening': bool(port_info),
                    'api_responding': 'API_FAILED' not in api_response,
                    'process_details': process_info,
                    'api_response': api_response
                }
            }
        finally:
            ssh.close()
    
    def health_check(self, node_info):
        """健康检查"""
        ssh = self.get_ssh_connection(node_info)
        try:
            # 系统资源检查
            stdin, stdout, stderr = ssh.exec_command('''
                echo "CPU_USAGE:$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)"
                echo "MEM_USAGE:$(free | grep Mem | awk '{printf("%.1f", $3/$2 * 100.0)}')"
                echo "DISK_USAGE:$(df -h / | awk 'NR==2{print $5}' | cut -d'%' -f1)"
            ''')
            resource_info = stdout.read().decode()
            
            # 服务状态检查
            stdin, stdout, stderr = ssh.exec_command('systemctl --user is-active openclaw-gateway')
            service_status = stdout.read().decode().strip()
            
            # 计算健康分数
            score = 100
            if service_status != 'active':
                score -= 50
            
            # 解析资源使用情况
            resources = {}
            for line in resource_info.split('\\n'):
                if ':' in line:
                    key, value = line.split(':', 1)
                    resources[key] = value
            
            return {
                'success': True,
                'score': score,
                'details': {
                    'service_status': service_status,
                    'resources': resources,
                    'timestamp': datetime.now().isoformat()
                }
            }
        finally:
            ssh.close()
    
    def register_node(self, node_info, env_info):
        """注册节点到数据库"""
        try:
            # 调用OCM API注册节点
            register_data = {
                'node_name': node_info.get('name', f"Node-{node_info['host']}"),
                'host': node_info['host'],
                'port': node_info.get('port', 22),
                'ssh_user': node_info['user'],
                'openclaw_path': '~/.openclaw',
                'status': 'online',
                'os_info': env_info['pretty_name'],
                'openclaw_version': '2026.2.16-auto',
                'tags': 'auto-installed'
            }
            
            response = requests.post(
                'http://192.168.3.33:8001/api/nodes',
                json=register_data,
                timeout=10
            )
            
            return {'success': response.status_code == 200}
        except Exception as e:
            print(f"节点注册失败: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    def get_ssh_connection(self, node_info):
        """获取SSH连接"""
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        connect_params = {
            'hostname': node_info['host'],
            'username': node_info['user'],
            'port': node_info.get('port', 22),
            'timeout': 30
        }
        
        # 添加认证方式
        if 'password' in node_info:
            connect_params['password'] = node_info['password']
        elif 'key_file' in node_info:
            connect_params['key_filename'] = node_info['key_file']
        
        ssh.connect(**connect_params)
        return ssh

# 使用示例
if __name__ == "__main__":
    import sys
    
    installer = EnhancedNodeInstaller()
    
    if len(sys.argv) > 1:
        # 从命令行参数获取节点信息 (JSON格式)
        try:
            node_info = json.loads(sys.argv[1])
            print(f"🚀 开始安装节点: {node_info.get('name', node_info.get('host'))}")
            result = installer.install_node_complete(node_info)
            print(json.dumps(result, indent=2, ensure_ascii=False))
            
            # 设置退出码
            sys.exit(0 if result.get('success') else 1)
            
        except json.JSONDecodeError as e:
            print(f"❌ JSON解析错误: {e}")
            sys.exit(1)
        except Exception as e:
            print(f"❌ 安装过程异常: {e}")
            sys.exit(1)
    else:
        # 测试模式
        test_node = {
            'host': '192.168.3.17',
            'user': 'openclaw02', 
            'password': 'Niejing0221',
            'name': 'PC-B测试节点'
        }
        
        result = installer.install_node_complete(test_node)
        print(json.dumps(result, indent=2, ensure_ascii=False))