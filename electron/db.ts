import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'node:path'
import type { ClipboardItem, ClipboardType } from '../src/types'

let db: Database.Database

/**
 * SQLite DB를 초기화한다. `app` ready 이후 한 번 호출해야 한다 —
 * `app.getPath('userData')`로 쓰기 가능한 경로를 사용하기 때문.
 */
export function initDb(): void {
  const dbPath = path.join(app.getPath('userData'), 'clipboard.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS clipboard_items (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      type       TEXT NOT NULL,
      content    TEXT NOT NULL,
      size       INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
  `)

  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_clipboard_created_at
       ON clipboard_items (created_at DESC);`,
  )
}

/** UTF-8 문자열의 바이트 크기. */
function byteSize(content: string): number {
  return Buffer.byteLength(content, 'utf8')
}

/**
 * 새 클립보드 항목을 삽입한다. `size`는 content 바이트 길이에서 자동 계산하고
 * `created_at`은 현재 ISO8601 시간으로 설정한다. 생성 id가 포함된 row를 반환한다.
 */
export function insertItem(type: ClipboardType, content: string): ClipboardItem {
  const size = byteSize(content)
  const createdAt = new Date().toISOString()

  const stmt = db.prepare(
    `INSERT INTO clipboard_items (type, content, size, created_at)
     VALUES (?, ?, ?, ?)`,
  )
  const info = stmt.run(type, content, size, createdAt)

  return {
    id: Number(info.lastInsertRowid),
    type,
    content,
    size,
    created_at: createdAt,
  }
}

/** 저장된 모든 항목을 최신순으로 반환한다. */
export function getAllItems(): ClipboardItem[] {
  return db
    .prepare(
      `SELECT id, type, content, size, created_at
         FROM clipboard_items
        ORDER BY created_at DESC, id DESC`,
    )
    .all() as ClipboardItem[]
}

/** content LIKE 검색(유사 전문 검색), 최신순. */
export function searchItems(query: string): ClipboardItem[] {
  return db
    .prepare(
      `SELECT id, type, content, size, created_at
         FROM clipboard_items
        WHERE content LIKE ?
        ORDER BY created_at DESC, id DESC`,
    )
    .all(`%${query}%`) as ClipboardItem[]
}

/** id로 단일 항목 삭제. */
export function deleteItem(id: number): void {
  db.prepare(`DELETE FROM clipboard_items WHERE id = ?`).run(id)
}

/** 모든 항목 삭제. */
export function deleteAll(): void {
  db.prepare(`DELETE FROM clipboard_items`).run()
}

/** 저장된 모든 content가 차지하는 총 바이트. */
export function getTotalSize(): number {
  const row = db
    .prepare(`SELECT COALESCE(SUM(size), 0) AS total FROM clipboard_items`)
    .get() as { total: number }
  return row.total
}
