import { AppNav } from "@/app/components/AppNav";

export default function DashboardLoading() {
  return (
    <div className="dashboard-page dashboard-page--list">
      <AppNav active="list" variant="wallet" />
      <main className="page-shell dashboard-shell dashboard-loading" aria-busy="true" aria-live="polite">
        <span className="sr-only">일정을 불러오고 있어요</span>
        <header className="page-header">
          <div className="dashboard-loading__title">
            <span className="skeleton skeleton--eyebrow" />
            <span className="skeleton skeleton--title" />
          </div>
          <span className="skeleton skeleton--icon" />
        </header>
        <section className="dashboard-loading__summary">
          <span className="skeleton skeleton--summary-icon" />
          <span className="dashboard-loading__copy">
            <span className="skeleton skeleton--line-lg" />
            <span className="skeleton skeleton--line-sm" />
          </span>
          <span className="skeleton skeleton--metric" />
        </section>
        <div className="dashboard-loading__section-heading">
          <span className="skeleton skeleton--heading" />
          <span className="skeleton skeleton--count" />
        </div>
        <div className="dashboard-loading__cards" role="status">
          <span className="dashboard-loading__card skeleton" />
          <span className="dashboard-loading__card skeleton" />
        </div>
      </main>
    </div>
  );
}
