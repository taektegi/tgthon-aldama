import Link from "next/link";

type AppNavItem = "list" | "add" | "calendar";

const items: Array<{ id: AppNavItem; href: string; icon: string; label: string }> = [
  { id: "list", href: "/dashboard?view=list", icon: "▤", label: "일정" },
  { id: "add", href: "/dashboard?add=choose", icon: "+", label: "추가" },
  { id: "calendar", href: "/dashboard?view=calendar", icon: "□", label: "캘린더" },
];

export function AppNav({ active }: { active?: AppNavItem }) {
  return (
    <nav className="app-nav" aria-label="주요 메뉴">
      <div className="app-nav__inner">
        {items.map((item) => {
          const isActive = active === item.id;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`app-nav__item ${item.id === "add" ? "app-nav__item--add" : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="app-nav__icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
