#!/usr/bin/env python3
import sqlite3
import sys

def cleanup_mock_data(db_path):
    db = sqlite3.connect(db_path)
    cur = db.cursor()
    
    # 清理mock备份记录（保留真实的.tar.gz文件）
    cur.execute("DELETE FROM backups WHERE git_commit NOT LIKE '%.tar.gz' OR created_at IS NULL")
    backup_count = cur.rowcount
    print(f"清理了 {backup_count} 条mock备份记录")
    
    # 清理mock bot备份
    cur.execute("DELETE FROM bot_backups WHERE git_commit LIKE '%mock%' OR file_count > 1000")
    bot_backup_count = cur.rowcount
    print(f"清理了 {bot_backup_count} 条mock bot备份")
    
    # 查看剩余备份
    cur.execute("SELECT COUNT(*) FROM backups")
    remaining_backups = cur.fetchone()[0]
    print(f"剩余真实备份: {remaining_backups} 条")
    
    # 提交更改
    db.commit()
    db.close()
    print("Mock数据清理完成!")

if __name__ == "__main__":
    cleanup_mock_data("/home/linou/shared/ocm-project/server/db/ocm.db")