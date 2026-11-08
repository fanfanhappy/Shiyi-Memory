import {
  FACT_KINDS,
  MEMORY_COGNITIVE_TYPES,
  MEMORY_CONTENT_CATEGORIES,
  MEMORY_SCOPES,
  MEMORY_SOURCES,
  PERSISTED_MEMORY_STATUSES,
  type MemoryCreateInput,
  type MemoryUpdateInput,
  type MemoryLifecycleInput,
  type MemoryListQuery,
  type MemoryMetadata,
  type PaginationQuery
} from "./memory.types";

export class MemoryValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string
  ) {
    super(`${field}: ${message}`);
    this.name = "MemoryValidationError";
  }
}

function fail(field: string, message: string): never {
  throw new MemoryValidationError(field, message);
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function assertRecord(
  value: unknown,
  field: string
): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    fail(field, "必须是对象");
  }
}

function assertKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  field: string
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      fail(`${field}.${key}`, "不支持的字段");
    }
  }
}

function assertString(
  value: unknown,
  field: string,
  maxLength = 10000,
  allowEmpty = false
): asserts value is string {
  if (typeof value !== "string") {
    fail(field, "必须是字符串");
  }

  if (!allowEmpty && !value.trim()) {
    fail(field, "不能为空");
  }

  if (value.length > maxLength) {
    fail(field, `不能超过 ${maxLength} 个字符`);
  }
}

function assertEnum(
  value: unknown,
  allowed: readonly string[],
  field: string
): void {
  if (
    typeof value !== "string" ||
    !allowed.includes(value)
  ) {
    fail(field, "包含不支持的类型");
  }
}

function assertNumber(
  value: unknown,
  field: string,
  min: number,
  max: number,
  integer = false
): void {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  ) {
    fail(field, `必须在 ${min}–${max} 范围内`);
  }
}

function assertDate(
  value: unknown,
  field: string
): asserts value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    fail(field, "必须是有效的 ISO 日期");
  }
}

function assertOptionalString(
  value: unknown,
  field: string,
  maxLength = 10000,
  allowNull = false
): void {
  if (value === undefined) return;
  if (value === null && allowNull) return;
  assertString(value, field, maxLength, true);
}

function assertJsonValue(
  value: unknown,
  field: string,
  stack = new WeakSet<object>()
): void {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) return;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      fail(field, "JSON 不允许非有限数字");
    }
    return;
  }

  if (typeof value !== "object") {
    fail(field, "包含无法序列化的 JSON 值");
  }

  if (stack.has(value)) {
    fail(field, "不允许循环引用");
  }

  stack.add(value);

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      assertJsonValue(item, `${field}[${index}]`, stack);
    });
  } else {
    const prototype = Object.getPrototypeOf(value);

    if (
      prototype !== Object.prototype &&
      prototype !== null
    ) {
      fail(field, "只允许普通 JSON 对象");
    }

    for (const [key, item] of Object.entries(value)) {
      assertJsonValue(item, `${field}.${key}`, stack);
    }
  }

  stack.delete(value);
}

const METADATA_KEYS = [
  "cognitiveType",
  "scope",
  "scopeId",
  "factKind",
  "confidence",
  "importanceScore",
  "sensitivity",
  "validFrom",
  "validUntil",
  "sourceConversationId",
  "sourceMessageIds",
  "custom"
] as const;

export function validateMemoryMetadata(
  value: unknown
): asserts value is MemoryMetadata {
  assertRecord(value, "metadata");
  assertKeys(value, METADATA_KEYS, "metadata");

  const m = value;

  if (m.cognitiveType !== undefined) {
    assertEnum(m.cognitiveType, MEMORY_COGNITIVE_TYPES, "metadata.cognitiveType");
  }

  if (m.scope !== undefined) {
    assertEnum(m.scope, MEMORY_SCOPES, "metadata.scope");
  }

  if (m.factKind !== undefined) {
    assertEnum(m.factKind, FACT_KINDS, "metadata.factKind");
  }

  if (m.scopeId !== undefined) {
    assertString(m.scopeId, "metadata.scopeId", 256);
  }

  if (m.confidence !== undefined) {
    assertNumber(m.confidence, "metadata.confidence", 0, 1);
  }

  if (m.importanceScore !== undefined) {
    assertNumber(m.importanceScore, "metadata.importanceScore", 0, 100);
  }

  if (m.sensitivity !== undefined) {
    assertString(m.sensitivity, "metadata.sensitivity", 64);
  }

  for (const field of ["validFrom", "validUntil"] as const) {
    if (m[field] !== undefined) {
      assertDate(m[field], `metadata.${field}`);
    }
  }

  if (
    m.validFrom !== undefined &&
    m.validUntil !== undefined &&
    Date.parse(m.validFrom as string) >
      Date.parse(m.validUntil as string)
  ) {
    fail("metadata", "validFrom 不能晚于 validUntil");
  }

  if (m.sourceConversationId !== undefined) {
    assertString(m.sourceConversationId, "metadata.sourceConversationId", 128);
  }

  if (m.sourceMessageIds !== undefined) {
    if (!Array.isArray(m.sourceMessageIds)) {
      fail("metadata.sourceMessageIds", "必须是数组");
    }

    m.sourceMessageIds.forEach((id, index) => {
      assertString(id, `metadata.sourceMessageIds[${index}]`, 128);
    });
  }

  if (m.custom !== undefined) {
    assertRecord(m.custom, "metadata.custom");
    assertJsonValue(m.custom, "metadata.custom");

    const serialized = JSON.stringify(m.custom);

    if (!serialized || serialized.length > 100000) {
      fail("metadata.custom", "扩展数据过大");
    }
  }
}

export function validateMemoryMetadataPatch(
  value: unknown
): asserts value is Partial<MemoryMetadata> {
  validateMemoryMetadata(value);
}

export function validateMemoryCreateInput(
  input: unknown
): asserts input is MemoryCreateInput {
  assertRecord(input, "input");

  assertKeys(
    input,
    ["content", "summary", "contentCategory", "importance", "source", "metadata"],
    "input"
  );

  assertString(input.content, "content", 100000);

  assertOptionalString(input.summary, "summary", 5000, true);

  if (input.contentCategory !== undefined) {
    assertEnum(input.contentCategory, MEMORY_CONTENT_CATEGORIES, "contentCategory");
  }

  if (input.importance !== undefined) {
    assertNumber(input.importance, "importance", 1, 5, true);
  }

  if (input.source !== undefined) {
    assertEnum(input.source, MEMORY_SOURCES, "source");
  }

  if (input.metadata !== undefined) {
    validateMemoryMetadata(input.metadata);
  }
}

export function validateMemoryUpdateInput(
  input: unknown
): asserts input is MemoryUpdateInput {
  assertRecord(input, "input");

  assertKeys(input, ["id", "patch", "reason", "expectedVersion"], "input");

  assertString(input.id, "id", 128);

  assertRecord(input.patch, "patch");

  const patch = input.patch;

  assertKeys(
    patch,
    ["content", "summary", "contentCategory", "importance", "metadata"],
    "patch"
  );

  if (Object.keys(patch).length === 0) {
    fail("patch", "更新内容不能为空");
  }

  if (patch.content !== undefined) {
    assertString(patch.content, "patch.content", 100000);
  }

  assertOptionalString(patch.summary, "patch.summary", 5000, true);

  if (patch.contentCategory !== undefined) {
    assertEnum(patch.contentCategory, MEMORY_CONTENT_CATEGORIES, "patch.contentCategory");
  }

  if (patch.importance !== undefined) {
    assertNumber(patch.importance, "patch.importance", 1, 5, true);
  }

  if (patch.metadata !== undefined) {
    validateMemoryMetadataPatch(patch.metadata);
  }

  if (input.reason !== undefined) {
    assertString(input.reason, "reason", 2000);
  }

  if (input.expectedVersion !== undefined) {
    assertNumber(input.expectedVersion, "expectedVersion", 1, Number.MAX_SAFE_INTEGER, true);
  }
}

export function validateMemoryLifecycleInput(
  input: unknown
): asserts input is MemoryLifecycleInput {
  assertRecord(input, "input");

  assertKeys(input, ["id", "reason", "expectedVersion"], "input");

  assertString(input.id, "id", 128);

  if (input.reason !== undefined) {
    assertString(input.reason, "reason", 2000);
  }

  if (input.expectedVersion !== undefined) {
    assertNumber(input.expectedVersion, "expectedVersion", 1, Number.MAX_SAFE_INTEGER, true);
  }
}

export interface NormalizedPagination {
  page: number;
  pageSize: number;
  offset: number;
}

export function normalizePagination(
  query?: PaginationQuery
): NormalizedPagination {
  const page = query?.page ?? 1;
  const pageSize = query?.pageSize ?? 20;

  assertNumber(page, "page", 1, Number.MAX_SAFE_INTEGER, true);
  assertNumber(pageSize, "pageSize", 1, 100, true);

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize
  };
}

export function validateMemoryListQuery(
  query: unknown = {}
): asserts query is MemoryListQuery {
  assertRecord(query, "query");

  assertKeys(
    query,
    [
      "search", "contentCategory", "cognitiveType",
      "scope", "scopeId", "factKind", "status", "source",
      "importanceMin", "importanceMax", "tag", "entityId",
      "createdFrom", "createdTo", "updatedFrom", "updatedTo",
      "page", "pageSize", "sortBy", "sortDirection"
    ],
    "query"
  );

  normalizePagination(query as PaginationQuery);

  if (query.search !== undefined) {
    assertString(query.search, "search", 500, true);
  }

  if (query.contentCategory !== undefined) {
    const values = Array.isArray(query.contentCategory)
      ? query.contentCategory
      : [query.contentCategory];

    if (values.length === 0) fail("contentCategory", "筛选数组不能为空");

    values.forEach(v => assertEnum(v, MEMORY_CONTENT_CATEGORIES, "contentCategory"));
  }

  if (query.cognitiveType !== undefined) {
    assertEnum(query.cognitiveType, MEMORY_COGNITIVE_TYPES, "cognitiveType");
  }

  if (query.scope !== undefined) {
    assertEnum(query.scope, MEMORY_SCOPES, "scope");
  }

  if (query.scopeId !== undefined) {
    assertString(query.scopeId, "scopeId", 256);
  }

  if (query.factKind !== undefined) {
    assertEnum(query.factKind, FACT_KINDS, "factKind");
  }

  if (query.status !== undefined) {
    const values = Array.isArray(query.status)
      ? query.status
      : [query.status];

    if (values.length === 0) fail("status", "筛选数组不能为空");

    values.forEach(v => assertEnum(v, PERSISTED_MEMORY_STATUSES, "status"));
  }

  if (query.source !== undefined) {
    assertEnum(query.source, MEMORY_SOURCES, "source");
  }

  if (query.importanceMin !== undefined) {
    assertNumber(query.importanceMin, "importanceMin", 1, 5, true);
  }

  if (query.importanceMax !== undefined) {
    assertNumber(query.importanceMax, "importanceMax", 1, 5, true);
  }

  if (
    query.importanceMin !== undefined &&
    query.importanceMax !== undefined &&
    (query.importanceMin as number) > (query.importanceMax as number)
  ) {
    fail("importance", "最小重要性不能大于最大重要性");
  }

  for (const field of ["tag", "entityId"] as const) {
    if (query[field] !== undefined) {
      assertString(query[field], field, 256);
    }
  }

  for (const field of [
    "createdFrom", "createdTo", "updatedFrom", "updatedTo"
  ] as const) {
    if (query[field] !== undefined) {
      assertDate(query[field], field);
    }
  }

  if (query.sortBy !== undefined) {
    assertEnum(
      query.sortBy,
      ["createdAt", "updatedAt", "importance", "lastAccessedAt"],
      "sortBy"
    );
  }

  if (query.sortDirection !== undefined) {
    assertEnum(query.sortDirection, ["asc", "desc"], "sortDirection");
  }
}
