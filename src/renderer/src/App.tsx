import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowRight,
  Brain,
  Clock3,
  Copy,
  Database,
  Folder,
  Layers,
  MessageCircle,
  Mic,
  Moon,
  Ellipsis,
  Network,
  Plus,
  Settings,
  Sparkles,
  Sun,
  ThumbsDown,
  ThumbsUp,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import MemoryCenter from "./pages/MemoryCenter";
import { CATEGORY_LABELS, formatRelativeTime } from "./memoryLabels";
import type {
  MemoryContentCategoryDto,
  MemoryDto
} from "../../shared/ipc";

type Page =
  | "chat"
  | "memory"
  | "graph"
  | "profile"
  | "projects"
  | "timeline"
  | "settings";

type Message = {
  id: number;
  role: "user" | "assistant";
  content: string;
  details?: string[];
};

const navItems: {
  id: Page;
  icon: LucideIcon;
  label: string;
}[] = [
  { id: "chat", icon: MessageCircle, label: "AI 对话" },
  { id: "memory", icon: Brain, label: "记忆中心" },
  { id: "graph", icon: Network, label: "知识图谱" },
  { id: "profile", icon: UserRound, label: "用户画像" },
  { id: "projects", icon: Folder, label: "项目空间" },
  { id: "timeline", icon: Clock3, label: "时间线" }
];

const projectItems = ["拾忆项目", "个人知识管理", "AI 学习计划"];

const pageInfo: Record<Exclude<Page, "chat">, {
  title: string;
  description: string;
}> = {
  memory: {
    title: "记忆中心",
    description: "自动沉淀、整理和管理你的长期记忆。"
  },
  graph: {
    title: "知识图谱",
    description: "探索人物、事件、项目和知识之间的联系。"
  },
  profile: {
    title: "我的画像",
    description: "逐渐理解你的兴趣、偏好与长期目标。"
  },
  projects: {
    title: "项目空间",
    description: "集中管理项目资料、任务和关联记忆。"
  },
  timeline: {
    title: "时间线",
    description: "沿着时间重新发现重要经历与事件。"
  },
  settings: {
    title: "设置",
    description: "管理 AI 服务、本地数据、隐私和外观。"
  }
};

const initialMessages: Message[] = [
  {
    id: 1,
    role: "user",
    content: "我们继续完善拾忆项目的技术架构吧。"
  },
  {
    id: 2,
    role: "assistant",
    content: "好的，我们继续完善拾忆（Shiyi）的技术架构。基于我们之前确认的原则，建议采用以下方案：",
    details: [
      "数据层：本地（Local）",
      "记忆机制：自动（Automatic）",
      "知识图谱：基于 SQLite",
      "应用形式：Windows 桌面应用（Electron）"
    ]
  }
];

const memoryIcons: Record<
  MemoryContentCategoryDto,
  { icon: LucideIcon; color: string }
> = {
  general: { icon: Brain, color: "blue" },
  fact: { icon: Database, color: "blue" },
  preference: { icon: Sparkles, color: "purple" },
  experience: { icon: Clock3, color: "cyan" },
  project: { icon: Folder, color: "blue" },
  person: { icon: UserRound, color: "purple" },
  goal: { icon: Layers, color: "cyan" },
  event: { icon: Clock3, color: "purple" }
};

function App() {
  const [activePage, setActivePage] = useState<Page>("chat");
  const [version, setVersion] = useState("本地模式");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(initialMessages);
  const [darkMode, setDarkMode] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [chatStatus, setChatStatus] = useState<string | null>(null);

  const [recentMemories, setRecentMemories] = useState<MemoryDto[]>([]);
  const [memoryTotal, setMemoryTotal] = useState(0);
  const [memoryReady, setMemoryReady] = useState(false);
  const [memoryFailed, setMemoryFailed] = useState(false);
  const [memoryRevision, setMemoryRevision] = useState(0);

  useEffect(() => {
    if (window.shiyi?.getAppVersion) {
      window.shiyi.getAppVersion()
        .then((value) => setVersion(`v${value}`))
        .catch(() => setVersion("本地模式"));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadRecentMemories() {
      const api = window.shiyi?.memory;

      if (!api) return;

      const result = await api.list({
        pageSize: 3,
        sortBy: "updatedAt",
        sortDirection: "desc"
      });

      if (cancelled) return;

      if (result.ok) {
        setRecentMemories(result.data.items);
        setMemoryTotal(result.data.totalItems);
        setMemoryFailed(false);
      } else {
        setMemoryFailed(true);
      }

      setMemoryReady(true);
    }

    void loadRecentMemories();

    return () => {
      cancelled = true;
    };
  }, [memoryRevision]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const content = input.trim();
    if (!content) return;

    setMessages((previous) => [
      ...previous,
      {
        id: Date.now(),
        role: "user",
        content
      }
    ]);

    setInput("");
    setChatStatus("正在保存到本地对话记录…");

    const api = window.shiyi?.conversation;

    if (!api) {
      setChatStatus("本地对话服务未连接");
      return;
    }

    let targetId = conversationId;

    if (!targetId) {
      const created = await api.create({});

      if (!created.ok) {
        setChatStatus(`保存失败：${created.error.message}`);
        return;
      }

      targetId = created.data.id;
      setConversationId(targetId);
    }

    const appended = await api.append({
      conversationId: targetId,
      role: "user",
      content
    });

    setChatStatus(
      appended.ok
        ? "已保存到本地对话记录"
        : `保存失败：${appended.error.message}`
    );
  }

  const activeLabel =
    navItems.find((item) => item.id === activePage)?.label
    ?? pageInfo[activePage as Exclude<Page, "chat">]?.title
    ?? "设置";

  const memoryCategories = Array.from(
    new Set(recentMemories.map((memory) => memory.contentCategory))
  );

  return (
    <div className={`app-root ${darkMode ? "dark-mode" : ""}`}>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <div className="desktop-window">

        <aside className="sidebar">
          <div className="brand">
            <div className="brand-logo">
              <span />
            </div>
            <div className="brand-text">
              <strong>拾忆 Shiyi</strong>
              <small>PERSONAL MEMORY</small>
            </div>
          </div>

          <div className="section-label">工作空间</div>

          <nav className="nav-list">
            {navItems.map((item) => (
              <button
                key={item.id}
                className={`nav-item ${
                  activePage === item.id ? "selected" : ""
                }`}
                onClick={() => setActivePage(item.id)}
              >
                <span className="nav-icon">
                  <item.icon size={17} strokeWidth={1.8} />
                </span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="sidebar-divider" />

          <div className="project-heading">
            <span>我的项目</span>
            <button title="添加项目">
              <Plus size={17} />
            </button>
          </div>

          <div className="project-list">
            {projectItems.map((project, index) => (
              <button
                key={project}
                className="project-item"
                onClick={() => setActivePage("projects")}
              >
                <span className="folder-icon">
                  <Folder size={16} />
                </span>
                <span>{project}</span>
                {index === 0 && <i />}
              </button>
            ))}
          </div>

          <div className="sidebar-bottom">
            <button
              className={`nav-item settings-item ${
                activePage === "settings" ? "selected" : ""
              }`}
              onClick={() => setActivePage("settings")}
            >
              <span className="nav-icon">
                <Settings size={17} />
              </span>
              <span>设置</span>
            </button>

            <div className="local-status">
              <span className="online-dot" />
              <span>本地记忆空间</span>
              <small>{version}</small>
            </div>
          </div>
        </aside>

        <main className="center-panel">
          <header className="topbar">
            <div className="breadcrumb">
              工作空间 <span>/</span> {activeLabel}
            </div>
            <div className="topbar-actions">
              <span className="local-badge">
                <i /> 本地运行
              </span>
              <button
                className="appearance-toggle"
                type="button"
                onClick={() => setDarkMode((current) => !current)}
                title={darkMode ? "切换浅色模式" : "切换深色模式"}
                aria-label={darkMode ? "切换浅色模式" : "切换深色模式"}
              >
                {darkMode ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <button
                className="avatar"
                title="用户"
                onClick={() => setActivePage("profile")}
              >
                <UserRound size={17} />
              </button>
            </div>
          </header>

          {activePage === "chat" ? (
            <>
              <div className="chat-scroll">
                <section className="chat-intro">
                  <div className="memory-orb large-orb">
                    <span />
                  </div>

                  <div className="intro-copy">
                    <h1>早上好 <span>👋</span></h1>
                    <p>
                      今天想聊些什么？我会记住重要的内容，
                      并在未来适当的时候帮你回忆。
                    </p>
                  </div>
                </section>

                <div className="conversation">
                  <div className="conversation-label">
                    <span>最近的对话</span>
                    <span>示例会话</span>
                  </div>

                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`message-row ${message.role}`}
                    >
                      {message.role === "assistant" && (
                        <div className="assistant-avatar">
                          <span />
                        </div>
                      )}

                      <div className="message-bubble">
                        <p>{message.content}</p>

                        {message.details && (
                          <div className="detail-list">
                            {message.details.map((detail) => (
                              <div key={detail} className="detail-item">
                                <span>✓</span>
                                {detail}
                              </div>
                            ))}
                          </div>
                        )}

                        {message.role === "assistant" && (
                          <div className="message-actions">
                            <button title="赞同">
                              <ThumbsUp size={14} />
                            </button>
                            <button title="不喜欢">
                              <ThumbsDown size={14} />
                            </button>
                            <button title="复制">
                              <Copy size={14} />
                            </button>
                            <button title="更多">
                              <Ellipsis size={15} />
                            </button>
                            <span>示例内容</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="composer-area">
                <form className="composer" onSubmit={sendMessage}>
                  <button
                    type="button"
                    className="composer-tool"
                    title="添加附件"
                  >
                    <Plus size={19} />
                  </button>

                  <textarea
                    rows={1}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="和拾忆聊聊你的想法、经历或计划..."
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                  />

                  <button
                    type="button"
                    className="composer-tool microphone"
                    title="语音输入（尚未接入）"
                  >
                    <Mic size={17} />
                  </button>

                  <button
                    type="submit"
                    className="send-button"
                    disabled={!input.trim()}
                    title="发送"
                  >
                    <ArrowRight size={18} />
                  </button>
                </form>

                <p className="composer-hint">
                  {chatStatus
                    ?? "对话会自动保存到本地，AI 模型将在后续阶段接入。"}
                </p>
              </div>
            </>
          ) : activePage === "memory" ? (
            <MemoryCenter
              onChanged={() => setMemoryRevision((current) => current + 1)}
            />
          ) : (
            <section className="module-page">
              <div className="module-hero">
                <div className="module-orb memory-orb">
                  <span />
                </div>
                <span className="eyebrow">SHIYI WORKSPACE</span>
                <h1>
                  {pageInfo[activePage as Exclude<Page, "chat">]?.title}
                </h1>
                <p>
                  {pageInfo[activePage as Exclude<Page, "chat">]?.description}
                </p>
              </div>

              <div className="module-grid">
                <div className="module-card">
                  <span className="card-symbol">✧</span>
                  <strong>自然沉淀</strong>
                  <p>让重要信息在交流中逐渐形成长期记忆。</p>
                </div>
                <div className="module-card">
                  <span className="card-symbol purple">⌘</span>
                  <strong>智能关联</strong>
                  <p>连接人物、事件、项目和相关知识。</p>
                </div>
                <div className="module-card">
                  <span className="card-symbol green">◷</span>
                  <strong>持续成长</strong>
                  <p>随着时间积累，形成连续的个人知识体系。</p>
                </div>
              </div>

              <div className="module-notice">
                <span>✧</span>
                此页面目前为界面预览，功能将在后续开发阶段接入。
              </div>
            </section>
          )}
        </main>

        <aside className="context-panel">
          <div className="context-heading">
            <div className="context-title">
              <span>
                <Layers size={17} strokeWidth={1.8} />
              </span>
              <strong>相关记忆</strong>
            </div>
            <span className="count-badge">
              {memoryTotal > 99 ? "99+" : memoryTotal}
            </span>
          </div>

          <div className="memory-cards">
            {recentMemories.map((memory) => {
              const visual = memoryIcons[memory.contentCategory];
              const MemoryIcon = visual.icon;

              return (
                <div className="memory-card" key={memory.id}>
                  <div className={`memory-card-icon ${visual.color}`}>
                    <MemoryIcon size={17} strokeWidth={1.8} />
                  </div>
                  <div className="memory-card-content">
                    <strong>{CATEGORY_LABELS[memory.contentCategory]}</strong>
                    <p>{memory.content}</p>
                    <small>{formatRelativeTime(memory.updatedAt)}</small>
                  </div>
                </div>
              );
            })}

            {memoryReady && recentMemories.length === 0 && (
              <p className="context-empty">
                还没有记忆，去记忆中心写一条试试。
              </p>
            )}
          </div>

          <div className="context-divider" />

          <div className="context-heading entities-heading">
            <div className="context-title">
              <span>
                <Layers size={17} strokeWidth={1.8} />
              </span>
              <strong>记忆类型</strong>
            </div>
            <span className="count-badge">{memoryCategories.length}</span>
          </div>

          <div className="entity-grid">
            {memoryCategories.length === 0 && (
              <p className="context-empty">暂无分类</p>
            )}

            {memoryCategories.map((category) => {
              const visual = memoryIcons[category];
              const CategoryIcon = visual.icon;

              return (
                <div className="entity-chip" key={category}>
                  <CategoryIcon size={14} strokeWidth={1.8} />
                  {CATEGORY_LABELS[category]}
                </div>
              );
            })}
          </div>

          <div className="context-divider" />

          <div className="memory-status">
            <div className="memory-status-heading">
              <span>
                <Sparkles size={17} strokeWidth={1.8} />
              </span>
              <strong>Memory Glow</strong>
            </div>
            <p>让记忆自然发生</p>
            <div className="status-orbs">
              <div className="status-orb thinking">
                <span />
                <small>思考中</small>
              </div>
              <div className="status-orb extracting">
                <span />
                <small>提取记忆</small>
              </div>
            </div>
          </div>

          <div className="context-footer">
            <span className="online-dot" />
            {memoryFailed
              ? "本地记忆空间 · 读取失败"
              : memoryReady
                ? "本地记忆空间 · 已连接 SQLite"
                : "本地记忆空间 · 连接中"}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default App;
