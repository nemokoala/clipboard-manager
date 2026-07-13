import Database from 'better-sqlite3'
import type { ClipboardItem, ClipboardType, StorageStats } from '../src/types'

let db: Database.Database

/**
 * SQLite DB를 열고 스키마를 준비한다.
 * 경로는 호출자가 주입한다 — 이 모듈이 Electron 에 의존하지 않게 하기 위함이다.
 * (`app.getPath('userData')` 는 app ready 이후에만 유효하므로 main 에서 넘긴다.)
 */
export function initDb(dbPath: string): void {
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS clipboard_items (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      type       TEXT NOT NULL,
      content    TEXT NOT NULL,
      size       INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      pinned     INTEGER NOT NULL DEFAULT 0,
      thumbnail  TEXT
    );
  `)

  addMissingColumns()

  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_clipboard_created_at
       ON clipboard_items (created_at DESC);`,
  )
}

/** 예전 스키마로 만들어진 DB 에 나중에 추가된 컬럼을 채워 넣는다. */
function addMissingColumns(): void {
  const existing = new Set(
    (
      db.prepare(`PRAGMA table_info(clipboard_items)`).all() as {
        name: string
      }[]
    ).map((col) => col.name),
  )

  if (!existing.has('pinned')) {
    db.exec(
      `ALTER TABLE clipboard_items ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0`,
    )
  }
  // 이미지 목록용 축소본. 기존 행은 NULL 이며 백필로 채운다(backfill.ts).
  if (!existing.has('thumbnail')) {
    db.exec(`ALTER TABLE clipboard_items ADD COLUMN thumbnail TEXT`)
  }
}

/** SQLite 가 boolean 을 모르므로 pinned 는 0/1 정수로 들어온다. */
type ClipboardRow = Omit<ClipboardItem, 'pinned'> & { pinned: number }

/** DB row 를 ClipboardItem(pinned: boolean) 으로 변환한다. */
function rowToItem(row: ClipboardRow): ClipboardItem {
  return { ...row, pinned: row.pinned === 1 }
}

/** UTF-8 문자열의 바이트 크기. */
function byteSize(content: string): number {
  return Buffer.byteLength(content, 'utf8')
}

/**
 * 새 클립보드 항목을 삽입한다. `size` 는 content 바이트 길이에서 자동 계산하고
 * `created_at` 은 현재 ISO8601 시간으로 설정한다.
 *
 * `thumbnail` 은 이미지에만 있다. 목록에는 원본 대신 이 축소본을 내려보내므로
 * 렌더러가 수 MB 짜리 base64 를 들고 있을 일이 없다.
 */
export function insertItem(
  type: ClipboardType,
  content: string,
  thumbnail?: string,
): ClipboardItem {
  const size = byteSize(content)
  const createdAt = new Date().toISOString()

  const info = db
    .prepare(
      `INSERT INTO clipboard_items (type, content, size, created_at, thumbnail)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(type, content, size, createdAt, thumbnail ?? null)

  return {
    id: Number(info.lastInsertRowid),
    type,
    preview: thumbnail ?? content,
    size,
    created_at: createdAt,
    pinned: false,
  }
}

// 목록에는 원본(content)이 아니라 preview 를 실어 보낸다.
// 이미지는 썸네일, 그 밖에는 원문. 아직 백필되지 않은 이미지는 원본으로 폴백한다.
const SELECT_ITEM = `
  SELECT id, type, COALESCE(thumbnail, content) AS preview, size, created_at, pinned
    FROM clipboard_items`
// 고정 항목을 항상 상단에 두고, 그 안에서 최신순으로 정렬한다.
const ORDER_BY = `ORDER BY pinned DESC, created_at DESC, id DESC`

/** 저장된 모든 항목을 (고정 우선) 최신순으로 반환한다. */
export function getAllItems(): ClipboardItem[] {
  const rows = db.prepare(`${SELECT_ITEM} ${ORDER_BY}`).all() as ClipboardRow[]
  return rows.map(rowToItem)
}

/**
 * content LIKE 검색(유사 전문 검색), 고정 우선 최신순.
 * 이미지는 제외한다 — base64 문자열을 뒤져봐야 의미가 없고, 오히려 검색어가
 * base64 노이즈에 우연히 걸려 엉뚱한 이미지가 잡힌다.
 */
export function searchItems(query: string): ClipboardItem[] {
  const rows = db
    .prepare(
      `${SELECT_ITEM} WHERE type != 'image' AND content LIKE ? ${ORDER_BY}`,
    )
    .all(`%${query}%`) as ClipboardRow[]
  return rows.map(rowToItem)
}

/**
 * 클립보드에 다시 쓸 원본 내용을 읽는다.
 * 목록에는 썸네일만 내려가므로, 복사 시점에 메인 프로세스가 이걸로 원본을 가져온다.
 */
export function getContentById(id: number): string | null {
  const row = db
    .prepare(`SELECT content FROM clipboard_items WHERE id = ?`)
    .get(id) as { content: string } | undefined
  return row?.content ?? null
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

/** 썸네일이 아직 없는 이미지 (백필 대상). */
export function getImagesMissingThumbnail(
  limit: number,
): { id: number; content: string }[] {
  return db
    .prepare(
      `SELECT id, content
         FROM clipboard_items
        WHERE type = 'image' AND thumbnail IS NULL
        ORDER BY created_at DESC
        LIMIT ?`,
    )
    .all(limit) as { id: number; content: string }[]
}

export function setThumbnail(id: number, thumbnail: string): void {
  db.prepare(`UPDATE clipboard_items SET thumbnail = ? WHERE id = ?`).run(
    thumbnail,
    id,
  )
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

/** 저장소 현황: 전체 항목 수와 원본 content 가 차지하는 총 바이트. */
export function getStorageStats(): StorageStats {
  return db
    .prepare(
      `SELECT COUNT(*) AS itemCount, COALESCE(SUM(size), 0) AS totalBytes
         FROM clipboard_items`,
    )
    .get() as StorageStats
}
