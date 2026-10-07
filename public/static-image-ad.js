(() => {
  // Embedded tools already receive an ad from the surrounding site layout.
  if (window.self !== window.top || document.getElementById('static-detail-bottom-ad')) return;
  const data = document.getElementById('static-image-ad-config');
  if (!data) return;
  let config;
  try { config = JSON.parse(data.textContent); } catch { return; }
  const pagePath = window.location.pathname.replace(/\/$/, '/index.html');
  if (pagePath !== config.pagePath || !config.enabled || !String(config.imageUrl || '').trim()) return;

  const section = document.createElement('section');
  section.id = 'static-detail-bottom-ad';
  section.setAttribute('aria-label', '工具详情底部广告');
  section.style.cssText = 'display:block;box-sizing:border-box;width:calc(100% - 32px);max-width:1280px;flex:0 0 auto;margin:32px auto 24px;padding:12px;border:1px solid #e5e7eb;border-radius:12px;background:white;text-align:left;';
  if (config.showLabel !== false) {
    const label = document.createElement('div');
    label.textContent = '广告';
    label.style.cssText = 'margin-bottom:8px;font:11px/1.5 sans-serif;color:#9ca3af;';
    section.appendChild(label);
  }
  const picture = document.createElement('picture');
  if (config.mobileImageUrl) {
    const source = document.createElement('source');
    source.media = '(max-width: 767px)';
    source.srcset = config.mobileImageUrl;
    source.setAttribute('width', config.mobileImageWidth);
    source.setAttribute('height', config.mobileImageHeight);
    picture.appendChild(source);
  }
  const image = document.createElement('img');
  image.src = config.imageUrl;
  image.alt = config.alt || '广告';
  image.width = config.imageWidth;
  image.height = config.imageHeight;
  image.loading = 'lazy';
  image.decoding = 'async';
  image.style.cssText = 'display:block;width:100%;height:auto;border-radius:8px;';
  picture.appendChild(image);
  if (String(config.linkUrl || '').trim()) {
    const link = document.createElement('a');
    link.href = config.linkUrl;
    link.target = config.openInNewTab ? '_blank' : '_self';
    link.rel = config.openInNewTab ? 'sponsored noopener noreferrer' : 'sponsored';
    link.style.display = 'block';
    link.appendChild(picture);
    section.appendChild(link);
  } else section.appendChild(picture);
  // Only consider a direct body footer, not result cards or footers inside the tool.
  const footer = Array.from(document.body.children).find(node => node.tagName === 'FOOTER');
  document.body.insertBefore(section, footer || null);
})();
