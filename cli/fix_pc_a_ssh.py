#!/usr/bin/env python3
"""
修复PC-A主机SSH连接问题
设置SSH密钥认证或密码认证
"""

import subprocess
import os
from pathlib import Path

def setup_ssh_key():
    """设置SSH密钥认证"""
    print("🔐 设置SSH密钥认证到PC-A主机...")
    
    # 检查是否已有SSH密钥
    ssh_key_path = Path.home() / ".ssh" / "id_rsa"
    if not ssh_key_path.exists():
        print("📝 生成SSH密钥...")
        result = subprocess.run([
            "ssh-keygen", "-t", "rsa", "-b", "4096", 
            "-f", str(ssh_key_path), 
            "-N", "",  # 无密码
            "-C", "ocm-cli@openclaw"
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            print("✅ SSH密钥生成成功")
        else:
            print(f"❌ SSH密钥生成失败: {result.stderr}")
            return False
    else:
        print("✅ SSH密钥已存在")
    
    # 复制公钥到PC-A
    print("📤 复制SSH公钥到PC-A主机...")
    print("⚠️  请在提示时输入PC-A主机(openclaw01)的密码")
    
    result = subprocess.run([
        "ssh-copy-id", "-p", "22", "openclaw01@192.168.3.73"
    ])
    
    if result.returncode == 0:
        print("✅ SSH密钥认证设置成功")
        return True
    else:
        print("❌ SSH密钥复制失败")
        return False

def test_pc_a_connection():
    """测试PC-A连接"""
    print("🔗 测试PC-A SSH连接...")
    
    from core.ssh_manager import SSHConnectionManager
    
    ssh_manager = SSHConnectionManager()
    result = ssh_manager.test_connection("192.168.3.73", 22, "openclaw01")
    
    if result['status'] == 'success':
        print("✅ SSH连接测试成功")
        
        # 检查OpenClaw状态
        openclaw_result = ssh_manager.check_openclaw_installation(
            "192.168.3.73", 22, "openclaw01"
        )
        
        if openclaw_result['status'] == 'success':
            print(f"  🎯 OpenClaw版本: {openclaw_result['openclaw_version']}")
            print(f"  📊 服务状态: {openclaw_result['service_status']}")
            print(f"  🎮 综合状态: {openclaw_result['overall_status']}")
            
            # 更新数据库状态
            import sqlite3
            from datetime import datetime
            from config import DB_PATH
            
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE nodes 
                SET status = ?, last_check = ? 
                WHERE id = ?
            ''', (openclaw_result['overall_status'], datetime.now().isoformat(), "pc-a-main"))
            conn.commit()
            conn.close()
            
            print("✅ 数据库状态已更新")
            return True
        else:
            print(f"❌ OpenClaw检查失败: {openclaw_result.get('message', 'Unknown')}")
    else:
        print(f"❌ SSH连接测试失败: {result['message']}")
    
    return False

def main():
    """主函数"""
    print("🔧 修复PC-A主机SSH连接")
    print("=" * 40)
    
    # 询问用户选择
    print("选择修复方式:")
    print("1. 设置SSH密钥认证 (推荐)")
    print("2. 仅测试当前连接")
    
    choice = input("请选择 (1/2): ").strip()
    
    if choice == "1":
        if setup_ssh_key():
            print("\n🎉 SSH密钥设置完成，开始测试连接...")
            test_pc_a_connection()
        else:
            print("\n❌ SSH密钥设置失败")
    elif choice == "2":
        test_pc_a_connection()
    else:
        print("❌ 无效选择")

if __name__ == "__main__":
    main()