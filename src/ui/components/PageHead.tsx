// A page's header band in the Play board's look (the playmat, its frame bar and the signature line): an optional
// kicker naming the section, the page's one <h1>, a line of context, and the page's main actions.
export function PageHead({ kicker, title, actions, children }: { kicker?: string; title: React.ReactNode; actions?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="page-head">
      <div className="page-head-main">
        {kicker && <span className="page-kicker">{kicker}</span>}
        <h1>{title}</h1>
        {children && <div className="page-head-sub">{children}</div>}
      </div>
      {actions && <div className="page-head-actions">{actions}</div>}
    </header>
  );
}
