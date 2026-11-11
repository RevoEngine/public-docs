export const WidgetReadingPreview = () => (
  <figure className="revo-widget-preview not-prose" aria-label="Two matrix rows rendered inside a dashboard widget">
    <style>{`
      .revo-widget-preview { margin: 1.5rem 0; font-size: .875rem; }
      .revo-widget-preview .wp-panel {
        display: grid; gap: 8px; padding: 12px; border: 1px solid #94a3b8;
        border-radius: 12px; color: #0f172a; background: #f8fafc;
      }
      .revo-widget-preview .wp-row { display: grid; gap: 8px; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); }
      .revo-widget-preview .wp-cell { padding: 10px; border: 1px solid #94a3b8; border-radius: 7px; background: white; }
      .revo-widget-preview .wp-cell small { display: block; color: #475569; }
      .revo-widget-preview figcaption { margin-top: .6rem; }
      .dark .revo-widget-preview .wp-panel { color: #f1f5f9; background: #0f172a; }
      .dark .revo-widget-preview .wp-cell { background: #1e293b; }
      .dark .revo-widget-preview .wp-cell small { color: #cbd5e1; }
      @media (max-width: 700px) {
        .revo-widget-preview .wp-row { grid-template-columns: minmax(0, 1fr); }
      }
    `}</style>
    <div className="wp-panel">
      <div className="wp-cell">
        <small>Row 1 · title</small>
        <strong>Order overview</strong>
      </div>
      <div className="wp-row">
        <div className="wp-cell"><small>Row 2 · open · 60%</small>Open: 12</div>
        <div className="wp-cell"><small>Row 2 · late · 40%</small>Late: 3</div>
      </div>
    </div>
    <figcaption>The outer dashboard panel contains two matrix rows. Widths divide the second row when its cells sit side by side. Narrow screens stack the cells.</figcaption>
  </figure>
);
