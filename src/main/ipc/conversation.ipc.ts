/**
 * Shiyi Conversation IPC
 *
 * M5.1
 *
 * 对话通道：只负责捕获与读取原始对话，不做记忆提取。
 */

import { ipcMain } from "electron";
import type { DatabaseSync } from "node:sqlite";

import {
  CONVERSATION_IPC,
  type ConversationDto,
  type IpcError,
  type IpcResult,
  type MessageDto,
  type MessageRoleDto,
  type PageDto,
  type PaginationDto
} from "../../shared/ipc";

import {
  ConversationNotFoundError,
  ConversationValidationError,
  createConversationService
} from "../services/conversation.service";

import type {
  Conversation,
  ConversationService,
  Message
} from "../services/conversation.types";

import type { PaginatedResult } from "../services/memory.types";
import { normalizePagination } from "../services/memory.validators";

export function registerConversationIpc(db: DatabaseSync): void {
  const service = createConversationService(db);

  ipcMain.handle(CONVERSATION_IPC.list, (_event, payload: unknown) =>
    handle(() => listConversations(service, payload))
  );

  ipcMain.handle(CONVERSATION_IPC.create, (_event, payload: unknown) =>
    handle(() => createConversation(service, payload))
  );

  ipcMain.handle(
    CONVERSATION_IPC.messages,
    (_event, id: unknown, query: unknown) =>
      handle(() => listMessages(service, id, query))
  );

  ipcMain.handle(CONVERSATION_IPC.append, (_event, payload: unknown) =>
    handle(() => appendMessage(service, payload))
  );

  ipcMain.handle(CONVERSATION_IPC.archive, (_event, payload: unknown) =>
    handle(() => archiveConversation(service, payload))
  );
}

// ============================================================
// 处理函数
// ============================================================

function listConversations(
  service: ConversationService,
  payload: unknown
): PageDto<ConversationDto> {
  const pagination = readPagination(payload);
  return toPage(service.list(pagination), toConversationDto);
}

function createConversation(
  service: ConversationService,
  payload: unknown
): ConversationDto {
  const title = readOptionalTitle(payload);
  return toConversationDto(service.create({ title }));
}

function listMessages(
  service: ConversationService,
  id: unknown,
  query: unknown
): PageDto<MessageDto> {
  const conversationId = readId(id);
  const pagination = readPagination(query);

  return toPage(
    service.getMessages(conversationId, pagination),
    toMessageDto
  );
}

function appendMessage(
  service: ConversationService,
  payload: unknown
): MessageDto {
  if (typeof payload !== "object" || payload === null) {
    throw new ConversationValidationError("input", "消息载荷必须是对象");
  }

  const record = payload as Record<string, unknown>;

  return toMessageDto(
    service.appendMessage({
      conversationId: readId(record.conversationId),
      role: record.role as MessageRoleDto,
      content: typeof record.content === "string" ? record.content : "",
      metadata:
        typeof record.metadata === "object" &&
        record.metadata !== null &&
        !Array.isArray(record.metadata)
          ? (record.metadata as Record<string, unknown>)
          : undefined
    })
  );
}

function archiveConversation(
  service: ConversationService,
  payload: unknown
): ConversationDto {
  if (typeof payload !== "object" || payload === null) {
    throw new ConversationValidationError("input", "会话载荷必须是对象");
  }

  const record = payload as Record<string, unknown>;

  return toConversationDto(service.archive(readId(record.id)));
}

// ============================================================
// 校验
// ============================================================

function readId(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ConversationValidationError("id", "ID 不能为空");
  }

  if (value.length > 128) {
    throw new ConversationValidationError("id", "ID 不能超过 128 个字符");
  }

  return value;
}

function readOptionalTitle(payload: unknown): string | undefined {
  if (payload === undefined || payload === null) return undefined;

  if (typeof payload !== "object" || Array.isArray(payload)) {
    throw new ConversationValidationError("input", "载荷必须是对象");
  }

  const record = payload as Record<string, unknown>;

  for (const key of Object.keys(record)) {
    if (key !== "title") {
      throw new ConversationValidationError(`input.${key}`, "不支持的字段");
    }
  }

  if (record.title === undefined) return undefined;

  if (typeof record.title !== "string") {
    throw new ConversationValidationError("title", "标题必须是字符串");
  }

  return record.title;
}

function readPagination(value: unknown): PaginationDto {
  if (value === undefined || value === null) return {};

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new ConversationValidationError("query", "分页参数必须是对象");
  }

  const record = value as Record<string, unknown>;

  for (const key of Object.keys(record)) {
    if (key !== "page" && key !== "pageSize") {
      throw new ConversationValidationError(
        `query.${key}`,
        "不支持的分页字段"
      );
    }
  }

  const page = record.page as number | undefined;
  const pageSize = record.pageSize as number | undefined;

  try {
    normalizePagination({ page, pageSize });
  } catch {
    throw new ConversationValidationError("query", "分页参数不合法");
  }

  return { page, pageSize };
}

// ============================================================
// 信封与映射
// ============================================================

function handle<T>(work: () => T): IpcResult<T> {
  try {
    return { ok: true, data: work() };
  } catch (error) {
    return { ok: false, error: toIpcError(error) };
  }
}

function toIpcError(error: unknown): IpcError {
  if (error instanceof ConversationValidationError) {
    return {
      code: "VALIDATION_ERROR",
      message: error.message,
      field: error.field
    };
  }

  if (error instanceof ConversationNotFoundError) {
    return { code: "NOT_FOUND", message: error.message };
  }

  console.error("[Shiyi] conversation ipc failed:", error);

  return {
    code: "INTERNAL_ERROR",
    message: "对话操作失败，请稍后重试"
  };
}

function toConversationDto(conversation: Conversation): ConversationDto {
  return {
    id: conversation.id,
    title: conversation.title,
    status: conversation.status,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt
  };
}

function toMessageDto(message: Message): MessageDto {
  return {
    id: message.id,
    conversationId: message.conversationId,
    role: message.role,
    content: message.content,
    metadata: message.metadata,
    createdAt: message.createdAt
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
