/**
 * Shiyi Conversation Types
 *
 * M5.1
 *
 * 原始对话是记忆的证据来源：
 * conversations / messages 一旦写入，不随记忆更新而变化。
 */

import type {
  PaginatedResult,
  PaginationQuery
} from "./memory.types";

// ============================================================
// 1. 枚举
// ============================================================

export const MESSAGE_ROLES = [
  "user",
  "assistant",
  "system",
  "tool"
] as const;

export type MessageRole = (typeof MESSAGE_ROLES)[number];

export const CONVERSATION_STATUSES = [
  "active",
  "archived"
] as const;

export type ConversationStatus =
  (typeof CONVERSATION_STATUSES)[number];

// ============================================================
// 2. 领域模型
// ============================================================

export interface Conversation {
  id: string;
  title: string;
  status: ConversationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ============================================================
// 3. SQLite Row
// ============================================================

export interface ConversationRow {
  id: string;
  title: string;
  status: ConversationStatus;
  created_at: string;
  updated_at: string;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  metadata_json: string;
  created_at: string;
}

// ============================================================
// 4. 输入
// ============================================================

export interface ConversationCreateInput {
  title?: string;
}

export interface MessageAppendInput {
  conversationId: string;
  role: MessageRole;
  content: string;
  metadata?: Record<string, unknown>;
}

// ============================================================
// 5. 服务接口
// ============================================================

export interface ConversationService {
  create(input?: ConversationCreateInput): Conversation;

  getById(id: string): Conversation | null;

  list(
    query?: PaginationQuery
  ): PaginatedResult<Conversation>;

  appendMessage(input: MessageAppendInput): Message;

  getMessages(
    conversationId: string,
    query?: PaginationQuery
  ): PaginatedResult<Message>;

  archive(id: string): Conversation;
}
