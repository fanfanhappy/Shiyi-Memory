/**
 * Shiyi Conversation Service
 *
 * M5.1：对话捕获
 *
 * 责任：
 * 1. 会话与消息的本地持久化（自动捕获原始对话）。
 * 2. 不调用任何模型，不做记忆提取，只保证证据完整。
 * 3. 所有入参先校验，再写库。
 */

import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

import { getDatabase } from "../database/connection";
import {
  normalizePagination
} from "./memory.validators";
import type {
  PaginatedResult,
  PaginationQuery
} from "./memory.types";
import {
  CONVERSATION_STATUSES,
  MESSAGE_ROLES,
  type Conversation,
  type ConversationCreateInput,
  type ConversationRow,
  type ConversationService,
  type ConversationStatus,
  type Message,
  type MessageAppendInput,
  type MessageRole,
  type MessageRow
} from "./conversation.types";

// ============================================================
// 1. 错误
// ============================================================

export class ConversationNotFoundError extends Error {
  constructor(public readonly conversationId: string) {
    super(`会话不存在：${conversationId}`);
    this.name = "ConversationNotFoundError";
  }
}

export class ConversationValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string
  ) {
    super(`${field}: ${message}`);
    this.name = "ConversationValidationError";
  }
}

// ============================================================
// 2. 工具
// ============================================================

function nowIso(): string {
  return new Date().toISOString();
}

function parseMetadata(json: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(json);
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function toConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    metadata: parseMetadata(row.metadata_json),
    createdAt: row.created_at
  };
}

function assertConversationId(value: unknown): asserts value is string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ConversationValidationError("conversationId", "会话 ID 不能为空");
  }

  if (value.length > 128) {
    throw new ConversationValidationError(
      "conversationId",
      "会话 ID 不能超过 128 个字符"
    );
  }
}

function assertTitle(value: unknown): asserts value is string | undefined {
  if (value === undefined) return;

  if (typeof value !== "string") {
    throw new ConversationValidationError("title", "标题必须是字符串");
  }

  if (value.length > 120) {
    throw new ConversationValidationError("title", "标题不能超过 120 个字符");
  }
}

function assertRole(value: unknown): asserts value is MessageRole {
  if (
    typeof value !== "string" ||
    !(MESSAGE_ROLES as readonly string[]).includes(value)
  ) {
    throw new ConversationValidationError("role", "不支持的消息角色");
  }
}

function assertContent(value: unknown): asserts value is string {
  if (typeof value !== "string") {
    throw new ConversationValidationError("content", "消息内容必须是字符串");
  }

  if (!value.trim()) {
    throw new ConversationValidationError("content", "消息内容不能为空");
  }

  if (value.length > 100000) {
    throw new ConversationValidationError(
      "content",
      "消息内容不能超过 100000 个字符"
    );
  }
}

function assertMetadata(
  value: unknown
): asserts value is Record<string, unknown> | undefined {
  if (value === undefined) return;

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ConversationValidationError("metadata", "元数据必须是对象");
  }
}

// ============================================================
// 3. 实现
// ============================================================

const DEFAULT_TITLE = "新对话";

export class SqliteConversationService implements ConversationService {
  constructor(private readonly db: DatabaseSync = getDatabase()) {}

  create(input: ConversationCreateInput = {}): Conversation {
    const title = input.title?.trim() || DEFAULT_TITLE;
    assertTitle(title);

    const id = randomUUID();
    const timestamp = nowIso();

    this.db
      .prepare(
        `INSERT INTO conversations (id, title, created_at, updated_at, status)
         VALUES (?, ?, ?, ?, 'active')`
      )
      .run(id, title, timestamp, timestamp);

    return this.getByIdOrThrow(id);
  }

  getById(id: string): Conversation | null {
    assertConversationId(id);

    const row = this.db
      .prepare("SELECT * FROM conversations WHERE id = ?")
      .get(id) as ConversationRow | undefined;

    return row ? toConversation(row) : null;
  }

  list(query: PaginationQuery = {}): PaginatedResult<Conversation> {
    const { page, pageSize, offset } = normalizePagination(query);

    const total = this.db
      .prepare("SELECT COUNT(*) AS total FROM conversations")
      .get() as { total: number };

    const rows = this.db
      .prepare(
        `SELECT * FROM conversations
          ORDER BY updated_at DESC, rowid DESC
          LIMIT ? OFFSET ?`
      )
      .all(pageSize, offset) as unknown as ConversationRow[];

    const totalPages = Math.ceil(total.total / pageSize);

    return {
      items: rows.map(toConversation),
      page,
      pageSize,
      totalItems: total.total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1 && total.total > 0
    };
  }

  appendMessage(input: MessageAppendInput): Message {
    assertConversationId(input.conversationId);
    assertRole(input.role);
    assertContent(input.content);
    assertMetadata(input.metadata);

    const conversation = this.getByIdOrThrow(input.conversationId);
    const timestamp = nowIso();
    const id = randomUUID();

    this.db.exec("BEGIN IMMEDIATE");

    try {
      this.db
        .prepare(
          `INSERT INTO messages (
             id, conversation_id, role, content, metadata_json, created_at
           ) VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          conversation.id,
          input.role,
          input.content,
          JSON.stringify(input.metadata ?? {}),
          timestamp
        );

      // 第一条用户消息自动作为会话标题。
      const nextTitle =
        conversation.title === DEFAULT_TITLE && input.role === "user"
          ? buildTitle(input.content)
          : conversation.title;

      this.db
        .prepare(
          `UPDATE conversations
              SET title = ?, updated_at = ?
            WHERE id = ?`
        )
        .run(nextTitle, timestamp, conversation.id);

      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }

    const row = this.db
      .prepare("SELECT * FROM messages WHERE id = ?")
      .get(id) as unknown as MessageRow;

    return toMessage(row);
  }

  getMessages(
    conversationId: string,
    query: PaginationQuery = {}
  ): PaginatedResult<Message> {
    assertConversationId(conversationId);
    this.getByIdOrThrow(conversationId);

    const { page, pageSize, offset } = normalizePagination(query);

    const total = this.db
      .prepare(
        "SELECT COUNT(*) AS total FROM messages WHERE conversation_id = ?"
      )
      .get(conversationId) as { total: number };

    const rows = this.db
      .prepare(
        `SELECT * FROM messages
          WHERE conversation_id = ?
          ORDER BY created_at ASC, rowid ASC
          LIMIT ? OFFSET ?`
      )
      .all(conversationId, pageSize, offset) as unknown as MessageRow[];

    const totalPages = Math.ceil(total.total / pageSize);

    return {
      items: rows.map(toMessage),
      page,
      pageSize,
      totalItems: total.total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1 && total.total > 0
    };
  }

  archive(id: string): Conversation {
    assertConversationId(id);
    this.getByIdOrThrow(id);

    const status: ConversationStatus = "archived";

    if (!(CONVERSATION_STATUSES as readonly string[]).includes(status)) {
      throw new ConversationValidationError("status", "不支持的会话状态");
    }

    this.db
      .prepare(
        `UPDATE conversations
            SET status = ?, updated_at = ?
          WHERE id = ?`
      )
      .run(status, nowIso(), id);

    return this.getByIdOrThrow(id);
  }

  private getByIdOrThrow(id: string): Conversation {
    const conversation = this.getById(id);

    if (!conversation) {
      throw new ConversationNotFoundError(id);
    }

    return conversation;
  }
}

function buildTitle(content: string): string {
  const firstLine = content.trim().split(/\r?\n/)[0] ?? content.trim();
  return firstLine.length > 24 ? `${firstLine.slice(0, 24)}…` : firstLine;
}

// ============================================================
// 4. 工厂
// ============================================================

export function createConversationService(
  db: DatabaseSync = getDatabase()
): ConversationService {
  return new SqliteConversationService(db);
}
