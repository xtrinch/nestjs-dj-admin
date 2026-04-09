export function Breadcrumbs({
  category,
  resourceLabel,
  pageLabel,
}: {
  category: string;
  resourceLabel: string;
  pageLabel: string | null;
}) {
  return (
    <nav aria-label="Breadcrumb" className="breadcrumbs">
      <span>Home</span>
      <span className="breadcrumbs__sep">›</span>
      <span>{category}</span>
      <span className="breadcrumbs__sep">›</span>
      <span>{resourceLabel}</span>
      {pageLabel ? (
        <>
          <span className="breadcrumbs__sep">›</span>
          <span className="breadcrumbs__current">{pageLabel}</span>
        </>
      ) : null}
    </nav>
  );
}
