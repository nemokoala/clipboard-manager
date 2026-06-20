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
      created_at TEXT NOT NULL,
      pinned     INTEGER NOT NULL DEFAULT 0
    );
  `)

  // 마이그레이션: 기존(pinned 컬럼이 없는) DB 에 컬럼을 추가한다.
  const hasPinned = (
    db.prepare(`PRAGMA table_info(clipboard_items)`).all() as { name: string }[]
  ).some((col) => col.name === 'pinned')
  if (!hasPinned) {
    db.exec(
      `ALTER TABLE clipboard_items ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0`,
    )
  }

  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_clipboard_created_at
       ON clipboard_items (created_at DESC);`,
  )
}

/** DB row(pinned 가 0/1 정수) 를 ClipboardItem(boolean) 으로 변환한다. */
function rowToItem(row: Omit<ClipboardItem, 'pinned'> & { pinned: number }): ClipboardItem {
  return { ...row, pinned: row.pinned === 1 }
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
    pinned: false,
  }
}

// 고정 항목을 항상 상단에 두고, 그 안에서 최신순으로 정렬한다.
const ORDER_BY = `ORDER BY pinned DESC, created_at DESC, id DESC`

/** 저장된 모든 항목을 (고정 우선) 최신순으로 반환한다. */
export function getAllItems(): ClipboardItem[] {
  return (
    db
      .prepare(
        `SELECT id, type, content, size, created_at, pinned
           FROM clipboard_items
          ${ORDER_BY}`,
      )
      .all() as (Omit<ClipboardItem, 'pinned'> & { pinned: number })[]
  ).map(rowToItem)
}

/** content LIKE 검색(유사 전문 검색), 고정 우선 최신순. */
export function searchItems(query: string): ClipboardItem[] {
  return (
    db
      .prepare(
        `SELECT id, type, content, size, created_at, pinned
           FROM clipboard_items
          WHERE content LIKE ?
          ${ORDER_BY}`,
      )
      .all(`%${query}%`) as (Omit<ClipboardItem, 'pinned'> & { pinned: number })[]
  ).map(rowToItem)
}

/** 항목의 고정 여부를 변경한다. */
export function setPinned(id: number, pinned: boolean): void {
  db.prepare(`UPDATE clipboard_items SET pinned = ? WHERE id = ?`).run(
    pinned ? 1 : 0,
    id,
  )
}

/** id로 단일 항목 삭제. */
export function deleteItem(id: number): void {
  db.prepare(`DELETE FROM clipboard_items WHERE id = ?`).run(id)
}

/** 모든 항목 삭제. */
export function deleteAll(): void {
  db.prepare(`DELETE FROM clipboard_items`).run()
}

/**
 * 보관 정책에 따라 오래되거나 초과한 항목을 삭제한다. 고정 항목은 제외한다.
 * - `maxAgeDays > 0`: 해당 일수보다 오래된 항목 삭제.
 * - `maxItems > 0`: 최신 maxItems 개만 남기고 나머지 삭제.
 * 삭제된 행 수를 반환한다(0 이면 변화 없음).
 */
export function purgeOldItems(maxAgeDays: number, maxItems: number): number {
  let deleted = 0

  if (maxAgeDays > 0) {
    const cutoff = new Date(
      Date.now() - maxAgeDays * 24 * 60 * 60 * 1000,
    ).toISOString()
    const info = db
      .prepare(
        `DELETE FROM clipboard_items
          WHERE pinned = 0 AND created_at < ?`,
      )
      .run(cutoff)
    deleted += info.changes
  }

  if (maxItems > 0) {
    // 고정되지 않은 항목 중 최신 maxItems 개의 id 를 보존하고 나머지를 삭제한다.
    const info = db
      .prepare(
        `DELETE FROM clipboard_items
          WHERE pinned = 0
            AND id NOT IN (
              SELECT id FROM clipboard_items
               WHERE pinned = 0
               ORDER BY created_at DESC, id DESC
               LIMIT ?
            )`,
      )
      .run(maxItems)
    deleted += info.changes
  }

  return deleted
}

/** 저장된 모든 content가 차지하는 총 바이트. */
export function getTotalSize(): number {
  const row = db
    .prepare(`SELECT COALESCE(SUM(size), 0) AS total FROM clipboard_items`)
    .get() as { total: number }
  return row.total
}
