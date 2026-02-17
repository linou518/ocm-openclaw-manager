import React, { useState, useEffect, useCallback, useRef } from 'react';

const API = '/api/ocm';

// ── Operation Log Panel ─────────────────────────────────────────
function OperationLog({ title, steps, onClose }) {
  const logRef = useRef(null);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [steps]);

  if (!steps || steps.length === 0) return null;

  const icon = (s) => s.status === 'done' ? '✅' : s.status === 'running' ? '⏳' : s.status === 'skipped' ? '⏭' : '❌';

  return (
    <div className="bg-gray-950 border border-gray-700 rounded-lg mb-4 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-900 border-b border-gray-700">
        <span className="text-sm font-semibold text-gray-200">📋 {title}</span>
        <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none">✕</button>
      </div>
      <div ref={logRef} className="p-4 max-h-60 overflow-auto font-mono text-sm space-y-1.5">
        {steps.map((s, i) => (
          <div key={i} className={`flex items-start gap-2 ${s.status === 'error' ? 'text-red-400' : s.status === 'running' ? 'text-yellow-300' : 'text-green-400'}`}>
            <span className="shrink-0">[Step {s.step}/{s.total}]</span>
            <span className="shrink-0">{icon(s)}</span>
            <span className="text-gray-300">{s.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SSE Action helper ───────────────────────────────────────────
function useSSEAction() {
  const [opLog, setOpLog] = useState({ title: '', steps: [], visible: false });

  const doSSEAction = useCallback((url, method, body, title, onDone) => {
    setOpLog({ title, steps: [], visible: true });

    const opts = {
      method: method || 'POST',
      headers: { 'Accept': 'text/event-stream', 'Content-Type': 'application/json' },
    };
    if (body) opts.body = JSON.stringify(body);

    fetch(url, opts).then(async (response) => {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              setOpLog(prev => {
                const steps = [...prev.steps];
                const idx = steps.findIndex(s => s.step === data.step && s.total === data.total);
                if (idx >= 0) steps[idx] = data;
                else steps.push(data);
                return { ...prev, steps };
              });
            } catch (e) { }
          }
        }
      }

      if (onDone) onDone();
    }).catch((err) => {
      setOpLog(prev => ({
        ...prev,
        steps: [...prev.steps, { step: '?', total: '?', message: `请求失败: ${err.message}`, status: 'error' }]
      }));
    });
  }, []);

  const closeLog = useCallback(() => setOpLog(prev => ({ ...prev, visible: false })), []);

  return { opLog, doSSEAction, closeLog };
}

// ── Confirm Dialog ──────────────────────────────────────────────
function ConfirmModal({ title, message, confirmLabel, onConfirm, onCancel, danger, inputConfirm }) {
  const [inputVal, setInputVal] = useState('');
  const canConfirm = inputConfirm ? inputVal === inputConfirm : true;
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-gray-800 rounded-xl border border-gray-600 p-6 max-w-md w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-2">{title}</h3>
        <p className="text-gray-300 text-sm mb-4 whitespace-pre-wrap">{message}</p>
        {inputConfirm && (
          <input
            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-white mb-4 focus:outline-none focus:border-blue-500"
            placeholder={`输入 "${inputConfirm}" 确认`}
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            autoFocus
          />
        )}
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm">取消</button>
          <button
            onClick={() => canConfirm && onConfirm()}
            disabled={!canConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${danger ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'} disabled:opacity-40`}
          >
            {confirmLabel || '确认'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Restore Picker ──────────────────────────────────────────────
function RestoreModal({ title, backupsText, onRestore, onCancel }) {
  const lines = (backupsText || '').split('\n').filter(l => l.trim());
  const backups = lines.filter(l => /\.(tar\.gz|zip|tgz)/.test(l) || /backup/i.test(l)).map(l => {
    const match = l.match(/(\S+\.(tar\.gz|zip|tgz)\S*)/);
    return match ? match[1] : l.trim();
  }).filter(Boolean);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-gray-800 rounded-xl border border-gray-600 p-6 max-w-lg w-full mx-4 shadow-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4">{title}</h3>
        {backups.length === 0 ? (
          <div className="text-gray-400 mb-4">
            <p className="mb-2">无可用备份</p>
            <pre className="text-xs bg-gray-900 p-3 rounded-lg overflow-auto max-h-40">{backupsText}</pre>
          </div>
        ) : (
          <div className="flex-1 overflow-auto space-y-2 mb-4">
            {backups.map((b, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-900 rounded-lg border border-gray-700 hover:border-blue-500 transition-colors">
                <span className="text-sm font-mono truncate flex-1 mr-3">{b}</span>
                <button onClick={() => onRestore(b)}
                  className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 rounded-lg text-xs font-medium text-white whitespace-nowrap">
                  📥 还原
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm">关闭</button>
        </div>
      </div>
    </div>
  );
}

// ── Backup List Modal (查看备份) ────────────────────────────────
function BackupListModal({ nodeId, onCancel }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/nodes/${nodeId}/backup-list`)
      .then(r => r.json())
      .then(data => {
        if (data.success) setFiles(data.files || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [nodeId]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-gray-800 rounded-xl border border-gray-600 p-6 max-w-2xl w-full mx-4 shadow-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4">📂 备份文件 - {nodeId}</h3>
        {loading ? (
          <div className="text-gray-400 py-8 text-center animate-pulse">加载中...</div>
        ) : files.length === 0 ? (
          <div className="text-gray-400 py-8 text-center">暂无备份文件</div>
        ) : (
          <div className="flex-1 overflow-auto space-y-1.5 mb-4">
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 bg-gray-900 rounded-lg border border-gray-700">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${f.type === 'bot' ? 'bg-purple-900 text-purple-300' : 'bg-blue-900 text-blue-300'}`}>
                      {f.type === 'bot' ? `🤖 ${f.botId}` : '🖥️ 节点'}
                    </span>
                    <span className="text-sm font-mono truncate">{f.name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-3 text-xs text-gray-400 whitespace-nowrap">
                  <span>{f.sizeStr}</span>
                  <span>{new Date(f.mtime).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500">{files.length} 个备份文件</span>
          <button onClick={onCancel} className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm">关闭</button>
        </div>
      </div>
    </div>
  );
}

// ── Subscription Modal (设置订阅) ───────────────────────────────
function SubscriptionModal({ nodeId, onSubmit, onCancel }) {
  const [token, setToken] = useState('');
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-gray-800 rounded-xl border border-gray-600 p-6 max-w-md w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4">🔑 设置订阅 - {nodeId}</h3>
        <div className="mb-4">
          <label className="text-xs text-gray-400 mb-1 block">Anthropic API Token</label>
          <input
            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
            placeholder="sk-ant-..."
            value={token}
            onChange={e => setToken(e.target.value)}
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm">取消</button>
          <button
            onClick={() => token.trim() && onSubmit(token.trim())}
            disabled={!token.trim()}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium text-white disabled:opacity-40"
          >
            设置
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Logs Modal (查看日志 - 实时流) ─────────────────────────────────
function LogsModal({ nodeId, onCancel }) {
  const [logs, setLogs] = useState('');
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [lines, setLines] = useState(100);
  const logRef = useRef(null);
  const abortRef = useRef(null);
  const autoScroll = useRef(true);

  // Auto-scroll when new logs arrive
  useEffect(() => {
    if (logRef.current && autoScroll.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  const handleScroll = () => {
    if (!logRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logRef.current;
    autoScroll.current = scrollHeight - scrollTop - clientHeight < 50;
  };

  // Fetch initial logs then start streaming
  const startStream = useCallback(() => {
    // Abort any existing stream
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLogs('');
    setLoading(true);
    setStreaming(false);

    // First fetch historical logs
    fetch(`${API}/nodes/${nodeId}/logs?lines=${lines}`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        if (controller.signal.aborted) return;
        if (data.success) setLogs(data.logs || '');
        else setLogs(`错误: ${data.error}`);
        setLoading(false);

        // Then start SSE tail stream
        setStreaming(true);
        fetch(`${API}/nodes/${nodeId}/logs/stream`, {
          signal: controller.signal,
          headers: { 'Accept': 'text/event-stream' },
        }).then(async (response) => {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buf = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done || controller.signal.aborted) break;
            buf += decoder.decode(value, { stream: true });
            const evts = buf.split('\n');
            buf = evts.pop();
            for (const line of evts) {
              if (line.startsWith('data: ')) {
                try {
                  const d = JSON.parse(line.slice(6));
                  if (d.line) setLogs(prev => prev + d.line + '\n');
                  if (d.error) setLogs(prev => prev + '\n[Stream error: ' + d.error + ']\n');
                  if (d.done) setStreaming(false);
                } catch(e) {}
              }
            }
          }
          setStreaming(false);
        }).catch(() => setStreaming(false));
      })
      .catch(e => {
        if (!controller.signal.aborted) {
          setLogs(`请求失败: ${e.message}`);
          setLoading(false);
        }
      });
  }, [nodeId, lines]);

  useEffect(() => { startStream(); return () => { if (abortRef.current) abortRef.current.abort(); }; }, [startStream]);

  const handleClose = () => {
    if (abortRef.current) abortRef.current.abort();
    onCancel();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={handleClose}>
      <div className="bg-gray-800 rounded-xl border border-gray-600 p-6 max-w-4xl w-full mx-4 shadow-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold flex items-center gap-2">
            📋 Gateway 日志 - {nodeId}
            {streaming && <span className="inline-flex items-center gap-1 text-xs text-green-400 font-normal"><span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />实时</span>}
          </h3>
          <div className="flex items-center gap-2">
            <select value={lines} onChange={e => setLines(Number(e.target.value))}
              className="bg-gray-900 border border-gray-600 rounded-lg text-xs text-white px-2 py-1.5 focus:outline-none">
              <option value={50}>50行</option>
              <option value={100}>100行</option>
              <option value={200}>200行</option>
              <option value={500}>500行</option>
            </select>
            <button onClick={startStream}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-medium text-white">
              🔄 重连
            </button>
          </div>
        </div>
        <div ref={logRef} onScroll={handleScroll}
          className="flex-1 bg-gray-950 rounded-lg p-3 overflow-auto font-mono text-xs text-gray-300 whitespace-pre-wrap border border-gray-700"
          style={{ minHeight: '300px', maxHeight: '60vh' }}>
          {loading ? <span className="text-gray-500 animate-pulse">加载中...</span> : logs}
        </div>
        <div className="flex justify-end mt-3">
          <button onClick={handleClose} className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm">关闭</button>
        </div>
      </div>
    </div>
  );
}

// ── Add Node Modal ──────────────────────────────────────────────
function AddNodeModal({ onAdd, onCancel }) {
  const [form, setForm] = useState({ id: '', name: '', host: '', sshUser: '', sshPort: 22, ocPath: '', gatewayPort: 18789, authToken: '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.id && form.name && form.host && form.sshUser;
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-gray-800 rounded-xl border border-gray-600 p-6 max-w-md w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4">➕ 添加新节点</h3>
        <div className="space-y-3">
          {[
            { key: 'id', label: '节点ID', placeholder: 'my-node', required: true },
            { key: 'name', label: '名称', placeholder: 'My Node (描述)', required: true },
            { key: 'host', label: '主机地址', placeholder: '192.168.x.x', required: true },
            { key: 'sshUser', label: 'SSH用户', placeholder: 'username', required: true },
            { key: 'sshPort', label: 'SSH端口', placeholder: '22', type: 'number' },
            { key: 'ocPath', label: 'OpenClaw路径', placeholder: '/home/user/.openclaw' },
            { key: 'gatewayPort', label: 'Gateway端口', placeholder: '18789', type: 'number' },
            { key: 'authToken', label: 'Anthropic 订阅Token', placeholder: 'sk-ant-oat01-...' },
          ].map(f => (
            <div key={f.key}>
              <label className="text-xs text-gray-400 mb-1 block">{f.label}{f.required && ' *'}</label>
              <input
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                placeholder={f.placeholder}
                type={f.type || 'text'}
                value={form[f.key]}
                onChange={e => set(f.key, f.type === 'number' ? Number(e.target.value) : e.target.value)}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm">取消</button>
          <button onClick={() => valid && onAdd(form)} disabled={!valid}
            className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-sm font-medium text-white disabled:opacity-40">
            添加节点
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add Bot Modal ───────────────────────────────────────────────
function AddBotModal({ nodeId, onAdd, onCancel }) {
  const [form, setForm] = useState({ botId: '', botName: '', botToken: '', soul: '', model: 'anthropic/claude-opus-4-6', channel: 'telegram', authToken: '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.botId.trim() !== '';
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-gray-800 rounded-xl border border-gray-600 p-6 max-w-md w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4">🤖 添加 Bot 到 {nodeId}</h3>
        <div className="space-y-3">
          {[
            { key: 'botId', label: 'Bot ID', placeholder: 'jack', required: true },
            { key: 'botName', label: '显示名称', placeholder: 'Jack' },
            { key: 'botToken', label: 'Telegram Bot Token', placeholder: '123456:ABC-DEF...' },
            { key: 'model', label: 'LLM模型', placeholder: 'anthropic/claude-opus-4-6' },
            { key: 'authToken', label: 'Anthropic 订阅Token', placeholder: 'sk-ant-oat01-...' },
          ].map(f => (
            <div key={f.key}>
              <label className="text-xs text-gray-400 mb-1 block">{f.label}{f.required && ' *'}</label>
              <input
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                placeholder={f.placeholder}
                value={form[f.key]}
                onChange={e => set(f.key, e.target.value)}
              />
            </div>
          ))}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">人格描述 (Soul)</label>
            <textarea
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
              placeholder="AI助理..."
              rows={3}
              value={form.soul}
              onChange={e => set('soul', e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm">取消</button>
          <button onClick={() => valid && onAdd(form)} disabled={!valid}
            className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-sm font-medium text-white disabled:opacity-40">
            添加 Bot
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────
export default function OcmNodeManager() {
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedNode, setExpandedNode] = useState(null);
  const [nodeDetail, setNodeDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const { opLog, doSSEAction, closeLog } = useSSEAction();

  const [confirm, setConfirm] = useState(null);
  const [restoreModal, setRestoreModal] = useState(null);
  const [addNodeModal, setAddNodeModal] = useState(false);
  const [addBotModal, setAddBotModal] = useState(null);
  const [backupListModal, setBackupListModal] = useState(null);
  const [subscriptionModal, setSubscriptionModal] = useState(null);
  const [logsModal, setLogsModal] = useState(null);

  const fetchNodes = useCallback(async () => {
    try {
      const res = await fetch(`${API}/nodes`);
      const data = await res.json();
      if (data.success) setNodes(data.nodes);
    } catch (e) {
      console.error('fetch nodes failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNodes();
    const iv = setInterval(fetchNodes, 30000);
    return () => clearInterval(iv);
  }, [fetchNodes]);

  const fetchDetail = async (nodeId) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`${API}/nodes/${nodeId}`);
      const data = await res.json();
      if (data.success) setNodeDetail(data.node);
    } catch (e) {
      console.error('fetch detail failed:', e);
    } finally {
      setDetailLoading(false);
    }
  };

  const toggleExpand = (nodeId) => {
    if (expandedNode === nodeId) {
      setExpandedNode(null);
      setNodeDetail(null);
    } else {
      setExpandedNode(nodeId);
      fetchDetail(nodeId);
    }
  };

  const afterAction = () => {
    fetchNodes();
    if (expandedNode) fetchDetail(expandedNode);
  };

  // ── Node Actions ──
  const handleBackup = (nodeId) => {
    doSSEAction(`${API}/nodes/${nodeId}/backup`, 'POST', null, `备份节点 ${nodeId}`, afterAction);
  };

  const handleRestart = (nodeId) => {
    setConfirm({
      title: '🔄 重启 Gateway',
      message: `确认要重启节点 "${nodeId}" 的 Gateway 服务吗？\n所有在该节点运行的 agent 会暂时中断。`,
      confirmLabel: '重启',
      onConfirm: () => {
        setConfirm(null);
        doSSEAction(`${API}/nodes/${nodeId}/restart`, 'POST', null, `重启 Gateway - ${nodeId}`, afterAction);
      }
    });
  };

  const handleShowBackups = async (nodeId) => {
    setActionLoading(true);
    try {
      const res = await fetch(`${API}/nodes/${nodeId}/backups`);
      const data = await res.json();
      setRestoreModal({
        title: `📦 节点 "${nodeId}" 可用备份`,
        backupsText: data.output || '无数据',
        onRestore: (filename) => {
          setRestoreModal(null);
          setConfirm({
            title: '📥 还原节点',
            message: `确认从备份还原节点 "${nodeId}"?\n文件: ${filename}\n\n⚠️ 这将覆盖当前节点的 ~/.openclaw/ 目录！`,
            confirmLabel: '确认还原',
            danger: true,
            onConfirm: () => {
              setConfirm(null);
              doSSEAction(`${API}/nodes/${nodeId}/restore`, 'POST', { filename }, `还原节点 ${nodeId}`, afterAction);
            }
          });
        }
      });
    } catch (e) {
      console.error('fetch backups failed:', e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetire = (nodeId) => {
    setConfirm({
      title: '⚠️ 退役节点',
      message: `确认要退役节点 "${nodeId}"?\n\n退役后该节点将被标记为停用状态。`,
      confirmLabel: '确认退役',
      danger: true,
      inputConfirm: nodeId,
      onConfirm: () => {
        setConfirm(null);
        doSSEAction(`${API}/nodes/${nodeId}/retire`, 'POST', null, `退役节点 ${nodeId}`, afterAction);
      }
    });
  };

  const handleDoctorFix = (nodeId) => {
    doSSEAction(`${API}/nodes/${nodeId}/doctor`, 'POST', null, `Doctor Fix - ${nodeId}`, afterAction);
  };

  const handleSetSubscription = (nodeId) => {
    setSubscriptionModal(nodeId);
  };

  const handleSubscriptionSubmit = (token) => {
    const nodeId = subscriptionModal;
    setSubscriptionModal(null);
    doSSEAction(`${API}/nodes/${nodeId}/subscription`, 'POST', { token }, `设置订阅 - ${nodeId}`, afterAction);
  };

  // ── Bot Actions ──
  const handleBotBackup = (nodeId, botId) => {
    doSSEAction(`${API}/nodes/${nodeId}/bots/${botId}/backup`, 'POST', null, `备份 Bot ${botId}`, afterAction);
  };

  const handleBotRestore = async (nodeId, botId) => {
    setActionLoading(true);
    try {
      const res = await fetch(`${API}/nodes/${nodeId}/bots/${botId}/backups`);
      const data = await res.json();
      setRestoreModal({
        title: `📦 Bot "${botId}" 可用备份`,
        backupsText: data.output || '无数据',
        onRestore: (filename) => {
          setRestoreModal(null);
          setConfirm({
            title: '📥 还原 Bot',
            message: `确认从备份还原 bot "${botId}"?\n文件: ${filename}`,
            confirmLabel: '确认还原',
            danger: true,
            onConfirm: () => {
              setConfirm(null);
              doSSEAction(`${API}/nodes/${nodeId}/bots/${botId}/restore`, 'POST', { filename }, `还原 Bot ${botId}`, afterAction);
            }
          });
        }
      });
    } catch (e) {
      console.error('fetch bot backups failed:', e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBotDelete = (nodeId, botId) => {
    setConfirm({
      title: '🗑️ 删除 Bot',
      message: `确认要删除 bot "${botId}"?\n此操作不可撤销！`,
      confirmLabel: '确认删除',
      danger: true,
      inputConfirm: botId,
      onConfirm: () => {
        setConfirm(null);
        doSSEAction(`${API}/nodes/${nodeId}/bots/${botId}/delete`, 'POST', null, `删除 Bot ${botId}`, afterAction);
      }
    });
  };

  const handleAddBot = (nodeId) => {
    setAddBotModal(nodeId);
  };

  const handleAddBotSubmit = (form) => {
    const nodeId = addBotModal;
    setAddBotModal(null);
    doSSEAction(`${API}/nodes/${nodeId}/bots/add`, 'POST', form, `添加 Bot ${form.botId} 到 ${nodeId}`, afterAction);
  };

  const handleAddNode = (form) => {
    setAddNodeModal(false);
    doSSEAction(`${API}/nodes/add`, 'POST', form, `添加节点 ${form.id}`, afterAction);
  };

  // ── Status helpers ──
  const statusDot = (s) => s === 'active' ? 'bg-green-400' : s === 'inactive' ? 'bg-yellow-400' : 'bg-red-400';
  const statusColor = (s) => s === 'active' ? 'text-green-400' : s === 'inactive' ? 'text-yellow-400' : 'text-red-400';
  const statusLabel = (s) => s === 'active' ? '在线' : s === 'inactive' ? '离线' : '不可达';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">🖥️</div>
          <p className="text-gray-400">加载节点数据...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">🔧 节点管理器</h2>
          <p className="text-gray-400 text-sm mt-1">管理所有 OpenClaw 节点 · {nodes.length} 个节点</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setAddNodeModal(true)}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium text-white transition-colors">
            ➕ 添加节点
          </button>
          <button onClick={() => { setLoading(true); fetchNodes(); }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium text-white transition-colors">
            🔄 刷新
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: '总节点', value: nodes.length, icon: '🖥️', color: 'blue' },
          { label: '在线', value: nodes.filter(n => n.status === 'active').length, icon: '🟢', color: 'green' },
          { label: '离线', value: nodes.filter(n => n.status !== 'active').length, icon: '🔴', color: 'red' },
          { label: '总Bots', value: nodes.reduce((s, n) => s + (n.botCount || 0), 0), icon: '🤖', color: 'purple' },
        ].map(c => (
          <div key={c.label} className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <div className="flex items-center justify-between">
              <span className="text-2xl">{c.icon}</span>
              <span className="text-2xl font-bold text-white">{c.value}</span>
            </div>
            <p className="text-gray-400 text-xs mt-2">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Global Operation Log */}
      {opLog.visible && <OperationLog title={opLog.title} steps={opLog.steps} onClose={closeLog} />}

      {/* Node List */}
      <div className="space-y-4">
        {nodes.map(node => (
          <div key={node.id} className={`bg-gray-800 rounded-xl border transition-colors ${expandedNode === node.id ? 'border-blue-500' : 'border-gray-700'}`}>
            {/* Node Header */}
            <div onClick={() => toggleExpand(node.id)}
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-750 transition-colors rounded-t-xl">
              <div className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${statusDot(node.status)}`} />
                <span className="font-semibold text-white">{node.name}</span>
                <span className="text-gray-500 text-sm">{node.host}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor(node.status)} bg-gray-900`}>
                  {statusLabel(node.status)}
                </span>
                <span className="text-gray-400 text-sm">🤖 {node.botCount}</span>
                <span className="text-gray-500 text-lg">{expandedNode === node.id ? '▾' : '▸'}</span>
              </div>
            </div>

            {/* Expanded Content */}
            {expandedNode === node.id && (
              <div className="border-t border-gray-700 p-4">
                {/* Action Buttons - Row 1: Main actions */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <ActionBtn icon="💾" label="备份节点" onClick={() => handleBackup(node.id)} loading={actionLoading} />
                  <ActionBtn icon="📦" label="还原节点" onClick={() => handleShowBackups(node.id)} loading={actionLoading} color="bg-orange-600 hover:bg-orange-500" />
                  <ActionBtn icon="🔄" label="重启Gateway" onClick={() => handleRestart(node.id)} loading={actionLoading} color="bg-yellow-600 hover:bg-yellow-500" />
                  <ActionBtn icon="🤖" label="添加Bot" onClick={() => handleAddBot(node.id)} loading={actionLoading} color="bg-green-600 hover:bg-green-500" />
                  <ActionBtn icon="🚫" label="退役节点" onClick={() => handleRetire(node.id)} loading={actionLoading} color="bg-red-600 hover:bg-red-500" />
                  <ActionBtn icon="📂" label="查看备份" onClick={() => setBackupListModal(node.id)} loading={actionLoading} color="bg-indigo-600 hover:bg-indigo-500" />
                  <ActionBtn icon="🩺" label="Doctor Fix" onClick={() => handleDoctorFix(node.id)} loading={actionLoading} color="bg-teal-600 hover:bg-teal-500" />
                  <ActionBtn icon="🔑" label="设置订阅" onClick={() => handleSetSubscription(node.id)} loading={actionLoading} color="bg-violet-600 hover:bg-violet-500" />
                  <ActionBtn icon="📋" label="查看日志" onClick={() => setLogsModal(node.id)} loading={actionLoading} color="bg-gray-600 hover:bg-gray-500" />
                </div>

                {/* Bot List */}
                {detailLoading ? (
                  <div className="text-gray-400 py-4 text-center animate-pulse">⏳ 加载 Bot 列表...</div>
                ) : nodeDetail?.bots?.length > 0 ? (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-300 mb-3">🤖 Agents ({nodeDetail.bots.length})</h4>
                    <div className="space-y-2">
                      {nodeDetail.bots.map(bot => (
                        <div key={bot.id} className="flex items-center justify-between p-3 bg-gray-900 rounded-lg border border-gray-700">
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-white">{bot.name || bot.id}</span>
                            <span className="text-gray-500 text-xs ml-3">
                              {bot.channel && bot.channel !== '?' && `📡 ${bot.channel}`}
                              {bot.model && bot.model !== '?' && ` · 🧠 ${typeof bot.model === 'object' ? bot.model.primary || 'default' : bot.model}`}
                            </span>
                          </div>
                          <div className="flex gap-1.5 ml-3">
                            <SmallBtn icon="💾" title="备份Bot" onClick={() => handleBotBackup(node.id, bot.id)} />
                            <SmallBtn icon="📥" title="还原Bot" onClick={() => handleBotRestore(node.id, bot.id)} />
                            <SmallBtn icon="🗑️" title="删除Bot" onClick={() => handleBotDelete(node.id, bot.id)} danger />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : nodeDetail ? (
                  <p className="text-gray-500 text-sm">该节点无 Agents</p>
                ) : null}

                {/* Node Info */}
                {nodeDetail && (
                  <div className="mt-4 pt-4 border-t border-gray-700 flex flex-wrap gap-4 text-xs text-gray-500">
                    <span>📁 磁盘: {nodeDetail.diskUsage || '?'}</span>
                    <span>🔌 Gateway: :{node.gatewayPort}</span>
                    <span>👤 {node.sshUser}@{node.host}:{node.sshPort}</span>
                    {node.ocPath && <span>📂 {node.ocPath}</span>}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modals */}
      {confirm && <ConfirmModal {...confirm} onCancel={() => setConfirm(null)} />}
      {restoreModal && <RestoreModal {...restoreModal} onCancel={() => setRestoreModal(null)} />}
      {addBotModal && <AddBotModal nodeId={addBotModal} onAdd={handleAddBotSubmit} onCancel={() => setAddBotModal(null)} />}
      {addNodeModal && <AddNodeModal onAdd={handleAddNode} onCancel={() => setAddNodeModal(false)} />}
      {backupListModal && <BackupListModal nodeId={backupListModal} onCancel={() => setBackupListModal(null)} />}
      {subscriptionModal && <SubscriptionModal nodeId={subscriptionModal} onSubmit={handleSubscriptionSubmit} onCancel={() => setSubscriptionModal(null)} />}
      {logsModal && <LogsModal nodeId={logsModal} onCancel={() => setLogsModal(null)} />}
    </div>
  );
}

function ActionBtn({ icon, label, onClick, loading, color = 'bg-blue-600 hover:bg-blue-500' }) {
  return (
    <button onClick={onClick} disabled={loading}
      className={`px-3 py-2 rounded-lg text-xs font-medium text-white transition-colors ${color} disabled:opacity-50 disabled:cursor-wait`}>
      {icon} {label}
    </button>
  );
}

function SmallBtn({ icon, title, onClick, danger }) {
  return (
    <button onClick={onClick} title={title}
      className={`p-1.5 rounded-md text-sm transition-colors ${danger ? 'hover:bg-red-900/50 text-red-400' : 'hover:bg-gray-700 text-gray-400'}`}>
      {icon}
    </button>
  );
}
