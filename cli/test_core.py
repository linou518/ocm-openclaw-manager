#!/usr/bin/env python3
"""
OCM CLI 核心功能测试脚本
测试SSH连接和节点检查功能
"""

import sys
from core.ssh_manager import SSHConnectionManager
from config import NODE_TEMPLATES

def test_ssh_connections():
    """测试SSH连接"""
    print("🔗 测试SSH连接...")
    ssh_manager = SSHConnectionManager()
    
    for node_id, template in NODE_TEMPLATES.items():
        print(f"\n📍 测试节点: {template['name']} ({template['host_ip']})")
        
        # 测试SSH连接
        result = ssh_manager.test_connection(
            template['host_ip'],
            template.get('ssh_port', 22),
            template['ssh_user']
        )
        
        if result['status'] == 'success':
            print(f"  ✅ SSH连接: {result['message']}")
            
            # 测试OpenClaw检查
            openclaw_result = ssh_manager.check_openclaw_installation(
                template['host_ip'],
                template.get('ssh_port', 22),
                template['ssh_user'],
                template.get('openclaw_path', '/usr/bin/openclaw')
            )
            
            if openclaw_result['status'] == 'success':
                print(f"  ✅ OpenClaw: {openclaw_result['openclaw_version']}")
                print(f"  📊 服务状态: {openclaw_result['service_status']}")
                print(f"  🔗 端口监听: {'是' if openclaw_result['port_listening'] else '否'}")
                print(f"  🎯 综合状态: {openclaw_result['overall_status']}")
                
                # 测试Bot检测
                bot_result = ssh_manager.get_node_bots(
                    template['host_ip'],
                    template.get('ssh_port', 22),
                    template['ssh_user']
                )
                
                if bot_result['status'] == 'success':
                    print(f"  🤖 检测到Agents: {len(bot_result['agents'])}个")
                    for agent in bot_result['agents'][:3]:  # 显示前3个
                        print(f"     • {agent}")
                    
                    print(f"  📱 Bot名称: {len(bot_result['bot_names'])}个")
                    for bot_name in bot_result['bot_names'][:3]:  # 显示前3个
                        print(f"     • {bot_name}")
                    
                    print(f"  ⚡ 运行进程: {bot_result['process_count']}个")
                else:
                    print(f"  ⚠️  Bot检测失败: {bot_result.get('error', 'Unknown')}")
            else:
                print(f"  ❌ OpenClaw检查失败: {openclaw_result.get('message', 'Unknown')}")
        else:
            print(f"  ❌ SSH连接失败: {result['message']}")

def update_node_status():
    """更新数据库中的节点状态"""
    print("\n📊 更新节点状态到数据库...")
    
    import sqlite3
    from config import DB_PATH
    from datetime import datetime
    
    ssh_manager = SSHConnectionManager()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    for node_id, template in NODE_TEMPLATES.items():
        # 检查节点状态
        openclaw_result = ssh_manager.check_openclaw_installation(
            template['host_ip'],
            template.get('ssh_port', 22),
            template['ssh_user'],
            template.get('openclaw_path', '/usr/bin/openclaw')
        )
        
        if openclaw_result['status'] == 'success':
            status = openclaw_result['overall_status']
        else:
            status = 'offline'
        
        # 更新数据库
        cursor.execute('''
            UPDATE nodes 
            SET status = ?, last_check = ? 
            WHERE id = ?
        ''', (status, datetime.now().isoformat(), node_id))
        
        print(f"  📍 {template['name']}: {status}")
    
    conn.commit()
    conn.close()
    print("✅ 节点状态更新完成")

def main():
    """主函数"""
    print("🧪 OCM CLI 核心功能测试")
    print("=" * 50)
    
    try:
        test_ssh_connections()
        update_node_status()
        
        print("\n🎉 核心功能测试完成!")
        print("📝 测试结果已更新到数据库")
        print("🚀 可以运行 python3 quick_setup.py 查看节点状态")
        
    except KeyboardInterrupt:
        print("\n⏹️  测试被用户中断")
    except Exception as e:
        print(f"\n❌ 测试过程中发生错误: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()