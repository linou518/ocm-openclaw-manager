      // 恢复文件 - 修复版本
      const result = await ssh.execCommand(`
        cd ${tempDir} && 
        # 找到实际的openclaw配置目录
        SOURCE_PATH=$(find . -name "openclaw.json" | head -1 | xargs dirname)
        echo "Found OpenClaw config at: $SOURCE_PATH"
        
        if [ -n "$SOURCE_PATH" ] && [ "$SOURCE_PATH" != "." ]; then
          # 复制配置文件到正确位置
          cp -r "$SOURCE_PATH"/* "${targetNodeInfo.openclaw_path}/"
          echo "Restored files from $SOURCE_PATH to ${targetNodeInfo.openclaw_path}/"
        else
          echo "Could not find OpenClaw config directory"
          exit 1
        fi
      `);
