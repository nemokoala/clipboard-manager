import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'node:path'
import type { ClipboardItem, ClipboardType } from '../src/types'

let db: Database.Database

/**
 * Initialise the SQLite database. Must be called once after `app` is ready,
 * because it relies on `app.getPath('userData')` for a writable location.
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

/** Byte size of a UTF-8 string. */
function byteSize(content: string): number {
  return Buffer.byteLength(content, 'utf8')
}

/**
 * Insert a new clipboard item. `size` is computed automatically from the
 * content's byte length and `created_at` is set to the current ISO8601 time.
 * Returns the freshly stored row (with its generated id).
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

/** Return every stored item, newest first. */
export function getAllItems(): ClipboardItem[] {
  return db
    .prepare(
      `SELECT id, type, content, size, created_at
         FROM clipboard_items
        ORDER BY created_at DESC, id DESC`,
    )
    .all() as ClipboardItem[]
}

/** Full-text-ish LIKE search over content, newest first. */
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

/** Delete a single item by id. */
export function deleteItem(id: number): void {
  db.prepare(`DELETE FROM clipboard_items WHERE id = ?`).run(id)
}

/** Remove every item. */
export function deleteAll(): void {
  db.prepare(`DELETE FROM clipboard_items`).run()
}

/** Total bytes consumed by all stored content. */
export function getTotalSize(): number {
  const row = db
    .prepare(`SELECT COALESCE(SUM(size), 0) AS total FROM clipboard_items`)
    .get() as { total: number }
  return row.total
}
