#!/usr/bin/env python3
import json
import sys
import os
sys.path.append('/home/linou/shared')

# 导入生成器
exec(open('/home/linou/shared/updated-bot-config-generator.py').read())

def create_bot_config(bot_info_json):
    bot_info = json.loads(bot_info_json)
    generator = UpdatedBotConfigGenerator('/home/linou/shared/joe-template')
    config_bundle = generator.generate_bot_config(bot_info)
    bundle_path = generator.save_config_bundle(config_bundle)
    return str(bundle_path)

if __name__ == '__main__':
    if len(sys.argv) > 1:
        result = create_bot_config(sys.argv[1])
        print(f'CONFIG_BUNDLE_PATH:{result}')
