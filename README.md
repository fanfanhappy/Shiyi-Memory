# 拾忆 Shiyi

### Personal AI Memory System

**让 AI 不止记住对话，更能理解一个人的长期经历、知识、偏好与关系。**

<p align="center">
  Windows Desktop · Local-First · AI Memory · RAG · Knowledge Graph
</p>

---

## 项目简介

**拾忆（Shiyi）** 是一个面向 Windows 桌面环境的个人 AI 长期记忆系统。

它希望解决传统 AI 助手在长期使用中的一个核心问题：

AI 可以很好地回答当前问题，却很难持续理解用户过去的经历、长期偏好、正在推进的项目以及曾经做出的决定。

拾忆希望建立一个独立于具体大模型的个人记忆层，让 AI 能够逐渐理解用户，并在未来的对话中调用相关历史信息。

拾忆不是简单的聊天记录搜索工具，也不只是一个 RAG 知识库。

它的长期目标是建立一套具备记忆提取、质量判断、知识关联、记忆更新、冲突处理和长期演化能力的个人 AI 记忆系统。

## 核心理念

- **长期记忆：** 持续积累用户的经历、知识、偏好和重要决策。
- **自动化：** 尽可能从自然对话中发现有价值的信息，减少手动记忆操作。
- **记忆进化：** 能够纠正、更新和整理记忆，而不是简单覆盖历史。
- **知识关联：** 理解人物、项目、事件和知识之间的关系。
- **模型独立：** 记忆数据不绑定某一个 AI 模型，未来可以切换不同模型。
- **本地优先：** 以本地 SQLite 作为核心数据存储，用户掌握自己的记忆数据。

## 产品规划

拾忆计划围绕以下几个核心模块展开：

| 模块 | 功能定位 |
|---|---|
| AI 对话 | 与 AI 进行日常交流，结合长期记忆提供上下文 |
| 记忆中心 | 查看、搜索、编辑和管理长期记忆 |
| 知识图谱 | 建立人物、项目、组织、事件之间的关联 |
| 用户画像 | 整理长期偏好、习惯、目标和个人信息 |
| 项目中心 | 管理项目背景、进展和历史决策 |
| 系统设置 | 管理模型、数据存储、隐私和系统配置 |

以上为产品规划，具体功能将随开发逐步实现。

## 技术架构

拾忆采用 Electron + React 的 Windows 桌面应用架构。

```text
                  Shiyi 拾忆
                       │
             ┌─────────┴─────────┐
             │   Presentation   │
             │   React + TS     │
             └─────────┬─────────┘
                       │
             ┌─────────┴─────────┐
             │   Preload Layer  │
             │  Context Bridge  │
             └─────────┬─────────┘
                       │
             ┌─────────┴─────────┐
             │  Electron Main   │
             │    IPC Layer     │
             └─────────┬─────────┘
                       │
             ┌─────────┴─────────┐
             │   Memory Core    │
             │ Memory Services  │
             └─────────┬─────────┘
                       │
             ┌─────────┴─────────┐
             │   SQLite Storage │
             │  Local Database  │
             └───────────────────┘
```

### 技术栈

| 技术 | 用途 |
|---|---|
| Electron | Windows 桌面应用框架 |
| React | 用户界面 |
| TypeScript | 类型安全与工程开发 |
| Vite / electron-vite | 开发和构建工具 |
| SQLite | 本地核心数据库 |
| Node.js | 主进程与本地服务运行环境 |
| pnpm | 依赖管理 |

### 记忆系统设计

拾忆计划采用分层记忆架构。

**1. 认知记忆**

- Working Memory：工作记忆
- Episodic Memory：情景记忆
- Semantic Memory：语义记忆
- Procedural Memory：程序记忆

**2. 记忆生命周期**

```text
对话产生
   │
   ▼
Candidate
候选记忆
   │
   ▼
Validation
质量验证
   │
   ▼
Active
正式记忆
   │
   ▼
Memory Evolution
记忆更新与进化
   │
   ├── 更新
   ├── 合并
   ├── 归档
   └── 历史版本保留
```

**3. 智能检索**

规划采用多路检索机制：

- BM25：关键词检索
- Vector：向量语义检索
- Graph：知识图谱检索
- Temporal：时间维度检索
- Scope：用户与项目作用域检索

**4. Memory Dream**

后台记忆整理机制，计划负责重复记忆合并、事实冲突发现、关系建立和长期信息整理。

## 数据存储

SQLite 是拾忆的核心数据来源。

当前数据库已经建立以下基础数据表：

| 数据表 | 用途 |
|---|---|
| memories | 记忆主体 |
| entities | 实体 |
| relations | 实体关系 |
| memory_tags | 记忆标签 |
| memory_entities | 记忆与实体关联 |
| conversations | 对话 |
| messages | 消息 |
| schema_migrations | 数据库版本迁移 |

M4.2 正在扩展记忆版本与审计能力：

- memory_versions：记忆历史版本
- memory_audit：记忆操作审计

数据库使用 SQLite WAL 模式，并启用外键约束。数据库结构通过版本化 Migration 管理。

## 项目开发进度

**当前处于早期开发阶段（Early Development）。**

| 里程碑 | 内容 | 状态 |
|---|---|---|
| M0 | 项目基础与规划 | 已完成 |
| M1 | 基础工程与界面框架 | 已完成 |
| M2 | 产品界面与交互基础 | 已完成 |
| M3 | 桌面端基础能力 | 已完成 |
| M4.1 | SQLite 数据库基础设施 | 已完成 |
| M4.2 | 记忆管理服务 | 开发中 |

M4.2 的主要工作：

- 记忆数据类型定义
- Memory Service
- 记忆新增、查询、编辑
- 记忆归档与恢复
- 记忆版本管理
- 操作审计
- 记忆搜索与统计
- 安全 IPC 接入

后续计划：

- 自动记忆提取
- RAG 混合检索
- Embedding 向量检索
- 知识图谱
- DeepSeek 等模型 Provider
- Dream 后台记忆整合
- 用户画像与记忆进化

注意：路线图中的功能不代表当前版本已经实现。

## 本地开发

### 环境要求

- Windows 开发环境
- Node.js
- pnpm

### 获取项目

```bash
git clone https://github.com/fanfanhappy/Shiyi-Memory.git

cd Shiyi-Memory
```

### 安装依赖

```bash
pnpm install
```

### 启动开发环境

```bash
pnpm dev
```

### 类型检查

```bash
pnpm typecheck
```

### 生产构建

```bash
pnpm build
```

### 预览构建

```bash
pnpm start
```

## 数据目录

拾忆采用开发数据与正式用户数据分离的方式。

开发环境：

```text
项目目录/
└── data-dev/
    └── shiyi.db
```

正式运行环境：

```text
Electron UserData/
└── data/
    └── shiyi.db
```

数据库、用户数据、备份文件及密钥不应提交到 Git 仓库。

## 隐私与数据安全

拾忆坚持 Local-First 设计原则：

- 用户记忆优先保存在本地。
- SQLite 作为核心数据来源。
- 记忆修改应保留必要的历史记录。
- 数据库迁移采用版本管理。
- 不允许未经授权覆盖用户已有记忆。
- 不同 AI Provider 与记忆存储层保持独立。

需要注意：本地存储不等于完全离线。未来接入云端模型时，发送给模型服务的上下文仍可能离开本地设备，相关数据范围需要明确控制。

## 项目愿景

拾忆希望成为一个真正属于用户自己的 AI 记忆系统。

未来，无论用户使用 DeepSeek、OpenAI、Gemini，还是本地运行的模型，都可以通过统一的记忆层理解过去的经历与知识。

用户不需要每次重新解释自己，也不需要反复告诉 AI 曾经做过什么。

**AI 应该逐渐理解一个人，而不只是一次次回答一个问题。**

---

## 项目信息

- Project：Shiyi / 拾忆
- Repository：[Shiyi-Memory](https://github.com/fanfanhappy/Shiyi-Memory)
- Platform：Windows Desktop
- Architecture：Electron + React + TypeScript + SQLite
- Development Status：Early Development

**License：** 当前仓库尚未声明正式开源许可证。
