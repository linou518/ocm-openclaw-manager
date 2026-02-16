#!/usr/bin/env python3
"""
精确替换OCM中的Mock API
"""

def replace_mock_apis():
    # 读取现有文件
    with open('/home/linou/shared/ocm-project/server/index.js', 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # 读取新的API代码
    with open('/home/linou/shared/ocm-project/server/real_operations_api.js', 'r', encoding='utf-8') as f:
        new_api_code = f.read()
    
    # 找到需要替换的范围
    restart_start = None
    restart_end = None
    test_start = None
    test_end = None
    
    for i, line in enumerate(lines):
        if "app.post('/api/nodes/:id/restart'" in line:
            restart_start = i
        elif restart_start is not None and restart_end is None and line.strip() == '});':
            restart_end = i + 1
        elif "app.post('/api/nodes/:id/test'" in line:
            test_start = i
        elif test_start is not None and test_end is None and line.strip() == '});':
            test_end = i + 1
            break
    
    print(f"重启API范围: {restart_start+1}-{restart_end}")
    print(f"智力测试API范围: {test_start+1}-{test_end}")
    
    if restart_start and restart_end and test_start and test_end:
        # 构建新文件
        new_lines = []
        
        # 添加重启API之前的内容
        new_lines.extend(lines[:restart_start])
        
        # 添加新的API代码
        new_lines.append('\n// ============ Real Node Operations ============\n')
        new_lines.append(new_api_code)
        new_lines.append('\n')
        
        # 添加智力测试API之后的内容
        new_lines.extend(lines[test_end:])
        
        # 写入新文件
        with open('/home/linou/shared/ocm-project/server/index_new.js', 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
        
        print("✅ 新文件已生成: index_new.js")
        return True
    else:
        print("❌ 未找到需要替换的API范围")
        return False

if __name__ == "__main__":
    replace_mock_apis()