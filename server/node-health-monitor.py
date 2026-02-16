#!/usr/bin/env python3
"""
节点健康监控系统 - 实时检查所有节点状态
确保只有健康节点才能添加Bot
"""

import json
import time
import requests
import paramiko
import threading
from datetime import datetime, timedelta
import sqlite3
import os

class NodeHealthMonitor:
    def __init__(self):
        self.ocm_api_base = "http://192.168.3.33:8001/api"
        self.check_interval = 300  # 5分钟检查一次
        self.health_thresholds = {
            'cpu_warning': 80,      # CPU使用率警告
            'cpu_critical': 95,     # CPU使用率严重
            'memory_warning': 80,   # 内存使用率警告
            'memory_critical': 90,  # 内存使用率严重
            'disk_warning': 85,     # 磁盘使用率警告
            'disk_critical': 95,    # 磁盘使用率严重
            'response_timeout': 10   # API响应超时(秒)
        }
        self.running = False
        
    def start_monitoring(self):
        """启动健康监控"""
        self.running = True
        print("🔍 启动节点健康监控...")
        
        while self.running:
            try:
                self.check_all_nodes()
                time.sleep(self.check_interval)
            except KeyboardInterrupt:
                print("\\n监控已停止")
                break
            except Exception as e:
                print(f"监控异常: {str(e)}")
                time.sleep(60)  # 异常时等待1分钟后重试
    
    def check_all_nodes(self):
        """检查所有节点"""
        try:
            # 获取所有节点
            response = requests.get(f"{self.ocm_api_base}/nodes", timeout=10)
            if response.status_code != 200:
                print(f"❌ 无法获取节点列表: {response.status_code}")
                return
            
            nodes = response.json()
            print(f"📋 开始检查 {len(nodes)} 个节点...")
            
            # 并行检查所有节点
            threads = []
            results = {}
            
            for node in nodes:
                thread = threading.Thread(
                    target=self._check_single_node,
                    args=(node, results)
                )
                threads.append(thread)
                thread.start()
            
            # 等待所有检查完成
            for thread in threads:
                thread.join(timeout=30)
            
            # 处理检查结果
            self._process_health_results(results)
            
        except Exception as e:
            print(f"❌ 节点检查失败: {str(e)}")
    
    def _check_single_node(self, node, results):
        """检查单个节点"""
        node_id = node['id']
        try:
            print(f"🔍 检查节点: {node['name']} ({node['host']})")
            
            # 1. 网络连通性检查
            connectivity = self._check_connectivity(node)
            
            # 2. OpenClaw服务检查
            openclaw_status = self._check_openclaw_service(node)
            
            # 3. 系统资源检查
            resources = self._check_system_resources(node)
            
            # 4. API响应检查
            api_status = self._check_api_response(node)
            
            # 5. 计算健康分数
            health_score = self._calculate_health_score(
                connectivity, openclaw_status, resources, api_status
            )
            
            # 6. 确定节点状态
            status = self._determine_node_status(health_score, connectivity, openclaw_status)
            
            results[node_id] = {
                'node': node,
                'connectivity': connectivity,
                'openclaw_status': openclaw_status,
                'resources': resources,
                'api_status': api_status,
                'health_score': health_score,
                'status': status,
                'checked_at': datetime.now().isoformat()
            }
            
            print(f"✅ {node['name']}: {status} (分数: {health_score}/100)")
            
        except Exception as e:
            results[node_id] = {
                'node': node,
                'error': str(e),
                'health_score': 0,
                'status': 'error',
                'checked_at': datetime.now().isoformat()
            }
            print(f"❌ {node['name']}: 检查失败 - {str(e)}")
    
    def _check_connectivity(self, node):
        """检查网络连通性"""
        try:
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            connect_params = {
                'hostname': node['host'],
                'username': node.get('ssh_user', 'linou'),
                'port': node.get('port', 22),
                'timeout': 10
            }
            
            # 添加认证(这里简化处理，实际应该从配置读取)
            if node['host'] == '192.168.3.17':
                connect_params['password'] = 'Niejing0221'
            elif node['host'] in ['192.168.3.33', '192.168.3.11']:
                # 使用SSH密钥或密码
                pass
            
            ssh.connect(**connect_params)
            
            # 简单命令测试
            stdin, stdout, stderr = ssh.exec_command('echo "OK"')
            result = stdout.read().decode().strip()
            ssh.close()
            
            return {
                'success': True,
                'response_time_ms': 100,  # 简化
                'details': 'SSH连接正常'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'details': 'SSH连接失败'
            }
    
    def _check_openclaw_service(self, node):
        """检查OpenClaw服务状态"""
        if not hasattr(self, '_ssh_cache'):
            return {'success': False, 'error': '无SSH连接'}
        
        try:
            ssh = self._get_ssh_connection(node)
            
            # 检查进程
            stdin, stdout, stderr = ssh.exec_command('ps aux | grep openclaw | grep -v grep')
            process_info = stdout.read().decode()
            
            # 检查端口
            stdin, stdout, stderr = ssh.exec_command('ss -tlnp | grep :18789')
            port_info = stdout.read().decode()
            
            # 检查systemd服务状态
            stdin, stdout, stderr = ssh.exec_command('systemctl --user is-active openclaw-gateway 2>/dev/null || echo "inactive"')
            service_status = stdout.read().decode().strip()
            
            ssh.close()
            
            return {
                'success': bool(process_info and port_info),
                'process_running': bool(process_info),
                'port_listening': bool(port_info),
                'service_status': service_status,
                'details': {
                    'process_info': process_info[:200],  # 限制长度
                    'port_info': port_info[:100]
                }
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def _check_system_resources(self, node):
        """检查系统资源"""
        try:
            ssh = self._get_ssh_connection(node)
            
            # CPU使用率
            stdin, stdout, stderr = ssh.exec_command(
                "top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1 | sed 's/[^0-9.]//g'"
            )
            cpu_usage = float(stdout.read().decode().strip() or 0)
            
            # 内存使用率
            stdin, stdout, stderr = ssh.exec_command(
                "free | grep Mem | awk '{printf(\"%.1f\", $3/$2 * 100.0)}'"
            )
            memory_usage = float(stdout.read().decode().strip() or 0)
            
            # 磁盘使用率
            stdin, stdout, stderr = ssh.exec_command(
                "df -h / | awk 'NR==2{print $5}' | cut -d'%' -f1"
            )
            disk_usage = float(stdout.read().decode().strip() or 0)
            
            # 负载平均值
            stdin, stdout, stderr = ssh.exec_command('uptime | awk -F"load average:" \'{print $2}\'')
            load_avg = stdout.read().decode().strip()
            
            ssh.close()
            
            return {
                'cpu_usage': cpu_usage,
                'memory_usage': memory_usage,
                'disk_usage': disk_usage,
                'load_average': load_avg,
                'status': self._get_resource_status(cpu_usage, memory_usage, disk_usage)
            }
            
        except Exception as e:
            return {
                'error': str(e),
                'status': 'unknown'
            }
    
    def _check_api_response(self, node):
        """检查OpenClaw API响应"""
        try:
            port = 18789  # OpenClaw默认端口
            url = f"http://{node['host']}:{port}/status"
            
            start_time = time.time()
            response = requests.get(url, timeout=self.health_thresholds['response_timeout'])
            response_time = (time.time() - start_time) * 1000
            
            return {
                'success': response.status_code == 200,
                'status_code': response.status_code,
                'response_time_ms': response_time,
                'content': response.text[:500] if response.text else ''
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'response_time_ms': None
            }
    
    def _calculate_health_score(self, connectivity, openclaw_status, resources, api_status):
        """计算健康分数 (0-100)"""
        score = 0
        
        # 网络连通性 (25分)
        if connectivity['success']:
            score += 25
        
        # OpenClaw服务 (35分)
        if openclaw_status['success']:
            score += 35
        elif openclaw_status.get('process_running'):
            score += 20  # 进程运行但端口可能有问题
        
        # API响应 (25分)
        if api_status['success']:
            score += 25
        elif api_status.get('status_code'):
            score += 10  # 有响应但不是200
        
        # 系统资源 (15分)
        if 'status' in resources:
            if resources['status'] == 'healthy':
                score += 15
            elif resources['status'] == 'warning':
                score += 10
            elif resources['status'] == 'critical':
                score += 5
        
        return min(100, max(0, score))
    
    def _determine_node_status(self, health_score, connectivity, openclaw_status):
        """确定节点状态"""
        if health_score >= 90:
            return 'healthy'
        elif health_score >= 70:
            return 'warning'
        elif health_score >= 30:
            return 'unstable'
        elif connectivity['success']:
            return 'degraded'
        else:
            return 'offline'
    
    def _get_resource_status(self, cpu, memory, disk):
        """获取资源状态"""
        critical_count = 0
        warning_count = 0
        
        for usage, name in [(cpu, 'cpu'), (memory, 'memory'), (disk, 'disk')]:
            if usage >= self.health_thresholds[f'{name}_critical']:
                critical_count += 1
            elif usage >= self.health_thresholds[f'{name}_warning']:
                warning_count += 1
        
        if critical_count > 0:
            return 'critical'
        elif warning_count > 1:
            return 'warning'
        elif warning_count > 0:
            return 'warning'
        else:
            return 'healthy'
    
    def _get_ssh_connection(self, node):
        """获取SSH连接（简化版）"""
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        connect_params = {
            'hostname': node['host'],
            'username': node.get('ssh_user', 'linou'),
            'port': node.get('port', 22),
            'timeout': 10
        }
        
        # 根据不同主机配置认证
        if node['host'] == '192.168.3.17':
            connect_params['username'] = 'openclaw02'
            connect_params['password'] = 'Niejing0221'
        
        ssh.connect(**connect_params)
        return ssh
    
    def _process_health_results(self, results):
        """处理健康检查结果"""
        try:
            # 更新数据库中的节点状态
            for node_id, result in results.items():
                if 'error' not in result:
                    self._update_node_status(
                        node_id,
                        result['status'],
                        result['health_score'],
                        result['resources']
                    )
            
            # 生成健康报告
            self._generate_health_report(results)
            
        except Exception as e:
            print(f"处理健康结果失败: {str(e)}")
    
    def _update_node_status(self, node_id, status, health_score, resources):
        """更新节点状态到数据库"""
        try:
            update_data = {
                'status': status,
                'last_seen_at': int(time.time() * 1000),
                'cpu_usage': resources.get('cpu_usage', 0),
                'ram_usage': resources.get('memory_usage', 0),
                'disk_usage': resources.get('disk_usage', 0),
                'last_score': health_score,
                'last_score_at': int(time.time() * 1000)
            }
            
            response = requests.put(
                f"{self.ocm_api_base}/nodes/{node_id}",
                json=update_data,
                timeout=10
            )
            
            if response.status_code == 200:
                print(f"✅ 更新节点状态: {node_id} -> {status}")
            
        except Exception as e:
            print(f"❌ 更新节点状态失败: {str(e)}")
    
    def _generate_health_report(self, results):
        """生成健康报告"""
        total_nodes = len(results)
        healthy_nodes = sum(1 for r in results.values() if r.get('status') == 'healthy')
        offline_nodes = sum(1 for r in results.values() if r.get('status') == 'offline')
        
        print(f"\\n📊 健康监控报告 ({datetime.now().strftime('%Y-%m-%d %H:%M:%S')})")
        print(f"总节点数: {total_nodes}")
        print(f"健康节点: {healthy_nodes}")
        print(f"离线节点: {offline_nodes}")
        print(f"健康率: {(healthy_nodes/total_nodes*100):.1f}%")
        
        # 显示问题节点
        problem_nodes = [
            (node_id, result) for node_id, result in results.items() 
            if result.get('status') not in ['healthy', 'warning']
        ]
        
        if problem_nodes:
            print("\\n⚠️ 问题节点:")
            for node_id, result in problem_nodes:
                node = result.get('node', {})
                print(f"  {node.get('name', node_id)}: {result.get('status', 'unknown')}")
    
    def check_node_ready_for_bot(self, node_id):
        """检查节点是否准备好添加Bot"""
        try:
            response = requests.get(f"{self.ocm_api_base}/nodes/{node_id}", timeout=10)
            if response.status_code != 200:
                return {'ready': False, 'reason': '节点不存在或API错误'}
            
            node = response.json()
            
            # 检查节点状态
            if node.get('status') not in ['healthy', 'online']:
                return {'ready': False, 'reason': f"节点状态不健康: {node.get('status')}"}
            
            # 检查最近的健康分数
            last_score = node.get('last_score', 0)
            if last_score < 70:
                return {'ready': False, 'reason': f"健康分数过低: {last_score}/100"}
            
            # 检查最近的检查时间
            last_seen = node.get('last_seen_at', 0)
            if last_seen < (time.time() - 600) * 1000:  # 10分钟内
                return {'ready': False, 'reason': '节点状态过期，请等待下次健康检查'}
            
            return {'ready': True, 'node': node}
            
        except Exception as e:
            return {'ready': False, 'reason': f'检查失败: {str(e)}'}

# CLI接口
if __name__ == "__main__":
    import sys
    
    monitor = NodeHealthMonitor()
    
    if len(sys.argv) > 1:
        if sys.argv[1] == 'check':
            # 单次检查
            monitor.check_all_nodes()
        elif sys.argv[1] == 'ready' and len(sys.argv) > 2:
            # 检查节点是否准备好添加Bot
            result = monitor.check_node_ready_for_bot(sys.argv[2])
            print(json.dumps(result, indent=2, ensure_ascii=False))
        else:
            print("用法: python3 node-health-monitor.py [check|ready <node_id>]")
    else:
        # 持续监控模式
        monitor.start_monitoring()