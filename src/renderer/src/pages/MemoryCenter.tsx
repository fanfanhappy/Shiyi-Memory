import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  Archive,
  Brain,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  X
} from "lucide-react";

import type {
  MemoryAuditDto,
  MemoryContentCategoryDto,
  MemoryDto,
  MemoryListQueryDto,
  MemoryVersionDto
} from "../../../shared/ipc";

import {
  AUDIT_LABELS,
  CATEGORY_LABELS,
  COGNITIVE_LABELS,
  FACT_KIND_LABELS,
  SCOPE_LABELS,
  SOURCE_LABELS,
  STATUS_LABELS,
  formatRelativeTime
} from "../memoryLabels";

// ============================================================
// 展示用语
// ============================================================

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS) as Array<
  [MemoryContentCategoryDto, string]
>;

type StatusFilter = "active" | "archived" | "deleted";

const STATUS_TABS: Array<{ id: StatusFilter; label: string }> = [
  { id: "active", label: "生效中" },
  { id: "archived", label: "已归档" },
  { id: "deleted", label: "已删除" }
];

// ============================================================
// 页面
// ============================================================

interface MemoryCenterProps {
  onChanged: () => void;
}

export default function MemoryCenter({ onChanged }: MemoryCenterProps) {
  const [items, setItems] = useState<MemoryDto[]>([]);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [category, setCategory] = useState<
    MemoryContentCategoryDto | "all"
  >("all");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);

  const [detail, setDetail] = useState<MemoryDto | null>(null);
  const [detailTab, setDetailTab] = useState<"versions" | "audit">(
    "versions"
  );
  const [versions, setVersions] = useState<MemoryVersionDto[]>([]);
  const [audit, setAudit] = useState<MemoryAuditDto[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const closeDetail = useCallback(() => {
    setDetail(null);
    setDetailError(null);
  }, []);

  useEffect(() => {
    if (!detail) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeDetail();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [detail, closeDetail]);

  async function openDetail(memory: MemoryDto) {
    setDetail(memory);
    setDetailTab("versions");
    setDetailLoading(true);
    setDetailError(null);
    setVersions([]);
    setAudit([]);

    const [versionResult, auditResult] = await Promise.all([
      window.shiyi.memory.versions(memory.id, { pageSize: 50 }),
      window.shiyi.memory.audit(memory.id, { pageSize: 50 })
    ]);

    if (versionResult.ok) {
      setVersions(versionResult.data.items);
    } else {
      setDetailError(versionResult.error.message);
    }

    if (auditResult.ok) {
      setAudit(auditResult.data.items);
    } else {
      setDetailError(auditResult.error.message);
    }

    setDetailLoading(false);
  }

  const reload = useCallback(() => {
    setRevision((current) => current + 1);
  }, []);

  // 搜索输入防抖，避免每敲一个字就查一次数据库。
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);

    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const api = window.shiyi?.memory;

      if (!api) {
        setError("记忆服务未连接：请在桌面应用中打开。");
        setLoading(false);
        return;
      }

      setLoading(true);

      const query: MemoryListQueryDto = {
        pageSize: 100,
        sortBy: "updatedAt",
        sortDirection: "desc",
        status
      };

      if (debouncedSearch) query.search = debouncedSearch;
      if (category !== "all") query.contentCategory = category;

      const result = await api.list(query);

      if (cancelled) return;

      if (result.ok) {
        setItems(result.data.items);
        setTotal(result.data.totalItems);
        setError(null);
      } else {
        setError(result.error.message);
      }

      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, status, category, revision]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const content = draft.trim();
    if (!content || saving) return;

    setSaving(true);

    const result = await window.shiyi.memory.create({
      content,
      source: "manual"
    });

    setSaving(false);

    if (result.ok) {
      setDraft("");
      setStatus("active");
      reload();
      onChanged();
    } else {
      setError(result.error.message);
    }
  }

  async function handleLifecycle(
    memory: MemoryDto,
    action: "archive" | "restore" | "remove"
  ) {
    if (action === "remove") {
      const confirmed = window.confirm(
        "确认删除这条记忆？删除后仍可在历史版本中追溯。"
      );

      if (!confirmed) return;
    }

    const api = window.shiyi.memory;
    const payload = { id: memory.id, expectedVersion: memory.version };

    const result =
      action === "archive"
        ? await api.archive(payload)
        : action === "restore"
          ? await api.restore(payload)
          : await api.remove(payload);

    if (result.ok) {
      reload();
      onChanged();
    } else {
      setError(result.error.message);
    }
  }

  return (
    <section className="memory-center">
      <header className="memory-center-head">
        <div>
          <span className="eyebrow">MEMORY SPACE</span>
          <h1>记忆中心</h1>
          <p>这里保存拾忆真正记住的内容，全部存放在本地 SQLite。</p>
        </div>

        <div className="memory-head-actions">
          <span className="memory-storage-badge">
            <i /> 本地 SQLite
          </span>
          <button
            type="button"
            className="memory-refresh"
            onClick={reload}
            title="刷新记忆"
            aria-label="刷新记忆"
          >
            <RefreshCw size={15} className={loading ? "spinning" : ""} />
          </button>
        </div>
      </header>

      <form className="memory-create" onSubmit={handleCreate}>
        <textarea
          rows={2}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="手动写入一条记忆，例如：拾忆确定使用 SQLite 作为唯一记忆事实源。"
          maxLength={100000}
        />
        <div className="memory-create-actions">
          <small>手动写入 · 会记录版本与来源</small>
          <button
            type="submit"
            className="memory-create-button"
            disabled={!draft.trim() || saving}
          >
            <Plus size={15} />
            {saving ? "保存中" : "保存记忆"}
          </button>
        </div>
      </form>

      <div className="memory-toolbar">
        <label className="memory-search">
          <Search size={15} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索记忆内容..."
            maxLength={500}
          />
        </label>

        <select
          className="memory-select"
          value={category}
          onChange={(event) =>
            setCategory(
              event.target.value as MemoryContentCategoryDto | "all"
            )
          }
          aria-label="按内容分类筛选"
        >
          <option value="all">全部分类</option>
          {CATEGORY_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <div className="memory-tabs">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`memory-tab ${status === tab.id ? "active" : ""}`}
              onClick={() => setStatus(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="memory-error" role="alert">
          {error}
        </div>
      )}

      <div className="memory-result-bar">
        <span>
          {loading ? "正在读取本地记忆…" : `共 ${total} 条`}
        </span>
        {debouncedSearch && <span>搜索：{debouncedSearch}</span>}
      </div>

      {loading && items.length === 0 ? (
        <div className="memory-skeleton">
          <span />
          <span />
          <span />
        </div>
      ) : items.length === 0 ? (
        <div className="memory-empty">
          <Brain size={22} strokeWidth={1.6} />
          <strong>这里还没有记忆</strong>
          <p>
            {debouncedSearch
              ? "换一个关键词试试。"
              : "在上方手动写入一条，或等对话接入后由拾忆自动沉淀。"}
          </p>
        </div>
      ) : (
        <div className="memory-list">
          {items.map((memory) => (
            <article
              className="memory-entry"
              key={memory.id}
              role="button"
              tabIndex={0}
              onClick={() => void openDetail(memory)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void openDetail(memory);
                }
              }}
            >
              <div className="memory-entry-head">
                <span className={`memory-chip ${memory.contentCategory}`}>
                  {CATEGORY_LABELS[memory.contentCategory]}
                </span>

                {memory.metadata.cognitiveType && (
                  <span className="memory-chip ghost">
                    {COGNITIVE_LABELS[memory.metadata.cognitiveType]}
                  </span>
                )}

                <span className={`memory-state ${memory.status}`}>
                  {STATUS_LABELS[memory.status]}
                </span>

                <span
                  className="memory-importance"
                  title={`重要性 ${memory.importance} / 5`}
                >
                  {Array.from({ length: 5 }, (_, index) => (
                    <i
                      key={index}
                      className={index < memory.importance ? "on" : ""}
                    />
                  ))}
                </span>
              </div>

              <p className="memory-entry-content">{memory.content}</p>

              <div className="memory-entry-meta">
                <span>v{memory.version}</span>
                <span>{formatRelativeTime(memory.updatedAt)}</span>

                <div
                  className="memory-entry-actions"
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  {memory.status === "active" && (
                    <button
                      type="button"
                      onClick={() => void handleLifecycle(memory, "archive")}
                      title="归档"
                    >
                      <Archive size={13} />
                      归档
                    </button>
                  )}

                  {memory.status !== "active" && memory.status !== "deleted" && (
                    <button
                      type="button"
                      onClick={() => void handleLifecycle(memory, "restore")}
                      title="恢复"
                    >
                      <RotateCcw size={13} />
                      恢复
                    </button>
                  )}

                  {memory.status !== "deleted" && (
                    <button
                      type="button"
                      className="danger"
                      onClick={() => void handleLifecycle(memory, "remove")}
                      title="删除"
                    >
                      <Trash2 size={13} />
                      删除
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {detail && (
        <div
          className="memory-detail-backdrop"
          role="presentation"
          onClick={closeDetail}
        >
          <aside
            className="memory-detail"
            role="dialog"
            aria-modal="true"
            aria-label="记忆详情"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="memory-detail-head">
              <div className="memory-detail-tags">
                <span className={`memory-chip ${detail.contentCategory}`}>
                  {CATEGORY_LABELS[detail.contentCategory]}
                </span>
                <span className={`memory-state ${detail.status}`}>
                  {STATUS_LABELS[detail.status]}
                </span>
                <span className="memory-detail-version">
                  v{detail.version}
                </span>
              </div>

              <button
                type="button"
                className="memory-detail-close"
                onClick={closeDetail}
                aria-label="关闭详情"
              >
                <X size={16} />
              </button>
            </header>

            <p className="memory-detail-content">{detail.content}</p>

            <dl className="memory-detail-meta">
              <div>
                <dt>认知类型</dt>
                <dd>
                  {detail.metadata.cognitiveType
                    ? COGNITIVE_LABELS[detail.metadata.cognitiveType]
                    : "未标注"}
                </dd>
              </div>
              <div>
                <dt>作用域</dt>
                <dd>
                  {detail.metadata.scope
                    ? SCOPE_LABELS[detail.metadata.scope]
                    : "未标注"}
                  {detail.metadata.scopeId
                    ? ` · ${detail.metadata.scopeId}`
                    : ""}
                </dd>
              </div>
              <div>
                <dt>事实等级</dt>
                <dd>
                  {detail.metadata.factKind
                    ? FACT_KIND_LABELS[detail.metadata.factKind]
                    : "未标注"}
                </dd>
              </div>
              <div>
                <dt>置信度</dt>
                <dd>
                  {typeof detail.metadata.confidence === "number"
                    ? detail.metadata.confidence.toFixed(2)
                    : "未标注"}
                </dd>
              </div>
              <div>
                <dt>来源</dt>
                <dd>{SOURCE_LABELS[detail.source] ?? detail.source}</dd>
              </div>
              <div>
                <dt>更新时间</dt>
                <dd>
                  {new Date(detail.updatedAt).toLocaleString("zh-CN")}
                </dd>
              </div>
            </dl>

            <div className="memory-detail-tabs">
              <button
                type="button"
                className={detailTab === "versions" ? "active" : ""}
                onClick={() => setDetailTab("versions")}
              >
                版本历史 · {versions.length}
              </button>
              <button
                type="button"
                className={detailTab === "audit" ? "active" : ""}
                onClick={() => setDetailTab("audit")}
              >
                审计记录 · {audit.length}
              </button>
            </div>

            {detailError && (
              <div className="memory-error" role="alert">
                {detailError}
              </div>
            )}

            {detailLoading ? (
              <p className="memory-detail-loading">正在读取历史…</p>
            ) : detailTab === "versions" ? (
              versions.length === 0 ? (
                <p className="memory-detail-loading">暂无版本记录。</p>
              ) : (
                <ol className="memory-timeline">
                  {versions.map((version) => (
                    <li key={version.id}>
                      <div className="memory-timeline-head">
                        <strong>v{version.version}</strong>
                        <span>
                          {new Date(version.createdAt).toLocaleString(
                            "zh-CN"
                          )}
                        </span>
                      </div>
                      <p>{version.content}</p>
                      <small>
                        {version.changeReason ?? "无变更说明"} ·{" "}
                        {STATUS_LABELS[version.status]}
                      </small>
                    </li>
                  ))}
                </ol>
              )
            ) : audit.length === 0 ? (
              <p className="memory-detail-loading">暂无审计记录。</p>
            ) : (
              <ol className="memory-timeline">
                {audit.map((entry) => (
                  <li key={entry.id}>
                    <div className="memory-timeline-head">
                      <strong>
                        {AUDIT_LABELS[entry.operation] ?? entry.operation}
                      </strong>
                      <span>
                        {new Date(entry.createdAt).toLocaleString("zh-CN")}
                      </span>
                    </div>
                    <small>{entry.reason ?? "无备注"}</small>
                  </li>
                ))}
              </ol>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
