export type UrgencyLevel = "none" | "overdue" | "urgent" | "today" | "soon" | "later" | "distant";

export interface Urgency {
  level: UrgencyLevel;
  label: string;
  background: string;
  color: string;
  fontWeight: number;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export function getUrgency(dueAt: string | null, now: Date = new Date()): Urgency {
  if (!dueAt) {
    return { level: "none", label: "–", background: "#f1f2f3", color: "#5d636a", fontWeight: 600 };
  }

  const diff = new Date(dueAt).getTime() - now.getTime();

  if (diff < 0) {
    return { level: "overdue", label: "마감 지남", background: "#f6eff1", color: "#76424f", fontWeight: 800 };
  }

  if (diff <= DAY) {
    const hours = Math.max(1, Math.ceil(diff / HOUR));
    return { level: "urgent", label: `긴급! ${hours}시간 남음`, background: "#fff1f1", color: "#c93444", fontWeight: 800 };
  }

  const days = Math.ceil(diff / DAY);

  if (days <= 3) {
    return { level: "soon", label: `D-${days}`, background: "#fff7e3", color: "#9b6400", fontWeight: 700 };
  }

  if (days <= 7) {
    return { level: "later", label: `D-${days}`, background: "#edf7ff", color: "#1873b8", fontWeight: 600 };
  }

  return { level: "distant", label: `D-${days}`, background: "#edf7ff", color: "#1873b8", fontWeight: 600 };
}
