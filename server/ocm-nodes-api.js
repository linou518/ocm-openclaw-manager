/**
 * OCM Nodes CLI API Routes
 * Integrates ocm-nodes.py CLI tool with Express server
 */

const express = require('express');
const { exec, spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ocmNodesRouter = express.Router();
const OCM_NODES_PY = path.join(__dirname, 'ocm-nodes.py');
const BACKUP_BASE = '/home/linou/shared/00_Node_Backup';

// Load registry to get node info
function getNodeFromRegistry(nodeId) {
  const regPaths = [
    path.join(__dirname, 'nodes-registry.json'),
    path.join(process.cwd(), 'nodes-registry.json'),
  ];
  for (const p of regPaths) {
    if (fs.existsSync(p)) {
      const reg = JSON.parse(fs.readFileSync(p, 'utf8'));
      return reg.nodes.find(n => n.id === nodeId);
    }
  }
  return null;
}

function runOcmNodes(command, timeout = 180000) {
  return new Promise((resolve, reject) => {
    exec(`python3 ${OCM_NODES_PY} --json ${command}`, { timeout, env: { ...process.env, HOME: process.env.HOME || '/home/linou' } }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || stdout || error.message));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        resolve({ raw: stdout });
      }
    });
  });
}

function runOcmNodesRaw(command, timeout = 180000) {
  return new Promise((resolve, reject) => {
    exec(`python3 ${OCM_NODES_PY} ${command}`, { timeout, env: { ...process.env, HOME: process.env.HOME || '/home/linou' } }, (error, stdout, stderr) => {
      if (error && !stdout) {
        reject(new Error(stderr || error.message));
        return;
      }
      resolve(stdout || stderr);
    });
  });
}

function sendStep(res, step, total, message, status, extra = {}) {
  const data = JSON.stringify({ step, total, message, status, ...extra });
  res.write(`data: ${data}\n\n`);
}

function setupSSE(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
}

// Stream CLI output as SSE steps
function streamCLI(res, args, total, timeout = 300000) {
  const child = spawn('python3', [OCM_NODES_PY, ...args], {
    env: { ...process.env, HOME: process.env.HOME || '/home/linou', PYTHONUNBUFFERED: '1' },
    timeout,
  });

  let buffer = '';
  child.stdout.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      const m = line.match(/\[Step (\d+)\/(\d+)\]\s*(.*)/);
      if (m) {
        const step = parseInt(m[1]);
        const t = parseInt(m[2]);
        const msg = m[3];
        const status = msg.includes('✗') ? 'error' : msg.includes('⏭') ? 'skipped' : 'done';
        sendStep(res, step, t, msg, status);
      }
    }
  });

  child.stderr.on('data', () => {});

  child.on('close', () => {
    if (buffer.trim()) {
      const m = buffer.match(/\[Step (\d+)\/(\d+)\]\s*(.*)/);
      if (m) {
        sendStep(res, parseInt(m[1]), parseInt(m[2]), m[3], 'done');
      }
    }
    res.end();
  });

  child.on('error', (err) => {
    sendStep(res, 1, total, `执行失败: ${err.message}`, 'error');
    res.end();
  });
}

// GET /api/ocm/nodes
ocmNodesRouter.get('/api/ocm/nodes', async (req, res) => {
  try {
    const nodes = await runOcmNodes('list');
    res.json({ success: true, nodes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/ocm/nodes/:id
ocmNodesRouter.get('/api/ocm/nodes/:id', async (req, res) => {
  try {
    const detail = await runOcmNodes(`status ${req.params.id}`);
    res.json({ success: true, node: detail });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/ocm/nodes/:id/backup (SSE)
ocmNodesRouter.post('/api/ocm/nodes/:id/backup', async (req, res) => {
  const nodeId = req.params.id;
  const useSSE = req.headers.accept === 'text/event-stream';

  if (!useSSE) {
    try {
      const output = await runOcmNodesRaw(`backup ${nodeId}`);
      return res.json({ success: true, output });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  setupSSE(res);
  sendStep(res, 1, 3, `连接到节点 ${nodeId}...`, 'running');

  try {
    await new Promise(r => setTimeout(r, 500));
    sendStep(res, 1, 3, `连接到节点 ${nodeId}...`, 'done');
    sendStep(res, 2, 3, `打包 ~/.openclaw/ 目录...`, 'running');

    const output = await runOcmNodesRaw(`backup ${nodeId}`);

    const fileMatch = output.match(/备份成功:\s*(\S+)/);
    const sizeMatch = output.match(/\(([^)]+)\)/);
    const filename = fileMatch ? fileMatch[1] : '';
    const size = sizeMatch ? sizeMatch[1] : '';

    sendStep(res, 2, 3, `打包 ~/.openclaw/ 目录...`, 'done');
    sendStep(res, 3, 3, `备份完成!${filename ? ' 文件: ' + path.basename(filename) : ''}${size ? ', 大小: ' + size : ''}`, 'done', { result: { output } });
  } catch (error) {
    sendStep(res, 2, 3, `备份失败: ${error.message}`, 'error');
  }
  res.end();
});

// POST /api/ocm/nodes/:id/restart (SSE)
ocmNodesRouter.post('/api/ocm/nodes/:id/restart', async (req, res) => {
  const nodeId = req.params.id;
  const useSSE = req.headers.accept === 'text/event-stream';

  if (!useSSE) {
    try {
      const output = await runOcmNodesRaw(`restart ${nodeId}`);
      return res.json({ success: true, output });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  setupSSE(res);
  sendStep(res, 1, 4, `连接到节点 ${nodeId}...`, 'running');
  await new Promise(r => setTimeout(r, 500));
  sendStep(res, 1, 4, `连接到节点 ${nodeId}...`, 'done');
  sendStep(res, 2, 4, `执行 systemctl --user restart openclaw-gateway...`, 'running');

  try {
    const output = await runOcmNodesRaw(`restart ${nodeId}`);
    sendStep(res, 2, 4, `执行重启命令...`, 'done');
    sendStep(res, 3, 4, `等待 Gateway 启动...`, 'running');
    await new Promise(r => setTimeout(r, 1000));
    sendStep(res, 3, 4, `等待 Gateway 启动...`, 'done');

    const isOk = output.includes('恢复运行') || output.includes('已发送');
    sendStep(res, 4, 4, isOk ? '重启完成! Gateway 运行正常' : `重启完成 (请检查状态)`, 'done', { result: { output } });
  } catch (error) {
    sendStep(res, 2, 4, `重启失败: ${error.message}`, 'error');
  }
  res.end();
});

// GET /api/ocm/nodes/:id/backups - list available backups (from local backup dir)
ocmNodesRouter.get('/api/ocm/nodes/:id/backups', async (req, res) => {
  try {
    const output = await runOcmNodesRaw(`restore ${req.params.id}`);
    res.json({ success: true, output });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/ocm/nodes/:id/backup-list - detailed backup list with sizes/dates
ocmNodesRouter.get('/api/ocm/nodes/:id/backup-list', async (req, res) => {
  try {
    const nodeId = req.params.id;
    const backupDir = path.join(BACKUP_BASE, nodeId);
    const files = [];

    const walkDir = (dir, prefix = '') => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walkDir(fullPath, entry.name);
        } else if (entry.name.endsWith('.tar.gz')) {
          const stat = fs.statSync(fullPath);
          files.push({
            name: entry.name,
            path: prefix ? `${prefix}/${entry.name}` : entry.name,
            size: stat.size,
            sizeStr: stat.size > 1024*1024 ? `${(stat.size / 1024 / 1024).toFixed(1)}M` : `${Math.round(stat.size / 1024)}K`,
            mtime: stat.mtime.toISOString(),
            type: prefix ? 'bot' : 'node',
            botId: prefix || null,
          });
        }
      }
    };

    walkDir(backupDir);
    files.sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
    res.json({ success: true, files, backupDir });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/ocm/nodes/:id/restore (SSE)
ocmNodesRouter.post('/api/ocm/nodes/:id/restore', async (req, res) => {
  const nodeId = req.params.id;
  const useSSE = req.headers.accept === 'text/event-stream';
  const { filename } = req.body || {};

  if (!useSSE) {
    try {
      if (!filename) return res.status(400).json({ success: false, error: 'filename required' });
      const safeFilename = filename.replace(/[^a-zA-Z0-9._\/-]/g, '');
      const output = await new Promise((resolve, reject) => {
        exec(`echo "yes" | python3 ${OCM_NODES_PY} restore ${nodeId} ${safeFilename}`,
          { timeout: 300000 }, (error, stdout, stderr) => {
            if (error && !stdout) return reject(new Error(stderr || error.message));
            resolve(stdout || stderr);
          });
      });
      return res.json({ success: true, output });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  if (!filename) {
    setupSSE(res);
    sendStep(res, 1, 1, 'filename required', 'error');
    return res.end();
  }

  const safeFilename = filename.replace(/[^a-zA-Z0-9._\/-]/g, '');
  setupSSE(res);
  sendStep(res, 1, 4, `连接到节点 ${nodeId}...`, 'running');
  await new Promise(r => setTimeout(r, 500));
  sendStep(res, 1, 4, `连接到节点 ${nodeId}...`, 'done');
  sendStep(res, 2, 4, `解压备份文件 ${safeFilename}...`, 'running');

  try {
    const output = await new Promise((resolve, reject) => {
      exec(`echo "yes" | python3 ${OCM_NODES_PY} restore ${nodeId} ${safeFilename}`,
        { timeout: 300000 }, (error, stdout, stderr) => {
          if (error && !stdout) return reject(new Error(stderr || error.message));
          resolve(stdout || stderr);
        });
    });
    sendStep(res, 2, 4, `解压备份文件...`, 'done');
    sendStep(res, 3, 4, `重启 Gateway...`, 'running');
    await new Promise(r => setTimeout(r, 3000));
    sendStep(res, 3, 4, `重启 Gateway...`, 'done');
    sendStep(res, 4, 4, `还原完成!`, 'done', { result: { output } });
  } catch (error) {
    sendStep(res, 2, 4, `还原失败: ${error.message}`, 'error');
  }
  res.end();
});

// POST /api/ocm/nodes/:id/retire (SSE - streams CLI output)
ocmNodesRouter.post('/api/ocm/nodes/:id/retire', async (req, res) => {
  const nodeId = req.params.id;
  const useSSE = req.headers.accept === 'text/event-stream';

  if (!useSSE) {
    try {
      const output = await runOcmNodesRaw(`retire ${nodeId} --yes`);
      return res.json({ success: true, output });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  setupSSE(res);
  streamCLI(res, ['retire', nodeId, '--yes'], 11);
});

// POST /api/ocm/nodes/:id/doctor (SSE - runs openclaw doctor --fix)
ocmNodesRouter.post('/api/ocm/nodes/:id/doctor', async (req, res) => {
  const nodeId = req.params.id;
  const useSSE = req.headers.accept === 'text/event-stream';

  if (!useSSE) {
    try {
      const output = await runOcmNodesRaw(`doctor-fix ${nodeId}`);
      return res.json({ success: true, output });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  setupSSE(res);
  streamCLI(res, ['doctor-fix', nodeId], 3, 180000);
});

// POST /api/ocm/nodes/:id/subscription (SSE - set subscription token)
ocmNodesRouter.post('/api/ocm/nodes/:id/subscription', async (req, res) => {
  const nodeId = req.params.id;
  const { token } = req.body || {};
  const useSSE = req.headers.accept === 'text/event-stream';

  if (!token) {
    if (useSSE) {
      setupSSE(res);
      sendStep(res, 1, 1, '缺少token参数', 'error');
      return res.end();
    }
    return res.status(400).json({ success: false, error: 'token required' });
  }

  if (!useSSE) {
    try {
      const output = await runOcmNodesRaw(`set-subscription ${nodeId} --token "${token}"`);
      return res.json({ success: true, output });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  setupSSE(res);
  streamCLI(res, ['set-subscription', nodeId, '--token', token], 4, 60000);
});

// GET /api/ocm/nodes/:id/logs - get gateway logs
ocmNodesRouter.get('/api/ocm/nodes/:id/logs', async (req, res) => {
  try {
    const nodeId = req.params.id;
    const lines = parseInt(req.query.lines) || 100;
    const node = getNodeFromRegistry(nodeId);
    if (!node) return res.status(404).json({ success: false, error: 'Node not found' });

    const sshHost = `${node.sshUser}@${node.host}`;
    const sshPort = node.sshPort || 22;
    const cmd = `journalctl --user -u openclaw-gateway --no-pager -n ${lines} 2>&1`;

    // Check if local
    let output;
    try {
      const hostname = execSync('hostname -I', { timeout: 5000 }).toString().trim();
      const localIps = new Set(hostname.split(/\s+/).concat(['127.0.0.1']));
      if (localIps.has(node.host)) {
        output = execSync(cmd, { timeout: 30000 }).toString();
      } else {
        output = execSync(`ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no -p ${sshPort} ${sshHost} "${cmd}"`, { timeout: 30000 }).toString();
      }
    } catch (e) {
      output = e.stdout ? e.stdout.toString() : e.message;
    }

    res.json({ success: true, logs: output, lines });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


// POST /api/ocm/nodes/add (SSE)
ocmNodesRouter.post('/api/ocm/nodes/add', async (req, res) => {
  const { id, name, host, sshUser, sshPort, ocPath, gatewayPort, authToken } = req.body || {};
  const useSSE = req.headers.accept === 'text/event-stream';

  if (!id || !name || !host || !sshUser) {
    if (useSSE) {
      setupSSE(res);
      sendStep(res, 1, 1, '缺少必填字段: id, name, host, sshUser', 'error');
      return res.end();
    }
    return res.status(400).json({ success: false, error: 'id, name, host, sshUser required' });
  }

  if (!useSSE) {
    try {
      const args = ['add', '--id', id, '--name', name, '--host', host, '--user', sshUser, '--yes'];
      if (sshPort) args.push('--port', String(sshPort));
      if (ocPath) args.push('--oc-path', ocPath);
      if (gatewayPort) args.push('--gateway-port', String(gatewayPort));
      if (authToken) args.push('--auth-token', authToken);
      const output = await runOcmNodesRaw(args.join(' '));
      return res.json({ success: true, output });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  setupSSE(res);

  const cliArgs = ['add', '--id', id, '--name', name, '--host', host, '--user', sshUser, '--yes'];
  if (sshPort) cliArgs.push('--port', String(sshPort));
  if (ocPath) cliArgs.push('--oc-path', ocPath);
  if (gatewayPort) cliArgs.push('--gateway-port', String(gatewayPort));
  if (authToken) cliArgs.push('--auth-token', authToken);

  streamCLI(res, cliArgs, 13, 600000);
});

// POST /api/ocm/nodes/:id/bots/add (SSE)
ocmNodesRouter.post('/api/ocm/nodes/:id/bots/add', async (req, res) => {
  const nodeId = req.params.id;
  const { botId, botName, botToken, soul, model, channel, authToken } = req.body || {};
  const useSSE = req.headers.accept === 'text/event-stream';

  if (!botId) {
    if (useSSE) {
      setupSSE(res);
      sendStep(res, 1, 1, '缺少必填字段: botId', 'error');
      return res.end();
    }
    return res.status(400).json({ success: false, error: 'botId required' });
  }

  const cliArgs = ['bot-add', nodeId, botId, '--yes'];
  if (botName) cliArgs.push('--name', botName);
  if (model) cliArgs.push('--model', model);
  if (channel) cliArgs.push('--channel', channel);
  if (botToken) cliArgs.push('--bot-token', botToken);
  if (soul) cliArgs.push('--soul', soul);
  if (authToken) cliArgs.push('--auth-token', authToken);

  if (!useSSE) {
    try {
      const output = await new Promise((resolve, reject) => {
        const ch = spawn('python3', [OCM_NODES_PY, ...cliArgs], { timeout: 120000, env: { ...process.env, HOME: process.env.HOME || '/home/linou', PYTHONUNBUFFERED: '1' } });
        let out = ''; ch.stdout.on('data', d => out += d); ch.stderr.on('data', d => out += d);
        ch.on('close', () => resolve(out)); ch.on('error', reject);
      });
      return res.json({ success: true, output });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  setupSSE(res);
  streamCLI(res, cliArgs, 10, 120000);
});


// POST /api/ocm/nodes/:id/bots/:botId/backup (SSE)
ocmNodesRouter.post('/api/ocm/nodes/:id/bots/:botId/backup', async (req, res) => {
  const { id: nodeId, botId } = req.params;
  const useSSE = req.headers.accept === 'text/event-stream';

  if (!useSSE) {
    try {
      const output = await runOcmNodesRaw(`bot-backup ${nodeId} ${botId}`);
      return res.json({ success: true, output });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  setupSSE(res);
  sendStep(res, 1, 3, `连接到节点 ${nodeId}...`, 'running');
  await new Promise(r => setTimeout(r, 500));
  sendStep(res, 1, 3, `连接到节点 ${nodeId}...`, 'done');
  sendStep(res, 2, 3, `打包 Bot ${botId} 工作目录...`, 'running');

  try {
    const output = await runOcmNodesRaw(`bot-backup ${nodeId} ${botId}`);
    sendStep(res, 2, 3, `打包 Bot ${botId} 工作目录...`, 'done');
    sendStep(res, 3, 3, `备份完成!`, 'done', { result: { output } });
  } catch (error) {
    sendStep(res, 2, 3, `备份失败: ${error.message}`, 'error');
  }
  res.end();
});

// GET /api/ocm/nodes/:id/bots/:botId/backups
ocmNodesRouter.get('/api/ocm/nodes/:id/bots/:botId/backups', async (req, res) => {
  try {
    const output = await runOcmNodesRaw(`bot-restore ${req.params.id} ${req.params.botId}`);
    res.json({ success: true, output });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/ocm/nodes/:id/bots/:botId/restore (SSE)
ocmNodesRouter.post('/api/ocm/nodes/:id/bots/:botId/restore', async (req, res) => {
  const { id: nodeId, botId } = req.params;
  const useSSE = req.headers.accept === 'text/event-stream';
  const { filename } = req.body || {};

  if (!useSSE) {
    try {
      if (!filename) return res.status(400).json({ success: false, error: 'filename required' });
      const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '');
      const output = await new Promise((resolve, reject) => {
        exec(`echo "yes" | python3 ${OCM_NODES_PY} bot-restore ${nodeId} ${botId} ${safeFilename}`,
          { timeout: 120000 }, (error, stdout, stderr) => {
            if (error && !stdout) return reject(new Error(stderr || error.message));
            resolve(stdout || stderr);
          });
      });
      return res.json({ success: true, output });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  if (!filename) {
    setupSSE(res);
    sendStep(res, 1, 1, 'filename required', 'error');
    return res.end();
  }

  const safeFilename = filename.replace(/[^a-zA-Z0-9._\/-]/g, '');
  setupSSE(res);
  sendStep(res, 1, 4, `连接到节点 ${nodeId}...`, 'running');
  await new Promise(r => setTimeout(r, 500));
  sendStep(res, 1, 4, `连接到节点 ${nodeId}...`, 'done');
  sendStep(res, 2, 4, `解压备份文件到 Bot ${botId} 目录...`, 'running');

  try {
    const output = await new Promise((resolve, reject) => {
      exec(`echo "yes" | python3 ${OCM_NODES_PY} bot-restore ${nodeId} ${botId} ${safeFilename}`,
        { timeout: 120000 }, (error, stdout, stderr) => {
          if (error && !stdout) return reject(new Error(stderr || error.message));
          resolve(stdout || stderr);
        });
    });
    sendStep(res, 2, 4, `解压备份文件...`, 'done');
    sendStep(res, 3, 4, `重启 Gateway...`, 'running');
    await new Promise(r => setTimeout(r, 1000));
    sendStep(res, 3, 4, `重启 Gateway...`, 'done');
    sendStep(res, 4, 4, `还原完成!`, 'done', { result: { output } });
  } catch (error) {
    sendStep(res, 2, 4, `还原失败: ${error.message}`, 'error');
  }
  res.end();
});

// POST /api/ocm/nodes/:id/bots/:botId/delete (SSE)
ocmNodesRouter.post('/api/ocm/nodes/:id/bots/:botId/delete', async (req, res) => {
  const { id: nodeId, botId } = req.params;
  const useSSE = req.headers.accept === 'text/event-stream';

  if (!useSSE) {
    try {
      const output = await runOcmNodesRaw(`bot-delete ${nodeId} ${botId} --yes`);
      return res.json({ success: true, output });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  setupSSE(res);
  streamCLI(res, ['bot-delete', nodeId, botId, '--yes'], 6, 60000);
});


// GET /api/ocm/nodes/:id/logs/stream - SSE real-time log streaming (tail -f)
ocmNodesRouter.get('/api/ocm/nodes/:id/logs/stream', async (req, res) => {
  const nodeId = req.params.id;
  const node = getNodeFromRegistry(nodeId);
  if (!node) return res.status(404).json({ success: false, error: 'Node not found' });

  setupSSE(res);

  const sshHost = `${node.sshUser}@${node.host}`;
  const sshPort = node.sshPort || 22;
  const tailCmd = 'journalctl --user -u openclaw-gateway --no-pager -f 2>&1';

  // Check if local
  let child;
  try {
    const hostname = execSync('hostname -I', { timeout: 5000 }).toString().trim();
    const localIps = new Set(hostname.split(/\s+/).concat(['127.0.0.1']));
    if (localIps.has(node.host)) {
      child = spawn('bash', ['-c', tailCmd]);
    } else {
      child = spawn('ssh', ['-o', 'ConnectTimeout=5', '-o', 'StrictHostKeyChecking=no', '-p', String(sshPort), sshHost, tailCmd]);
    }
  } catch (e) {
    res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
    return res.end();
  }

  let buffer = '';
  child.stdout.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (line.trim()) {
        res.write(`data: ${JSON.stringify({ line })}\n\n`);
      }
    }
  });

  child.stderr.on('data', (chunk) => {
    const msg = chunk.toString().trim();
    if (msg) res.write(`data: ${JSON.stringify({ line: '[stderr] ' + msg })}\n\n`);
  });

  child.on('close', () => {
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  });

  child.on('error', (err) => {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  });

  // Kill child when client disconnects
  req.on('close', () => {
    child.kill('SIGTERM');
  });

  // Timeout after 5 minutes
  setTimeout(() => {
    child.kill('SIGTERM');
  }, 300000);
});

module.exports = ocmNodesRouter;
