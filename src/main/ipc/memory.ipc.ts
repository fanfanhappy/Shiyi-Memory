/**
 * Shiyi Memory IPC
 *
 * M4.3
 *
 * Main Process 中唯一注册记忆通道的地方。
 *
 * 安全约束：
 * 1. Renderer 不能直接访问数据库，只能通过这里登记的通道。
 * 2. 所有载荷在这里先做结构与类型校验，再交给 Memory Service。
 * 3. 统一返回结果信封，不向界面泄露堆栈、SQL 或文件路径。
 */

import { ipcMain } from "electron";
import type { DatabaseSync } from "node:sqlite";

import {
  MEMORY_IPC,
  type MemoryAuditDto,
  type MemoryCreateDto,
  type MemoryDto,
  type MemoryIpcError,
  type MemoryIpcResult,
  type MemoryLifecycleDto,
  type MemoryMetadataDto,
  type MemoryUpdateDto,
  type MemoryVersionDto,
  type PageDto,
  type PaginationDto
} from "../../shared/ipc";

import {
  createMemoryService,
  MemoryNotFoundError,
  MemoryStateError,
  MemoryVersionConflictError
} from "../services/memory.service";

import {
  MemoryValidationError,
  normalizePagination,
  validateMemoryCreateInput,
  validateMemoryLifecycleInput,
  validateMemoryListQuery,
  validateMemoryUpdateInput
} from "../services/memory.validators";

import type {
  Memory,
  MemoryAudit,
  MemoryMetadata,
  MemoryService,
  MemoryVersion,
  PaginatedResult
} from "../services/memory.types";

// ============================================================
// 1. 注册
// ============================================================

export function registerMemoryIpc(db: DatabaseSync): void {
  const service = createMemoryService(db);

  ipcMain.handle(MEMORY_IPC.list, (_event, payload: unknown) =>
    handle(() => listMemories(service, payload))
  );

  ipcMain.handle(MEMORY_IPC.get, (_event, id: unknown) =>
    handle(() => getMemory(service, id))
  );

  ipcMain.handle(MEMORY_IPC.create, (_event, payload: unknown) =>
    handle(() => createMemory(service, payload))
  );

  ipcMain.handle(MEMORY_IPC.update, (_event, payload: unknown) =>
    handle(() => updateMemory(service, payload))
  );

  ipcMain.handle(MEMORY_IPC.archive, (_event, payload: unknown) =>
    handle(() => archiveMemory(service, payload))
  );

  ipcMain.handle(MEMORY_IPC.restore, (_event, payload: unknown) =>
    handle(() => restoreMemory(service, payload))
  );

  ipcMain.handle(MEMORY_IPC.remove, (_event, payload: unknown) =>
    handle(() => removeMemory(service, payload))
  );

  ipcMain.handle(
    MEMORY_IPC.versions,
    (_event, id: unknown, query: unknown) =>
      handle(() => listVersions(service, id, query))
  );

  ipcMain.handle(
    MEMORY_IPC.audit,
    (_event, id: unknown, query: unknown) =>
      handle(() => listAudit(service, id, query))
  );
}

// ============================================================
// 2. 各通道处理
// ============================================================

function listMemories(
  service: MemoryService,
  payload: unknown
): PageDto<MemoryDto> {
  const query = payload ?? {};

  validateMemoryListQuery(query);

  return toPage(service.list(query), toMemoryDto);
}

function getMemory(
  service: MemoryService,
  id: unknown
): MemoryDto {
  const memoryId = assertId(id);
  const memory = service.getById(memoryId);

  if (!memory) {
    throw new MemoryNotFoundError(memoryId);
  }

  return toMemoryDto(memory);
}

function createMemory(
  service: MemoryService,
  payload: unknown
): MemoryDto {
  validateMemoryCreateInput(payload);

  const input = payload as MemoryCreateDto;

  return toMemoryDto(service.create(input));
}

function updateMemory(
  service: MemoryService,
  payload: unknown
): MemoryDto {
  validateMemoryUpdateInput(payload);

  const input = payload as MemoryUpdateDto;

  return toMemoryDto(service.update(input));
}

function archiveMemory(
  service: MemoryService,
  payload: unknown
): MemoryDto {
  validateMemoryLifecycleInput(payload);

  return toMemoryDto(service.archive(payload as MemoryLifecycleDto));
}

function restoreMemory(
  service: MemoryService,
  payload: unknown
): MemoryDto {
  validateMemoryLifecycleInput(payload);

  return toMemoryDto(service.restore(payload as MemoryLifecycleDto));
}

function removeMemory(
  service: MemoryService,
  payload: unknown
): MemoryDto {
  validateMemoryLifecycleInput(payload);

  return toMemoryDto(service.softDelete(payload as MemoryLifecycleDto));
}

function listVersions(
  service: MemoryService,
  id: unknown,
  query: unknown
): PageDto<MemoryVersionDto> {
  const memoryId = assertId(id);
  const pagination = readPagination(query);

  return toPage(
    service.getVersions(memoryId, pagination),
    toVersionDto
  );
}

function listAudit(
  service: MemoryService,
  id: unknown,
  query: unknown
): PageDto<MemoryAuditDto> {
  const memoryId = assertId(id);
  const pagination = readPagination(query);

  return toPage(service.getAuditLog(memoryId, pagination), toAuditDto);
}

// ============================================================
// 3. 结果信封与错误映射
// ============================================================

function handle<T>(work: () => T): MemoryIpcResult<T> {
  try {
    return { ok: true, data: work() };
  } catch (error) {
    return { ok: false, error: toIpcError(error) };
  }
}

function toIpcError(error: unknown): MemoryIpcError {
  if (error instanceof MemoryValidationError) {
    return {
      code: "VALIDATION_ERROR",
      message: error.message,
      field: error.field
    };
  }

  if (error instanceof MemoryNotFoundError) {
    return { code: "NOT_FOUND", message: error.message };
  }

  if (error instanceof MemoryVersionConflictError) {
    return { code: "VERSION_CONFLICT", message: error.message };
  }

  if (error instanceof MemoryStateError) {
    return { code: "INVALID_STATE", message: error.message };
  }

  // 未预期的错误只记录在主进程日志中，界面拿到通用提示。
  console.error("[Shiyi] memory ipc failed:", error);

  return {
    code: "INTERNAL_ERROR",
    message: "记忆操作失败，请稍后重试"
  };
}

// ============================================================
// 4. 入参校验
// ============================================================

function assertId(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new MemoryValidationError("id", "记忆 ID 不能为空");
  }

  if (value.length > 128) {
    throw new MemoryValidationError("id", "记忆 ID 不能超过 128 个字符");
  }

  return value;
}

function readPagination(value: unknown): PaginationDto {
  if (value === undefined || value === null) {
    return {};
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new MemoryValidationError("query", "分页参数必须是对象");
  }

  const record = value as Record<string, unknown>;

  for (const key of Object.keys(record)) {
    if (key !== "page" && key !== "pageSize") {
      throw new MemoryValidationError(`query.${key}`, "不支持的分页字段");
    }
  }

  const page = record.page as number | undefined;
  const pageSize = record.pageSize as number | undefined;

  normalizePagination({ page, pageSize });

  return { page, pageSize };
}

// ============================================================
// 5. 领域模型 → DTO
// ============================================================

function toMetadataDto(metadata: MemoryMetadata): MemoryMetadataDto {
  return { ...metadata };
}

function toMemoryDto(memory: Memory): MemoryDto {
  return {
    id: memory.id,
    content: memory.content,
    summary: memory.summary,
    contentCategory: memory.contentCategory,
    importance: memory.importance,
    source: memory.source,
    status: memory.status,
    version: memory.version,
    metadata: toMetadataDto(memory.metadata),
    createdAt: memory.createdAt,
    updatedAt: memory.updatedAt,
    lastAccessedAt: memory.lastAccessedAt
  };
}

function toVersionDto(version: MemoryVersion): MemoryVersionDto {
  return {
    id: version.id,
    memoryId: version.memoryId,
    version: version.version,
    content: version.content,
    summary: version.summary,
    contentCategory: version.contentCategory,
    importance: version.importance,
    source: version.source,
    status: version.status,
    metadata: toMetadataDto(version.metadata),
    changeReason: version.changeReason,
    createdAt: version.createdAt
  };
}

function toAuditDto(audit: MemoryAudit): MemoryAuditDto {
  return {
    id: audit.id,
    memoryId: audit.memoryId,
    operation: audit.operation,
    oldValue: audit.oldValue,
    newValue: audit.newValue,
    reason: audit.reason,
    createdAt: audit.createdAt
  };
}

function toPage<TIn, TOut>(
  page: PaginatedResult<TIn>,
  map: (item: TIn) => TOut
): PageDto<TOut> {
  return {
    items: page.items.map(map),
    page: page.page,
    pageSize: page.pageSize,
    totalItems: page.totalItems,
    totalPages: page.totalPages,
    hasNextPage: page.hasNextPage,
    hasPreviousPage: page.hasPreviousPage
  };
}
