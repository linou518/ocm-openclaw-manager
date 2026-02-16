#!/usr/bin/env python3
"""
OCM CLI - SSH连接管理器
处理到OpenClaw节点的SSH连接、命令执行和文件传输

作者: Joe (OpenClaw Manager)  
创建: 2026-02-16
"""

import paramiko
import socket
import logging
from pathlib import Path
import json
import time
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

class SSHConnectionManager:
    def __init__(self):
        self.connections = {}  # 连接池
        
    def test_connection(self, host: str, port: int, username: str, password: str = None, key_path: str = None) -> Dict:
        """测试SSH连接"""
        try:
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            # 尝试连接
            if key_path and Path(key_path).exists():
                ssh.connect(host, port=port, username=username, key_filename=key_path, timeout=10)
            elif password:
                ssh.connect(host, port=port, username=username, password=password, timeout=10)
            else:
                ssh.connect(host, port=port, username=username, timeout=10)
            
            # 测试基本命令执行
            stdin, stdout, stderr = ssh.exec_command("echo 'SSH连接测试成功'", timeout=5)
            result = stdout.read().decode().strip()
            
            ssh.close()
            
            if "SSH连接测试成功" in result:
                return {"status": "success", "message": "SSH连接正常"}
            else:
                return {"status": "error", "message": "连接成功但命令执行失败"}
                
        except paramiko.AuthenticationException:
            return {"status": "error", "message": "SSH认证失败，请检查用户名密码或密钥"}
        except paramiko.SSHException as e:
            return {"status": "error", "message": f"SSH连接异常: {str(e)}"}
        except socket.timeout:
            return {"status": "error", "message": "连接超时，请检查主机IP和端口"}
        except Exception as e:
            return {"status": "error", "message": f"连接失败: {str(e)}"}
    
    def execute_command(self, host: str, port: int, username: str, command: str, 
                       password: str = None, key_path: str = None, timeout: int = 30) -> Dict:
        """执行SSH命令"""
        try:
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            # 建立连接
            if key_path and Path(key_path).exists():
                ssh.connect(host, port=port, username=username, key_filename=key_path)
            elif password:
                ssh.connect(host, port=port, username=username, password=password)
            else:
                ssh.connect(host, port=port, username=username)
            
            # 执行命令
            stdin, stdout, stderr = ssh.exec_command(command, timeout=timeout)
            
            stdout_data = stdout.read().decode()
            stderr_data = stderr.read().decode()
            exit_code = stdout.channel.recv_exit_status()
            
            ssh.close()
            
            return {
                "status": "success",
                "stdout": stdout_data,
                "stderr": stderr_data,
                "exit_code": exit_code
            }
            
        except Exception as e:
            return {
                "status": "error",
                "message": f"命令执行失败: {str(e)}"
            }
    
    def check_openclaw_installation(self, host: str, port: int, username: str, 
                                   openclaw_path: str = "/usr/bin/openclaw",
                                   password: str = None, key_path: str = None) -> Dict:
        """检查OpenClaw程序安装状态"""
        
        # 1. 检查OpenClaw二进制文件
        result = self.execute_command(
            host, port, username, 
            f"test -f {openclaw_path} && echo 'EXISTS' || echo 'NOT_FOUND'",
            password, key_path
        )
        
        if result["status"] == "error":
            return result
        
        if "NOT_FOUND" in result["stdout"]:
            return {
                "status": "error",
                "message": f"OpenClaw程序未找到: {openclaw_path}"
            }
        
        # 2. 检查版本信息
        version_result = self.execute_command(
            host, port, username,
            f"{openclaw_path} --version",
            password, key_path
        )
        
        version = "未知版本"
        if version_result["status"] == "success":
            version = version_result["stdout"].strip()
        
        # 3. 检查OpenClaw服务状态
        service_result = self.execute_command(
            host, port, username,
            "systemctl --user is-active openclaw-gateway",
            password, key_path
        )
        
        service_status = "未知"
        if service_result["status"] == "success":
            service_status = service_result["stdout"].strip()
        
        # 4. 检查端口监听
        port_result = self.execute_command(
            host, port, username,
            "ss -tlnp | grep :18789 || echo 'NOT_LISTENING'",
            password, key_path
        )
        
        port_listening = False
        if port_result["status"] == "success" and "NOT_LISTENING" not in port_result["stdout"]:
            port_listening = True
        
        return {
            "status": "success",
            "openclaw_version": version,
            "service_status": service_status,
            "port_listening": port_listening,
            "overall_status": "active" if service_status == "active" and port_listening else "inactive"
        }
    
    def get_node_bots(self, host: str, port: int, username: str,
                     password: str = None, key_path: str = None) -> Dict:
        """获取节点上运行的Bot列表"""
        
        # 1. 读取agents配置
        agents_result = self.execute_command(
            host, port, username,
            "cd ~/.openclaw && cat openclaw.json | jq -r '.agents.list[]?' || echo 'NO_AGENTS'",
            password, key_path
        )
        
        agents = []
        if agents_result["status"] == "success" and "NO_AGENTS" not in agents_result["stdout"]:
            agents = [a.strip() for a in agents_result["stdout"].split('\n') if a.strip()]
        
        # 2. 读取Telegram Bot配置
        bots_result = self.execute_command(
            host, port, username,
            "cd ~/.openclaw && cat openclaw.json | jq -r '.telegram.accounts[]?.botName?' || echo 'NO_BOTS'",
            password, key_path
        )
        
        bot_names = []
        if bots_result["status"] == "success" and "NO_BOTS" not in bots_result["stdout"]:
            bot_names = [b.strip() for b in bots_result["stdout"].split('\n') if b.strip()]
        
        # 3. 检查运行中的进程
        process_result = self.execute_command(
            host, port, username,
            "pgrep -f openclaw | wc -l",
            password, key_path
        )
        
        process_count = 0
        if process_result["status"] == "success":
            try:
                process_count = int(process_result["stdout"].strip())
            except:
                pass
        
        return {
            "status": "success",
            "agents": agents,
            "bot_names": bot_names,
            "process_count": process_count
        }
    
    def restart_node_service(self, host: str, port: int, username: str,
                           password: str = None, key_path: str = None) -> Dict:
        """重启节点OpenClaw服务"""
        restart_log = []
        
        try:
            # 1. 停止服务
            restart_log.append("停止OpenClaw服务...")
            stop_result = self.execute_command(
                host, port, username,
                "systemctl --user stop openclaw-gateway",
                password, key_path, timeout=10
            )
            
            if stop_result["status"] == "error":
                restart_log.append(f"停止服务失败: {stop_result['message']}")
                return {"status": "error", "message": "停止服务失败", "log": restart_log}
            
            time.sleep(2)
            
            # 2. 检查残留进程
            restart_log.append("检查残留进程...")
            check_result = self.execute_command(
                host, port, username,
                "pgrep -f openclaw || echo 'NO_PROCESSES'",
                password, key_path
            )
            
            if check_result["status"] == "success" and "NO_PROCESSES" not in check_result["stdout"]:
                pids = check_result["stdout"].strip()
                restart_log.append(f"强制停止残留进程: {pids}")
                self.execute_command(
                    host, port, username,
                    "pkill -9 -f openclaw",
                    password, key_path
                )
                time.sleep(2)
            
            # 3. 清理端口占用
            restart_log.append("清理端口占用...")
            self.execute_command(
                host, port, username,
                "lsof -ti:18789 | xargs -r kill -9 2>/dev/null || true",
                password, key_path
            )
            
            # 4. 启动服务
            restart_log.append("启动OpenClaw服务...")
            start_result = self.execute_command(
                host, port, username,
                "systemctl --user start openclaw-gateway",
                password, key_path, timeout=15
            )
            
            if start_result["status"] == "error":
                restart_log.append(f"启动服务失败: {start_result['message']}")
                return {"status": "error", "message": "启动服务失败", "log": restart_log}
            
            # 5. 等待服务启动
            restart_log.append("等待服务启动...")
            for i in range(10):
                time.sleep(1)
                status_result = self.execute_command(
                    host, port, username,
                    "systemctl --user is-active openclaw-gateway",
                    password, key_path
                )
                
                if status_result["status"] == "success" and "active" in status_result["stdout"]:
                    break
            
            # 6. 验证最终状态
            final_check = self.check_openclaw_installation(host, port, username, password=password, key_path=key_path)
            
            if final_check["status"] == "success" and final_check["overall_status"] == "active":
                restart_log.append("✅ 重启成功! 服务正常运行")
                return {
                    "status": "success",
                    "message": "节点重启成功",
                    "log": restart_log,
                    "service_info": final_check
                }
            else:
                restart_log.append("❌ 重启失败! 服务未正常启动")
                return {
                    "status": "error",
                    "message": "服务重启后未正常运行",
                    "log": restart_log
                }
                
        except Exception as e:
            restart_log.append(f"❌ 重启异常: {str(e)}")
            return {
                "status": "error",
                "message": f"重启过程异常: {str(e)}",
                "log": restart_log
            }

if __name__ == "__main__":
    # 测试用例
    ssh_manager = SSHConnectionManager()
    
    # 测试连接
    result = ssh_manager.test_connection("192.168.3.73", 22, "openclaw01")
    print("连接测试:", result)
    
    # 检查OpenClaw安装
    if result["status"] == "success":
        check_result = ssh_manager.check_openclaw_installation("192.168.3.73", 22, "openclaw01")
        print("OpenClaw检查:", check_result)
        
        # 获取Bot列表
        bots_result = ssh_manager.get_node_bots("192.168.3.73", 22, "openclaw01")
        print("Bot列表:", bots_result)