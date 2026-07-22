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
    return { level: "none", label: "–", background: "#f3f4f6", color: "#6b7280", fontWeight: 600 };
  }

  const diff = new Date(dueAt).getTime() - now.getTime();

  if (diff < 0) {
    return { level: "overdue", label: "마감 지남", background: "#fde8e8", color: "#b42318", fontWeight: 800 };
  }

  if (diff <= 6 * HOUR) {
    const hours = Math.max(1, Math.ceil(diff / HOUR));
    return { level: "urgent", label: `${hours}시간 남음`, background: "#fdeae2", color: "#d64545", fontWeight: 800 };
  }

  if (diff <= DAY) {
    return { level: "today", label: "D-1", background: "#ffedd5", color: "#c2410c", fontWeight: 800 };
  }

  const days = Math.ceil(diff / DAY);

  if (days <= 3) {
    return { level: "soon", label: `D-${days}`, background: "var(--primary-pale)", color: "var(--primary-deep)", fontWeight: 700 };
  }

  if (days <= 7) {
    return { level: "later", label: `D-${days}`, background: "#f3f4f6", color: "#475569", fontWeight: 600 };
  }

  return { level: "distant", label: `D-${days}`, background: "#f3f4f6", color: "#475569", fontWeight: 600 };
}
