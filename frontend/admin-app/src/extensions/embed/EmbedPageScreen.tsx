import { useEffect } from 'react';
import type { EmbedPageSchema } from '../../types.js';
import type { AdminExtensionPageProps } from '../types.js';
import './styles.css';

export function EmbedPageScreen({
  page,
  onTitleChange,
}: AdminExtensionPageProps<EmbedPageSchema>) {
  useEffect(() => {
    onTitleChange?.(null);
  }, [onTitleChange]);

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
