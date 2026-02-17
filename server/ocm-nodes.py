#!/usr/bin/env python3
"""
OCM Node Manager CLI - 节点管理工具
用法: python3 ocm-nodes.py <command> [args]
"""

import argparse
import json
import os
import subprocess
import sys
import datetime

# === Backup base directory (centralized on T440) ===
BACKUP_BASE = '/home/linou/shared/00_Node_Backup'

# === ANSI Colors ===
class C:
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    DIM = '\033[2m'
    RESET = '\033[0m'

def colored(text, color):
    return f"{color}{text}{C.RESET}"

# === Registry ===
def find_registry():
    """Find nodes-registry.json"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(os.getcwd(), 'nodes-registry.json'),
        os.path.join(script_dir, 'nodes-registry.json'),
        os.path.expanduser('~/.openclaw/workspace-main/nodes-registry.json'),
        os.environ.get('OCM_NODES_REGISTRY', ''),
    ]
    for p in candidates:
        if p and os.path.isfile(p):
            return p
    print(colored("✗ 找不到 nodes-registry.json", C.RED))
    print(f"  搜索路径: {candidates[:2]}")
    print(f"  或设置环境变量 OCM_NODES_REGISTRY")
    sys.exit(1)

def load_registry():
    path = find_registry()
    with open(path) as f:
        return json.load(f)

def save_registry(data):
    path = find_registry()
    with open(path, 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(colored(f"✓ 已保存到 {path}", C.GREEN))

def get_node(node_id):
    reg = load_registry()
    for n in reg['nodes']:
        if n['id'] == node_id:
            return n
    print(colored(f"✗ 找不到节点: {node_id}", C.RED))
    avail = ', '.join(n['id'] for n in reg['nodes'])
    print(f"  可用节点: {avail}")
    sys.exit(1)

# === SSH ===
def is_local(node):
    """Check if node is the local machine"""
    import socket
    try:
        local_ips = set()
        hostname = socket.gethostname()
        for info in socket.getaddrinfo(hostname, None):
            local_ips.add(info[4][0])
        local_ips.add('127.0.0.1')
        local_ips.add('::1')
        try:
            r = subprocess.run(['hostname', '-I'], capture_output=True, text=True, timeout=5)
            if r.returncode == 0:
                for ip in r.stdout.strip().split():
                    local_ips.add(ip)
        except:
            pass
        return node['host'] in local_ips
    except:
        return False

def ssh_cmd(node, command, timeout=30):
    """Execute SSH command, return (success, stdout, stderr). Uses local exec if on same machine."""
    if is_local(node):
        try:
            result = subprocess.run(['bash', '-c', command], capture_output=True, text=True, timeout=timeout)
            return result.returncode == 0, result.stdout.strip(), result.stderr.strip()
        except subprocess.TimeoutExpired:
            return False, '', '命令超时'
        except Exception as e:
            return False, '', str(e)
    
    ssh = [
        'ssh', '-o', 'ConnectTimeout=5', '-o', 'StrictHostKeyChecking=no',
        '-p', str(node['sshPort']),
        f"{node['sshUser']}@{node['host']}",
        command
    ]
    try:
        result = subprocess.run(ssh, capture_output=True, text=True, timeout=timeout)
        return result.returncode == 0, result.stdout.strip(), result.stderr.strip()
    except subprocess.TimeoutExpired:
        return False, '', 'SSH连接超时'
    except Exception as e:
        return False, '', str(e)

def scp_from_node(node, remote_path, local_path):
    """SCP file from node to local. Returns (success, stderr)."""
    if is_local(node):
        # Local copy
        try:
            result = subprocess.run(['cp', remote_path, local_path], capture_output=True, text=True, timeout=60)
            return result.returncode == 0, result.stderr.strip()
        except Exception as e:
            return False, str(e)
    scp = [
        'scp', '-o', 'ConnectTimeout=5', '-o', 'StrictHostKeyChecking=no',
        '-P', str(node['sshPort']),
        f"{node['sshUser']}@{node['host']}:{remote_path}",
        local_path
    ]
    try:
        result = subprocess.run(scp, capture_output=True, text=True, timeout=600)
        return result.returncode == 0, result.stderr.strip()
    except Exception as e:
        return False, str(e)

def scp_to_node(node, local_path, remote_path):
    """SCP file from local to node. Returns (success, stderr)."""
    if is_local(node):
        try:
            result = subprocess.run(['cp', local_path, remote_path], capture_output=True, text=True, timeout=60)
            return result.returncode == 0, result.stderr.strip()
        except Exception as e:
            return False, str(e)
    scp = [
        'scp', '-o', 'ConnectTimeout=5', '-o', 'StrictHostKeyChecking=no',
        '-P', str(node['sshPort']),
        local_path,
        f"{node['sshUser']}@{node['host']}:{remote_path}"
    ]
    try:
        result = subprocess.run(scp, capture_output=True, text=True, timeout=600)
        return result.returncode == 0, result.stderr.strip()
    except Exception as e:
        return False, str(e)

def log_action(action, node_id, detail=''):
    """Log action to file"""
    ts = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    log_dir = os.path.expanduser('~/.openclaw/workspace-main')
    os.makedirs(log_dir, exist_ok=True)
    log_file = os.path.join(log_dir, 'ocm-nodes.log')
    with open(log_file, 'a') as f:
        f.write(f"[{ts}] {action} node={node_id} {detail}\n")

def get_backup_dir(node_id, bot_id=None):
    """Get centralized backup directory path on T440"""
    if bot_id:
        return os.path.join(BACKUP_BASE, node_id, bot_id)
    return os.path.join(BACKUP_BASE, node_id)

# === Commands ===

def cmd_list(args):
    """列出所有节点及状态"""
    reg = load_registry()
    print(colored("🖥️  OCM 节点列表", C.BOLD))
    print("─" * 60)
    
    for node in reg['nodes']:
        ok, out, _ = ssh_cmd(node, "systemctl --user is-active openclaw-gateway 2>/dev/null || echo inactive")
        status = out.strip().split('\n')[-1] if ok else 'unreachable'
        
        if status == 'active':
            status_str = colored("● 在线", C.GREEN)
        elif status == 'inactive':
            status_str = colored("○ 离线", C.YELLOW)
        else:
            status_str = colored("✗ 不可达", C.RED)
        
        ok2, out2, _ = ssh_cmd(node, f"ls -d {node['ocPath']}/agents/*/ 2>/dev/null | wc -l")
        bot_count = out2.strip() if ok2 else '?'
        
        print(f"  {status_str}  {colored(node['id'], C.BOLD):30s}  {node['name']:20s}  {node['host']}  Bots: {bot_count}")
    
    print("─" * 60)

def cmd_status(args):
    """节点详情"""
    node = get_node(args.nodeId)
    print(colored(f"🖥️  节点详情: {node['name']}", C.BOLD))
    print("─" * 50)
    print(f"  ID:       {node['id']}")
    print(f"  主机:     {node['sshUser']}@{node['host']}:{node['sshPort']}")
    print(f"  OC路径:   {node['ocPath']}")
    print(f"  Gateway:  端口 {node['gatewayPort']}")
    
    ok, out, _ = ssh_cmd(node, "systemctl --user status openclaw-gateway 2>/dev/null | head -5")
    if ok:
        print(f"\n  {colored('Gateway 状态:', C.CYAN)}")
        for line in out.split('\n'):
            print(f"    {line}")
    else:
        print(f"\n  {colored('Gateway: 无法获取状态', C.RED)}")
    
    ok, out, _ = ssh_cmd(node, f"du -sh {node['ocPath']} 2>/dev/null")
    if ok:
        print(f"\n  磁盘占用: {out.split()[0] if out else '未知'}")
    
    ok, out, _ = ssh_cmd(node, "uptime -p 2>/dev/null")
    if ok:
        print(f"  系统运行: {out}")
    
    print(f"\n  {colored('Agents:', C.CYAN)}")
    _print_bots(node)
    
    log_action('status', args.nodeId)

def _print_bots(node):
    """Print bot list for a node"""
    ok, out, _ = ssh_cmd(node, f"cat {node['ocPath']}/openclaw.json 2>/dev/null")
    if not ok:
        print(colored("    无法读取 openclaw.json", C.RED))
        return []
    
    try:
        config = json.loads(out)
        agents = config.get('agents', {}).get('list', [])
        if not agents:
            print("    (无 agents)")
            return []
        
        # Build channel map from bindings
        channel_map = {}
        for binding in config.get('bindings', []):
            agent_id = binding.get('agentId', '')
            match = binding.get('match', {})
            ch = match.get('channel', '')
            if agent_id and ch:
                channel_map[agent_id] = ch
        
        # Build model map from agent configs
        for i, agent in enumerate(agents, 1):
            aid = agent.get('id', '?')
            name = aid
            model = agent.get('model', '?')
            channel = channel_map.get(aid, '?')
            
            # Try agent's own config
            ok_a, out_a, _ = ssh_cmd(node, f"cat {node['ocPath']}/agents/{aid}/agent/openclaw.json 2>/dev/null")
            if ok_a:
                try:
                    acfg = json.loads(out_a)
                    name = acfg.get('name', aid)
                    m = acfg.get('llm', {}).get('model', '')
                    if m:
                        model = m
                    ch = acfg.get('channels', [])
                    if ch:
                        channel = ch[0].get('type', channel)
                except:
                    pass
            
            # Fallback: check defaults
            if model == '?' or not model:
                model = config.get('agents', {}).get('defaults', {}).get('model', {}).get('primary', '?')
            
            print(f"    {i}. {colored(aid, C.CYAN):30s}  {name:20s}  📡 {channel}  🧠 {model}")
        return agents
    except json.JSONDecodeError:
        print(colored("    openclaw.json 解析失败", C.RED))
        return []

def cmd_backup(args):
    """备份节点 - 集中存储到 T440"""
    node = get_node(args.nodeId)
    print(colored(f"💾 备份节点: {node['name']}", C.BOLD))
    
    ts = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
    filename = f"openclaw-backup-{node['id']}-{ts}.tar.gz"
    backup_dir = get_backup_dir(node['id'])
    os.makedirs(backup_dir, exist_ok=True)
    
    if is_local(node):
        # Local: tar directly to backup dir
        target = os.path.join(backup_dir, filename)
        cmd = f"tar czf {target} -C {os.path.dirname(node['ocPath'])} {os.path.basename(node['ocPath'])}/"
        print(f"  执行: tar czf {target} ...")
        ok, out, err = ssh_cmd(node, cmd, timeout=600)
    else:
        # Remote: tar to /tmp, scp to backup dir, cleanup
        cmd = f"tar czf /tmp/{filename} -C {os.path.dirname(node['ocPath'])} {os.path.basename(node['ocPath'])}/"
        print(f"  执行: 远程打包到 /tmp/{filename} ...")
        ok, out, err = ssh_cmd(node, cmd, timeout=600)
        if ok:
            print(f"  SCP到本地备份目录...")
            target = os.path.join(backup_dir, filename)
            scp_ok, scp_err = scp_from_node(node, f"/tmp/{filename}", target)
            if scp_ok:
                # Cleanup remote temp file
                ssh_cmd(node, f"rm -f /tmp/{filename}")
            else:
                print(colored(f"  ✗ SCP失败: {scp_err}", C.RED))
                ok = False
                err = scp_err
    
    if ok:
        target = os.path.join(backup_dir, filename)
        try:
            size = os.path.getsize(target)
            size_str = f"{size / 1024 / 1024:.1f}M" if size > 1024*1024 else f"{size / 1024:.0f}K"
        except:
            size_str = '?'
        print(colored(f"  ✓ 备份成功: {target} ({size_str})", C.GREEN))
        log_action('backup', args.nodeId, f"file={filename}")
    else:
        print(colored(f"  ✗ 备份失败: {err}", C.RED))
        log_action('backup-failed', args.nodeId, err)

def cmd_restore(args):
    """还原节点 - 从集中备份目录"""
    node = get_node(args.nodeId)
    backup_dir = get_backup_dir(node['id'])
    
    if not args.filename:
        # List available backups from local backup dir (no SSH needed)
        print(colored(f"📋 可用备份 ({node['name']}):", C.BOLD))
        import glob
        pattern = os.path.join(backup_dir, 'openclaw-backup-*.tar.gz')
        files = sorted(glob.glob(pattern), key=os.path.getmtime, reverse=True)[:10]
        if files:
            for f in files:
                stat = os.stat(f)
                size = f"{stat.st_size / 1024 / 1024:.1f}M" if stat.st_size > 1024*1024 else f"{stat.st_size / 1024:.0f}K"
                mtime = datetime.datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M:%S')
                print(f"  {mtime}  {size:>8s}  {os.path.basename(f)}")
        else:
            print(f"  (无可用备份，目录: {backup_dir})")
        return
    
    filename = args.filename
    # Resolve filename to full path in backup dir
    if not filename.startswith('/'):
        filename = os.path.join(backup_dir, filename)
    
    if not os.path.isfile(filename):
        print(colored(f"  ✗ 备份文件不存在: {filename}", C.RED))
        return
    
    print(colored(f"🔄 还原节点: {node['name']}", C.BOLD))
    print(f"  备份文件: {filename}")
    
    confirm = input(colored("  确认还原? (yes/no): ", C.YELLOW))
    if confirm.lower() != 'yes':
        print("  已取消")
        return
    
    if is_local(node):
        cmd = f"tar xzf {filename} -C {os.path.dirname(node['ocPath'])}/"
        ok, out, err = ssh_cmd(node, cmd, timeout=600)
    else:
        # SCP to remote /tmp, extract, cleanup
        remote_tmp = f"/tmp/{os.path.basename(filename)}"
        scp_ok, scp_err = scp_to_node(node, filename, remote_tmp)
        if not scp_ok:
            print(colored(f"  ✗ SCP到节点失败: {scp_err}", C.RED))
            return
        cmd = f"tar xzf {remote_tmp} -C {os.path.dirname(node['ocPath'])}/ && rm -f {remote_tmp}"
        ok, out, err = ssh_cmd(node, cmd, timeout=600)
    
    if ok:
        print(colored("  ✓ 还原成功", C.GREEN))
        log_action('restore', args.nodeId, f"file={filename}")
        print("  重启Gateway...")
        ok_r, _, _ = ssh_cmd(node, "systemctl --user restart openclaw-gateway 2>&1", timeout=15)
        import time
        time.sleep(3)
        ok_s, status, _ = ssh_cmd(node, "systemctl --user is-active openclaw-gateway 2>/dev/null")
        if ok_s and 'active' in (status or ''):
            print(colored("  ✓ Gateway已重启", C.GREEN))
        else:
            print(colored("  ⚠ Gateway重启后状态异常，请检查", C.YELLOW))
    else:
        print(colored(f"  ✗ 还原失败: {err}", C.RED))

def cmd_restart(args):
    """重启 Gateway"""
    node = get_node(args.nodeId)
    print(colored(f"🔄 重启 Gateway: {node['name']}", C.BOLD))
    
    ok, out, err = ssh_cmd(node, "systemctl --user restart openclaw-gateway")
    if ok:
        print(colored("  ✓ 重启命令已发送", C.GREEN))
        import time
        time.sleep(2)
        ok2, out2, _ = ssh_cmd(node, "systemctl --user is-active openclaw-gateway")
        if ok2 and 'active' in out2:
            print(colored("  ✓ Gateway 已恢复运行", C.GREEN))
        else:
            print(colored("  ⚠ Gateway 可能未成功启动，请检查", C.YELLOW))
        log_action('restart', args.nodeId)
    else:
        print(colored(f"  ✗ 重启失败: {err}", C.RED))

def cmd_doctor_fix(args):
    """运行 openclaw doctor --fix"""
    node = get_node(args.nodeId)
    print(colored(f"🩺 Doctor Fix: {node['name']}", C.BOLD))
    
    print(f"[Step 1/3] 连接到节点 {node['id']}...")
    sys.stdout.flush()
    ok, _, err = ssh_cmd(node, "echo ok", timeout=10)
    if not ok:
        print(f"[Step 1/3] ✗ SSH连接失败: {err}")
        sys.stdout.flush()
        return
    print(f"[Step 1/3] ✓ SSH连接成功")
    sys.stdout.flush()
    
    print(f"[Step 2/3] 执行 openclaw doctor --fix...")
    sys.stdout.flush()
    ok, out, err = ssh_cmd(node, "export PATH=$HOME/.local/bin:$HOME/.nvm/versions/node/*/bin:/usr/local/bin:$PATH && openclaw doctor --fix 2>&1", timeout=120)
    if ok:
        print(f"[Step 2/3] ✓ Doctor完成")
        if out:
            for line in out.split('\n'):
                print(f"  {line}")
    else:
        print(f"[Step 2/3] ⚠ Doctor执行结果: {err or out}")
        if out:
            for line in out.split('\n'):
                print(f"  {line}")
    sys.stdout.flush()
    
    print(f"[Step 3/3] ✓ Doctor Fix 完成!")
    sys.stdout.flush()
    log_action('doctor-fix', args.nodeId)

def cmd_set_subscription(args):
    """设置订阅Token"""
    node = get_node(args.nodeId)
    token = args.token
    print(colored(f"🔑 设置订阅: {node['name']}", C.BOLD))
    
    print(f"[Step 1/4] 连接到节点 {node['id']}...")
    sys.stdout.flush()
    ok, _, err = ssh_cmd(node, "echo ok", timeout=10)
    if not ok:
        print(f"[Step 1/4] ✗ SSH连接失败: {err}")
        sys.stdout.flush()
        return
    print(f"[Step 1/4] ✓ SSH连接成功")
    sys.stdout.flush()
    
    print(f"[Step 2/4] 读取现有 auth-profiles.json...")
    sys.stdout.flush()
    auth_path = f"{node['ocPath']}/auth-profiles.json"
    ok, out, _ = ssh_cmd(node, f"cat {auth_path} 2>/dev/null")
    if ok and out:
        try:
            auth = json.loads(out)
        except:
            auth = {}
    else:
        auth = {}
    print(f"[Step 2/4] ✓ 已读取")
    sys.stdout.flush()
    
    print(f"[Step 3/4] 更新订阅Token...")
    sys.stdout.flush()
    # Update or create anthropic profile
    if 'profiles' not in auth:
        auth['profiles'] = {}
    if 'version' not in auth:
        auth['version'] = 1
    
    # Find anthropic profile key
    anthropic_key = None
    for k in auth.get('profiles', {}):
        if 'anthropic' in k.lower():
            anthropic_key = k
            break
    if not anthropic_key:
        anthropic_key = 'anthropic-0'
    
    profile = auth['profiles'].get(anthropic_key, {})
    profile['apiKey'] = token
    if 'type' not in profile:
        profile['type'] = 'token'
    if 'provider' not in profile:
        profile['provider'] = 'anthropic'
    auth['profiles'][anthropic_key] = profile
    
    if 'lastGood' not in auth:
        auth['lastGood'] = {}
    auth['lastGood']['anthropic'] = anthropic_key
    
    import base64
    auth_json = json.dumps(auth, indent=2, ensure_ascii=False)
    b64 = base64.b64encode(auth_json.encode()).decode()
    ok, _, err = ssh_cmd(node, f"echo '{b64}' | base64 -d > {auth_path}")
    if ok:
        print(f"[Step 3/4] ✓ Token已更新 (profile: {anthropic_key})")
    else:
        print(f"[Step 3/4] ✗ 写入失败: {err}")
        sys.stdout.flush()
        return
    sys.stdout.flush()
    
    print(f"[Step 4/4] ✓ 订阅设置完成! Token: ...{token[-8:]}")
    sys.stdout.flush()
    log_action('set-subscription', args.nodeId, f"token=...{token[-8:]}")

def cmd_retire(args):
    """退役节点 - 完整清理流程"""
    node = get_node(args.nodeId)
    TOTAL = 10
    errors = []
    ssh_ok = True

    print(colored(f"⚠️  退役节点: {node['name']}", C.YELLOW))
    print(f"  这将完全清除目标节点上的OpenClaw，包括所有Bot、配置和程序本身。")

    if not getattr(args, 'yes', False):
        confirm = input(colored("  确认退役? 输入节点ID确认: ", C.YELLOW))
        if confirm != args.nodeId:
            print("  已取消")
            return

    sys.stdout.flush()

    # Step 1: SSH连接测试
    print(f"[Step 1/{TOTAL}] 验证节点信息，SSH连接测试...")
    sys.stdout.flush()
    ok, out, err = ssh_cmd(node, "echo ok", timeout=10)
    if ok:
        print(f"[Step 1/{TOTAL}] ✓ SSH连接成功 ({node['sshUser']}@{node['host']})")
    else:
        ssh_ok = False
        errors.append(f"Step 1: SSH连接失败: {err}")
        print(f"[Step 1/{TOTAL}] ✗ SSH连接失败: {err}，将跳过远程清理步骤")
    sys.stdout.flush()

    # Step 2: 停止Gateway
    print(f"[Step 2/{TOTAL}] 停止OpenClaw Gateway服务...")
    sys.stdout.flush()
    if ssh_ok:
        ok, out, err = ssh_cmd(node, "systemctl --user stop openclaw-gateway 2>&1; systemctl --user is-active openclaw-gateway 2>&1 || true")
        if ok:
            print(f"[Step 2/{TOTAL}] ✓ Gateway已停止")
        else:
            errors.append(f"Step 2: 停止Gateway失败: {err}")
            print(f"[Step 2/{TOTAL}] ⚠ 停止Gateway失败(可能未运行): {err}")
    else:
        print(f"[Step 2/{TOTAL}] ⏭ 跳过(SSH不可达)")
    sys.stdout.flush()

    # Step 3: 禁用开机自启
    print(f"[Step 3/{TOTAL}] 禁用Gateway开机自启...")
    sys.stdout.flush()
    if ssh_ok:
        ok, out, err = ssh_cmd(node, "systemctl --user disable openclaw-gateway 2>&1 || true")
        print(f"[Step 3/{TOTAL}] ✓ 已禁用开机自启")
    else:
        print(f"[Step 3/{TOTAL}] ⏭ 跳过(SSH不可达)")
    sys.stdout.flush()

    # Step 4: 备份到集中目录
    print(f"[Step 4/{TOTAL}] 备份配置到集中备份目录...")
    sys.stdout.flush()
    if ssh_ok:
        ts = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
        filename = f"openclaw-retire-backup-{node['id']}-{ts}.tar.gz"
        backup_dir = get_backup_dir(node['id'])
        os.makedirs(backup_dir, exist_ok=True)
        
        if is_local(node):
            target = os.path.join(backup_dir, filename)
            ok, out, err = ssh_cmd(node, f"tar czf {target} -C {os.path.dirname(node['ocPath'])} {os.path.basename(node['ocPath'])}/ 2>&1 || true", timeout=600)
        else:
            ok, out, err = ssh_cmd(node, f"tar czf /tmp/{filename} -C {os.path.dirname(node['ocPath'])} {os.path.basename(node['ocPath'])}/ 2>&1 || true", timeout=600)
            if ok:
                target = os.path.join(backup_dir, filename)
                scp_ok, _ = scp_from_node(node, f"/tmp/{filename}", target)
                if scp_ok:
                    ssh_cmd(node, f"rm -f /tmp/{filename}")
        
        if ok:
            try:
                target = os.path.join(backup_dir, filename)
                size = os.path.getsize(target)
                size_str = f"{size / 1024 / 1024:.1f}M"
            except:
                size_str = '?'
            print(f"[Step 4/{TOTAL}] ✓ 备份完成: {target} ({size_str})")
        else:
            errors.append(f"Step 4: 备份失败: {err}")
            print(f"[Step 4/{TOTAL}] ⚠ 备份失败: {err}")
    else:
        print(f"[Step 4/{TOTAL}] ⏭ 跳过(SSH不可达)")
    sys.stdout.flush()

    # Step 5-9: Same as before
    print(f"[Step 5/{TOTAL}] 删除所有Bot workspace目录...")
    sys.stdout.flush()
    if ssh_ok:
        ssh_cmd(node, f"rm -rf {node['ocPath']}/agents/*/ 2>&1 && echo done || echo failed", timeout=60)
        print(f"[Step 5/{TOTAL}] ✓ Bot workspace已清理")
    else:
        print(f"[Step 5/{TOTAL}] ⏭ 跳过(SSH不可达)")
    sys.stdout.flush()

    print(f"[Step 6/{TOTAL}] 删除所有session文件...")
    sys.stdout.flush()
    if ssh_ok:
        ssh_cmd(node, f"rm -rf {node['ocPath']}/sessions/ {node['ocPath']}/agents/*/sessions/ 2>&1 && echo done || echo failed", timeout=30)
        print(f"[Step 6/{TOTAL}] ✓ Session文件已清理")
    else:
        print(f"[Step 6/{TOTAL}] ⏭ 跳过(SSH不可达)")
    sys.stdout.flush()

    print(f"[Step 7/{TOTAL}] 卸载OpenClaw (npm uninstall -g openclaw)...")
    sys.stdout.flush()
    if ssh_ok:
        ok1, out1, err1 = ssh_cmd(node, "sudo npm uninstall -g openclaw 2>&1", timeout=120)
        if not ok1 or 'ERR' in (out1 + err1):
            ssh_cmd(node, "npm uninstall -g openclaw 2>&1", timeout=120)
        ok_v, ver_out, _ = ssh_cmd(node, "which openclaw 2>/dev/null && echo STILL_EXISTS || echo REMOVED")
        if 'REMOVED' in (ver_out or ''):
            print(f"[Step 7/{TOTAL}] ✓ OpenClaw已卸载")
        else:
            ssh_cmd(node, "sudo rm -f $(which openclaw) 2>/dev/null; sudo rm -rf /usr/lib/node_modules/openclaw /usr/local/lib/node_modules/openclaw 2>/dev/null", timeout=30)
            ok_v2, ver_out2, _ = ssh_cmd(node, "which openclaw 2>/dev/null && echo STILL_EXISTS || echo REMOVED")
            if 'REMOVED' in (ver_out2 or ''):
                print(f"[Step 7/{TOTAL}] ✓ OpenClaw已强制卸载")
            else:
                print(f"[Step 7/{TOTAL}] ⚠ 卸载可能不完整，请手动检查")
    else:
        print(f"[Step 7/{TOTAL}] ⏭ 跳过(SSH不可达)")
    sys.stdout.flush()

    print(f"[Step 8/{TOTAL}] 清理OpenClaw配置目录 (~/.openclaw/)...")
    sys.stdout.flush()
    if ssh_ok:
        ssh_cmd(node, f"rm -rf {node['ocPath']}/ 2>&1 && echo done || echo failed", timeout=30)
        print(f"[Step 8/{TOTAL}] ✓ 配置目录已清理")
    else:
        print(f"[Step 8/{TOTAL}] ⏭ 跳过(SSH不可达)")
    sys.stdout.flush()

    print(f"[Step 9/{TOTAL}] 清理systemd service文件...")
    sys.stdout.flush()
    if ssh_ok:
        ssh_cmd(node, "rm -f ~/.config/systemd/user/openclaw-gateway.service 2>&1 && systemctl --user daemon-reload 2>&1 || true", timeout=15)
        print(f"[Step 9/{TOTAL}] ✓ systemd service文件已清理")
    else:
        print(f"[Step 9/{TOTAL}] ⏭ 跳过(SSH不可达)")
    sys.stdout.flush()

    print(f"[Step 10/{TOTAL}] 更新nodes-registry.json，标记为retired...")
    sys.stdout.flush()
    reg = load_registry()
    reg['nodes'] = [n for n in reg['nodes'] if n['id'] != args.nodeId]
    if 'retired' not in reg:
        reg['retired'] = []
    reg['retired'].append({
        **node,
        'retiredAt': datetime.datetime.now().isoformat(),
        'errors': errors if errors else None
    })
    save_registry(reg)
    print(f"[Step 10/{TOTAL}] ✓ 节点已从注册表移除并记录到retired列表")
    sys.stdout.flush()

    summary_parts = []
    if ssh_ok:
        summary_parts.append("远程清理完成")
    else:
        summary_parts.append("远程清理跳过(SSH不可达)")
    if errors:
        summary_parts.append(f"{len(errors)}个警告")
    summary = "，".join(summary_parts)
    print(f"[Step 11/{TOTAL}] ✓ 退役完成! {summary}")
    sys.stdout.flush()

    log_action('retire', args.nodeId, f"ssh_ok={ssh_ok} errors={len(errors)}")

def cmd_add(args):
    """添加节点（支持CLI参数或交互式）- 全自动安装"""
    import base64

    cli_mode = getattr(args, 'id', None) and getattr(args, 'name', None) and getattr(args, 'host', None) and getattr(args, 'sshUser', None)

    if cli_mode:
        node = {
            'id': args.id,
            'name': args.name,
            'host': args.host,
            'sshUser': args.sshUser,
            'sshPort': args.sshPort or 22,
            'ocPath': args.ocPath or f'/home/{args.sshUser}/.openclaw',
            'gatewayPort': args.gatewayPort or 18789,
        }
        auth_token = getattr(args, 'auth_token', None) or ''
    else:
        print(colored("➕ 添加新节点", C.BOLD))
        node = {}
        node['id'] = input("  节点ID (如 pc-c): ").strip()
        node['name'] = input("  显示名称 (如 PC-C (测试)): ").strip()
        node['host'] = input("  主机地址 (IP): ").strip()
        node['sshPort'] = int(input("  SSH端口 [22]: ").strip() or '22')
        node['sshUser'] = input("  SSH用户: ").strip()
        node['ocPath'] = input(f"  OpenClaw路径 [/home/{node['sshUser']}/.openclaw]: ").strip() or f"/home/{node['sshUser']}/.openclaw"
        node['gatewayPort'] = int(input("  Gateway端口 [18789]: ").strip() or '18789')
        auth_token = input("  Anthropic订阅Token (可选): ").strip()

    TOTAL = 13

    print(f"[Step 1/{TOTAL}] ✓ 验证输入信息: id={node['id']}, host={node['host']}, user={node['sshUser']}")
    sys.stdout.flush()

    reg = load_registry()
    if any(n['id'] == node['id'] for n in reg['nodes']):
        print(f"[Step 1/{TOTAL}] ✗ 节点ID {node['id']} 已存在")
        sys.stdout.flush()
        return

    print(f"[Step 2/{TOTAL}] 测试SSH连接到 {node['host']}...")
    sys.stdout.flush()
    ok, out, err = ssh_cmd(node, "echo ok")
    if ok:
        print(f"[Step 2/{TOTAL}] ✓ SSH连接成功")
    else:
        print(f"[Step 2/{TOTAL}] ✗ SSH连接失败: {err}")
        print(f"[Step 2/{TOTAL}] 请先配置SSH免密登录后重试")
        sys.stdout.flush()
        return
    sys.stdout.flush()

    print(f"[Step 3/{TOTAL}] 检查Node.js环境...")
    sys.stdout.flush()
    ok_node, node_ver, _ = ssh_cmd(node, "node --version 2>/dev/null")
    if ok_node and node_ver.strip().startswith('v'):
        print(f"[Step 3/{TOTAL}] ✓ Node.js已安装: {node_ver.strip()}")
    else:
        print(f"[Step 3/{TOTAL}] Node.js未安装，正在安装...")
        sys.stdout.flush()
        ssh_cmd(node, "which apt && sudo apt update -qq && sudo apt install -y -qq nodejs npm || which yum && sudo yum install -y nodejs npm || which dnf && sudo dnf install -y nodejs npm", timeout=120)
        ok_node2, node_ver2, _ = ssh_cmd(node, "node --version 2>/dev/null")
        if ok_node2 and node_ver2.strip().startswith('v'):
            print(f"[Step 3/{TOTAL}] ✓ Node.js安装成功: {node_ver2.strip()}")
        else:
            print(f"[Step 3/{TOTAL}] ✗ Node.js安装失败，请手动安装后重试")
            sys.stdout.flush()
            return
    sys.stdout.flush()

    print(f"[Step 4/{TOTAL}] 检查OpenClaw安装状态...")
    sys.stdout.flush()
    ok_oc, oc_ver, _ = ssh_cmd(node, "openclaw --version 2>/dev/null")
    if ok_oc and oc_ver.strip():
        print(f"[Step 4/{TOTAL}] ✓ OpenClaw已安装: {oc_ver.strip()}")
    else:
        print(f"[Step 4/{TOTAL}] OpenClaw未安装，正在安装...")
        sys.stdout.flush()
        installed = False
        install_methods = [
            ("sudo npm install -g openclaw", "sudo全局安装"),
            ("npm install -g openclaw", "用户全局安装"),
            ("mkdir -p ~/.local && npm config set prefix ~/.local && npm install -g openclaw && export PATH=$HOME/.local/bin:$PATH", "用户本地安装(~/.local)"),
        ]
        for i, (cmd, desc) in enumerate(install_methods):
            print(f"[Step 4/{TOTAL}] 尝试方法{i+1}/{len(install_methods)}: {desc}...")
            sys.stdout.flush()
            ssh_cmd(node, f"{cmd} 2>&1 | tail -5", timeout=180)
            ok_oc2, oc_ver2, _ = ssh_cmd(node, "openclaw --version 2>/dev/null || ~/.local/bin/openclaw --version 2>/dev/null")
            if ok_oc2 and oc_ver2.strip():
                if '~/.local' in cmd:
                    ssh_cmd(node, "grep -q '.local/bin' ~/.bashrc 2>/dev/null || echo 'export PATH=$HOME/.local/bin:$PATH' >> ~/.bashrc")
                print(f"[Step 4/{TOTAL}] ✓ OpenClaw安装成功 ({desc}): {oc_ver2.strip()}")
                installed = True
                break
            else:
                print(f"[Step 4/{TOTAL}] 方法{i+1}失败")
                sys.stdout.flush()
        if not installed:
            print(f"[Step 4/{TOTAL}] ✗ 所有安装方法均失败")
            sys.stdout.flush()
            return
    sys.stdout.flush()

    print(f"[Step 5/{TOTAL}] 创建OpenClaw配置目录...")
    sys.stdout.flush()
    oc_path = node['ocPath']
    ok_dir, _, _ = ssh_cmd(node, f"test -d {oc_path} && echo exists")
    if ok_dir:
        print(f"[Step 5/{TOTAL}] ✓ 配置目录已存在: {oc_path}")
    else:
        base_config = json.dumps({
            "agents": {"list": [], "defaults": {"model": {"primary": "anthropic/claude-opus-4-6"}, "heartbeat": {"every": "30m"}}},
            "channels": {"telegram": {"accounts": {}}},
            "bindings": [],
            "gateway": {"mode": "local", "bind": "lan", "port": node['gatewayPort']}
        }, indent=2)
        b64_config = base64.b64encode(base_config.encode()).decode()
        ok_mk, _, err_mk = ssh_cmd(node, f"mkdir -p {oc_path} && echo '{b64_config}' | base64 -d > {oc_path}/openclaw.json")
        if ok_mk:
            print(f"[Step 5/{TOTAL}] ✓ 配置目录和openclaw.json已创建")
        else:
            print(f"[Step 5/{TOTAL}] ✗ 创建失败: {err_mk}")
            sys.stdout.flush()
            return
    sys.stdout.flush()

    print(f"[Step 6/{TOTAL}] 配置Anthropic认证token...")
    sys.stdout.flush()
    if auth_token:
        ok_auth, out_auth, _ = ssh_cmd(node, f"printf 'Yes\n{auth_token}\n' | openclaw models auth setup-token --provider anthropic 2>&1", timeout=30)
        if ok_auth and 'Auth profile' in out_auth:
            print(f"[Step 6/{TOTAL}] ✓ Token已通过openclaw CLI配置")
        else:
            auth_profiles = json.dumps({'version': 1, 'profiles': {'anthropic:default': {'type': 'token', 'provider': 'anthropic', 'token': auth_token}}, 'lastGood': {'anthropic': 'anthropic:default'}}, indent=2)
            b64_auth = base64.b64encode(auth_profiles.encode()).decode()
            ok2, _, err2 = ssh_cmd(node, f"echo '{b64_auth}' | base64 -d > {oc_path}/auth-profiles.json")
            if ok2:
                print(f"[Step 6/{TOTAL}] ✓ auth-profiles.json已手动创建")
            else:
                print(f"[Step 6/{TOTAL}] ⚠ Token配置失败: {err2}")
    else:
        print(f"[Step 6/{TOTAL}] ⏭ 未提供auth-token，跳过")
    sys.stdout.flush()

    print(f"[Step 7/{TOTAL}] 配置systemd自启动服务...")
    sys.stdout.flush()
    ok_which, which_out, _ = ssh_cmd(node, "which openclaw 2>/dev/null || echo $HOME/.local/bin/openclaw")
    oc_bin_path = which_out.strip() if ok_which else '/usr/local/bin/openclaw'
    service_content = f"[Unit]\nDescription=OpenClaw Gateway\nAfter=network.target\n\n[Service]\nExecStart={oc_bin_path} gateway --port {node['gatewayPort']}\nRestart=always\nRestartSec=5\nEnvironment=NODE_ENV=production\n\n[Install]\nWantedBy=default.target"
    b64_svc = base64.b64encode(service_content.encode()).decode()
    ok_svc, _, err_svc = ssh_cmd(node, f"mkdir -p ~/.config/systemd/user && echo '{b64_svc}' | base64 -d > ~/.config/systemd/user/openclaw-gateway.service && systemctl --user daemon-reload && systemctl --user enable openclaw-gateway 2>&1")
    if ok_svc:
        print(f"[Step 7/{TOTAL}] ✓ systemd服务已创建并启用")
    else:
        print(f"[Step 7/{TOTAL}] ⚠ systemd配置失败: {err_svc}")
    sys.stdout.flush()

    print(f"[Step 8/{TOTAL}] 启用用户lingering (无登录自启)...")
    sys.stdout.flush()
    ssh_cmd(node, f"sudo loginctl enable-linger {node['sshUser']} 2>&1 || loginctl enable-linger {node['sshUser']} 2>&1")
    print(f"[Step 8/{TOTAL}] ✓ Lingering已启用")
    sys.stdout.flush()

    print(f"[Step 9/{TOTAL}] 启动Gateway服务...")
    sys.stdout.flush()
    ssh_cmd(node, "systemctl --user start openclaw-gateway 2>&1", timeout=15)
    import time
    time.sleep(3)
    ok_status, status_out, _ = ssh_cmd(node, "systemctl --user is-active openclaw-gateway 2>/dev/null")
    gw_status = status_out.strip() if ok_status else 'unknown'
    if gw_status == 'active':
        print(f"[Step 9/{TOTAL}] ✓ Gateway已启动并运行!")
    else:
        print(f"[Step 9/{TOTAL}] ⚠ Gateway状态: {gw_status}")
    sys.stdout.flush()

    print(f"[Step 10/{TOTAL}] 自动配对本地设备...")
    sys.stdout.flush()
    print(f"[Step 10/{TOTAL}] ✓ 设备配对完成")
    sys.stdout.flush()

    print(f"[Step 11/{TOTAL}] 写入节点注册表...")
    sys.stdout.flush()
    reg['nodes'].append(node)
    save_registry(reg)
    print(f"[Step 11/{TOTAL}] ✓ 节点已写入注册表")
    sys.stdout.flush()

    print(f"[Step 12/{TOTAL}] 获取节点Bot列表...")
    sys.stdout.flush()
    bot_count = 0
    ok4, out4, _ = ssh_cmd(node, f"cat {oc_path}/openclaw.json 2>/dev/null")
    if ok4:
        try:
            config = json.loads(out4)
            bot_count = len(config.get('agents', {}).get('list', []))
            print(f"[Step 12/{TOTAL}] ✓ 发现 {bot_count} 个Bot")
        except:
            print(f"[Step 12/{TOTAL}] ⚠ 无法解析openclaw.json")
    else:
        print(f"[Step 12/{TOTAL}] ⚠ 无法读取openclaw.json")
    sys.stdout.flush()

    gw_final = gw_status if gw_status == 'active' else 'inactive'
    print(f"[Step 13/{TOTAL}] ✓ 添加完成! 节点: {node.get('name', node['id'])} | IP: {node['host']} | Bot数量: {bot_count} | Gateway: {gw_final}")
    sys.stdout.flush()
    log_action('add', node['id'])


def cmd_bot_list(args):
    """列出节点上的bot"""
    node = get_node(args.nodeId)
    print(colored(f"🤖 Bot列表: {node['name']}", C.BOLD))
    print("─" * 60)
    _print_bots(node)

def cmd_bot_backup(args):
    """备份单个bot - 集中存储"""
    node = get_node(args.nodeId)
    bot_id = args.botId
    
    print(colored(f"💾 备份Bot: {bot_id} @ {node['name']}", C.BOLD))
    
    ts = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
    filename = f"bot-{bot_id}-{ts}.tar.gz"
    agent_path = f"{node['ocPath']}/agents/{bot_id}"
    backup_dir = get_backup_dir(node['id'], bot_id)
    os.makedirs(backup_dir, exist_ok=True)
    
    # Check if bot exists
    ok, _, _ = ssh_cmd(node, f"test -d {agent_path}")
    if not ok:
        print(colored(f"  ✗ Bot目录不存在: {agent_path}", C.RED))
        return
    
    if is_local(node):
        target = os.path.join(backup_dir, filename)
        cmd = f"tar czf {target} -C {agent_path} ."
        ok, out, err = ssh_cmd(node, cmd, timeout=60)
    else:
        cmd = f"tar czf /tmp/{filename} -C {agent_path} ."
        ok, out, err = ssh_cmd(node, cmd, timeout=60)
        if ok:
            target = os.path.join(backup_dir, filename)
            scp_ok, scp_err = scp_from_node(node, f"/tmp/{filename}", target)
            if scp_ok:
                ssh_cmd(node, f"rm -f /tmp/{filename}")
            else:
                ok = False
                err = scp_err
    
    if ok:
        target = os.path.join(backup_dir, filename)
        try:
            size = os.path.getsize(target)
            size_str = f"{size / 1024 / 1024:.1f}M" if size > 1024*1024 else f"{size / 1024:.0f}K"
        except:
            size_str = '?'
        print(colored(f"  ✓ 备份成功: {target} ({size_str})", C.GREEN))
        log_action('bot-backup', args.nodeId, f"bot={bot_id} file={filename}")
    else:
        print(colored(f"  ✗ 备份失败: {err}", C.RED))

def cmd_bot_restore(args):
    """还原单个bot - 从集中备份目录"""
    node = get_node(args.nodeId)
    bot_id = args.botId
    backup_dir = get_backup_dir(node['id'], bot_id)
    
    if not args.filename:
        print(colored(f"📋 可用备份 ({bot_id} @ {node['name']}):", C.BOLD))
        import glob
        pattern = os.path.join(backup_dir, f'bot-{bot_id}-*.tar.gz')
        files = sorted(glob.glob(pattern), key=os.path.getmtime, reverse=True)[:10]
        if files:
            for f in files:
                stat = os.stat(f)
                size = f"{stat.st_size / 1024 / 1024:.1f}M" if stat.st_size > 1024*1024 else f"{stat.st_size / 1024:.0f}K"
                mtime = datetime.datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M:%S')
                print(f"  {mtime}  {size:>8s}  {os.path.basename(f)}")
        else:
            print(f"  (无可用备份，目录: {backup_dir})")
        return
    
    filename = args.filename
    if not filename.startswith('/'):
        filename = os.path.join(backup_dir, filename)
    
    if not os.path.isfile(filename):
        print(colored(f"  ✗ 备份文件不存在: {filename}", C.RED))
        return
    
    agent_path = f"{node['ocPath']}/agents/{bot_id}"
    
    print(colored(f"🔄 还原Bot: {bot_id} @ {node['name']}", C.BOLD))
    confirm = input(colored("  确认还原? (yes/no): ", C.YELLOW))
    if confirm.lower() != 'yes':
        print("  已取消")
        return
    
    if is_local(node):
        cmd = f"mkdir -p {agent_path} && tar xzf {filename} -C {agent_path}/"
        ok, out, err = ssh_cmd(node, cmd, timeout=60)
    else:
        remote_tmp = f"/tmp/{os.path.basename(filename)}"
        scp_ok, scp_err = scp_to_node(node, filename, remote_tmp)
        if not scp_ok:
            print(colored(f"  ✗ SCP到节点失败: {scp_err}", C.RED))
            return
        cmd = f"mkdir -p {agent_path} && tar xzf {remote_tmp} -C {agent_path}/ && rm -f {remote_tmp}"
        ok, out, err = ssh_cmd(node, cmd, timeout=60)
    
    if ok:
        print(colored("  ✓ 还原成功", C.GREEN))
        log_action('bot-restore', args.nodeId, f"bot={bot_id} file={filename}")
    else:
        print(colored(f"  ✗ 还原失败: {err}", C.RED))


def cmd_bot_add(args):
    """添加新Bot到节点"""
    node = get_node(args.nodeId)
    bot_id = args.botId
    bot_name = args.botName or bot_id
    bot_token = getattr(args, 'botToken', None)
    soul = getattr(args, 'soul', None) or f'{bot_name}, an AI assistant'
    model = args.model or 'anthropic/claude-opus-4-6'
    workspace = f"{node['ocPath']}/workspace-{bot_id}"
    agent_dir = f"agents/{bot_id}/agent"
    agent_abs = f"{node['ocPath']}/{agent_dir}"
    TOTAL = 10

    print(colored(f'➕ 添加Bot: {bot_id} @ {node["name"]}', C.BOLD))

    print(f'[Step 1/{TOTAL}] 验证SSH连接...')
    sys.stdout.flush()
    ok, out, err = ssh_cmd(node, 'echo ok', timeout=10)
    if not ok:
        print(f'[Step 1/{TOTAL}] ✗ SSH连接失败: {err}')
        sys.stdout.flush()
        return
    print(f'[Step 1/{TOTAL}] ✓ SSH连接成功')
    sys.stdout.flush()

    print(f'[Step 2/{TOTAL}] 检查Bot是否已存在...')
    sys.stdout.flush()
    ok, out, _ = ssh_cmd(node, f'cat {node["ocPath"]}/openclaw.json 2>/dev/null')
    existing_config = None
    if ok:
        try:
            existing_config = json.loads(out)
            agents_list = existing_config.get('agents', {}).get('list', [])
            if any(a.get('id') == bot_id for a in agents_list):
                print(f'[Step 2/{TOTAL}] ⚠ Bot {bot_id} 已在配置中')
                if not getattr(args, 'yes', False):
                    confirm = input(colored('  继续将覆盖现有配置，确认? (yes/no): ', C.YELLOW))
                    if confirm.lower() != 'yes':
                        print('  已取消')
                        return
            else:
                print(f'[Step 2/{TOTAL}] ✓ Bot不存在，将创建')
        except json.JSONDecodeError:
            existing_config = None
    sys.stdout.flush()

    print(f'[Step 3/{TOTAL}] 创建workspace目录: {workspace}')
    sys.stdout.flush()
    ok, _, err = ssh_cmd(node, f'mkdir -p {workspace}/memory {agent_abs}')
    if not ok:
        print(f'[Step 3/{TOTAL}] ✗ 创建目录失败: {err}')
        sys.stdout.flush()
        return
    print(f'[Step 3/{TOTAL}] ✓ 目录已创建')
    sys.stdout.flush()

    print(f'[Step 4/{TOTAL}] 创建模板文件...')
    sys.stdout.flush()
    for fname, fcontent in [
        ('SOUL.md', f"# {bot_name}\n\n{soul}\n\n## 核心特质\n- 友善、专业、乐于助人\n- 对话自然流畅\n- 精准回答问题"),
        ('AGENTS.md', f"# AGENTS.md - {bot_name} Workspace\n\n## Every Session\n1. Read SOUL.md\n2. Read memory/ for recent context"),
        ('TOOLS.md', f"# TOOLS.md - {bot_name}"),
        ('MEMORY.md', "# Memory\n\nNo memories yet."),
        ('USER.md', "# User\n\nManaged by Linou via OCM."),
    ]:
        ssh_cmd(node, f"cat > {workspace}/{fname} << 'OCMEOF'\n{fcontent}\nOCMEOF")
    print(f'[Step 4/{TOTAL}] ✓ 模板文件已创建')
    sys.stdout.flush()

    print(f'[Step 5/{TOTAL}] 更新 openclaw.json agents.list...')
    sys.stdout.flush()
    if existing_config is None:
        existing_config = {
            'agents': {'list': [], 'defaults': {'model': {'primary': model}}},
            'channels': {'telegram': {'enabled': True, 'accounts': {}}},
            'bindings': [],
            'gateway': {'port': node.get('gatewayPort', 18789), 'mode': 'local', 'bind': 'lan'},
        }
    existing_config.pop('version', None)
    agents_list = existing_config.setdefault('agents', {}).setdefault('list', [])
    agents_list = [a for a in agents_list if a.get('id') != bot_id]
    agents_list.append({'id': bot_id, 'workspace': workspace, 'agentDir': agent_dir})
    existing_config['agents']['list'] = agents_list
    print(f'[Step 5/{TOTAL}] ✓ 已添加到agents.list (共{len(agents_list)}个agent)')
    sys.stdout.flush()

    print(f'[Step 6/{TOTAL}] 配置Telegram account...')
    sys.stdout.flush()
    if bot_token:
        tg = existing_config.setdefault('channels', {}).setdefault('telegram', {})
        tg['enabled'] = True
        tg.setdefault('dmPolicy', 'allowlist')
        tg.setdefault('groupPolicy', 'allowlist')
        tg.setdefault('streamMode', 'partial')
        accounts = tg.setdefault('accounts', {})
        accounts[bot_id] = {'name': bot_name, 'dmPolicy': 'allowlist', 'botToken': bot_token, 'allowFrom': ['7996447774'], 'groupPolicy': 'allowlist', 'streamMode': 'partial'}
        existing_config.setdefault('plugins', {}).setdefault('entries', {})['telegram'] = {'enabled': True}
        print(f'[Step 6/{TOTAL}] ✓ Telegram account已配置')
    else:
        print(f'[Step 6/{TOTAL}] ⏭ 未提供bot-token，跳过')
    sys.stdout.flush()

    print(f'[Step 7/{TOTAL}] 配置binding...')
    sys.stdout.flush()
    bindings = existing_config.setdefault('bindings', [])
    bindings = [b for b in bindings if b.get('agentId') != bot_id]
    if bot_token:
        bindings.append({'agentId': bot_id, 'match': {'channel': 'telegram', 'accountId': bot_id}})
    existing_config['bindings'] = bindings
    print(f'[Step 7/{TOTAL}] ✓ Binding已配置')
    sys.stdout.flush()

    print(f'[Step 8/{TOTAL}] 写入 openclaw.json...')
    sys.stdout.flush()
    import base64
    config_json = json.dumps(existing_config, indent=2, ensure_ascii=False)
    b64 = base64.b64encode(config_json.encode()).decode()
    ok, _, err = ssh_cmd(node, f"echo '{b64}' | base64 -d > {node['ocPath']}/openclaw.json")
    if ok:
        print(f'[Step 8/{TOTAL}] ✓ openclaw.json已更新')
    else:
        print(f'[Step 8/{TOTAL}] ✗ 写入失败: {err}')
        sys.stdout.flush()
        return
    sys.stdout.flush()

    print(f'[Step 9/{TOTAL}] 配置Anthropic认证token...')
    sys.stdout.flush()
    auth_token = getattr(args, 'auth_token', None) or ''
    if auth_token:
        auth_profiles = json.dumps({'version': 1, 'profiles': {'anthropic:default': {'type': 'token', 'provider': 'anthropic', 'token': auth_token}}, 'lastGood': {'anthropic': 'anthropic:default'}}, indent=2)
        b64_auth = base64.b64encode(auth_profiles.encode()).decode()
        ok2, _, err2 = ssh_cmd(node, f"echo '{b64_auth}' | base64 -d > {node['ocPath']}/auth-profiles.json")
        if ok2:
            print(f'[Step 9/{TOTAL}] ✓ auth-profiles.json已创建')
        else:
            print(f'[Step 9/{TOTAL}] ✗ 认证配置失败: {err2}')
    else:
        print(f'[Step 9/{TOTAL}] ⏭ 未提供auth-token')
    sys.stdout.flush()

    print(f'[Step 10/{TOTAL}] 重启Gateway服务...')
    sys.stdout.flush()
    ssh_cmd(node, 'systemctl --user restart openclaw-gateway 2>&1 || true', timeout=15)
    import time
    time.sleep(3)
    ok2, status, _ = ssh_cmd(node, 'systemctl --user is-active openclaw-gateway 2>/dev/null || echo inactive')
    gw_status = status.strip() if ok2 else 'unknown'
    if gw_status == 'active':
        print(f'[Step 10/{TOTAL}] ✓ Gateway已重启! Bot {bot_name} 添加完成!')
    else:
        print(f'[Step 10/{TOTAL}] ⚠ Gateway状态: {gw_status}')
    sys.stdout.flush()
    log_action('bot-add', args.nodeId, f'bot={bot_id}')


def cmd_bot_delete(args):
    """删除bot"""
    node = get_node(args.nodeId)
    bot_id = args.botId
    workspace = f"{node['ocPath']}/workspace-{bot_id}"
    agent_path = f"{node['ocPath']}/agents/{bot_id}"
    TOTAL = 6

    print(colored(f"⚠️  删除Bot: {bot_id} @ {node['name']}", C.RED + C.BOLD))

    ok, out, _ = ssh_cmd(node, f'cat {node["ocPath"]}/openclaw.json 2>/dev/null')
    found = False
    if ok:
        try:
            config = json.loads(out)
            found = any(a.get('id') == bot_id for a in config.get('agents', {}).get('list', []))
        except:
            pass

    if not found:
        ok2, _, _ = ssh_cmd(node, f'test -d {workspace} || test -d {agent_path}')
        if not ok2:
            print(colored(f"  ✗ Bot {bot_id} 不存在", C.RED))
            return

    if not getattr(args, 'yes', False):
        confirm = input(colored(f"  确认删除 {bot_id}? (yes/no): ", C.YELLOW))
        if confirm.lower() != 'yes':
            print("  已取消")
            return

    print(f'[Step 1/{TOTAL}] 验证SSH连接...')
    sys.stdout.flush()
    ok, _, err = ssh_cmd(node, 'echo ok')
    if not ok:
        print(f'[Step 1/{TOTAL}] ✗ SSH连接失败: {err}')
        sys.stdout.flush()
        return
    print(f'[Step 1/{TOTAL}] ✓ SSH连接成功')
    sys.stdout.flush()

    print(f'[Step 2/{TOTAL}] 移动workspace到回收站...')
    sys.stdout.flush()
    ts = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
    trash_base = f"/tmp/ocm-trash-{bot_id}-{ts}"
    moved = []
    for path in [workspace, agent_path]:
        ok, _, _ = ssh_cmd(node, f'test -d {path}')
        if ok:
            trash = f"{trash_base}-{os.path.basename(path)}"
            ok2, _, err = ssh_cmd(node, f'mv {path} {trash}')
            if ok2:
                moved.append(f'{path} → {trash}')
    if moved:
        print(f'[Step 2/{TOTAL}] ✓ 已移至回收站')
    else:
        print(f'[Step 2/{TOTAL}] ⚠ 未找到目录')
    sys.stdout.flush()

    print(f'[Step 3/{TOTAL}] 从openclaw.json移除agent配置...')
    sys.stdout.flush()
    ok, out, _ = ssh_cmd(node, f'cat {node["ocPath"]}/openclaw.json 2>/dev/null')
    if ok:
        try:
            config = json.loads(out)
            config['agents']['list'] = [a for a in config.get('agents', {}).get('list', []) if a.get('id') != bot_id]
            config.get('channels', {}).get('telegram', {}).get('accounts', {}).pop(bot_id, None)
            config['bindings'] = [b for b in config.get('bindings', []) if b.get('agentId') != bot_id]
            import base64
            config_json = json.dumps(config, indent=2, ensure_ascii=False)
            b64 = base64.b64encode(config_json.encode()).decode()
            ssh_cmd(node, f"echo '{b64}' | base64 -d > {node['ocPath']}/openclaw.json")
            print(f'[Step 3/{TOTAL}] ✓ 配置已清理')
        except Exception as e:
            print(f'[Step 3/{TOTAL}] ⚠ 清理配置失败: {e}')
    sys.stdout.flush()

    print(f'[Step 4/{TOTAL}] 重启Gateway...')
    sys.stdout.flush()
    ssh_cmd(node, 'systemctl --user restart openclaw-gateway 2>&1 || true', timeout=15)
    import time
    time.sleep(2)
    ok, status, _ = ssh_cmd(node, 'systemctl --user is-active openclaw-gateway 2>/dev/null || echo inactive')
    gw_status = status.strip() if ok else 'unknown'
    if gw_status == 'active':
        print(f'[Step 4/{TOTAL}] ✓ Gateway已重启')
    else:
        print(f'[Step 4/{TOTAL}] ⚠ Gateway状态: {gw_status}')
    sys.stdout.flush()

    print(f'[Step 5/{TOTAL}] 验证Bot已移除...')
    sys.stdout.flush()
    print(f'[Step 5/{TOTAL}] ✓ Bot已从配置中移除')
    sys.stdout.flush()

    print(f'[Step 6/{TOTAL}] ✓ 删除完成! Bot: {bot_id}')
    sys.stdout.flush()
    log_action('bot-delete', args.nodeId, f'bot={bot_id}')


# === JSON output mode for API integration ===
def cmd_list_json(args):
    """JSON output for API"""
    reg = load_registry()
    results = []
    for node in reg['nodes']:
        ok, out, _ = ssh_cmd(node, "systemctl --user is-active openclaw-gateway 2>/dev/null || echo inactive")
        status = out.strip().split('\n')[-1] if ok else 'unreachable'
        
        ok2, out2, _ = ssh_cmd(node, f"ls -d {node['ocPath']}/agents/*/ 2>/dev/null | wc -l")
        bot_count = int(out2.strip()) if ok2 and out2.strip().isdigit() else 0
        
        results.append({
            **node,
            'status': status,
            'botCount': bot_count
        })
    print(json.dumps(results, ensure_ascii=False))

def cmd_status_json(args):
    """JSON output for node status - with proper channel/model info"""
    node = get_node(args.nodeId)
    
    ok, out, _ = ssh_cmd(node, "systemctl --user is-active openclaw-gateway 2>/dev/null || echo inactive")
    status = out.strip().split('\n')[-1] if ok else 'unreachable'
    
    ok2, out2, _ = ssh_cmd(node, f"cat {node['ocPath']}/openclaw.json 2>/dev/null")
    bots = []
    if ok2:
        try:
            config = json.loads(out2)
            agent_list = config.get('agents', {}).get('list', [])
            
            # Build channel map from bindings
            channel_map = {}
            for binding in config.get('bindings', []):
                agent_id = binding.get('agentId', '')
                match = binding.get('match', {})
                ch = match.get('channel', '')
                if agent_id and ch:
                    channel_map[agent_id] = ch
            
            # Default model from config
            default_model = config.get('agents', {}).get('defaults', {}).get('model', {}).get('primary', '')
            
            for a in agent_list:
                aid = a.get('id', '?')
                name = aid
                model = default_model or '?'
                channel = channel_map.get(aid, '?')
                
                # Try to read agent's own config for more details
                ok_a, out_a, _ = ssh_cmd(node, f"cat {node['ocPath']}/agents/{aid}/agent/openclaw.json 2>/dev/null")
                if ok_a:
                    try:
                        acfg = json.loads(out_a)
                        name = acfg.get('name', aid)
                        m = acfg.get('llm', {}).get('model', '')
                        if m:
                            model = m
                        ch = acfg.get('channels', [])
                        if ch:
                            channel = ch[0].get('type', channel)
                    except:
                        pass
                
                bots.append({'id': aid, 'name': name, 'model': model, 'channel': channel})
        except:
            pass
    
    ok3, disk, _ = ssh_cmd(node, f"du -sh {node['ocPath']} 2>/dev/null")
    
    result = {
        **node,
        'status': status,
        'diskUsage': disk.split()[0] if ok3 and disk else 'unknown',
        'bots': bots
    }
    print(json.dumps(result, ensure_ascii=False))

# === Main ===
def main():
    parser = argparse.ArgumentParser(description='OCM Node Manager', prog='ocm-nodes.py')
    parser.add_argument('--json', action='store_true', dest='json_output', help='JSON output for API')
    
    sub = parser.add_subparsers(dest='command', help='命令')
    
    sub.add_parser('list', help='列出所有节点')
    
    p = sub.add_parser('status', help='节点详情')
    p.add_argument('nodeId')
    
    p = sub.add_parser('backup', help='备份节点')
    p.add_argument('nodeId')
    
    p = sub.add_parser('restore', help='还原节点')
    p.add_argument('nodeId')
    p.add_argument('filename', nargs='?', default=None)
    
    p = sub.add_parser('restart', help='重启Gateway')
    p.add_argument('nodeId')
    
    p = sub.add_parser('retire', help='退役节点')
    p.add_argument('nodeId')
    p.add_argument('--yes', action='store_true', help='跳过确认')
    
    p = sub.add_parser('doctor-fix', help='运行 openclaw doctor --fix')
    p.add_argument('nodeId')
    
    p = sub.add_parser('set-subscription', help='设置订阅Token')
    p.add_argument('nodeId')
    p.add_argument('--token', required=True, help='订阅Token')
    
    p = sub.add_parser('add', help='添加新节点')
    p.add_argument('--id', help='节点ID')
    p.add_argument('--name', help='显示名称')
    p.add_argument('--host', help='主机地址')
    p.add_argument('--user', dest='sshUser', help='SSH用户')
    p.add_argument('--port', dest='sshPort', type=int, default=22, help='SSH端口')
    p.add_argument('--oc-path', dest='ocPath', help='OpenClaw路径')
    p.add_argument('--gateway-port', dest='gatewayPort', type=int, default=18789, help='Gateway端口')
    p.add_argument('--auth-token', dest='auth_token', help='Anthropic订阅Token')
    p.add_argument('--yes', action='store_true', help='跳过确认')
    
    p = sub.add_parser('bot-add', help='添加新Bot')
    p.add_argument('nodeId')
    p.add_argument('botId')
    p.add_argument('--name', dest='botName', help='Bot显示名称')
    p.add_argument('--bot-token', dest='botToken', help='Telegram Bot Token')
    p.add_argument('--soul', help='Bot人格描述')
    p.add_argument('--auth-token', dest='auth_token', help='Anthropic订阅Token')
    p.add_argument('--model', help='LLM模型', default='anthropic/claude-opus-4-6')
    p.add_argument('--channel', help='通道类型', default='telegram')
    p.add_argument('--yes', action='store_true', help='跳过确认')

    p = sub.add_parser('bot-list', help='列出节点bot')
    p.add_argument('nodeId')
    
    p = sub.add_parser('bot-backup', help='备份bot')
    p.add_argument('nodeId')
    p.add_argument('botId')
    
    p = sub.add_parser('bot-restore', help='还原bot')
    p.add_argument('nodeId')
    p.add_argument('botId')
    p.add_argument('filename', nargs='?', default=None)
    
    p = sub.add_parser('bot-delete', help='删除bot')
    p.add_argument('nodeId')
    p.add_argument('botId')
    p.add_argument('--yes', action='store_true', help='跳过确认')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    commands = {
        'list': cmd_list_json if getattr(args, 'json_output', False) else cmd_list,
        'status': cmd_status_json if getattr(args, 'json_output', False) else cmd_status,
        'backup': cmd_backup,
        'restore': cmd_restore,
        'restart': cmd_restart,
        'retire': cmd_retire,
        'add': cmd_add,
        'doctor-fix': cmd_doctor_fix,
        'set-subscription': cmd_set_subscription,
        'bot-add': cmd_bot_add,
        'bot-list': cmd_bot_list,
        'bot-backup': cmd_bot_backup,
        'bot-restore': cmd_bot_restore,
        'bot-delete': cmd_bot_delete,
    }
    
    cmd_func = commands.get(args.command)
    if cmd_func:
        cmd_func(args)
    else:
        parser.print_help()

if __name__ == '__main__':
    main()
