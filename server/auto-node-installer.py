#!/usr/bin/env python3
"""
完全自动化的节点安装系统
零人工干预的OpenClaw自动化部署
"""

import paramiko
import json
import subprocess
import time
import sys
import logging

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger(__name__)

class AutoNodeInstaller:
    def __init__(self):
        self.ssh_timeout = 300  # 5分钟SSH超时
        self.install_commands = {
            'ubuntu': [
                # 1. 系统更新和依赖
                'sudo apt update -y',
                'curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -',
                'sudo apt install -y nodejs python3 python3-pip',
                
                # 2. 安装OpenClaw
                'sudo npm install -g openclaw@latest',
                
                # 3. 创建配置目录
                'mkdir -p ~/.openclaw/{workspace-main,sessions,agents}',
                
                # 4. 创建基础配置
                '''cat > ~/.openclaw/openclaw.json << 'EOF'
{
  "agents": {
    "list": [],
    "defaults": {
      "model": "anthropic/claude-sonnet-4"
    }
  },
  "auth": {
    "profiles": {}
  },
  "gateway": {
    "bind": "loopback",
    "port": 18789,
    "mode": "local"
  }
}
EOF''',
                
                # 5. 安装和启动Gateway服务
                'openclaw gateway install',
                'systemctl --user enable openclaw-gateway',
                'systemctl --user start openclaw-gateway',
                
                # 6. 验证安装
                'sleep 5',  # 等待服务启动
            ]
        }
    
    def install_node_completely(self, node_info):
        """完全自动化安装节点"""
        try:
            logger.info(f"🚀 开始自动化安装节点: {node_info['host']}")
            
            # 1. SSH连接
            ssh = self.get_ssh_connection(node_info)
            if not ssh:
                return {'success': False, 'error': 'SSH连接失败'}
            
            # 2. 检测环境
            env_info = self.detect_environment(ssh)
            logger.info(f"📋 检测到环境: {env_info.get('os', 'unknown')}")
            
            # 3. 执行安装命令序列
            install_commands = self.install_commands.get(env_info.get('os', 'ubuntu'))
            results = []
            
            for i, cmd in enumerate(install_commands, 1):
                try:
                    logger.info(f"  [{i}/{len(install_commands)}] 执行: {cmd[:50]}...")
                    
                    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=120)
                    exit_status = stdout.channel.recv_exit_status()
                    
                    stdout_text = stdout.read().decode()[:500]
                    stderr_text = stderr.read().decode()[:500]
                    
                    result = {
                        'step': i,
                        'command': cmd,
                        'exit_status': exit_status,
                        'success': exit_status == 0,
                        'stdout': stdout_text,
                        'stderr': stderr_text
                    }
                    results.append(result)
                    
                    if exit_status != 0 and 'curl' not in cmd and 'apt update' not in cmd:
                        logger.warning(f"    ⚠️ 步骤 {i} 警告: 退出码 {exit_status}")
                        
                except Exception as e:
                    logger.error(f"    ❌ 步骤 {i} 失败: {str(e)}")
                    results.append({'step': i, 'command': cmd, 'error': str(e), 'success': False})
                    break
            
            # 4. 安装后验证
            verification = self.verify_installation(ssh)
            
            ssh.close()
            
            return {
                'success': verification.get('installation_success', False),
                'message': f"✅ 节点 {node_info['host']} 自动化安装完成",
                'details': {
                    'environment': env_info,
                    'steps_completed': len([r for r in results if r.get('success', False)]),
                    'total_steps': len(install_commands),
                    'verification': verification,
                    'installation_results': results
                },
                'openclaw_version': verification.get('openclaw_version'),
                'gateway_status': verification.get('gateway_status')
            }
            
        except Exception as e:
            logger.error(f"❌ 自动化安装异常: {str(e)}")
            return {'success': False, 'error': f"安装过程异常: {str(e)}"}
    
    def verify_installation(self, ssh):
        """验证安装结果"""
        verifications = {}
        
        try:
            # 检查OpenClaw程序
            stdin, stdout, stderr = ssh.exec_command('which openclaw && openclaw --version')
            exit_status = stdout.channel.recv_exit_status()
            output = stdout.read().decode().strip()
            
            if exit_status == 0:
                verifications['openclaw_installed'] = True
                # 提取版本号
                version_lines = output.split('\\n')
                for line in version_lines:
                    if '20' in line and '.' in line:  # 匹配版本号格式如 2026.2.14
                        verifications['openclaw_version'] = line.strip()
                        break
            else:
                verifications['openclaw_installed'] = False
            
            # 检查Gateway服务
            stdin, stdout, stderr = ssh.exec_command('systemctl --user is-active openclaw-gateway')
            gateway_status = stdout.read().decode().strip()
            verifications['gateway_status'] = gateway_status
            verifications['gateway_running'] = gateway_status == 'active'
            
            # 检查端口绑定
            stdin, stdout, stderr = ssh.exec_command('ss -tlnp | grep :18789')
            port_output = stdout.read().decode()
            verifications['port_bound'] = len(port_output.strip()) > 0
            
            # 检查配置文件
            stdin, stdout, stderr = ssh.exec_command('ls ~/.openclaw/openclaw.json')
            verifications['config_exists'] = stdout.channel.recv_exit_status() == 0
            
            # 综合判断安装成功
            verifications['installation_success'] = (
                verifications.get('openclaw_installed', False) and
                verifications.get('gateway_running', False) and
                verifications.get('config_exists', False)
            )
            
        except Exception as e:
            verifications['error'] = str(e)
            verifications['installation_success'] = False
        
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
                'timeout': self.ssh_timeout
            }
            
            if 'password' in node_info:
                connect_params['password'] = node_info['password']
            elif 'key_file' in node_info:
                connect_params['key_filename'] = node_info['key_file']
            
            ssh.connect(**connect_params)
            return ssh
            
        except Exception as e:
            logger.error(f"❌ SSH连接失败: {str(e)}")
            return None

# 命令行接口
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python3 auto-node-installer.py '{\"host\": \"IP\", \"user\": \"username\", \"password\": \"pass\"}'")
        sys.exit(1)
    
    try:
        node_info = json.loads(sys.argv[1])
        
        installer = AutoNodeInstaller()
        result = installer.install_node_completely(node_info)
        
        print(json.dumps(result, indent=2, ensure_ascii=False))
        
        # 退出码表示成功或失败
        sys.exit(0 if result['success'] else 1)
        
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}, indent=2, ensure_ascii=False))
        sys.exit(1)