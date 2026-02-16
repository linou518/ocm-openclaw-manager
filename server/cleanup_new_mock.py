#!/usr/bin/env python3
import sqlite3

def cleanup_new_mock_data():
    db = sqlite3.connect("/home/linou/shared/ocm-project/server/db/ocm.db")
    cur = db.cursor()
    
    # 查看所有备份记录
    cur.execute("SELECT id, node_id, git_commit, type, total_size, created_at FROM backups ORDER BY id DESC")
    all_backups = cur.fetchall()
    print("=== 所有备份记录 ===")
    for backup in all_backups:
        print(f"ID {backup[0]}: {backup[1]} - {backup[2]} ({backup[3]}) - {backup[4]} bytes - {backup[5]}")
    
    # 删除Mock数据 (created_at为NULL或特定的git_commit)
    mock_commits = ['49o57pt', 'gr52z2n']
    cur.execute("DELETE FROM backups WHERE created_at IS NULL OR git_commit IN (?, ?)", mock_commits)
    deleted_count = cur.rowcount
    print(f"\n清理了 {deleted_count} 条新Mock数据")
    
    # 查看剩余备份
    cur.execute("SELECT COUNT(*) FROM backups WHERE created_at IS NOT NULL")
    remaining_count = cur.fetchone()[0]
    print(f"剩余真实备份: {remaining_count} 条")
    
    db.commit()
    db.close()
    print("清理完成!")

if __name__ == "__main__":
    cleanup_new_mock_data()