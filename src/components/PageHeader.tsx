/** The title block at the top of a page, with an optional subtitle and a right-aligned action. */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  // The action drops below the title when the two do not fit side by side, and
  // may never be wider than the header. Without both, Analytics' four export
  // buttons ran 180px past the edge of a phone and dragged the page sideways.
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {action && <div className="max-w-full shrink-0">{action}</div>}
    </div>
  );
}

/** Centres a page's content and applies the standard max width and padding. */
export function PageContainer({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>;
}
