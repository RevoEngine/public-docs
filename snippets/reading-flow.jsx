export const ReadingFlow = ({ label, steps }) => (
  <figure className="revo-reading-flow not-prose" aria-label={label} data-layout={steps.some(step => step[2]) ? "vertical" : "horizontal"}>
    <style>{`
      .revo-reading-flow {
        margin: 1.5rem 0;
        --rf-border: #cbd5e1;
        --rf-surface: #f8fafc;
        --rf-ink: #0f172a;
        --rf-muted: #475569;
        --rf-accent: #0f766e;
      }
      .dark .revo-reading-flow {
        --rf-border: #475569;
        --rf-surface: #1e293b;
        --rf-ink: #f1f5f9;
        --rf-muted: #cbd5e1;
        --rf-accent: #99f6e4;
      }
      .revo-reading-flow ol {
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: minmax(0, 1fr);
        gap: 18px;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .revo-reading-flow li {
        position: relative;
        min-width: 0;
        padding: .75rem;
        border: 1px solid var(--rf-border);
        border-radius: 10px;
        background: var(--rf-surface);
        color: var(--rf-ink);
        overflow-wrap: anywhere;
      }
      .revo-reading-flow li:not(:last-child):after {
        position: absolute;
        inset-inline-end: -15px;
        top: calc(50% - 4px);
        width: 8px;
        height: 8px;
        border-right: 2px solid var(--rf-accent);
        border-top: 2px solid var(--rf-accent);
        transform: rotate(45deg);
        content: '';
      }
      .revo-reading-flow strong {
        display: block;
        font-size: .9rem;
        line-height: 1.4;
      }
      .revo-reading-flow li span {
        display: block;
        margin-top: .35rem;
        color: var(--rf-muted);
        font-size: .875rem;
        line-height: 1.45;
      }
      .revo-reading-flow .rf-branch {
        border-inline-start: 2px solid var(--rf-border);
        padding-inline-start: .6rem;
        font-weight: 550;
      }
      .revo-reading-flow[data-layout="vertical"] ol { grid-auto-flow: row; grid-auto-columns: auto; gap: 14px; }
      .revo-reading-flow[data-layout="vertical"] li:not(:last-child):after {
        top: auto;
        bottom: -10px;
        inset-inline-end: calc(50% - 4px);
        transform: rotate(135deg);
      }
      @media (max-width: 640px) {
        .revo-reading-flow ol { grid-auto-flow: row; grid-auto-columns: auto; gap: 14px; }
        .revo-reading-flow li:not(:last-child):after {
          top: auto;
          bottom: -10px;
          inset-inline-end: calc(50% - 4px);
          transform: rotate(135deg);
        }
      }
    `}</style>
    <ol role="list">
      {steps.map(([title, detail, branch]) => (
        <li key={title}>
          <strong>{title}</strong>
          <span>{detail}</span>
          {branch && <span className="rf-branch">{branch}</span>}
        </li>
      ))}
    </ol>
  </figure>
);
