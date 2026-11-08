export const ScreenshotDetail = ({ src, alt, width, height }) => (
  <details className="revo-screenshot-detail not-prose">
    <style>{`
      .revo-screenshot-detail { margin: -1rem 0 2rem; font-size: 14px; line-height: 1.6; }
      .revo-screenshot-detail summary { cursor: pointer; padding: 10px 0; min-height: 44px; font-weight: 600; }
      .revo-screenshot-detail p { margin: 0 0 12px; }
      .revo-screenshot-detail a { text-decoration: underline; text-underline-offset: 3px; }
      .revo-screenshot-detail summary:focus-visible, .revo-screenshot-detail a:focus-visible,
      .revo-screenshot-detail [role="region"]:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
      .revo-screenshot-detail [role="region"] { overflow: auto; max-height: min(65vh, 32rem); border: 1px solid #71717a; border-radius: 8px; background: #fff; overscroll-behavior: contain; }
      .revo-screenshot-detail img { display: block; max-width: none !important; margin: 0; }
    `}</style>
    <summary>Read screenshot at full size</summary>
    <p>Scroll horizontally and vertically to read the original detail, or <a href={src} target="_blank" rel="noopener noreferrer">open the original image</a>. Keyboard users can focus the image area and use the arrow keys.</p>
    <div role="region" aria-label={'Full-size screenshot: ' + alt} tabIndex={0}>
      <img src={src} alt={alt} width={width} height={height} loading="lazy" style={{ width: width + 'px', height: 'auto' }} />
    </div>
  </details>
);
