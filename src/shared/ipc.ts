/**
 * Shiyi IPC Contract
 *
 * M4.3 / M5.1
 *
 * Renderer / Preload / Main 之间唯一的类型契约。
 * 这里只定义可序列化的 DTO，不依赖主进程的领域模型，
 * 避免 Renderer 直接引用数据库层代码。
 *
 * 所有通道都返回统一信封：
 *   { ok: true, data } | { ok: false, error }
 * 主进程不会把异常堆栈或 SQL 细节透传给界面。
 */

// ============================================================
// 1. IPC 通道
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

export const CONVERSATION_IPC = {
  list: "shiyi:conversation:list",
  create: "shiyi:conversation:create",
  messages: "shiyi:conversation:messages",
  append: "shiyi:conversation:append",
  archive: "shiyi:conversation:archive"
} as const;

// ============================================================
// 2. 结果信封与错误码
// ============================================================

export type IpcErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "VERSION_CONFLICT"
  | "INVALID_STATE"
  | "INTERNAL_ERROR";

export interface IpcError {
  code: IpcErrorCode;
  message: string;
  field?: string;
}

export type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: IpcError };

// ============================================================
// 3. 枚举
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
// 4. Memory DTO
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
// 5. Memory 请求载荷
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
// 6. Memory API
// ============================================================

export interface MemoryApi {
  list(
    query?: MemoryListQueryDto
  ): Promise<IpcResult<PageDto<MemoryDto>>>;

  get(id: string): Promise<IpcResult<MemoryDto>>;

  create(
    input: MemoryCreateDto
  ): Promise<IpcResult<MemoryDto>>;

  update(
    input: MemoryUpdateDto
  ): Promise<IpcResult<MemoryDto>>;

  archive(
    input: MemoryLifecycleDto
  ): Promise<IpcResult<MemoryDto>>;

  restore(
    input: MemoryLifecycleDto
  ): Promise<IpcResult<MemoryDto>>;

  remove(
    input: MemoryLifecycleDto
  ): Promise<IpcResult<MemoryDto>>;

  versions(
    id: string,
    query?: PaginationDto
  ): Promise<IpcResult<PageDto<MemoryVersionDto>>>;

  audit(
    id: string,
    query?: PaginationDto
  ): Promise<IpcResult<PageDto<MemoryAuditDto>>>;
}

// ============================================================
// 7. 对话捕获 DTO（M5.1）
// ============================================================

export type MessageRoleDto = "user" | "assistant" | "system" | "tool";

export type ConversationStatusDto = "active" | "archived";

export interface ConversationDto {
  id: string;
  title: string;
  status: ConversationStatusDto;
  createdAt: string;
  updatedAt: string;
}

export interface MessageDto {
  id: string;
  conversationId: string;
  role: MessageRoleDto;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ConversationApi {
  list(
    query?: PaginationDto
  ): Promise<IpcResult<PageDto<ConversationDto>>>;

  create(input?: {
    title?: string;
  }): Promise<IpcResult<ConversationDto>>;

  messages(
    id: string,
    query?: PaginationDto
  ): Promise<IpcResult<PageDto<MessageDto>>>;

  append(input: {
    conversationId: string;
    role: MessageRoleDto;
    content: string;
    metadata?: Record<string, unknown>;
  }): Promise<IpcResult<MessageDto>>;

  archive(input: {
    id: string;
  }): Promise<IpcResult<ConversationDto>>;
}
