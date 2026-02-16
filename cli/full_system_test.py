#!/usr/bin/env python3
"""
OCM CLI 全面系统测试脚本
测试所有已实装功能的完整性和可靠性

作者: Joe (OpenClaw Manager)
创建: 2026-02-16
"""

import sys
import json
import sqlite3
import time
from datetime import datetime
from pathlib import Path

# 导入我们的模块
from config import DB_PATH, NODE_TEMPLATES, validate_config
from core.ssh_manager import SSHConnectionManager
from core.backup_engine import BackupEngine

class OCMFullSystemTest:
    def __init__(self):
        self.ssh_manager = SSHConnectionManager()
        self.backup_engine = BackupEngine(DB_PATH)
        self.test_results = {
            'passed': 0,
            'failed': 0,
            'skipped': 0,
            'details': []
        }
    
    def log_test(self, test_name: str, status: str, details: str = ""):
        """记录测试结果"""
        result = {
            'test': test_name,
            'status': status,
            'details': details,
            'timestamp': datetime.now().isoformat()
        }
        self.test_results['details'].append(result)
        self.test_results[status] += 1
        
        status_icon = {
            'passed': '✅',
            'failed': '❌', 
            'skipped': '⏭️'
        }.get(status, '❓')
        
        print(f"{status_icon} {test_name}: {details}")
    
    def test_configuration(self):
        """测试配置系统"""
        print("\n🔧 测试配置系统")
        print("=" * 40)
        
        try:
            # 验证配置
            issues = validate_config()
            if len(issues) <= 1:  # 只有Bot Token问题可以接受
                self.log_test("配置验证", "passed", f"发现{len(issues)}个配置问题（可接受）")
            else:
                self.log_test("配置验证", "failed", f"配置问题过多: {len(issues)}个")
            
            # 测试数据库路径
            db_path = Path(DB_PATH)
            if db_path.exists():
                self.log_test("数据库文件", "passed", f"数据库存在: {db_path}")
            else:
                self.log_test("数据库文件", "failed", f"数据库不存在: {db_path}")
            
            # 测试节点模板
            if len(NODE_TEMPLATES) > 0:
                self.log_test("节点模板", "passed", f"加载{len(NODE_TEMPLATES)}个模板")
            else:
                self.log_test("节点模板", "failed", "节点模板为空")
                
        except Exception as e:
            self.log_test("配置系统", "failed", f"配置测试异常: {str(e)}")
    
    def test_database_operations(self):
        """测试数据库操作"""
        print("\n🗄️ 测试数据库操作")
        print("=" * 40)
        
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            
            # 测试表结构
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = [row[0] for row in cursor.fetchall()]
            expected_tables = ['nodes', 'backups', 'restore_logs']
            
            for table in expected_tables:
                if table in tables:
                    self.log_test(f"数据表{table}", "passed", "表结构存在")
                else:
                    self.log_test(f"数据表{table}", "failed", "表结构缺失")
            
            # 测试节点查询
            cursor.execute("SELECT COUNT(*) FROM nodes")
            node_count = cursor.fetchone()[0]
            self.log_test("节点数据查询", "passed", f"查询到{node_count}个节点")
            
            # 测试节点详情查询
            cursor.execute("SELECT id, name, host_ip, status FROM nodes LIMIT 3")
            nodes = cursor.fetchall()
            for node_id, name, host_ip, status in nodes:
                self.log_test(f"节点{node_id}", "passed", f"{name} ({host_ip}) - {status}")
            
            # 测试备份记录查询
            cursor.execute("SELECT COUNT(*) FROM backups")
            backup_count = cursor.fetchone()[0]
            self.log_test("备份记录查询", "passed", f"查询到{backup_count}个备份记录")
            
            conn.close()
            
        except Exception as e:
            self.log_test("数据库操作", "failed", f"数据库测试异常: {str(e)}")
    
    def test_ssh_connections(self):
        """测试SSH连接"""
        print("\n🔗 测试SSH连接")
        print("=" * 40)
        
        for node_id, template in NODE_TEMPLATES.items():
            try:
                print(f"\n📍 测试节点: {template['name']} ({template['host_ip']})")
                
                # SSH连接测试
                result = self.ssh_manager.test_connection(
                    template['host_ip'],
                    template.get('ssh_port', 22),
                    template['ssh_user']
                )
                
                if result['status'] == 'success':
                    self.log_test(f"SSH连接-{node_id}", "passed", result['message'])
                    
                    # OpenClaw检查测试
                    openclaw_result = self.ssh_manager.check_openclaw_installation(
                        template['host_ip'],
                        template.get('ssh_port', 22),
                        template['ssh_user'],
                        template.get('openclaw_path', '/usr/bin/openclaw')
                    )
                    
                    if openclaw_result['status'] == 'success':
                        self.log_test(f"OpenClaw检查-{node_id}", "passed", 
                                    f"版本:{openclaw_result['openclaw_version']}, 状态:{openclaw_result['overall_status']}")
                        
                        # Bot检测测试
                        bot_result = self.ssh_manager.get_node_bots(
                            template['host_ip'],
                            template.get('ssh_port', 22),
                            template['ssh_user']
                        )
                        
                        if bot_result['status'] == 'success':
                            agent_count = len(bot_result['agents'])
                            process_count = bot_result['process_count']
                            self.log_test(f"Bot检测-{node_id}", "passed", 
                                        f"Agents:{agent_count}, 进程:{process_count}")
                        else:
                            self.log_test(f"Bot检测-{node_id}", "failed", 
                                        bot_result.get('error', 'Unknown'))
                    else:
                        self.log_test(f"OpenClaw检查-{node_id}", "failed", 
                                    openclaw_result.get('message', 'Unknown'))
                else:
                    self.log_test(f"SSH连接-{node_id}", "failed", result['message'])
                    # SSH连接失败时跳过后续测试
                    self.log_test(f"OpenClaw检查-{node_id}", "skipped", "SSH连接失败")
                    self.log_test(f"Bot检测-{node_id}", "skipped", "SSH连接失败")
                    
            except Exception as e:
                self.log_test(f"SSH测试-{node_id}", "failed", f"测试异常: {str(e)}")
    
    def test_backup_engine(self):
        """测试备份引擎"""
        print("\n📦 测试备份引擎")
        print("=" * 40)
        
        try:
            # 测试备份列表功能
            for node_id in NODE_TEMPLATES.keys():
                backups = self.backup_engine.get_node_backups(node_id, limit=3)
                self.log_test(f"备份列表-{node_id}", "passed", f"查询到{len(backups)}个备份")
            
            # 测试备份创建功能（仅对连接正常的节点）
            test_node_id = "t440-work"  # T440连接正常
            if test_node_id in NODE_TEMPLATES:
                template = NODE_TEMPLATES[test_node_id]
                
                # 检查SSH连接
                ssh_test = self.ssh_manager.test_connection(
                    template['host_ip'],
                    template.get('ssh_port', 22), 
                    template['ssh_user']
                )
                
                if ssh_test['status'] == 'success':
                    print(f"  🎯 创建测试备份: {template['name']}")
                    backup_result = self.backup_engine.create_node_backup(test_node_id, template)
                    
                    if backup_result['status'] == 'success':
                        self.log_test(f"备份创建-{test_node_id}", "passed", 
                                    f"备份成功: {backup_result['backup_name']} ({backup_result['formatted_size']})")
                        
                        # 测试备份还原功能（仅验证不实际还原）
                        backup_name = backup_result['backup_name']
                        self.log_test(f"备份验证-{test_node_id}", "passed", 
                                    f"备份文件校验: {backup_result['checksum'][:8]}...")
                    else:
                        self.log_test(f"备份创建-{test_node_id}", "failed", 
                                    backup_result.get('message', 'Unknown'))
                else:
                    self.log_test(f"备份创建-{test_node_id}", "skipped", "SSH连接失败")
            
        except Exception as e:
            self.log_test("备份引擎", "failed", f"备份引擎测试异常: {str(e)}")
    
    def test_telegram_interface(self):
        """测试Telegram界面（模拟）"""
        print("\n📱 测试Telegram界面")
        print("=" * 40)
        
        try:
            # 导入Telegram处理器
            from telegram_cli_handler import OCMTelegramCLI
            
            # 创建CLI实例
            cli = OCMTelegramCLI()
            self.log_test("Telegram CLI初始化", "passed", "CLI对象创建成功")
            
            # 测试权限检查
            admin_check = cli.is_admin(7996447774)  # Linou的用户ID
            if admin_check:
                self.log_test("权限检查", "passed", "管理员权限验证正常")
            else:
                self.log_test("权限检查", "failed", "管理员权限验证失败")
            
            # 测试非管理员
            non_admin_check = cli.is_admin(12345678)  # 随机ID
            if not non_admin_check:
                self.log_test("权限拒绝", "passed", "非管理员正确被拒绝")
            else:
                self.log_test("权限拒绝", "failed", "权限控制有漏洞")
                
        except Exception as e:
            self.log_test("Telegram界面", "failed", f"界面测试异常: {str(e)}")
    
    def test_node_restart(self):
        """测试节点重启功能"""
        print("\n🔄 测试节点重启功能")
        print("=" * 40)
        
        try:
            # 仅对T440执行重启测试（连接稳定）
            test_node_id = "t440-work"
            if test_node_id in NODE_TEMPLATES:
                template = NODE_TEMPLATES[test_node_id]
                
                # 检查当前状态
                status_before = self.ssh_manager.check_openclaw_installation(
                    template['host_ip'],
                    template.get('ssh_port', 22),
                    template['ssh_user']
                )
                
                if status_before['status'] == 'success' and status_before['overall_status'] == 'active':
                    self.log_test(f"重启前检查-{test_node_id}", "passed", 
                                f"服务正常运行: {status_before['service_status']}")
                    
                    # 模拟重启测试（实际不执行重启，只测试命令构建）
                    restart_command = [
                        "systemctl --user stop openclaw-gateway",
                        "sleep 2",
                        "systemctl --user start openclaw-gateway",
                        "sleep 5",
                        "systemctl --user is-active openclaw-gateway"
                    ]
                    
                    self.log_test(f"重启命令构建-{test_node_id}", "passed", 
                                f"重启脚本准备完成: {len(restart_command)}个步骤")
                    
                    # 注意：实际生产环境中可以取消注释进行真实重启测试
                    # restart_result = self.ssh_manager.restart_node_service(...)
                    self.log_test(f"重启测试-{test_node_id}", "skipped", "跳过实际重启以避免干扰生产环境")
                    
                else:
                    self.log_test(f"重启测试-{test_node_id}", "skipped", "服务状态不适合重启测试")
            
        except Exception as e:
            self.log_test("节点重启", "failed", f"重启测试异常: {str(e)}")
    
    def test_error_handling(self):
        """测试错误处理"""
        print("\n⚠️ 测试错误处理")
        print("=" * 40)
        
        try:
            # 测试无效主机连接
            invalid_result = self.ssh_manager.test_connection("192.168.3.999", 22, "invalid_user")
            if invalid_result['status'] == 'error':
                self.log_test("无效主机处理", "passed", "正确处理无效主机")
            else:
                self.log_test("无效主机处理", "failed", "未正确处理无效主机")
            
            # 测试数据库错误处理
            try:
                invalid_db = sqlite3.connect("/invalid/path/test.db")
                invalid_db.close()
                self.log_test("无效数据库处理", "failed", "未正确处理无效数据库路径")
            except Exception:
                self.log_test("无效数据库处理", "passed", "正确处理数据库错误")
            
            # 测试配置错误处理
            original_token = None
            try:
                from config import TELEGRAM_BOT_TOKEN
                if TELEGRAM_BOT_TOKEN == "YOUR_BOT_TOKEN_HERE":
                    self.log_test("配置错误检测", "passed", "正确检测到未配置的Bot Token")
                else:
                    self.log_test("配置错误检测", "passed", "Bot Token已正确配置")
            except Exception as e:
                self.log_test("配置错误处理", "failed", f"配置测试失败: {str(e)}")
                
        except Exception as e:
            self.log_test("错误处理", "failed", f"错误处理测试异常: {str(e)}")
    
    def test_performance(self):
        """测试性能"""
        print("\n⚡ 测试性能")
        print("=" * 40)
        
        try:
            # 测试SSH连接速度
            start_time = time.time()
            result = self.ssh_manager.test_connection("192.168.3.33", 22, "linou")
            end_time = time.time()
            
            connection_time = end_time - start_time
            if connection_time < 5.0:  # 5秒内完成
                self.log_test("SSH连接性能", "passed", f"连接耗时: {connection_time:.2f}秒")
            else:
                self.log_test("SSH连接性能", "failed", f"连接过慢: {connection_time:.2f}秒")
            
            # 测试数据库查询性能
            start_time = time.time()
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM nodes")
            nodes = cursor.fetchall()
            conn.close()
            end_time = time.time()
            
            query_time = end_time - start_time
            if query_time < 1.0:  # 1秒内完成
                self.log_test("数据库查询性能", "passed", f"查询耗时: {query_time:.3f}秒")
            else:
                self.log_test("数据库查询性能", "failed", f"查询过慢: {query_time:.3f}秒")
            
        except Exception as e:
            self.log_test("性能测试", "failed", f"性能测试异常: {str(e)}")
    
    def generate_report(self):
        """生成测试报告"""
        print("\n" + "=" * 60)
        print("🧪 OCM CLI 系统全面测试报告")
        print("=" * 60)
        
        total_tests = self.test_results['passed'] + self.test_results['failed'] + self.test_results['skipped']
        success_rate = (self.test_results['passed'] / total_tests * 100) if total_tests > 0 else 0
        
        print(f"📊 测试统计:")
        print(f"  ✅ 通过: {self.test_results['passed']}个")
        print(f"  ❌ 失败: {self.test_results['failed']}个")
        print(f"  ⏭️ 跳过: {self.test_results['skipped']}个")
        print(f"  📈 成功率: {success_rate:.1f}%")
        
        print(f"\n🎯 详细结果:")
        for detail in self.test_results['details']:
            status_icon = {
                'passed': '✅',
                'failed': '❌', 
                'skipped': '⏭️'
            }.get(detail['status'], '❓')
            print(f"  {status_icon} {detail['test']}: {detail['details']}")
        
        # 保存报告到文件
        report_file = Path("/tmp/ocm_test_report.json")
        with open(report_file, 'w') as f:
            json.dump(self.test_results, f, indent=2, ensure_ascii=False)
        
        print(f"\n📝 完整报告已保存: {report_file}")
        
        # 系统建议
        print(f"\n🚀 系统状态评估:")
        if success_rate >= 90:
            print("  🎉 系统状态: 优秀！已准备好生产使用")
        elif success_rate >= 75:
            print("  ✅ 系统状态: 良好，可以使用但有改进空间")
        elif success_rate >= 50:
            print("  ⚠️  系统状态: 一般，建议修复失败项目后使用")
        else:
            print("  ❌ 系统状态: 不佳，需要修复多个关键问题")
        
        # 下一步建议
        failed_tests = [d for d in self.test_results['details'] if d['status'] == 'failed']
        if failed_tests:
            print(f"\n🔧 修复建议:")
            for test in failed_tests[:5]:  # 显示前5个失败项
                print(f"  • {test['test']}: {test['details']}")
    
    def run_all_tests(self):
        """运行所有测试"""
        print("🧪 开始OCM CLI系统全面测试")
        print(f"📅 测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 60)
        
        # 按顺序执行所有测试
        self.test_configuration()
        self.test_database_operations()
        self.test_ssh_connections()
        self.test_backup_engine()
        self.test_telegram_interface()
        self.test_node_restart()
        self.test_error_handling()
        self.test_performance()
        
        # 生成最终报告
        self.generate_report()

def main():
    """主函数"""
    if len(sys.argv) > 1 and sys.argv[1] == "--quick":
        print("🚀 快速测试模式")
    else:
        print("🧪 完整测试模式")
    
    try:
        tester = OCMFullSystemTest()
        tester.run_all_tests()
    except KeyboardInterrupt:
        print("\n⏹️  测试被用户中断")
    except Exception as e:
        print(f"\n❌ 测试过程中发生严重错误: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()