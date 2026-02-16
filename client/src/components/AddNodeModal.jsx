import React, { useState } from 'react';

function AddNodeModal({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    host_last: '',  // 只存储最后一位数字
    port: '22',
    ssh_user: 'openclaw',
    ssh_user_suffix: '', // 数字后缀，可选
    openclaw_path: '/home/openclaw/.openclaw',
    auto_install: true  // 默认启用自动安装
  });

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // 构建完整的数据
      const submitData = {
        id: formData.id,
        name: formData.name,
        host: `192.168.3.${formData.host_last}`,  // 拼接完整IP
        port: formData.port,
        ssh_user: `${formData.ssh_user}${formData.ssh_user_suffix}`,  // 拼接用户名
        openclaw_path: formData.openclaw_path,
        auto_install: formData.auto_install  // 自动安装标志
      };
      
      const res = await fetch('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData)
      });
      
      if (!res.ok) throw new Error('Failed to add node');
      
      const newNode = await res.json();
      const statusMsg = formData.auto_install 
        ? '\n🚀 正在后台自动安装 OpenClaw...' 
        : '\n⚠️ 需要手动安装 OpenClaw';
      alert(`✅ 节点 ${newNode.id} 添加成功！\n地址: ${submitData.host}\n用户: ${submitData.ssh_user}${statusMsg}`);
      onSuccess();
      onClose();
      // 重置表单
      setFormData({ 
        id: '', 
        name: '', 
        host_last: '', 
        port: '22', 
        ssh_user: 'openclaw', 
        ssh_user_suffix: '', 
        openclaw_path: '/home/openclaw/.openclaw',
        auto_install: true
      });
    } catch (error) {
      alert('❌ 添加失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white">添加节点</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl leading-none"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">节点 ID *</label>
              <input
                type="text"
                value={formData.id}
                onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                placeholder="例: g3s-01"
                required
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">节点名称 *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例: Google Cloud Standard"
                required
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">主机地址 *</label>
              <div className="flex items-center">
                <span className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-l-lg text-gray-300 text-sm">
                  192.168.3.
                </span>
                <input
                  type="number"
                  min="1"
                  max="254"
                  value={formData.host_last}
                  onChange={(e) => setFormData({ ...formData, host_last: e.target.value })}
                  placeholder="17"
                  required
                  className="flex-1 px-4 py-2 bg-gray-700 border border-l-0 border-gray-600 rounded-r-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="text-xs text-gray-400 mt-1">
                完整地址: 192.168.3.{formData.host_last || 'XXX'}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">SSH 端口</label>
                <input
                  type="number"
                  value={formData.port}
                  onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                  placeholder="22"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">SSH 用户</label>
                <div className="flex items-center">
                  <span className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-l-lg text-white text-sm">
                    openclaw
                  </span>
                  <input
                    type="text"
                    value={formData.ssh_user_suffix}
                    onChange={(e) => setFormData({ ...formData, ssh_user_suffix: e.target.value })}
                    placeholder="02"
                    className="flex-1 px-4 py-2 bg-gray-700 border border-l-0 border-gray-600 rounded-r-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  用户名: openclaw{formData.ssh_user_suffix}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">OpenClaw 路径</label>
              <input
                type="text"
                value={formData.openclaw_path}
                onChange={(e) => setFormData({ ...formData, openclaw_path: e.target.value })}
                placeholder="/home/openclaw/.openclaw"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
              <div className="text-xs text-gray-400 mt-1">
                默认路径，一般无需修改
              </div>
            </div>

            {/* 自动安装选项 */}
            <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="auto_install"
                  checked={formData.auto_install}
                  onChange={(e) => setFormData({ ...formData, auto_install: e.target.checked })}
                  className="w-4 h-4 text-blue-600 bg-gray-600 border-gray-500 rounded focus:ring-blue-500 focus:ring-2"
                />
                <label htmlFor="auto_install" className="text-sm font-medium text-white">
                  🚀 自动安装 OpenClaw
                </label>
              </div>
              <div className="text-xs text-gray-400 mt-2 ml-7">
                {formData.auto_install ? (
                  <span className="text-green-400">
                    ✅ 将自动检测环境、安装Node.js、安装OpenClaw、配置服务并启动监控
                  </span>
                ) : (
                  <span className="text-yellow-400">
                    ⚠️ 仅添加节点信息，需要手动安装和配置 OpenClaw
                  </span>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-700">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 min-w-[100px]"
              >
                {loading ? '添加中...' : '添加节点'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default AddNodeModal;
