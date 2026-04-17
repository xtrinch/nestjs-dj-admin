import { useEffect } from 'react';
import type { CustomPageSchema } from '../types.js';

export function CustomPage({
  page,
  onTitleChange,
}: {
  page: CustomPageSchema;
  onTitleChange?: (label: string | null) => void;
}) {
  useEffect(() => {
    onTitleChange?.(null);
  }, [onTitleChange]);

  if (page.kind === 'embed') {
    return (
      <section className="custom-page custom-page--embed">
        <section className="panel custom-page__hero">
          <span className="panel__eyebrow">{page.category}</span>
          <div className="panel__title-row">
            <h2>{page.title ?? page.label}</h2>
          </div>
          {page.description ? <p className="custom-page__copy">{page.description}</p> : null}
        </section>

        <section className="panel custom-page__panel">
          <iframe
            className="custom-page__embed"
            src={page.url}
            title={page.title ?? page.label}
            loading="lazy"
            referrerPolicy={page.referrerPolicy}
            allow={page.allow}
            style={{ height: `${page.height}px` }}
          />
        </section>
      </section>
    );
  }

  return null;
}
