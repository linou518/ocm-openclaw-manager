# OCM CLI详细操作手册

## 📋 每个命令的详细操作清单

### 1. `/newnode` 命令操作流程

#### 步骤1: 命令触发处理
**执行脚本**: `telegram_cli_handler.py`
```python
# 接收/newnode命令
def handle_newnode_command(update, context):
    # 显示节点信息收集界面
    # 创建内联键盘要求用户输入信息
    return show_newnode_form(update.message.chat_id)
```

#### 步骤2: 信息收集
**执行脚本**: `newnode_handler.py`
```python
# 收集节点信息的函数
def collect_node_info(chat_id, callback_data):
    required_fields = {
        'node_id': '节点ID (英文)',
        'node_name': '节点名称', 
        'host_ip': '主机IP',
        'ssh_port': 'SSH端口 (默认22)',
        'ssh_user': 'SSH用户名',
        'openclaw_path': 'OpenClaw路径 (默认/usr/bin/openclaw)'
    }
    # 逐步收集每个字段
```

#### 步骤3: SSH连接测试
**执行脚本**: `ssh_connectivity_test.py`
```bash
#!/bin/bash
# SSH连通性测试
HOST_IP=$1
SSH_PORT=$2
SSH_USER=$3

# 测试SSH连接
timeout 10 ssh -o ConnectTimeout=5 -p $SSH_PORT $SSH_USER@$HOST_IP "echo 'SSH连接成功'"
if [ $? -eq 0 ]; then
    echo "SUCCESS:SSH连接正常"
else
    echo "ERROR:SSH连接失败"
    exit 1
fi
```

#### 步骤4: OpenClaw程序检查
**执行脚本**: `openclaw_presence_check.py`
```python
import subprocess
import paramiko

def check_openclaw_installation(host_ip, ssh_port, ssh_user, openclaw_path):
    """检查OpenClaw程序是否存在"""
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(host_ip, port=ssh_port, username=ssh_user)
        
        # 检查OpenClaw二进制文件
        stdin, stdout, stderr = ssh.exec_command(f"test -f {openclaw_path} && echo 'EXISTS' || echo 'NOT_FOUND'")
        result = stdout.read().decode().strip()
        
        if result == 'EXISTS':
            # 检查版本信息
            stdin, stdout, stderr = ssh.exec_command(f"{openclaw_path} --version")
            version = stdout.read().decode().strip()
            return {'status': 'success', 'version': version}
        else:
            return {'status': 'error', 'message': 'OpenClaw程序未找到'}
            
    except Exception as e:
        return {'status': 'error', 'message': str(e)}
    finally:
        ssh.close()
```

#### 步骤5: 节点注册
**执行脚本**: `node_registration.py`
```python
import sqlite3
from datetime import datetime

def register_new_node(node_info):
    """注册新节点到数据库"""
    conn = sqlite3.connect('/home/linou/shared/ocm-project/ocm.db')
    cursor = conn.cursor()
    
    # 插入节点信息
    insert_query = """
    INSERT INTO nodes (id, name, host_ip, ssh_port, ssh_user, openclaw_path, 
                      status, created_at, last_check)
    VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
    """
    
    now = datetime.now().isoformat()
    cursor.execute(insert_query, (
        node_info['node_id'],
        node_info['node_name'],
        node_info['host_ip'],
        node_info['ssh_port'],
        node_info['ssh_user'],
        node_info['openclaw_path'],
        now,
        now
    ))
    
    # 创建节点备份目录
    backup_dir = f"/home/linou/shared/ocm-project/backups/{node_info['node_id']}"
    os.makedirs(backup_dir, exist_ok=True)
    
    conn.commit()
    conn.close()
    return True
```

---

### 2. `/mynode` 命令操作流程

#### 步骤1: 获取节点列表
**执行脚本**: `node_list_manager.py`
```python
def get_all_nodes():
    """获取所有已注册节点"""
    conn = sqlite3.connect('/home/linou/shared/ocm-project/ocm.db')
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, name, host_ip, status, last_check 
        FROM nodes 
        ORDER BY created_at DESC
    """)
    
    nodes = cursor.fetchall()
    conn.close()
    return nodes
```

#### 步骤2: 实时状态检查
**执行脚本**: `node_status_checker.py`
```python
def check_node_status(node_id):
    """实时检查节点状态"""
    # 从数据库获取节点信息
    node_info = get_node_info(node_id)
    
    # SSH连接检查
    ssh_status = test_ssh_connection(node_info)
    
    # OpenClaw服务检查
    service_status = check_openclaw_service(node_info)
    
    # 端口监听检查
    port_status = check_openclaw_port(node_info)
    
    # 更新数据库状态
    update_node_status(node_id, {
        'ssh_ok': ssh_status,
        'service_ok': service_status,
        'port_ok': port_status,
        'last_check': datetime.now().isoformat()
    })
    
    return determine_overall_status(ssh_status, service_status, port_status)
```

#### 步骤3: Bot列表检测
**执行脚本**: `bot_detector.py`
```python
def detect_node_bots(node_info):
    """检测节点上运行的Bot"""
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(node_info['host_ip'], port=node_info['ssh_port'], 
                   username=node_info['ssh_user'])
        
        # 读取OpenClaw配置文件
        stdin, stdout, stderr = ssh.exec_command(
            "cat ~/.openclaw/openclaw.json | jq -r '.agents.list[]'"
        )
        agents = stdout.read().decode().strip().split('\n')
        
        # 读取Telegram账户配置
        stdin, stdout, stderr = ssh.exec_command(
            "cat ~/.openclaw/openclaw.json | jq -r '.telegram.accounts[].botName'"
        )
        bot_names = stdout.read().decode().strip().split('\n')
        
        return {
            'agents': [a for a in agents if a],
            'bot_names': [b for b in bot_names if b]
        }
        
    except Exception as e:
        return {'error': str(e)}
    finally:
        ssh.close()
```

---

### 3. 备份管理操作流程

#### 步骤1: 创建新备份
**执行脚本**: `create_node_backup.py`
```bash
#!/bin/bash
# 节点完整备份脚本

NODE_ID=$1
HOST_IP=$2
SSH_PORT=$3
SSH_USER=$4

BACKUP_DIR="/home/linou/shared/ocm-project/backups/$NODE_ID"
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
BACKUP_NAME="backup-$TIMESTAMP"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"

echo "开始备份节点: $NODE_ID"

# 创建备份目录
mkdir -p $BACKUP_PATH

# 1. 备份OpenClaw配置
echo "备份配置文件..."
scp -P $SSH_PORT $SSH_USER@$HOST_IP:~/.openclaw/openclaw.json $BACKUP_PATH/
scp -P $SSH_PORT $SSH_USER@$HOST_IP:~/.openclaw/auth-profiles.json $BACKUP_PATH/

# 2. 备份agents目录（排除大文件）
echo "备份agents配置..."
rsync -avz -e "ssh -p $SSH_PORT" --exclude='*.log' --exclude='sessions/' \
      $SSH_USER@$HOST_IP:~/.openclaw/agents/ $BACKUP_PATH/agents/

# 3. 备份工作空间文件
echo "备份workspace..."
rsync -avz -e "ssh -p $SSH_PORT" --exclude='node_modules/' --exclude='*.tmp' \
      $SSH_USER@$HOST_IP:~/.openclaw/workspace*/ $BACKUP_PATH/workspace/

# 4. 创建备份元信息
cat > $BACKUP_PATH/backup_info.json << EOF
{
    "node_id": "$NODE_ID",
    "backup_name": "$BACKUP_NAME",
    "created_at": "$(date -Iseconds)",
    "host_ip": "$HOST_IP",
    "backup_type": "full"
}
EOF

# 5. 压缩备份
echo "压缩备份文件..."
cd $BACKUP_DIR
tar -czf $BACKUP_NAME.tar.gz $BACKUP_NAME/
rm -rf $BACKUP_NAME/

# 6. 计算文件大小和校验
BACKUP_SIZE=$(stat -f%z $BACKUP_NAME.tar.gz 2>/dev/null || stat -c%s $BACKUP_NAME.tar.gz)
BACKUP_MD5=$(md5sum $BACKUP_NAME.tar.gz | cut -d' ' -f1)

# 7. 更新数据库记录
python3 << EOF
import sqlite3
import json
from datetime import datetime

conn = sqlite3.connect('/home/linou/shared/ocm-project/ocm.db')
cursor = conn.cursor()

cursor.execute('''
    INSERT INTO backups (node_id, backup_name, file_path, file_size, 
                        checksum, created_at, backup_type)
    VALUES (?, ?, ?, ?, ?, ?, ?)
''', (
    '$NODE_ID',
    '$BACKUP_NAME', 
    '$BACKUP_PATH.tar.gz',
    $BACKUP_SIZE,
    '$BACKUP_MD5',
    '$(date -Iseconds)',
    'full'
))

conn.commit()
conn.close()
print("备份记录已保存到数据库")
EOF

echo "备份完成: $BACKUP_NAME.tar.gz ($(numfmt --to=iec $BACKUP_SIZE))"
```

#### 步骤2: 列出备份历史
**执行脚本**: `list_node_backups.py`
```python
def get_node_backups(node_id, limit=3):
    """获取节点备份历史"""
    conn = sqlite3.connect('/home/linou/shared/ocm-project/ocm.db')
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
        
        # 计算友好的文件大小显示
        size_mb = file_size / (1024 * 1024)
        if size_mb < 1024:
            size_str = f"{size_mb:.1f}MB"
        else:
            size_str = f"{size_mb/1024:.1f}GB"
        
        # 计算时间差显示
        created_time = datetime.fromisoformat(created_at)
        time_diff = datetime.now() - created_time
        if time_diff.days > 0:
            time_str = f"{time_diff.days}天前"
        elif time_diff.seconds > 3600:
            time_str = f"{time_diff.seconds//3600}小时前"
        else:
            time_str = f"{time_diff.seconds//60}分钟前"
        
        backups.append({
            'name': backup_name,
            'path': file_path,
            'size_str': size_str,
            'time_str': time_str,
            'checksum': checksum
        })
    
    conn.close()
    return backups
```

#### 步骤3: 从备份还原
**执行脚本**: `restore_node_backup.py`
```bash
#!/bin/bash
# 节点备份还原脚本

NODE_ID=$1
BACKUP_NAME=$2
HOST_IP=$3
SSH_PORT=$4
SSH_USER=$5

BACKUP_DIR="/home/linou/shared/ocm-project/backups/$NODE_ID"
BACKUP_FILE="$BACKUP_DIR/$BACKUP_NAME.tar.gz"
RESTORE_DIR="/tmp/ocm_restore_$RANDOM"

echo "开始还原备份: $BACKUP_NAME 到节点: $NODE_ID"

# 1. 验证备份文件存在
if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: 备份文件不存在: $BACKUP_FILE"
    exit 1
fi

# 2. 校验备份完整性
echo "校验备份完整性..."
STORED_MD5=$(sqlite3 /home/linou/shared/ocm-project/ocm.db "SELECT checksum FROM backups WHERE backup_name='$BACKUP_NAME' AND node_id='$NODE_ID';")
ACTUAL_MD5=$(md5sum $BACKUP_FILE | cut -d' ' -f1)

if [ "$STORED_MD5" != "$ACTUAL_MD5" ]; then
    echo "ERROR: 备份文件校验失败"
    exit 1
fi

# 3. 解压备份文件
echo "解压备份文件..."
mkdir -p $RESTORE_DIR
cd $RESTORE_DIR
tar -xzf $BACKUP_FILE

# 4. 停止目标节点的OpenClaw服务
echo "停止目标节点OpenClaw服务..."
ssh -p $SSH_PORT $SSH_USER@$HOST_IP "systemctl --user stop openclaw-gateway"

# 5. 备份现有配置（以防需要回滚）
ROLLBACK_DIR="/tmp/rollback_$(date +%Y%m%d_%H%M%S)"
ssh -p $SSH_PORT $SSH_USER@$HOST_IP "mkdir -p $ROLLBACK_DIR && cp -r ~/.openclaw/* $ROLLBACK_DIR/"

# 6. 还原配置文件
echo "还原配置文件..."
scp -P $SSH_PORT $BACKUP_NAME/openclaw.json $SSH_USER@$HOST_IP:~/.openclaw/
scp -P $SSH_PORT $BACKUP_NAME/auth-profiles.json $SSH_USER@$HOST_IP:~/.openclaw/

# 7. 还原agents目录
echo "还原agents配置..."
ssh -p $SSH_PORT $SSH_USER@$HOST_IP "rm -rf ~/.openclaw/agents/*"
rsync -avz -e "ssh -p $SSH_PORT" $BACKUP_NAME/agents/ $SSH_USER@$HOST_IP:~/.openclaw/agents/

# 8. 还原workspace
echo "还原workspace..."
rsync -avz -e "ssh -p $SSH_PORT" $BACKUP_NAME/workspace/ $SSH_USER@$HOST_IP:~/.openclaw/workspace/

# 9. 修复文件权限
ssh -p $SSH_PORT $SSH_USER@$HOST_IP "chmod 600 ~/.openclaw/auth-profiles.json"
ssh -p $SSH_PORT $SSH_USER@$HOST_IP "chmod -R 755 ~/.openclaw/agents/"

# 10. 重启OpenClaw服务
echo "重启OpenClaw服务..."
ssh -p $SSH_PORT $SSH_USER@$HOST_IP "systemctl --user start openclaw-gateway"

# 11. 验证服务状态
sleep 5
SERVICE_STATUS=$(ssh -p $SSH_PORT $SSH_USER@$HOST_IP "systemctl --user is-active openclaw-gateway")

if [ "$SERVICE_STATUS" = "active" ]; then
    echo "SUCCESS: 还原完成，服务正常运行"
    # 记录还原操作到数据库
    python3 << EOF
import sqlite3
from datetime import datetime

conn = sqlite3.connect('/home/linou/shared/ocm-project/ocm.db')
cursor = conn.cursor()

cursor.execute('''
    INSERT INTO restore_logs (node_id, backup_name, restored_at, status, rollback_path)
    VALUES (?, ?, ?, ?, ?)
''', ('$NODE_ID', '$BACKUP_NAME', datetime.now().isoformat(), 'success', '$ROLLBACK_DIR'))

conn.commit()
conn.close()
EOF
else
    echo "ERROR: 服务启动失败，准备回滚..."
    # 回滚操作
    rsync -avz -e "ssh -p $SSH_PORT" $ROLLBACK_DIR/ $SSH_USER@$HOST_IP:~/.openclaw/
    ssh -p $SSH_PORT $SSH_USER@$HOST_IP "systemctl --user start openclaw-gateway"
    exit 1
fi

# 12. 清理临时文件
rm -rf $RESTORE_DIR
echo "还原操作完成"
```

---

### 4. Bot管理操作流程

#### 步骤1: Bot状态监控
**执行脚本**: `bot_status_monitor.py`
```python
def get_bot_detailed_info(node_info, agent_id):
    """获取Bot详细信息"""
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(node_info['host_ip'], port=node_info['ssh_port'], 
                   username=node_info['ssh_user'])
        
        # 检查进程信息
        stdin, stdout, stderr = ssh.exec_command(
            f"ps aux | grep 'openclaw.*{agent_id}' | grep -v grep"
        )
        process_info = stdout.read().decode().strip()
        
        if process_info:
            # 解析进程信息
            parts = process_info.split()
            pid = parts[1]
            cpu_usage = parts[2]
            mem_usage = parts[3]
            start_time = parts[8]
            
            # 获取内存使用量（KB转MB）
            stdin, stdout, stderr = ssh.exec_command(
                f"ps -o pid,rss --no-headers -p {pid}"
            )
            mem_info = stdout.read().decode().strip()
            if mem_info:
                rss_kb = int(mem_info.split()[1])
                mem_mb = rss_kb / 1024
            else:
                mem_mb = 0
            
            # 计算运行时长
            stdin, stdout, stderr = ssh.exec_command(
                f"ps -o pid,etime --no-headers -p {pid}"
            )
            runtime_info = stdout.read().decode().strip()
            runtime = runtime_info.split()[1] if runtime_info else "未知"
            
            # 检查最后消息时间（从session文件）
            stdin, stdout, stderr = ssh.exec_command(
                f"find ~/.openclaw/agents/{agent_id}/sessions/ -name '*.jsonl' -type f -exec ls -lt {{}} + | head -1 | awk '{{print $6, $7, $8}}'"
            )
            last_message = stdout.read().decode().strip()
            
            return {
                'status': 'running',
                'pid': pid,
                'cpu_usage': cpu_usage + '%',
                'memory_mb': f"{mem_mb:.1f}MB",
                'runtime': runtime,
                'last_message': last_message or '未知'
            }
        else:
            return {'status': 'stopped'}
            
    except Exception as e:
        return {'status': 'error', 'message': str(e)}
    finally:
        ssh.close()
```

#### 步骤2: Bot重启管理
**执行脚本**: `bot_restart_manager.py`
```python
def restart_bot(node_info, agent_id):
    """重启指定Bot"""
    ssh = paramiko.SSHClient() 
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(node_info['host_ip'], port=node_info['ssh_port'],
                   username=node_info['ssh_user'])
        
        # 1. 找到并停止Bot进程
        stdin, stdout, stderr = ssh.exec_command(
            f"pkill -f 'openclaw.*{agent_id}'"
        )
        
        # 等待进程完全停止
        time.sleep(2)
        
        # 2. 检查进程是否已停止
        stdin, stdout, stderr = ssh.exec_command(
            f"pgrep -f 'openclaw.*{agent_id}'"
        )
        remaining = stdout.read().decode().strip()
        
        if remaining:
            # 强制停止
            stdin, stdout, stderr = ssh.exec_command(
                f"pkill -9 -f 'openclaw.*{agent_id}'"
            )
            time.sleep(1)
        
        # 3. 重启OpenClaw Gateway (会重新拉起agent)
        stdin, stdout, stderr = ssh.exec_command(
            "systemctl --user restart openclaw-gateway"
        )
        
        # 4. 等待服务启动
        time.sleep(5)
        
        # 5. 验证服务状态
        stdin, stdout, stderr = ssh.exec_command(
            "systemctl --user is-active openclaw-gateway"
        )
        service_status = stdout.read().decode().strip()
        
        # 6. 检查agent是否正常运行
        stdin, stdout, stderr = ssh.exec_command(
            f"pgrep -f 'openclaw.*{agent_id}'"
        )
        new_pid = stdout.read().decode().strip()
        
        if service_status == 'active' and new_pid:
            return {
                'status': 'success', 
                'message': f'Bot重启成功，新PID: {new_pid}',
                'new_pid': new_pid
            }
        else:
            return {
                'status': 'error',
                'message': '服务重启后Bot未正常运行'
            }
            
    except Exception as e:
        return {'status': 'error', 'message': str(e)}
    finally:
        ssh.close()
```

#### 步骤3: Bot日志查看
**执行脚本**: `bot_log_viewer.py`
```python
def get_bot_logs(node_info, agent_id, lines=50):
    """获取Bot运行日志"""
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(node_info['host_ip'], port=node_info['ssh_port'],
                   username=node_info['ssh_user'])
        
        # 1. 查看systemd日志
        stdin, stdout, stderr = ssh.exec_command(
            f"journalctl --user -u openclaw-gateway -n {lines} --no-pager"
        )
        system_logs = stdout.read().decode()
        
        # 2. 查看agent特定日志
        stdin, stdout, stderr = ssh.exec_command(
            f"find ~/.openclaw/agents/{agent_id}/ -name '*.log' -type f | head -1"
        )
        log_file = stdout.read().decode().strip()
        
        agent_logs = ""
        if log_file:
            stdin, stdout, stderr = ssh.exec_command(
                f"tail -n {lines} {log_file}"
            )
            agent_logs = stdout.read().decode()
        
        # 3. 查看最新session活动
        stdin, stdout, stderr = ssh.exec_command(
            f"find ~/.openclaw/agents/{agent_id}/sessions/ -name '*.jsonl' -type f -exec tail -5 {{}} +"
        )
        session_activity = stdout.read().decode()
        
        return {
            'system_logs': system_logs,
            'agent_logs': agent_logs,
            'session_activity': session_activity
        }
        
    except Exception as e:
        return {'error': str(e)}
    finally:
        ssh.close()
```

---

### 5. 节点重启操作

#### 执行脚本: `node_restart_manager.py`
```python
def restart_node(node_info):
    """重启节点的OpenClaw服务"""
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    restart_log = []
    
    try:
        ssh.connect(node_info['host_ip'], port=node_info['ssh_port'],
                   username=node_info['ssh_user'])
        
        # 1. 停止服务
        restart_log.append("停止OpenClaw服务...")
        stdin, stdout, stderr = ssh.exec_command(
            "systemctl --user stop openclaw-gateway"
        )
        time.sleep(3)
        
        # 2. 检查进程是否完全停止
        restart_log.append("检查残留进程...")
        stdin, stdout, stderr = ssh.exec_command(
            "pgrep -f openclaw"
        )
        remaining_pids = stdout.read().decode().strip()
        
        if remaining_pids:
            restart_log.append(f"强制停止残留进程: {remaining_pids}")
            stdin, stdout, stderr = ssh.exec_command(
                "pkill -9 -f openclaw"
            )
            time.sleep(2)
        
        # 3. 清理可能的端口占用
        restart_log.append("清理端口占用...")
        stdin, stdout, stderr = ssh.exec_command(
            "lsof -ti:18789 | xargs -r kill -9"
        )
        
        # 4. 重新加载systemd配置
        stdin, stdout, stderr = ssh.exec_command(
            "systemctl --user daemon-reload"
        )
        
        # 5. 启动服务
        restart_log.append("启动OpenClaw服务...")
        stdin, stdout, stderr = ssh.exec_command(
            "systemctl --user start openclaw-gateway"
        )
        
        # 6. 等待服务启动
        restart_log.append("等待服务启动...")
        for i in range(10):  # 等待最多10秒
            time.sleep(1)
            stdin, stdout, stderr = ssh.exec_command(
                "systemctl --user is-active openclaw-gateway"
            )
            status = stdout.read().decode().strip()
            if status == 'active':
                break
        
        # 7. 验证端口监听
        restart_log.append("验证端口监听...")
        stdin, stdout, stderr = ssh.exec_command(
            "ss -tlnp | grep :18789"
        )
        port_status = stdout.read().decode().strip()
        
        # 8. 检查agent数量
        time.sleep(3)  # 等待agents启动
        stdin, stdout, stderr = ssh.exec_command(
            "pgrep -f openclaw | wc -l"
        )
        process_count = stdout.read().decode().strip()
        
        if status == 'active' and port_status and int(process_count) > 0:
            restart_log.append(f"✅ 重启成功! 服务状态: {status}, 进程数: {process_count}")
            return {
                'status': 'success',
                'message': '节点重启成功',
                'log': restart_log,
                'process_count': process_count
            }
        else:
            restart_log.append(f"❌ 重启失败! 服务状态: {status}")
            return {
                'status': 'error', 
                'message': '节点重启失败',
                'log': restart_log
            }
        
    except Exception as e:
        restart_log.append(f"❌ 重启异常: {str(e)}")
        return {
            'status': 'error',
            'message': str(e),
            'log': restart_log
        }
    finally:
        ssh.close()
```

---

## 🗄️ 数据库表结构需要创建

```sql
-- 节点表
CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    host_ip TEXT NOT NULL,
    ssh_port INTEGER DEFAULT 22,
    ssh_user TEXT NOT NULL,
    openclaw_path TEXT DEFAULT '/usr/bin/openclaw',
    status TEXT DEFAULT 'active',
    created_at TEXT NOT NULL,
    last_check TEXT NOT NULL
);

-- 备份表
CREATE TABLE IF NOT EXISTS backups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id TEXT NOT NULL,
    backup_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    checksum TEXT NOT NULL,
    created_at TEXT NOT NULL,
    backup_type TEXT DEFAULT 'full',
    FOREIGN KEY (node_id) REFERENCES nodes (id)
);

-- 还原日志表
CREATE TABLE IF NOT EXISTS restore_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id TEXT NOT NULL,
    backup_name TEXT NOT NULL,
    restored_at TEXT NOT NULL,
    status TEXT NOT NULL,
    rollback_path TEXT,
    FOREIGN KEY (node_id) REFERENCES nodes (id)
);

-- 操作日志表
CREATE TABLE IF NOT EXISTS operation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id TEXT,
    operation_type TEXT NOT NULL,
    operation_details TEXT,
    performed_by TEXT,
    performed_at TEXT NOT NULL,
    status TEXT NOT NULL
);
```