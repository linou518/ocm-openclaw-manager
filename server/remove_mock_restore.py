#!/usr/bin/env python3
"""
删除OCM中的Mock还原API，让前端使用真实的智能还原功能
"""

def remove_mock_restore_api():
    # 读取现有文件
    with open('/home/linou/shared/ocm-project/server/index.js', 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # 找到Mock还原API的范围 (从app.post('/api/nodes/:id/restore'开始)
    mock_restore_start = None
    mock_restore_end = None
    
    for i, line in enumerate(lines):
        # 找到第一个还原API (Mock版本)
        if mock_restore_start is None and "app.post('/api/nodes/:id/restore'" in line:
            mock_restore_start = i
            print(f"找到Mock还原API开始位置: 第{i+1}行")
        elif mock_restore_start is not None and mock_restore_end is None:
            # 寻找这个API的结束位置
            if line.strip() == '});' and 'catch (error)' in ''.join(lines[i-3:i]):
                mock_restore_end = i + 1
                print(f"找到Mock还原API结束位置: 第{i+1}行")
                break
    
    if mock_restore_start is not None and mock_restore_end is not None:
        # 构建新文件，删除Mock还原API
        new_lines = []
        
        # 添加Mock API之前的内容
        new_lines.extend(lines[:mock_restore_start])
        
        # 添加一个注释说明删除了Mock API
        new_lines.append('// Mock restore API removed - using real smart restore system instead\n')
        new_lines.append('\n')
        
        # 添加Mock API之后的内容
        new_lines.extend(lines[mock_restore_end:])
        
        # 写入新文件
        with open('/home/linou/shared/ocm-project/server/index_no_mock_restore.js', 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
        
        print(f"✅ Mock还原API已删除 (第{mock_restore_start+1}-{mock_restore_end}行)")
        print("新文件已生成: index_no_mock_restore.js")
        return True
    else:
        print("❌ 未找到Mock还原API范围")
        return False

if __name__ == "__main__":
    remove_mock_restore_api()