/**
 * Shiyi Memory Types
 *
 * M4.2.1.2
 *
 * 统一定义：
 * 1. 认知记忆类型
 * 2. 记忆作用域
 * 3. 记忆生命周期
 * 4. 事实可信度
 * 5. SQLite 持久化类型
 * 6. CRUD 输入输出
 * 7. 查询与分页
 *
 * 注意：
 * Domain Model 与 SQLite Row 分离。
 * 不允许将认知类型直接映射到现有 memory_type 字段。
 */

// ============================================================
// 1. Cognitive Memory Types
// ============================================================

export const MEMORY_COGNITIVE_TYPES = [
  "working",
  "episodic",
  "semantic",
  "procedural"
] as const;

export type MemoryCognitiveType =
  (typeof MEMORY_COGNITIVE_TYPES)[number];

// ============================================================
// 2. Memory Scope
// ============================================================

export const MEMORY_SCOPES = [
  "global",
  "user",
  "project",
  "entity",
  "session"
] as const;

export type MemoryScope =
  (typeof MEMORY_SCOPES)[number];

// ============================================================
// 3. Memory Lifecycle
// ============================================================

export const MEMORY_LIFECYCLE_STATUSES = [
  "candidate",
  "active",
  "superseded",
  "archived",
  "rejected",
  "deleted"
] as const;

export type MemoryLifecycleStatus =
  (typeof MEMORY_LIFECYCLE_STATUSES)[number];

// Current SQLite supports only these persisted statuses.
export const PERSISTED_MEMORY_STATUSES = [
  "active",
  "archived",
  "deleted"
] as const;

export type PersistedMemoryStatus =
  (typeof PERSISTED_MEMORY_STATUSES)[number];

// ============================================================
// 4. Fact Classification
// ============================================================

export const FACT_KINDS = [
  "fact",
  "inference",
  "hypothesis"
] as const;

export type FactKind =
  (typeof FACT_KINDS)[number];

// ============================================================
// 5. Existing SQLite Content Categories
// ============================================================

// These values correspond to the existing memories.memory_type.
// They are NOT cognitive memory types.

export const MEMORY_CONTENT_CATEGORIES = [
  "general",
  "fact",
  "preference",
  "experience",
  "project",
  "person",
  "goal",
  "event"
] as const;

export type MemoryContentCategory =
  (typeof MEMORY_CONTENT_CATEGORIES)[number];

// ============================================================
// 6. Memory Source
// ============================================================

export const MEMORY_SOURCES = [
  "manual",
  "conversation",
  "import",
  "system"
] as const;

export type MemorySource =
  (typeof MEMORY_SOURCES)[number];

// ============================================================
// 7. Scores and Primitive Types
// ============================================================

export type ISODateString = string;

// Current SQLite importance constraint: 1–5.
export type DatabaseImportance = 1 | 2 | 3 | 4 | 5;

// Domain importance score: 0–100.
// Stored separately from the current SQLite importance field.
export type ImportanceScore = number;

// Confidence score: 0–1.
export type ConfidenceScore = number;

// Sensitivity taxonomy remains extensible.
// Its final levels will be determined in the governance phase.
export type MemorySensitivity = string;

// ============================================================
// 8. Memory Metadata
// ============================================================

export interface MemoryMetadata {
  cognitiveType?: MemoryCognitiveType;

  scope?: MemoryScope;
  scopeId?: string;

  factKind?: FactKind;

  confidence?: ConfidenceScore;
  importanceScore?: ImportanceScore;
  sensitivity?: MemorySensitivity;

  validFrom?: ISODateString;
  validUntil?: ISODateString;

  sourceConversationId?: string;
  sourceMessageIds?: string[];

  custom?: Record<string, unknown>;
}

// ============================================================
// 9. Core Memory Domain Model
// ============================================================

export interface Memory {
  id: string;

  content: string;
  summary: string | null;

  contentCategory: MemoryContentCategory;
  importance: DatabaseImportance;

  source: MemorySource;
  status: PersistedMemoryStatus;

  version: number;

  metadata: MemoryMetadata;

  createdAt: ISODateString;
  updatedAt: ISODateString;
  lastAccessedAt: ISODateString | null;
}

// ============================================================
// 10. Memory Candidate
// ============================================================

export interface MemoryCandidate {
  id: string;

  content: string;
  summary?: string;

  contentCategory: MemoryContentCategory;
  cognitiveType: MemoryCognitiveType;

  scope: MemoryScope;
  scopeId?: string;

  factKind: FactKind;

  confidence: ConfidenceScore;
  importanceScore: ImportanceScore;
  sensitivity: MemorySensitivity;

  source: MemorySource;

  sourceConversationId?: string;
  sourceMessageIds?: string[];

  status: "candidate";

  createdAt: ISODateString;
}

// ============================================================
// 11. SQLite Persistence Row
// ============================================================

// Exact mapping to the existing memories table.
// Keep snake_case to match SQLite columns.

export interface MemoryRow {
  id: string;

  content: string;
  summary: string | null;

  memory_type: MemoryContentCategory;
  importance: DatabaseImportance;

  source: MemorySource;
  status: PersistedMemoryStatus;

  version: number;

  created_at: ISODateString;
  updated_at: ISODateString;
  last_accessed_at: ISODateString | null;

  metadata_json: string;
}

// ============================================================
// 12. Memory Version
// ============================================================

export interface MemoryVersion {
  id: string;
  memoryId: string;
  version: number;

  content: string;
  summary: string | null;

  contentCategory: MemoryContentCategory;
  importance: DatabaseImportance;

  source: MemorySource;
  status: PersistedMemoryStatus;

  metadata: MemoryMetadata;

  changeReason: string | null;
  createdAt: ISODateString;
}

export interface MemoryVersionRow {
  id: string;
  memory_id: string;
  version: number;

  content: string;
  summary: string | null;

  memory_type: MemoryContentCategory;
  importance: DatabaseImportance;

  source: MemorySource;
  status: PersistedMemoryStatus;

  metadata_json: string;

  change_reason: string | null;
  created_at: ISODateString;
}

// ============================================================
// 13. Memory Audit
// ============================================================

export const MEMORY_AUDIT_OPERATIONS = [
  "create",
  "update",
  "archive",
  "restore",
  "soft_delete",
  "access",
  "merge",
  "supersede",
  "reject"
] as const;

export type MemoryAuditOperation =
  (typeof MEMORY_AUDIT_OPERATIONS)[number];

export interface MemoryAudit {
  id: string;
  memoryId: string | null;

  operation: MemoryAuditOperation;

  oldValue: string | null;
  newValue: string | null;

  reason: string | null;
  createdAt: ISODateString;
}

export interface MemoryAuditRow {
  id: string;
  memory_id: string | null;

  operation: string;

  old_value: string | null;
  new_value: string | null;

  reason: string | null;
  created_at: ISODateString;
}

// ============================================================
// 14. Create Memory Input
// ============================================================

export interface MemoryCreateInput {
  content: string;
  summary?: string | null;

  contentCategory?: MemoryContentCategory;

  importance?: DatabaseImportance;

  source?: MemorySource;

  metadata?: MemoryMetadata;
}

// ============================================================
// 15. Update Memory Input
// ============================================================

export interface MemoryUpdatePatch {
  content?: string;
  summary?: string | null;

  contentCategory?: MemoryContentCategory;

  importance?: DatabaseImportance;

  metadata?: Partial<MemoryMetadata>;
}

export interface MemoryUpdateInput {
  id: string;

  patch: MemoryUpdatePatch;

  reason?: string;

  // Optimistic concurrency protection.
  expectedVersion?: number;
}

// ============================================================
// 16. Lifecycle Operation Input
// ============================================================

export interface MemoryLifecycleInput {
  id: string;
  reason?: string;
  expectedVersion?: number;
}

// ============================================================
// 17. Pagination
// ============================================================

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  items: T[];

  page: number;
  pageSize: number;

  totalItems: number;
  totalPages: number;

  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// ============================================================
// 18. Memory Query
// ============================================================

export type MemorySortField =
  | "createdAt"
  | "updatedAt"
  | "importance"
  | "lastAccessedAt";

export type SortDirection = "asc" | "desc";

export interface MemoryListFilters {
  search?: string;

  contentCategory?:
    | MemoryContentCategory
    | readonly MemoryContentCategory[];

  cognitiveType?: MemoryCognitiveType;

  scope?: MemoryScope;
  scopeId?: string;

  factKind?: FactKind;

  status?:
    | PersistedMemoryStatus
    | readonly PersistedMemoryStatus[];

  source?: MemorySource;

  importanceMin?: DatabaseImportance;
  importanceMax?: DatabaseImportance;

  tag?: string;
  entityId?: string;

  createdFrom?: ISODateString;
  createdTo?: ISODateString;

  updatedFrom?: ISODateString;
  updatedTo?: ISODateString;
}

export interface MemoryListQuery
  extends MemoryListFilters, PaginationQuery {
  sortBy?: MemorySortField;
  sortDirection?: SortDirection;
}

// ============================================================
// 19. Memory Service Interface
// ============================================================

// DatabaseSync is synchronous.
// Therefore, the main-process service is synchronous.
// Electron IPC will provide the Promise boundary to the renderer.

export interface MemoryService {
  create(input: MemoryCreateInput): Memory;

  getById(id: string): Memory | null;

  list(
    query?: MemoryListQuery
  ): PaginatedResult<Memory>;

  update(input: MemoryUpdateInput): Memory;

  archive(input: MemoryLifecycleInput): Memory;

  restore(input: MemoryLifecycleInput): Memory;

  softDelete(input: MemoryLifecycleInput): Memory;

  getVersions(
    memoryId: string,
    query?: PaginationQuery
  ): PaginatedResult<MemoryVersion>;

  getAuditLog(
    memoryId: string,
    query?: PaginationQuery
  ): PaginatedResult<MemoryAudit>;
}
