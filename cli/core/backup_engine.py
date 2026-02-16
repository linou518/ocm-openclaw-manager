#!/usr/bin/env python3
"""
OCM CLI - 备份引擎
处理OpenClaw节点的完整备份和恢复操作

作者: Joe (OpenClaw Manager)
创建: 2026-02-16
"""

import os
import sqlite3
import tarfile
import hashlib
import shutil
import subprocess
from datetime import datetime
from pathlib import Path
import logging
import json
from typing import Dict, List, Optional

from .ssh_manager import SSHConnectionManager

logger = logging.getLogger(__name__)

class BackupEngine:
    def __init__(self, db_path: str = "/home/linou/shared/ocm-project/ocm.db"):
        self.db_path = db_path
        self.backup_base_dir = Path("/home/linou/shared/ocm-project/backups")
        self.backup_base_dir.mkdir(exist_ok=True)
        self.ssh_manager = SSHConnectionManager()
    
    def create_node_backup(self, node_id: str, node_info: Dict) -> Dict:
        """创建节点完整备份"""
        try:
            timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            backup_name = f"backup-{timestamp}"
            node_backup_dir = self.backup_base_dir / node_id
            node_backup_dir.mkdir(exist_ok=True)
            
            backup_path = node_backup_dir / backup_name
            backup_path.mkdir(exist_ok=True)
            
            backup_log = []
            backup_log.append(f"开始备份节点: {node_id}")
            
            host = node_info["host_ip"]
            port = node_info.get("ssh_port", 22)
            username = node_info["ssh_user"]
            
            # 1. 备份OpenClaw主配置文件
            backup_log.append("备份主配置文件...")
            config_result = self.ssh_manager.execute_command(
                host, port, username,
                "test -f ~/.openclaw/openclaw.json && cat ~/.openclaw/openclaw.json || echo 'NO_CONFIG'"
            )
            
            if config_result["status"] == "success" and "NO_CONFIG" not in config_result["stdout"]:
                with open(backup_path / "openclaw.json", "w") as f:
                    f.write(config_result["stdout"])
            else:
                backup_log.append("⚠️  主配置文件不存在或读取失败")
            
            # 2. 备份认证文件
            backup_log.append("备份认证配置...")
            auth_result = self.ssh_manager.execute_command(
                host, port, username,
                "test -f ~/.openclaw/auth-profiles.json && cat ~/.openclaw/auth-profiles.json || echo 'NO_AUTH'"
            )
            
            if auth_result["status"] == "success" and "NO_AUTH" not in auth_result["stdout"]:
                with open(backup_path / "auth-profiles.json", "w") as f:
                    f.write(auth_result["stdout"])
            
            # 3. 备份agents目录结构和配置
            backup_log.append("备份agents配置...")
            agents_dir = backup_path / "agents"
            agents_dir.mkdir(exist_ok=True)
            
            # 获取agents列表
            agents_result = self.ssh_manager.execute_command(
                host, port, username,
                "find ~/.openclaw/agents -maxdepth 1 -type d -name '*' | grep -v '^agents$' | head -10"
            )
            
            if agents_result["status"] == "success":
                agent_dirs = [line.strip() for line in agents_result["stdout"].split('\n') if line.strip()]
                
                for agent_dir in agent_dirs:
                    agent_name = os.path.basename(agent_dir)
                    if agent_name and agent_name != "agents":
                        # 备份agent配置文件（排除大文件）
                        self._backup_agent_configs(host, port, username, agent_name, agents_dir, backup_log)
            
            # 4. 备份workspace文件
            backup_log.append("备份workspace...")
            workspace_dir = backup_path / "workspace"
            workspace_dir.mkdir(exist_ok=True)
            
            workspace_result = self.ssh_manager.execute_command(
                host, port, username,
                "find ~/.openclaw -maxdepth 1 -type d -name 'workspace*' | head -5"
            )
            
            if workspace_result["status"] == "success":
                workspaces = [line.strip() for line in workspace_result["stdout"].split('\n') if line.strip()]
                
                for ws in workspaces:
                    ws_name = os.path.basename(ws)
                    self._backup_workspace(host, port, username, ws, workspace_dir / ws_name, backup_log)
            
            # 5. 创建备份元信息
            backup_info = {
                "node_id": node_id,
                "backup_name": backup_name,
                "created_at": datetime.now().isoformat(),
                "host_ip": host,
                "backup_type": "full",
                "backup_log": backup_log
            }
            
            with open(backup_path / "backup_info.json", "w") as f:
                json.dump(backup_info, f, indent=2, ensure_ascii=False)
            
            # 6. 压缩备份
            backup_log.append("压缩备份文件...")
            compressed_path = node_backup_dir / f"{backup_name}.tar.gz"
            
            with tarfile.open(compressed_path, "w:gz") as tar:
                tar.add(backup_path, arcname=backup_name)
            
            # 7. 计算文件大小和校验和
            file_size = compressed_path.stat().st_size
            checksum = self._calculate_md5(compressed_path)
            
            # 8. 清理临时目录
            shutil.rmtree(backup_path)
            
            # 9. 保存备份记录到数据库
            self._save_backup_record(node_id, backup_name, str(compressed_path), 
                                   file_size, checksum, backup_info)
            
            backup_log.append(f"✅ 备份完成: {backup_name}.tar.gz ({self._format_size(file_size)})")
            
            return {
                "status": "success",
                "backup_name": backup_name,
                "file_path": str(compressed_path),
                "file_size": file_size,
                "formatted_size": self._format_size(file_size),
                "checksum": checksum,
                "log": backup_log
            }
            
        except Exception as e:
            logger.error(f"备份创建失败: {str(e)}")
            return {
                "status": "error",
                "message": f"备份创建失败: {str(e)}"
            }
    
    def restore_node_backup(self, node_id: str, backup_name: str, node_info: Dict) -> Dict:
        """从备份恢复节点配置"""
        try:
            restore_log = []
            restore_log.append(f"开始还原备份: {backup_name} 到节点: {node_id}")
            
            # 1. 查找备份文件
            backup_file = self.backup_base_dir / node_id / f"{backup_name}.tar.gz"
            if not backup_file.exists():
                return {
                    "status": "error",
                    "message": f"备份文件不存在: {backup_file}"
                }
            
            # 2. 验证备份完整性
            restore_log.append("验证备份完整性...")
            stored_checksum = self._get_backup_checksum(node_id, backup_name)
            actual_checksum = self._calculate_md5(backup_file)
            
            if stored_checksum != actual_checksum:
                return {
                    "status": "error",
                    "message": "备份文件校验失败，文件可能已损坏"
                }
            
            # 3. 解压备份文件
            restore_log.append("解压备份文件...")
            temp_restore_dir = Path(f"/tmp/ocm_restore_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
            temp_restore_dir.mkdir(exist_ok=True)
            
            with tarfile.open(backup_file, "r:gz") as tar:
                tar.extractall(temp_restore_dir)
            
            extracted_dir = temp_restore_dir / backup_name
            
            # 4. 停止目标节点OpenClaw服务
            restore_log.append("停止目标节点OpenClaw服务...")
            host = node_info["host_ip"]
            port = node_info.get("ssh_port", 22)
            username = node_info["ssh_user"]
            
            stop_result = self.ssh_manager.execute_command(
                host, port, username,
                "systemctl --user stop openclaw-gateway"
            )
            
            if stop_result["status"] == "error":
                restore_log.append(f"⚠️  停止服务失败: {stop_result['message']}")
            
            # 5. 创建回滚备份
            restore_log.append("创建回滚备份...")
            rollback_dir = f"/tmp/rollback_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            rollback_result = self.ssh_manager.execute_command(
                host, port, username,
                f"mkdir -p {rollback_dir} && cp -r ~/.openclaw/* {rollback_dir}/ 2>/dev/null || true"
            )
            
            # 6. 还原配置文件
            restore_log.append("还原配置文件...")
            if (extracted_dir / "openclaw.json").exists():
                with open(extracted_dir / "openclaw.json", "r") as f:
                    config_content = f.read()
                
                # 上传配置文件
                upload_result = self.ssh_manager.execute_command(
                    host, port, username,
                    f"cat > ~/.openclaw/openclaw.json << 'EOF'\n{config_content}\nEOF"
                )
                
                if upload_result["status"] == "error":
                    restore_log.append("⚠️  主配置文件还原失败")
            
            if (extracted_dir / "auth-profiles.json").exists():
                with open(extracted_dir / "auth-profiles.json", "r") as f:
                    auth_content = f.read()
                
                upload_result = self.ssh_manager.execute_command(
                    host, port, username,
                    f"cat > ~/.openclaw/auth-profiles.json << 'EOF'\n{auth_content}\nEOF"
                )
                
                if upload_result["status"] == "error":
                    restore_log.append("⚠️  认证文件还原失败")
            
            # 7. 还原agents配置
            restore_log.append("还原agents配置...")
            if (extracted_dir / "agents").exists():
                # 清理现有agents配置
                self.ssh_manager.execute_command(
                    host, port, username,
                    "rm -rf ~/.openclaw/agents/*"
                )
                
                # 还原agents配置（这里简化处理，实际需要递归上传）
                self._restore_agents_config(host, port, username, extracted_dir / "agents", restore_log)
            
            # 8. 修复文件权限
            restore_log.append("修复文件权限...")
            self.ssh_manager.execute_command(
                host, port, username,
                "chmod 600 ~/.openclaw/auth-profiles.json 2>/dev/null || true"
            )
            
            self.ssh_manager.execute_command(
                host, port, username,
                "chmod -R 755 ~/.openclaw/agents/ 2>/dev/null || true"
            )
            
            # 9. 重启OpenClaw服务
            restore_log.append("重启OpenClaw服务...")
            start_result = self.ssh_manager.execute_command(
                host, port, username,
                "systemctl --user start openclaw-gateway"
            )
            
            # 10. 验证服务状态
            import time
            time.sleep(5)
            
            check_result = self.ssh_manager.check_openclaw_installation(
                host, port, username
            )
            
            if check_result["status"] == "success" and check_result["overall_status"] == "active":
                restore_log.append("✅ 还原完成，服务正常运行")
                
                # 记录还原操作
                self._save_restore_log(node_id, backup_name, "success", rollback_dir)
                
                # 清理临时文件
                shutil.rmtree(temp_restore_dir, ignore_errors=True)
                
                return {
                    "status": "success",
                    "message": "还原完成，服务正常运行",
                    "log": restore_log,
                    "rollback_path": rollback_dir
                }
            else:
                restore_log.append("❌ 服务启动失败，准备回滚...")
                
                # 回滚操作（简化）
                self.ssh_manager.execute_command(
                    host, port, username,
                    f"cp -r {rollback_dir}/* ~/.openclaw/"
                )
                
                self.ssh_manager.execute_command(
                    host, port, username,
                    "systemctl --user start openclaw-gateway"
                )
                
                return {
                    "status": "error",
                    "message": "服务启动失败，已自动回滚",
                    "log": restore_log
                }
                
        except Exception as e:
            logger.error(f"还原操作失败: {str(e)}")
            return {
                "status": "error",
                "message": f"还原操作失败: {str(e)}"
            }
    
    def get_node_backups(self, node_id: str, limit: int = 3) -> List[Dict]:
        """获取节点备份列表"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT backup_name, file_path, file_size, created_at, checksum
            FROM backups 
            WHERE node_id = ? 
            ORDER BY created_at DESC 
            LIMIT ?
        """, (node_id, limit))
        
        backups = []
        for row in cursor.fetchall():
            backup_name, file_path, file_size, created_at, checksum = row
            
            # 计算友好显示
            size_str = self._format_size(file_size)
            time_str = self._format_time_ago(created_at)
            
            backups.append({
                "name": backup_name,
                "path": file_path,
                "size": file_size,
                "size_str": size_str,
                "time_str": time_str,
                "checksum": checksum,
                "created_at": created_at
            })
        
        conn.close()
        return backups
    
    def _backup_agent_configs(self, host: str, port: int, username: str, 
                             agent_name: str, target_dir: Path, backup_log: List[str]):
        """备份单个agent的配置"""
        try:
            agent_config_result = self.ssh_manager.execute_command(
                host, port, username,
                f"find ~/.openclaw/agents/{agent_name} -name '*.json' -o -name '*.md' | head -20"
            )
            
            if agent_config_result["status"] == "success":
                config_files = [f.strip() for f in agent_config_result["stdout"].split('\n') if f.strip()]
                
                agent_dir = target_dir / agent_name
                agent_dir.mkdir(exist_ok=True)
                
                for config_file in config_files:
                    file_result = self.ssh_manager.execute_command(
                        host, port, username,
                        f"cat '{config_file}'"
                    )
                    
                    if file_result["status"] == "success":
                        relative_path = config_file.replace(f"/home/{username}/.openclaw/agents/{agent_name}/", "")
                        local_file = agent_dir / relative_path
                        local_file.parent.mkdir(parents=True, exist_ok=True)
                        
                        with open(local_file, "w") as f:
                            f.write(file_result["stdout"])
                
                backup_log.append(f"   ✅ {agent_name} 配置已备份")
        except Exception as e:
            backup_log.append(f"   ⚠️  {agent_name} 备份失败: {str(e)}")
    
    def _backup_workspace(self, host: str, port: int, username: str, 
                         ws_path: str, target_dir: Path, backup_log: List[str]):
        """备份workspace目录"""
        try:
            target_dir.mkdir(parents=True, exist_ok=True)
            
            # 备份重要配置文件
            important_files_result = self.ssh_manager.execute_command(
                host, port, username,
                f"find '{ws_path}' -name '*.md' -o -name '*.json' -o -name '*.py' | grep -v node_modules | head -50"
            )
            
            if important_files_result["status"] == "success":
                files = [f.strip() for f in important_files_result["stdout"].split('\n') if f.strip()]
                
                for file_path in files:
                    file_result = self.ssh_manager.execute_command(
                        host, port, username,
                        f"cat '{file_path}'"
                    )
                    
                    if file_result["status"] == "success":
                        relative_path = file_path.replace(f"{ws_path}/", "")
                        local_file = target_dir / relative_path
                        local_file.parent.mkdir(parents=True, exist_ok=True)
                        
                        with open(local_file, "w") as f:
                            f.write(file_result["stdout"])
                
                ws_name = os.path.basename(ws_path)
                backup_log.append(f"   ✅ {ws_name} workspace已备份")
        except Exception as e:
            backup_log.append(f"   ⚠️  workspace备份失败: {str(e)}")
    
    def _restore_agents_config(self, host: str, port: int, username: str, 
                              agents_dir: Path, restore_log: List[str]):
        """还原agents配置（简化版）"""
        try:
            for agent_dir in agents_dir.iterdir():
                if agent_dir.is_dir():
                    agent_name = agent_dir.name
                    
                    # 创建agent目录
                    self.ssh_manager.execute_command(
                        host, port, username,
                        f"mkdir -p ~/.openclaw/agents/{agent_name}"
                    )
                    
                    # 还原配置文件
                    for config_file in agent_dir.rglob("*"):
                        if config_file.is_file():
                            relative_path = config_file.relative_to(agent_dir)
                            
                            with open(config_file, "r") as f:
                                content = f.read()
                            
                            self.ssh_manager.execute_command(
                                host, port, username,
                                f"mkdir -p ~/.openclaw/agents/{agent_name}/{relative_path.parent} && "
                                f"cat > ~/.openclaw/agents/{agent_name}/{relative_path} << 'EOF'\n{content}\nEOF"
                            )
                    
                    restore_log.append(f"   ✅ {agent_name} 配置已还原")
        except Exception as e:
            restore_log.append(f"   ⚠️  agents配置还原失败: {str(e)}")
    
    def _calculate_md5(self, file_path: Path) -> str:
        """计算文件MD5校验和"""
        hash_md5 = hashlib.md5()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()
    
    def _format_size(self, size_bytes: int) -> str:
        """格式化文件大小显示"""
        if size_bytes < 1024:
            return f"{size_bytes}B"
        elif size_bytes < 1024*1024:
            return f"{size_bytes/1024:.1f}KB"
        elif size_bytes < 1024*1024*1024:
            return f"{size_bytes/(1024*1024):.1f}MB"
        else:
            return f"{size_bytes/(1024*1024*1024):.1f}GB"
    
    def _format_time_ago(self, iso_time: str) -> str:
        """格式化时间差显示"""
        try:
            created_time = datetime.fromisoformat(iso_time)
            time_diff = datetime.now() - created_time
            
            if time_diff.days > 0:
                return f"{time_diff.days}天前"
            elif time_diff.seconds > 3600:
                return f"{time_diff.seconds//3600}小时前"
            else:
                return f"{max(1, time_diff.seconds//60)}分钟前"
        except:
            return "未知"
    
    def _save_backup_record(self, node_id: str, backup_name: str, file_path: str,
                           file_size: int, checksum: str, backup_info: Dict):
        """保存备份记录到数据库"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO backups (node_id, backup_name, file_path, file_size, 
                                checksum, created_at, backup_type)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            node_id,
            backup_name,
            file_path,
            file_size,
            checksum,
            backup_info["created_at"],
            backup_info["backup_type"]
        ))
        
        conn.commit()
        conn.close()
    
    def _get_backup_checksum(self, node_id: str, backup_name: str) -> str:
        """从数据库获取备份校验和"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT checksum FROM backups WHERE node_id = ? AND backup_name = ?",
            (node_id, backup_name)
        )
        
        result = cursor.fetchone()
        conn.close()
        
        return result[0] if result else ""
    
    def _save_restore_log(self, node_id: str, backup_name: str, status: str, rollback_path: str):
        """保存还原操作日志"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO restore_logs (node_id, backup_name, restored_at, status, rollback_path)
            VALUES (?, ?, ?, ?, ?)
        ''', (node_id, backup_name, datetime.now().isoformat(), status, rollback_path))
        
        conn.commit()
        conn.close()

if __name__ == "__main__":
    # 测试用例
    backup_engine = BackupEngine()
    
    # 测试节点信息
    test_node_info = {
        "host_ip": "192.168.3.73",
        "ssh_port": 22,
        "ssh_user": "openclaw01"
    }
    
    # 创建测试备份
    result = backup_engine.create_node_backup("pc-a-test", test_node_info)
    print("备份结果:", result)