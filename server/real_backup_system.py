#!/usr/bin/env python3
"""
真实的OpenClaw备份还原系统
"""
import os
import json
import tarfile
import subprocess
import sqlite3
import time
import paramiko
from datetime import datetime

class OpenClawBackupSystem:
    def __init__(self, db_path):
        self.db_path = db_path
        self.backup_dir = "/home/linou/shared/ocm-project/server/backups"
        
        # OpenClaw节点配置
        self.nodes = {
            "pc-a": {
                "host": "192.168.3.73", 
                "user": "openclaw01", 
                "password": "Niejing0221",
                "openclaw_dir": "/home/openclaw01/.openclaw",
                "config_path": "/home/openclaw01/.openclaw/openclaw.json"
            },
            "t440": {
                "host": "192.168.3.33", 
                "user": "linou", 
                "password": "Niejing0221",
                "openclaw_dir": "/home/linou/.openclaw", 
                "config_path": "/home/linou/.openclaw/openclaw.json"
            },
            "baota": {
                "host": "192.168.3.11", 
                "user": "linou", 
                "password": "Niejing@0221",
                "openclaw_dir": "/home/linou/.openclaw",
                "config_path": "/home/linou/.openclaw/openclaw.json"
            }
        }
    
    def create_ssh_client(self, node_config):
        """创建SSH客户端"""
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(
            node_config["host"], 
            username=node_config["user"], 
            password=node_config["password"]
        )
        return ssh
    
    def backup_node(self, node_id, backup_type="manual", note=""):
        """真实备份节点"""
        if node_id not in self.nodes:
            raise ValueError(f"Unknown node: {node_id}")
        
        node_config = self.nodes[node_id]
        timestamp = datetime.now().strftime("%Y-%m-%dT%H-%M-%S-%f")[:-3] + "Z"
        backup_filename = f"{node_id}_{timestamp}.tar.gz"
        backup_path = os.path.join(self.backup_dir, backup_filename)
        
        try:
            ssh = self.create_ssh_client(node_config)
            
            # 1. 停止OpenClaw服务 (如果是systemd)
            print(f"停止 {node_id} OpenClaw服务...")
            ssh.exec_command("systemctl --user stop openclaw-gateway 2>/dev/null || true")
            time.sleep(2)
            
            # 2. 获取git commit (如果有)
            stdin, stdout, stderr = ssh.exec_command(f"cd {node_config['openclaw_dir']} && git rev-parse --short HEAD 2>/dev/null || echo 'no-git'")
            git_commit = stdout.read().decode().strip()
            
            # 3. 创建远程tar包
            remote_backup_path = f"/tmp/{backup_filename}"
            tar_cmd = f"cd {node_config['openclaw_dir']} && tar -czf {remote_backup_path} --exclude='*.log' --exclude='node_modules' --exclude='.git' ."
            print(f"创建备份包: {tar_cmd}")
            stdin, stdout, stderr = ssh.exec_command(tar_cmd)
            if stdout.channel.recv_exit_status() != 0:
                raise Exception(f"备份失败: {stderr.read().decode()}")
            
            # 4. 获取文件统计
            stdin, stdout, stderr = ssh.exec_command(f"find {node_config['openclaw_dir']} -type f | wc -l")
            file_count = int(stdout.read().decode().strip())
            
            stdin, stdout, stderr = ssh.exec_command(f"stat -f%z {remote_backup_path} 2>/dev/null || stat -c%s {remote_backup_path}")
            total_size = int(stdout.read().decode().strip())
            
            # 5. 下载备份文件
            print(f"下载备份文件到 {backup_path}")
            sftp = ssh.open_sftp()
            sftp.get(remote_backup_path, backup_path)
            sftp.close()
            
            # 6. 清理远程临时文件
            ssh.exec_command(f"rm -f {remote_backup_path}")
            
            # 7. 重启OpenClaw服务
            print(f"重启 {node_id} OpenClaw服务...")
            ssh.exec_command("systemctl --user start openclaw-gateway 2>/dev/null || true")
            
            ssh.close()
            
            # 8. 记录到数据库
            db = sqlite3.connect(self.db_path)
            cur = db.cursor()
            cur.execute("""
                INSERT INTO backups (node_id, git_commit, type, file_count, total_size, note, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (node_id, backup_filename, backup_type, file_count, total_size, note, int(time.time() * 1000)))
            backup_id = cur.lastrowid
            db.commit()
            db.close()
            
            print(f"✅ 备份完成: {backup_filename} ({total_size} bytes, {file_count} files)")
            return {"id": backup_id, "filename": backup_filename, "size": total_size}
            
        except Exception as e:
            print(f"❌ 备份失败: {e}")
            # 确保服务重启
            try:
                ssh.exec_command("systemctl --user start openclaw-gateway 2>/dev/null || true") 
            except:
                pass
            raise
    
    def restore_node(self, node_id, backup_id):
        """真实还原节点"""
        if node_id not in self.nodes:
            raise ValueError(f"Unknown node: {node_id}")
        
        # 获取备份记录
        db = sqlite3.connect(self.db_path)
        cur = db.cursor()
        cur.execute("SELECT git_commit FROM backups WHERE id = ? AND node_id = ?", (backup_id, node_id))
        row = cur.fetchone()
        db.close()
        
        if not row:
            raise ValueError(f"Backup {backup_id} not found for node {node_id}")
        
        backup_filename = row[0]
        backup_path = os.path.join(self.backup_dir, backup_filename)
        
        if not os.path.exists(backup_path):
            raise FileNotFoundError(f"Backup file not found: {backup_path}")
        
        node_config = self.nodes[node_id]
        
        try:
            ssh = self.create_ssh_client(node_config)
            
            # 1. 停止OpenClaw服务
            print(f"停止 {node_id} OpenClaw服务...")
            ssh.exec_command("systemctl --user stop openclaw-gateway 2>/dev/null || true")
            time.sleep(2)
            
            # 2. 备份当前配置
            backup_current_cmd = f"cd {node_config['openclaw_dir']} && cp -r . /tmp/openclaw_current_backup_$(date +%s) 2>/dev/null || true"
            ssh.exec_command(backup_current_cmd)
            
            # 3. 上传备份文件
            remote_backup_path = f"/tmp/{backup_filename}"
            print(f"上传备份文件到 {node_config['host']}")
            sftp = ssh.open_sftp()
            sftp.put(backup_path, remote_backup_path)
            sftp.close()
            
            # 4. 清理现有目录并还原
            print(f"还原配置到 {node_config['openclaw_dir']}")
            restore_cmd = f"rm -rf {node_config['openclaw_dir']}/* && cd {node_config['openclaw_dir']} && tar -xzf {remote_backup_path}"
            stdin, stdout, stderr = ssh.exec_command(restore_cmd)
            if stdout.channel.recv_exit_status() != 0:
                raise Exception(f"还原失败: {stderr.read().decode()}")
            
            # 5. 清理临时文件
            ssh.exec_command(f"rm -f {remote_backup_path}")
            
            # 6. 重启OpenClaw服务
            print(f"重启 {node_id} OpenClaw服务...")
            ssh.exec_command("systemctl --user start openclaw-gateway 2>/dev/null || true")
            
            ssh.close()
            
            print(f"✅ 还原完成: {backup_filename}")
            return {"success": True, "message": f"已还原到 {backup_filename}"}
            
        except Exception as e:
            print(f"❌ 还原失败: {e}")
            # 确保服务重启
            try:
                ssh.exec_command("systemctl --user start openclaw-gateway 2>/dev/null || true")
            except:
                pass
            raise

if __name__ == "__main__":
    import sys
    backup_system = OpenClawBackupSystem("/home/linou/shared/ocm-project/server/db/ocm.db")
    
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python3 real_backup_system.py backup <node_id> [type] [note]")
        print("  python3 real_backup_system.py restore <node_id> <backup_id>")
        print("Available nodes: pc-a, t440, baota")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "backup":
        node_id = sys.argv[2]
        backup_type = sys.argv[3] if len(sys.argv) > 3 else "manual"
        note = sys.argv[4] if len(sys.argv) > 4 else ""
        result = backup_system.backup_node(node_id, backup_type, note)
        print(f"Backup created: {result}")
        
    elif command == "restore":
        node_id = sys.argv[2]
        backup_id = int(sys.argv[3])
        result = backup_system.restore_node(node_id, backup_id)
        print(f"Restore completed: {result}")
        
    else:
        print("Unknown command:", command)