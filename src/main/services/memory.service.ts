/**
 * Shiyi Memory Service
 *
 * M4.2.2
 *
 * 责任边界：
 * 1. 唯一的记忆读写入口，直接操作 SQLite。
 * 2. 所有写操作在事务内完成：主体数据 + 版本快照 + 审计记录。
 * 3. 读操作只做查询与映射，不产生副作用。
 * 4. 输入一律先经过 Validators，不允许把非法数据写入数据库。
 *
 * 约定：
 * - DatabaseSync 是同步 API，因此本服务同步实现；
 *   Electron IPC 层再提供 Promise 边界。
 * - 领域模型（camelCase）与 SQLite Row（snake_case）严格分离。
 * - 认知类型、作用域、事实等级保存在 metadata_json 中，
 *   本阶段不修改数据库 Schema。
 */

import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

import { getDatabase } from "../database/connection";
import {
  MEMORY_AUDIT_OPERATIONS,
  type DatabaseImportance,
  type ISODateString,
  type Memory,
  type MemoryAudit,
  type MemoryAuditOperation,
  type MemoryAuditRow,
  type MemoryContentCategory,
  type MemoryCreateInput,
  type MemoryLifecycleInput,
  type MemoryListQuery,
  type MemoryMetadata,
  type MemoryRow,
  type MemoryService,
  type MemorySortField,
  type MemorySource,
  type MemoryUpdateInput,
  type MemoryVersion,
  type MemoryVersionRow,
  type PaginationQuery,
  type PaginatedResult,
  type PersistedMemoryStatus
} from "./memory.types";
import {
  MemoryValidationError,
  normalizePagination,
  validateMemoryCreateInput,
  validateMemoryLifecycleInput,
  validateMemoryListQuery,
  validateMemoryUpdateInput
} from "./memory.validators";

// ============================================================
// 1. 服务错误
// ============================================================

export class MemoryNotFoundError extends Error {
  constructor(public readonly memoryId: string) {
    super(`记忆不存在：${memoryId}`);
    this.name = "MemoryNotFoundError";
  }
}

export class MemoryVersionConflictError extends Error {
  constructor(
    public readonly memoryId: string,
    public readonly expectedVersion: number,
    public readonly actualVersion: number
  ) {
    super(
      `记忆版本冲突：期望版本 ${expectedVersion}，当前版本 ${actualVersion}`
    );
    this.name = "MemoryVersionConflictError";
  }
}

export class MemoryStateError extends Error {
  constructor(
    public readonly memoryId: string,
    message: string
  ) {
    super(message);
    this.name = "MemoryStateError";
  }
}

// ============================================================
// 2. 内部类型与工具
// ============================================================

type SqlValue = string | number | bigint | null | Uint8Array;

interface MemoryValues {
  content: string;
  summary: string | null;
  contentCategory: MemoryContentCategory;
  importance: DatabaseImportance;
  source: MemorySource;
  status: PersistedMemoryStatus;
  metadata: MemoryMetadata;
}

const SORT_COLUMNS: Record<MemorySortField, string> = {
  createdAt: "created_at",
  updatedAt: "updated_at",
  importance: "importance",
  lastAccessedAt: "last_accessed_at"
};

function nowIso(): ISODateString {
  return new Date().toISOString();
}

function parseMetadata(json: string): MemoryMetadata {
  try {
    const value: unknown = JSON.parse(json);
    return typeof value === "object" && value !== null
      ? (value as MemoryMetadata)
      : {};
  } catch {
    // 数据库中的历史脏数据不应该导致读取整体失败。
    return {};
  }
}

function stringifyMetadata(metadata: MemoryMetadata): string {
  return JSON.stringify(metadata);
}

function toMemory(row: MemoryRow): Memory {
  return {
    id: row.id,
    content: row.content,
    summary: row.summary,
    contentCategory: row.memory_type,
    importance: row.importance,
    source: row.source,
    status: row.status,
    version: row.version,
    metadata: parseMetadata(row.metadata_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastAccessedAt: row.last_accessed_at
  };
}

function toVersion(row: MemoryVersionRow): MemoryVersion {
  return {
    id: row.id,
    memoryId: row.memory_id,
    version: row.version,
    content: row.content,
    summary: row.summary,
    contentCategory: row.memory_type,
    importance: row.importance,
    source: row.source,
    status: row.status,
    metadata: parseMetadata(row.metadata_json),
    changeReason: row.change_reason,
    createdAt: row.created_at
  };
}

function toAudit(row: MemoryAuditRow): MemoryAudit {
  return {
    id: row.id,
    memoryId: row.memory_id,
    operation: row.operation as MemoryAuditOperation,
    oldValue: row.old_value,
    newValue: row.new_value,
    reason: row.reason,
    createdAt: row.created_at
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function toArray<T>(value: T | readonly T[]): readonly T[] {
  return Array.isArray(value) ? value : [value as T];
}

function assertMemoryId(id: unknown): asserts id is string {
  if (typeof id !== "string" || !id.trim()) {
    throw new MemoryValidationError("id", "记忆 ID 不能为空");
  }

  if (id.length > 128) {
    throw new MemoryValidationError("id", "记忆 ID 不能超过 128 个字符");
  }
}

function paginate<T>(
  items: T[],
  totalItems: number,
  page: number,
  pageSize: number
): PaginatedResult<T> {
  const totalPages = Math.ceil(totalItems / pageSize);

  return {
    items,
    page,
    pageSize,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1 && totalItems > 0
  };
}

const AUDIT_OPERATIONS: readonly string[] = MEMORY_AUDIT_OPERATIONS;

function assertAuditOperation(
  operation: string
): asserts operation is MemoryAuditOperation {
  if (!AUDIT_OPERATIONS.includes(operation)) {
    throw new Error(`不支持的审计操作：${operation}`);
  }
}

// ============================================================
// 3. SQLite 实现
// ============================================================

export class SqliteMemoryService implements MemoryService {
  constructor(private readonly db: DatabaseSync = getDatabase()) {}

  // ---------------- 写操作 ----------------

  create(input: MemoryCreateInput): Memory {
    validateMemoryCreateInput(input);

    const timestamp = nowIso();
    const id = randomUUID();

    const values: MemoryValues = {
      content: input.content,
      summary: input.summary ?? null,
      contentCategory: input.contentCategory ?? "general",
      importance: input.importance ?? 3,
      source: input.source ?? "manual",
      status: "active",
      metadata: input.metadata ?? {}
    };

    this.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO memories (
             id, content, summary, memory_type, importance, source, status,
             created_at, updated_at, last_accessed_at, metadata_json, version
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 1)`
        )
        .run(
          id,
          values.content,
          values.summary,
          values.contentCategory,
          values.importance,
          values.source,
          values.status,
          timestamp,
          timestamp,
          stringifyMetadata(values.metadata)
        );

      this.insertVersion(id, 1, values, "创建记忆", timestamp);
      this.insertAudit("create", id, null, values, null, timestamp);
    });

    return this.getByIdOrThrow(id);
  }

  update(input: MemoryUpdateInput): Memory {
    validateMemoryUpdateInput(input);

    const existing = this.getRowOrThrow(input.id);

    if (existing.status === "deleted") {
      throw new MemoryStateError(
        existing.id,
        "已删除的记忆不能直接修改，请先恢复"
      );
    }

    if (
      input.expectedVersion !== undefined &&
      input.expectedVersion !== existing.version
    ) {
      throw new MemoryVersionConflictError(
        existing.id,
        input.expectedVersion,
        existing.version
      );
    }

    const previous: MemoryValues = {
      content: existing.content,
      summary: existing.summary,
      contentCategory: existing.memory_type,
      importance: existing.importance,
      source: existing.source,
      status: existing.status,
      metadata: parseMetadata(existing.metadata_json)
    };

    const metadata =
      input.patch.metadata !== undefined
        ? {
            ...previous.metadata,
            ...compactMetadata(input.patch.metadata)
          }
        : previous.metadata;

    const next: MemoryValues = {
      content: input.patch.content ?? previous.content,
      summary:
        input.patch.summary !== undefined
          ? input.patch.summary
          : previous.summary,
      contentCategory:
        input.patch.contentCategory ?? previous.contentCategory,
      importance: input.patch.importance ?? previous.importance,
      source: previous.source,
      status: previous.status,
      metadata
    };

    const timestamp = nowIso();
    const nextVersion = existing.version + 1;

    this.transaction(() => {
      const result = this.db
        .prepare(
          `UPDATE memories
              SET content = ?,
                  summary = ?,
                  memory_type = ?,
                  importance = ?,
                  metadata_json = ?,
                  version = ?,
                  updated_at = ?
            WHERE id = ?
              AND version = ?`
        )
        .run(
          next.content,
          next.summary,
          next.contentCategory,
          next.importance,
          stringifyMetadata(next.metadata),
          nextVersion,
          timestamp,
          existing.id,
          existing.version
        );

      if (result.changes !== 1) {
        throw new MemoryVersionConflictError(
          existing.id,
          nextVersion,
          this.getRowOrThrow(existing.id).version
        );
      }

      this.insertVersion(
        existing.id,
        nextVersion,
        next,
        input.reason ?? null,
        timestamp
      );
      this.insertAudit(
        "update",
        existing.id,
        previous,
        next,
        input.reason ?? null,
        timestamp
      );
    });

    return this.getByIdOrThrow(existing.id);
  }

  archive(input: MemoryLifecycleInput): Memory {
    return this.changeStatus(input, "archive", ["active"], "archived");
  }

  restore(input: MemoryLifecycleInput): Memory {
    return this.changeStatus(
      input,
      "restore",
      ["archived", "deleted"],
      "active"
    );
  }

  softDelete(input: MemoryLifecycleInput): Memory {
    return this.changeStatus(
      input,
      "soft_delete",
      ["active", "archived"],
      "deleted"
    );
  }

  // ---------------- 读操作 ----------------

  getById(id: string): Memory | null {
    assertMemoryId(id);

    const row = this.db
      .prepare(`SELECT * FROM memories WHERE id = ?`)
      .get(id) as MemoryRow | undefined;

    return row ? toMemory(row) : null;
  }

  list(query: MemoryListQuery = {}): PaginatedResult<Memory> {
    validateMemoryListQuery(query);

    const { page, pageSize, offset } = normalizePagination(query);
    const { where, params } = this.buildListFilter(query);

    const totalRow = this.db
      .prepare(`SELECT COUNT(*) AS total FROM memories ${where}`)
      .get(...params) as { total: number };

    const sortColumn = SORT_COLUMNS[query.sortBy ?? "createdAt"];
    const direction = query.sortDirection === "asc" ? "ASC" : "DESC";

    const rows = this.db
      .prepare(
        `SELECT * FROM memories ${where}
          ORDER BY ${sortColumn} ${direction}, id ASC
          LIMIT ? OFFSET ?`
      )
      .all(...params, pageSize, offset) as unknown as MemoryRow[];

    return paginate(
      rows.map(toMemory),
      totalRow.total,
      page,
      pageSize
    );
  }

  getVersions(
    memoryId: string,
    query: PaginationQuery = {}
  ): PaginatedResult<MemoryVersion> {
    assertMemoryId(memoryId);

    const { page, pageSize, offset } = normalizePagination(query);
    const exists = this.db
      .prepare(`SELECT 1 AS found FROM memories WHERE id = ?`)
      .get(memoryId) as { found: number } | undefined;

    if (!exists) {
      throw new MemoryNotFoundError(memoryId);
    }

    const totalRow = this.db
      .prepare(
        `SELECT COUNT(*) AS total
           FROM memory_versions
          WHERE memory_id = ?`
      )
      .get(memoryId) as { total: number };

    const rows = this.db
      .prepare(
        `SELECT * FROM memory_versions
          WHERE memory_id = ?
          ORDER BY version DESC
          LIMIT ? OFFSET ?`
      )
      .all(memoryId, pageSize, offset) as unknown as MemoryVersionRow[];

    return paginate(
      rows.map(toVersion),
      totalRow.total,
      page,
      pageSize
    );
  }

  getAuditLog(
    memoryId: string,
    query: PaginationQuery = {}
  ): PaginatedResult<MemoryAudit> {
    assertMemoryId(memoryId);

    const { page, pageSize, offset } = normalizePagination(query);
    const exists = this.db
      .prepare(`SELECT 1 AS found FROM memories WHERE id = ?`)
      .get(memoryId) as { found: number } | undefined;

    if (!exists) {
      throw new MemoryNotFoundError(memoryId);
    }

    const totalRow = this.db
      .prepare(
        `SELECT COUNT(*) AS total
           FROM memory_audit
          WHERE memory_id = ?`
      )
      .get(memoryId) as { total: number };

    const rows = this.db
      .prepare(
        `SELECT * FROM memory_audit
          WHERE memory_id = ?
          ORDER BY created_at DESC, rowid DESC
          LIMIT ? OFFSET ?`
      )
      .all(memoryId, pageSize, offset) as unknown as MemoryAuditRow[];

    return paginate(
      rows.map(toAudit),
      totalRow.total,
      page,
      pageSize
    );
  }

  // ---------------- 内部实现 ----------------

  private changeStatus(
    input: MemoryLifecycleInput,
    operation: "archive" | "restore" | "soft_delete",
    allowedFrom: readonly PersistedMemoryStatus[],
    target: PersistedMemoryStatus
  ): Memory {
    validateMemoryLifecycleInput(input);

    const existing = this.getRowOrThrow(input.id);

    if (existing.status === target) {
      throw new MemoryStateError(
        existing.id,
        `记忆已经处于 ${target} 状态`
      );
    }

    if (!allowedFrom.includes(existing.status)) {
      throw new MemoryStateError(
        existing.id,
        `当前状态 ${existing.status} 不能执行 ${operation}`
      );
    }

    if (
      input.expectedVersion !== undefined &&
      input.expectedVersion !== existing.version
    ) {
      throw new MemoryVersionConflictError(
        existing.id,
        input.expectedVersion,
        existing.version
      );
    }

    assertAuditOperation(operation);

    const timestamp = nowIso();
    const nextVersion = existing.version + 1;

    const previous: MemoryValues = {
      content: existing.content,
      summary: existing.summary,
      contentCategory: existing.memory_type,
      importance: existing.importance,
      source: existing.source,
      status: existing.status,
      metadata: parseMetadata(existing.metadata_json)
    };

    const next: MemoryValues = {
      ...previous,
      status: target
    };

    const reason = input.reason ?? null;

    this.transaction(() => {
      const result = this.db
        .prepare(
          `UPDATE memories
              SET status = ?, version = ?, updated_at = ?
            WHERE id = ?
              AND version = ?`
        )
        .run(
          target,
          nextVersion,
          timestamp,
          existing.id,
          existing.version
        );

      if (result.changes !== 1) {
        throw new MemoryVersionConflictError(
          existing.id,
          nextVersion,
          this.getRowOrThrow(existing.id).version
        );
      }

      this.insertVersion(
        existing.id,
        nextVersion,
        next,
        reason ?? `状态变更为 ${target}`,
        timestamp
      );
      this.insertAudit(
        operation,
        existing.id,
        previous,
        next,
        reason,
        timestamp
      );
    });

    return this.getByIdOrThrow(existing.id);
  }

  private buildListFilter(query: MemoryListQuery): {
    where: string;
    params: SqlValue[];
  } {
    const conditions: string[] = [];
    const params: SqlValue[] = [];

    // 默认不返回已删除记忆，除非调用方显式筛选。
    if (query.status !== undefined) {
      const statuses = toArray(query.status);
      conditions.push(
        `status IN (${statuses.map(() => "?").join(", ")})`
      );
      params.push(...statuses);
    } else {
      conditions.push(`status IN ('active', 'archived')`);
    }

    if (query.contentCategory !== undefined) {
      const categories = toArray(query.contentCategory);
      conditions.push(
        `memory_type IN (${categories.map(() => "?").join(", ")})`
      );
      params.push(...categories);
    }

    if (query.source !== undefined) {
      conditions.push(`source = ?`);
      params.push(query.source);
    }

    if (query.importanceMin !== undefined) {
      conditions.push(`importance >= ?`);
      params.push(query.importanceMin);
    }

    if (query.importanceMax !== undefined) {
      conditions.push(`importance <= ?`);
      params.push(query.importanceMax);
    }

    if (query.createdFrom !== undefined) {
      conditions.push(`created_at >= ?`);
      params.push(query.createdFrom);
    }

    if (query.createdTo !== undefined) {
      conditions.push(`created_at <= ?`);
      params.push(query.createdTo);
    }

    if (query.updatedFrom !== undefined) {
      conditions.push(`updated_at >= ?`);
      params.push(query.updatedFrom);
    }

    if (query.updatedTo !== undefined) {
      conditions.push(`updated_at <= ?`);
      params.push(query.updatedTo);
    }

    if (query.search !== undefined) {
      const pattern = `%${escapeLike(query.search)}%`;
      conditions.push(
        `(content LIKE ? ESCAPE '\\' OR summary LIKE ? ESCAPE '\\')`
      );
      params.push(pattern, pattern);
    }

    // metadata_json 中的领域字段使用 SQLite JSON1 直接过滤。
    const metadataFilters: Array<
      [keyof MemoryMetadata | "scopeId", string]
    > = [
      ["cognitiveType", "$.cognitiveType"],
      ["scope", "$.scope"],
      ["scopeId", "$.scopeId"],
      ["factKind", "$.factKind"]
    ];

    for (const [field, path] of metadataFilters) {
      const value = query[field as keyof MemoryListQuery];

      if (typeof value === "string" && value.length > 0) {
        conditions.push(`json_extract(metadata_json, ?) = ?`);
        params.push(path, value);
      }
    }

    if (query.tag !== undefined) {
      conditions.push(
        `EXISTS (
           SELECT 1 FROM memory_tags
            WHERE memory_tags.memory_id = memories.id
              AND memory_tags.tag = ?
         )`
      );
      params.push(query.tag);
    }

    if (query.entityId !== undefined) {
      conditions.push(
        `EXISTS (
           SELECT 1 FROM memory_entities
            WHERE memory_entities.memory_id = memories.id
              AND memory_entities.entity_id = ?
         )`
      );
      params.push(query.entityId);
    }

    return {
      where: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
      params
    };
  }

  private insertVersion(
    memoryId: string,
    version: number,
    values: MemoryValues,
    changeReason: string | null,
    timestamp: ISODateString
  ): void {
    this.db
      .prepare(
        `INSERT INTO memory_versions (
           id, memory_id, version, content, summary, memory_type,
           importance, source, status, metadata_json, change_reason,
           created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        randomUUID(),
        memoryId,
        version,
        values.content,
        values.summary,
        values.contentCategory,
        values.importance,
        values.source,
        values.status,
        stringifyMetadata(values.metadata),
        changeReason,
        timestamp
      );
  }

  private insertAudit(
    operation: MemoryAuditOperation,
    memoryId: string,
    previous: MemoryValues | null,
    next: MemoryValues | null,
    reason: string | null,
    timestamp: ISODateString
  ): void {
    this.db
      .prepare(
        `INSERT INTO memory_audit (
           id, memory_id, operation, old_value, new_value, reason, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        randomUUID(),
        memoryId,
        operation,
        previous ? JSON.stringify(previous) : null,
        next ? JSON.stringify(next) : null,
        reason,
        timestamp
      );
  }

  private getRowOrThrow(id: string): MemoryRow {
    const row = this.db
      .prepare(`SELECT * FROM memories WHERE id = ?`)
      .get(id) as MemoryRow | undefined;

    if (!row) {
      throw new MemoryNotFoundError(id);
    }

    return row;
  }

  private getByIdOrThrow(id: string): Memory {
    const row = this.getRowOrThrow(id);
    return toMemory(row);
  }

  private transaction<T>(work: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");

    try {
      const result = work();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      try {
        this.db.exec("ROLLBACK");
      } catch {
        // 回滚失败时保留原始错误，避免掩盖真实原因。
      }
      throw error;
    }
  }
}

// ============================================================
// 4. 只把已定义的字段合并进 metadata
// ============================================================

function compactMetadata(
  patch: Partial<MemoryMetadata>
): Partial<MemoryMetadata> {
  const entries = Object.entries(patch).filter(
    ([, value]) => value !== undefined
  );

  if (entries.length === 0) {
    return {};
  }

  return Object.fromEntries(entries) as Partial<MemoryMetadata>;
}

// ============================================================
// 5. 工厂函数
// ============================================================

export function createMemoryService(
  db: DatabaseSync = getDatabase()
): MemoryService {
  return new SqliteMemoryService(db);
}
