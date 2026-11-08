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
