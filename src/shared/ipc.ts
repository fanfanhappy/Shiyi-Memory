/**
 * Shiyi IPC Contract
 *
 * M4.3
 *
 * Renderer / Preload / Main 涔嬮棿鍞竴鐨勭被鍨嬪绾︺€? * 杩欓噷鍙畾涔夊彲搴忓垪鍖栫殑 DTO锛屼笉渚濊禆涓昏繘绋嬬殑棰嗗煙妯″瀷锛? * 閬垮厤 Renderer 鐩存帴寮曠敤鏁版嵁搴撳眰浠ｇ爜銆? *
 * 鎵€鏈夐€氶亾閮借繑鍥炵粺涓€淇″皝锛? *   { ok: true, data } | { ok: false, error }
 * 涓昏繘绋嬩笉浼氭妸寮傚父鍫嗘爤鎴?SQL 缁嗚妭閫忎紶缁欑晫闈€? */

// ============================================================
// 1. IPC 閫氶亾
// ============================================================

export const MEMORY_IPC = {
  list: "shiyi:memory:list",
  get: "shiyi:memory:get",
  create: "shiyi:memory:create",
  update: "shiyi:memory:update",
  archive: "shiyi:memory:archive",
  restore: "shiyi:memory:restore",
  remove: "shiyi:memory:remove",
  versions: "shiyi:memory:versions",
  audit: "shiyi:memory:audit"
} as const;

// ============================================================
// 2. 缁撴灉淇″皝涓庨敊璇爜
// ============================================================

export type MemoryIpcErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "VERSION_CONFLICT"
  | "INVALID_STATE"
  | "INTERNAL_ERROR";

export interface MemoryIpcError {
  code: MemoryIpcErrorCode;
  message: string;
  field?: string;
}

export type MemoryIpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: MemoryIpcError };

// ============================================================
// 3. 鏋氫妇
// ============================================================

export type MemoryCognitiveTypeDto =
  | "working"
  | "episodic"
  | "semantic"
  | "procedural";

export type MemoryScopeDto =
  | "global"
  | "user"
  | "project"
  | "entity"
  | "session";

export type MemoryContentCategoryDto =
  | "general"
  | "fact"
  | "preference"
  | "experience"
  | "project"
  | "person"
  | "goal"
  | "event";

export type MemorySourceDto =
  | "manual"
  | "conversation"
  | "import"
  | "system";

export type MemoryStatusDto = "active" | "archived" | "deleted";

export type MemoryImportanceDto = 1 | 2 | 3 | 4 | 5;

export type FactKindDto = "fact" | "inference" | "hypothesis";

export type MemoryAuditOperationDto =
  | "create"
  | "update"
  | "archive"
  | "restore"
  | "soft_delete"
  | "access"
  | "merge"
  | "supersede"
  | "reject";

// ============================================================
// 4. DTO
// ============================================================

export interface MemoryMetadataDto {
  cognitiveType?: MemoryCognitiveTypeDto;
  scope?: MemoryScopeDto;
  scopeId?: string;
  factKind?: FactKindDto;
  confidence?: number;
  importanceScore?: number;
  sensitivity?: string;
  validFrom?: string;
  validUntil?: string;
  sourceConversationId?: string;
  sourceMessageIds?: string[];
  custom?: Record<string, unknown>;
}

export interface MemoryDto {
  id: string;
  content: string;
  summary: string | null;
  contentCategory: MemoryContentCategoryDto;
  importance: MemoryImportanceDto;
  source: MemorySourceDto;
  status: MemoryStatusDto;
  version: number;
  metadata: MemoryMetadataDto;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string | null;
}

export interface MemoryVersionDto {
  id: string;
  memoryId: string;
  version: number;
  content: string;
  summary: string | null;
  contentCategory: MemoryContentCategoryDto;
  importance: MemoryImportanceDto;
  source: MemorySourceDto;
  status: MemoryStatusDto;
  metadata: MemoryMetadataDto;
  changeReason: string | null;
  createdAt: string;
}

export interface MemoryAuditDto {
  id: string;
  memoryId: string | null;
  operation: MemoryAuditOperationDto;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  createdAt: string;
}

export interface PageDto<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// ============================================================
// 5. 璇锋眰杞借嵎
// ============================================================

export interface PaginationDto {
  page?: number;
  pageSize?: number;
}

export interface MemoryListQueryDto {
  search?: string;
  contentCategory?:
    | MemoryContentCategoryDto
    | MemoryContentCategoryDto[];
  cognitiveType?: MemoryCognitiveTypeDto;
  scope?: MemoryScopeDto;
  scopeId?: string;
  factKind?: FactKindDto;
  status?: MemoryStatusDto | MemoryStatusDto[];
  source?: MemorySourceDto;
  importanceMin?: MemoryImportanceDto;
  importanceMax?: MemoryImportanceDto;
  tag?: string;
  entityId?: string;
  createdFrom?: string;
  createdTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "createdAt" | "updatedAt" | "importance" | "lastAccessedAt";
  sortDirection?: "asc" | "desc";
}

export interface MemoryCreateDto {
  content: string;
  summary?: string | null;
  contentCategory?: MemoryContentCategoryDto;
  importance?: MemoryImportanceDto;
  source?: MemorySourceDto;
  metadata?: MemoryMetadataDto;
}

export interface MemoryUpdateDto {
  id: string;
  patch: {
    content?: string;
    summary?: string | null;
    contentCategory?: MemoryContentCategoryDto;
    importance?: MemoryImportanceDto;
    metadata?: MemoryMetadataDto;
  };
  reason?: string;
  expectedVersion?: number;
}

export interface MemoryLifecycleDto {
  id: string;
  reason?: string;
  expectedVersion?: number;
}

// ============================================================
// 6. 鏆撮湶缁?Renderer 鐨?API
// ============================================================

export interface MemoryApi {
  list(
    query?: MemoryListQueryDto
  ): Promise<MemoryIpcResult<PageDto<MemoryDto>>>;

  get(id: string): Promise<MemoryIpcResult<MemoryDto>>;

  create(
    input: MemoryCreateDto
  ): Promise<MemoryIpcResult<MemoryDto>>;

  update(
    input: MemoryUpdateDto
  ): Promise<MemoryIpcResult<MemoryDto>>;

  archive(
    input: MemoryLifecycleDto
  ): Promise<MemoryIpcResult<MemoryDto>>;

  restore(
    input: MemoryLifecycleDto
  ): Promise<MemoryIpcResult<MemoryDto>>;

  remove(
    input: MemoryLifecycleDto
  ): Promise<MemoryIpcResult<MemoryDto>>;

  versions(
    id: string,
    query?: PaginationDto
  ): Promise<MemoryIpcResult<PageDto<MemoryVersionDto>>>;

  audit(
    id: string,
    query?: PaginationDto
  ): Promise<MemoryIpcResult<PageDto<MemoryAuditDto>>>;
}
