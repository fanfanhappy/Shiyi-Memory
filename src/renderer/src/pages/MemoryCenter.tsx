import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  Archive,
  Brain,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2
} from "lucide-react";

import type {
  MemoryContentCategoryDto,
  MemoryDto,
  MemoryListQueryDto
} from "../../../shared/ipc";

import {
  CATEGORY_LABELS,
  COGNITIVE_LABELS,
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
            <article className="memory-entry" key={memory.id}>
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

                <div className="memory-entry-actions">
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
    </section>
  );
}
