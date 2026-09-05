(function () {
  const OPTIONS = window.TOP_AD_OPTIONS || {};
  const ROOT_ID = 'shared-top-ad-root';
  const STYLE_ID = 'shared-top-ad-style';
  const MAX_WIDTH = '1536px';

  if (document.getElementById(ROOT_ID)) return;
  if (OPTIONS.hideWhenEmbedded && window.self !== window.top) return;

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.shared-top-ad{width:100%;border-top:1px solid #fed7aa;border-bottom:1px solid #fed7aa;background:#fff7ed;}',
      '.shared-top-ad__inner{max-width:' + MAX_WIDTH + ';margin:0 auto;padding:8px 12px;color:#c2410c;}',
      '.shared-top-ad__link{display:flex;min-height:40px;width:100%;flex-direction:column;align-items:center;justify-content:center;gap:4px;text-align:center;text-decoration:none;color:inherit;}',
      '.shared-top-ad__text{font-size:12px;font-weight:600;white-space:normal;word-break:break-word;}',
      '.shared-top-ad__cta{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;background:#ffedd5;padding:2px 8px;font-size:11px;font-weight:700;color:#c2410c;}',
      '.shared-top-ad__image-link{display:block;overflow:hidden;border-radius:6px;text-decoration:none;color:inherit;}',
      '.shared-top-ad__image{display:block;height:auto;width:100%;border-radius:6px;object-fit:cover;}',
      '.shared-top-ad__plain{display:flex;min-height:40px;width:100%;align-items:center;justify-content:center;text-align:center;}',
      '@media (min-width: 768px){.shared-top-ad__inner{padding:8px 16px;}.shared-top-ad__link{min-height:40px;flex-direction:row;gap:8px;}.shared-top-ad__text{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}}'
    ].join('');
    document.head.appendChild(style);
  }

  function normalizeConfig(raw) {
    const type = String((raw && raw.type) || 'auto').trim().toLowerCase();
    const imageHeight = Number(raw && raw.imageHeight);

    return {
      enabled: Boolean(raw && raw.enabled),
      type: type === 'image' || type === 'text' || type === 'auto' ? type : 'auto',
      text: String((raw && raw.text) || '').trim(),
      imageUrl: String((raw && raw.imageUrl) || '').trim(),
      linkUrl: String((raw && raw.linkUrl) || '').trim(),
      alt: String((raw && raw.alt) || '页眉下广告位').trim() || '页眉下广告位',
      ctaText: String((raw && raw.ctaText) || '点击跳转').trim() || '点击跳转',
      openInNewTab: raw && raw.openInNewTab !== false,
      imageHeight: Number.isFinite(imageHeight) && imageHeight >= 80 ? imageHeight : 160
    };
  }

  function getInsertAnchor() {
    if (OPTIONS.insertAfterSelector) {
      return document.querySelector(OPTIONS.insertAfterSelector);
    }

    return document.querySelector('#site-header-container') ||
      document.querySelector('.site-header') ||
      document.querySelector('header');
  }

  function createWrapper() {
    const wrapper = document.createElement('div');
    wrapper.id = ROOT_ID;
    return wrapper;
  }

  function render(config) {
    const hasImage = Boolean(config.imageUrl);
    const showImage = config.type === 'image' ? hasImage : config.type === 'text' ? false : hasImage;
    const hasLink = Boolean(config.linkUrl);
    const wrapper = createWrapper();
    const root = document.createElement('div');
    const inner = document.createElement('div');

    root.className = 'shared-top-ad';
    inner.className = 'shared-top-ad__inner';

    if (showImage) {
      const image = document.createElement('img');
      image.className = 'shared-top-ad__image';
      image.src = config.imageUrl;
      image.alt = config.alt;
      image.loading = 'eager';
      image.style.maxHeight = config.imageHeight + 'px';

      if (hasLink) {
        const link = document.createElement('a');
        link.className = 'shared-top-ad__image-link';
        link.href = config.linkUrl;
        if (config.openInNewTab) {
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
        }
        link.appendChild(image);
        inner.appendChild(link);
      } else {
        inner.appendChild(image);
      }
    } else if (hasLink) {
      const link = document.createElement('a');
      const text = document.createElement('span');
      const cta = document.createElement('span');

      link.className = 'shared-top-ad__link';
      link.href = config.linkUrl;
      if (config.openInNewTab) {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }

      text.className = 'shared-top-ad__text';
      text.textContent = config.text;
      cta.className = 'shared-top-ad__cta';
      cta.textContent = config.ctaText + ' ↗';

      link.appendChild(text);
      link.appendChild(cta);
      inner.appendChild(link);
    } else {
      const plain = document.createElement('div');
      const text = document.createElement('span');

      plain.className = 'shared-top-ad__plain';
      text.className = 'shared-top-ad__text';
      text.textContent = config.text;

      plain.appendChild(text);
      inner.appendChild(plain);
    }

    root.appendChild(inner);
    wrapper.appendChild(root);

    const anchor = getInsertAnchor();
    if (anchor && anchor.parentNode) {
      anchor.insertAdjacentElement('afterend', wrapper);
    } else if (document.body.firstChild) {
      document.body.insertBefore(wrapper, document.body.firstChild);
    } else {
      document.body.appendChild(wrapper);
    }
  }

  fetch('/api/top-ad', { cache: 'no-store' })
    .then(function (response) {
      if (!response.ok) throw new Error('failed to load top ad config');
      return response.json();
    })
    .then(function (raw) {
      const config = normalizeConfig(raw);
      if (!config.enabled) return;
      injectStyles();
      render(config);
    })
    .catch(function () {});
})();
