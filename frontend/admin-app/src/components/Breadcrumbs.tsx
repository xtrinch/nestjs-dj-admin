export function Breadcrumbs({
  category,
  resourceHref,
  resourceLabel,
  pageLabel,
}: {
  category: string;
  resourceHref: string;
  resourceLabel: string;
  pageLabel: string | null;
}) {
  return (
    <nav aria-label="Breadcrumb" className="breadcrumbs">
      <a className="breadcrumbs__link" href="#">Home</a>
      <span className="breadcrumbs__sep">›</span>
      <span>{category}</span>
      <span className="breadcrumbs__sep">›</span>
      <a className="breadcrumbs__link" href={resourceHref}>
        {resourceLabel}
      </a>
      {pageLabel ? (
        <>
          <span className="breadcrumbs__sep">›</span>
          <span className="breadcrumbs__current">{pageLabel}</span>
        </>
      ) : null}
    </nav>
  );
}
