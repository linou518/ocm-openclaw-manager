#!/usr/bin/env python3
"""
自动化节点健康监控系统
实时监控OpenClaw节点状态并自动更新数据库
"""

import paramiko
import json
import sqlite3
import time
import logging
from datetime import datetime
import threading
import sys
import os

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class AutoHealthMonitor:
    def __init__(self, db_path='./db/ocm.db'):
        self.db_path = db_path
        self.monitoring_interval = 300  # 5分钟检查间隔
        self.ssh_timeout = 30
        self.is_running = False
        
    def start_monitoring(self):
        """启动健康监控服务"""
        logger.info("🚀 启动自动化节点健康监控服务...")
        self.is_running = True
        
        monitor_thread = threading.Thread(target=self.monitoring_loop, daemon=True)
        monitor_thread.start()
        
        logger.info("✅ 健康监控服务已启动")
        return monitor_thread
    
    def stop_monitoring(self):
        """停止监控服务"""
        logger.info("⏹️ 停止健康监控服务...")
        self.is_running = False
    
    def monitoring_loop(self):
        """监控主循环"""
        while self.is_running:
            try:
                self.check_all_nodes()
                time.sleep(self.monitoring_interval)
            except Exception as e:
                logger.error(f"❌ 监控循环异常: {str(e)}")
                time.sleep(60)  # 出错时等待1分钟再重试
    
    def check_all_nodes(self):
        """检查所有节点的健康状态"""
        try:
            nodes = self.get_nodes_from_database()
            logger.info(f"📊 开始检查 {len(nodes)} 个节点的健康状态...")
            
            for node in nodes:
                try:
                    health_result = self.check_node_health(node)
                    self.update_node_health_status(node['id'], health_result)
                    
                    # 记录状态变化
                    if health_result.get('status_changed', False):
                        logger.info(f"🔄 节点 {node['name']} 状态变化: {health_result.get('old_status')} → {health_result.get('new_status')}")
                        
                except Exception as e:
                    logger.error(f"❌ 检查节点 {node.get('name', node.get('id'))} 失败: {str(e)}")
            
            logger.info("✅ 节点健康检查循环完成")
            
        except Exception as e:
            logger.error(f"❌ 获取节点列表失败: {str(e)}")
    
    def check_node_health(self, node):
        """检查单个节点的健康状态"""
        node_id = node['id']
        node_name = node.get('name', node_id)
        node_host = node['host']
        
        logger.debug(f"🔍 检查节点: {node_name} ({node_host})")
        
        health_result = {
            'node_id': node_id,
            'checked_at': datetime.now().isoformat(),
            'connectivity': False,
            'openclaw_installed': False,
            'gateway_running': False,
            'port_available': False,
            'health_score': 0,
            'status': 'offline',
            'details': {}
        }
        
        try:
            # SSH连接测试
            ssh = self.get_ssh_connection(node)
            if not ssh:
                health_result['status'] = 'offline'
                health_result['details']['error'] = 'SSH连接失败'
                return health_result
            
            health_result['connectivity'] = True
            health_result['health_score'] += 25  # 连接成功 +25分
            
            # 检查OpenClaw程序
            stdin, stdout, stderr = ssh.exec_command('which openclaw && openclaw --version', timeout=10)
            if stdout.channel.recv_exit_status() == 0:
                version_output = stdout.read().decode().strip()
                health_result['openclaw_installed'] = True
                health_result['health_score'] += 25  # 程序安装 +25分
                health_result['details']['openclaw_version'] = self.extract_version(version_output)
            
            # 检查Gateway服务状态
            stdin, stdout, stderr = ssh.exec_command('systemctl --user is-active openclaw-gateway', timeout=10)
            gateway_status = stdout.read().decode().strip()
            if gateway_status == 'active':
                health_result['gateway_running'] = True
                health_result['health_score'] += 25  # 服务运行 +25分
            health_result['details']['gateway_status'] = gateway_status
            
            # 检查端口绑定
            stdin, stdout, stderr = ssh.exec_command('ss -tlnp | grep :18789', timeout=10)
            port_check = stdout.read().decode()
            if len(port_check.strip()) > 0:
                health_result['port_available'] = True
                health_result['health_score'] += 25  # 端口绑定 +25分
            
            # 获取系统资源信息
            system_info = self.get_system_resources(ssh)
            health_result['details'].update(system_info)
            
            # 确定整体状态
            if health_result['health_score'] >= 75:
                health_result['status'] = 'online'
            elif health_result['health_score'] >= 50:
                health_result['status'] = 'unstable'  
            else:
                health_result['status'] = 'offline'
            
            ssh.close()
            
        except Exception as e:
            logger.error(f"❌ 节点健康检查异常 {node_name}: {str(e)}")
            health_result['details']['error'] = str(e)
            health_result['status'] = 'error'
        
        return health_result
    
    def get_system_resources(self, ssh):
        """获取系统资源信息"""
        try:
            # CPU使用率
            stdin, stdout, stderr = ssh.exec_command("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1", timeout=10)
            cpu_usage = stdout.read().decode().strip()
            
            # 内存使用率  
            stdin, stdout, stderr = ssh.exec_command("free | grep Mem | awk '{printf \"%.1f\", $3/$2 * 100.0}'", timeout=10)
            memory_usage = stdout.read().decode().strip()
            
            # 磁盘使用率
            stdin, stdout, stderr = ssh.exec_command("df -h / | tail -1 | awk '{print $5}' | cut -d'%' -f1", timeout=10)
            disk_usage = stdout.read().decode().strip()
            
            return {
                'cpu_usage': float(cpu_usage) if cpu_usage.replace('.', '').isdigit() else 0,
                'memory_usage': float(memory_usage) if memory_usage.replace('.', '').isdigit() else 0,
                'disk_usage': float(disk_usage) if disk_usage.isdigit() else 0,
                'resource_check_time': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.debug(f"资源信息获取失败: {str(e)}")
            return {
                'cpu_usage': 0,
                'memory_usage': 0, 
                'disk_usage': 0,
                'resource_error': str(e)
            }
    
    def extract_version(self, version_output):
        """从版本输出中提取版本号"""
        try:
            lines = version_output.split('\\n')
            for line in lines:
                if '20' in line and '.' in line:  # 匹配类似 2026.2.14 的版本号
                    return line.strip()
            return version_output.split('\\n')[-1].strip()
        except:
            return 'unknown'
    
    def get_ssh_connection(self, node):
        """获取SSH连接"""
        try:
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            connect_params = {
                'hostname': node['host'],
                'username': node['ssh_user'],
                'port': node.get('port', 22),
                'timeout': self.ssh_timeout
            }
            
            # 使用默认密码（实际生产环境应使用密钥）
            connect_params['password'] = os.getenv('NODE_SSH_PASSWORD', 'Niejing0221')
            
            ssh.connect(**connect_params)
            return ssh
            
        except Exception as e:
            logger.debug(f"SSH连接失败 {node['host']}: {str(e)}")
            return None
    
    def get_nodes_from_database(self):
        """从数据库获取所有节点"""
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row  # 使结果可以像字典一样访问
            cursor = conn.cursor()
            
            cursor.execute("SELECT * FROM nodes WHERE status != 'deleted'")
            nodes = [dict(row) for row in cursor.fetchall()]
            
            conn.close()
            return nodes
            
        except Exception as e:
            logger.error(f"❌ 数据库查询失败: {str(e)}")
            return []
    
    def update_node_health_status(self, node_id, health_result):
        """更新节点的健康状态到数据库"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # 获取当前状态以检查变化
            cursor.execute("SELECT status, openclaw_version FROM nodes WHERE id = ?", (node_id,))
            current = cursor.fetchone()
            old_status = current[0] if current else None
            old_version = current[1] if current else None
            
            # 检查状态是否变化
            status_changed = old_status != health_result['status']
            version_changed = old_version != health_result['details'].get('openclaw_version')
            
            # 更新节点状态
            update_sql = """
                UPDATE nodes SET 
                    status = ?,
                    openclaw_version = ?,
                    cpu_usage = ?,
                    ram_usage = ?,
                    disk_usage = ?,
                    last_seen_at = ?,
                    last_score = ?,
                    last_score_at = ?,
                    updated_at = ?
                WHERE id = ?
            """
            
            cursor.execute(update_sql, (
                health_result['status'],
                health_result['details'].get('openclaw_version'),
                health_result['details'].get('cpu_usage', 0),
                health_result['details'].get('memory_usage', 0),
                health_result['details'].get('disk_usage', 0),
                int(time.time() * 1000),  # 时间戳（毫秒）
                health_result['health_score'],
                int(time.time() * 1000),
                int(time.time() * 1000)
            ), (node_id,))
            
            conn.commit()
            conn.close()
            
            # 记录重要变化
            if status_changed:
                health_result['status_changed'] = True
                health_result['old_status'] = old_status
                health_result['new_status'] = health_result['status']
                logger.info(f"📊 节点 {node_id} 健康状态更新: {health_result['status']} (分数: {health_result['health_score']})")
            
        except Exception as e:
            logger.error(f"❌ 更新节点状态失败 {node_id}: {str(e)}")

# 命令行接口
if __name__ == "__main__":
    if len(sys.argv) > 1:
        if sys.argv[1] == '--daemon':
            # 守护进程模式
            monitor = AutoHealthMonitor()
            monitor.start_monitoring()
            
            try:
                # 保持运行
                while True:
                    time.sleep(60)
            except KeyboardInterrupt:
                logger.info("⏹️ 收到停止信号")
                monitor.stop_monitoring()
        elif sys.argv[1] == '--check-once':
            # 单次检查模式
            monitor = AutoHealthMonitor()
            monitor.check_all_nodes()
            print("✅ 单次健康检查完成")
    else:
        print("用法:")
        print("  python3 auto-health-monitor.py --daemon    # 守护进程模式")
        print("  python3 auto-health-monitor.py --check-once # 单次检查")