import type {
  MemoryContentCategoryDto,
  MemoryStatusDto
} from "../../shared/ipc";

export const CATEGORY_LABELS: Record<MemoryContentCategoryDto, string> = {
  general: "通用",
  fact: "事实",
  preference: "偏好",
  experience: "经历",
  project: "项目",
  person: "人物",
  goal: "目标",
  event: "事件"
};

export const COGNITIVE_LABELS: Record<string, string> = {
  working: "工作记忆",
  episodic: "情景记忆",
  semantic: "语义记忆",
  procedural: "程序记忆"
};

export const STATUS_LABELS: Record<MemoryStatusDto, string> = {
  active: "生效中",
  archived: "已归档",
  deleted: "已删除"
};

export const SOURCE_LABELS: Record<string, string> = {
  manual: "手动写入",
  conversation: "对话提取",
  import: "导入",
  system: "系统"
};

export const SCOPE_LABELS: Record<string, string> = {
  global: "全局",
  user: "用户",
  project: "项目",
  entity: "实体",
  session: "会话"
};

export const FACT_KIND_LABELS: Record<string, string> = {
  fact: "事实",
  inference: "推断",
  hypothesis: "假设"
};

export const AUDIT_LABELS: Record<string, string> = {
  create: "创建",
  update: "更新",
  archive: "归档",
  restore: "恢复",
  soft_delete: "删除",
  access: "访问",
  merge: "合并",
  supersede: "替代",
  reject: "拒绝"
};

export function formatRelativeTime(iso: string): string {
  const timestamp = Date.parse(iso);

  if (!Number.isFinite(timestamp)) {
    return "时间未知";
  }

  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;

  return new Date(timestamp).toLocaleDateString("zh-CN");
}
