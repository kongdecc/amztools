export function injectStaticImageAd(html, config, pagePath) {
  const clean = html.replace(/<!-- static-image-ad:start -->[\s\S]*?<!-- static-image-ad:end -->\s*/g, '')
  const { notes, ...placement } = config.placements['detail-bottom']
  const data = JSON.stringify({ ...placement, pagePath }).replace(/</g, '\\u003c')
  const snippet = `<!-- static-image-ad:start -->
<script id="static-image-ad-config" type="application/json">${data}</script>
<script src="/static-image-ad.js" defer></script>
<!-- static-image-ad:end -->`
  return clean.replace(/<\/body>/i, `${snippet}\n</body>`)
}
