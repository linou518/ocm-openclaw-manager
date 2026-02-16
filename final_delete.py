#!/usr/bin/env python3
import subprocess
import sys
import json

def delete_agent(agent_id):
    try:
        print(f'删除agent: {agent_id}')
        
        # 1. 备份
        subprocess.run(['ssh', 'openclaw02@192.168.3.17', 
                       'cd ~/.openclaw && cp openclaw.json openclaw.json.backup-final'], 
                       check=True)
        
        # 2. 读取和修改配置
        result = subprocess.run(['ssh', 'openclaw02@192.168.3.17', 
                                'cd ~/.openclaw && cat openclaw.json'], 
                               capture_output=True, text=True, check=True)
        config = json.loads(result.stdout)
        
        # 删除agent
        config['agents']['list'] = [a for a in config['agents']['list'] if a.get('id') != agent_id]
        
        # 写回配置
        config_json = json.dumps(config, indent=2)
        subprocess.run(['ssh', 'openclaw02@192.168.3.17', 
                       f'cd ~/.openclaw && cat > openclaw.json << ENDCONFIG\n{config_json}\nENDCONFIG'], 
                       shell=True, check=True)
        
        # 3. 删除目录
        subprocess.run(['ssh', 'openclaw02@192.168.3.17', 
                       f'rm -rf ~/.openclaw/agents/{agent_id} ~/.openclaw/workspace-{agent_id}'], 
                       shell=True, check=True)
        
        # 4. 重启服务
        subprocess.run(['ssh', 'openclaw02@192.168.3.17', 
                       'systemctl --user restart openclaw-gateway'], 
                       check=True)
        
        print(f'✅ Agent {agent_id} 删除成功')
        return True
        
    except Exception as e:
        print(f'❌ 删除失败: {e}')
        return False

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print('用法: python3 final_delete.py <agent_id>')
        sys.exit(1)
    
    agent_id = sys.argv[1]
    success = delete_agent(agent_id)
    sys.exit(0 if success else 1)
