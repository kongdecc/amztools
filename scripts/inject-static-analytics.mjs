import fs from 'fs'
import path from 'path'

const BAIDU_ANALYTICS_ID = 'f41283b760f768032fa2b7990826c3c3'
const GOOGLE_ANALYTICS_ID = 'G-MDVMB3KBBP'
const GOOGLE_ADSENSE_CLIENT = 'ca-pub-6790643369569237'
const PUBLIC_DIR = path.join(process.cwd(), 'public')
const HTML_SUFFIX = '.html'
const SITE_FAVICON_SNIPPET = '<link rel="icon" href="/site-icon-v2.svg" type="image/svg+xml" />'
const siteSeo = JSON.parse(fs.readFileSync(new URL('../src/config/site-seo.json', import.meta.url), 'utf8'))
const staticSeo = JSON.parse(fs.readFileSync(new URL('../src/config/static-seo.json', import.meta.url), 'utf8'))
const escapeHtml = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function injectSeo(content, filePath) {
  const key = '/' + path.relative(PUBLIC_DIR, filePath).split(path.sep).join('/')
  const entry = staticSeo[key]
  if (!entry) throw new Error('Missing static SEO entry: ' + key)
  let html = content.replace(/<!-- published-seo:start -->[\s\S]*?<!-- published-seo:end -->\s*/g, '')
    .replace(/<!-- published-intro:start -->[\s\S]*?<!-- published-intro:end -->\s*/g, '')
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\b(?=[^>]*\bname=["'](?:description|robots|google-site-verification|baidu-site-verification)["'])[^>]*>/gi, '')
    .replace(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/gi, '')
  const canonical = new URL(entry.canonical, siteSeo.siteUrl).href
  const tags = [
    '<!-- published-seo:start -->',
    '<title>' + escapeHtml(entry.title + ' - ' + siteSeo.siteName) + '</title>',
    '<meta name="description" content="' + escapeHtml(entry.description) + '">',
    '<link rel="canonical" href="' + escapeHtml(canonical) + '">',
    '<meta name="robots" content="index, follow">',
    ...[['google-site-verification', siteSeo.googleVerification], ['baidu-site-verification', siteSeo.baiduVerification]].filter(([, value]) => value).map(([name, value]) => '<meta name="' + name + '" content="' + escapeHtml(value) + '">'),
    '<!-- published-seo:end -->'
  ].join('\n')
  html = html.replace(/<\/head>/i, tags + '\n</head>')
  return html.replace(/^[\t ]+$/gm, '')
}
const FAVICON_LINK_PATTERN = /<link\b(?=[^>]*\brel\s*=\s*["'][^"']*\bicon\b[^"']*["'])[^>]*>/gi

const baiduAnalyticsSnippet = [
  '<script>',
  '  var _hmt = window._hmt || [];',
  '  (function() {',
  '    var hm = document.createElement("script");',
  `    hm.src = "https://hm.baidu.com/hm.js?${BAIDU_ANALYTICS_ID}";`,
  '    var s = document.getElementsByTagName("script")[0];',
  '    s.parentNode.insertBefore(hm, s);',
  '  })();',
  '</script>',
].join('\n')

const googleAnalyticsSnippet = [
  `<script async src="https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}"></script>`,
  '<script>',
  '  window.dataLayer = window.dataLayer || [];',
  '  function gtag(){dataLayer.push(arguments);}',
  "  gtag('js', new Date());",
  `  gtag('config', '${GOOGLE_ANALYTICS_ID}');`,
  '</script>',
].join('\n')

const googleAdsenseSnippet = `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${GOOGLE_ADSENSE_CLIENT}" crossorigin="anonymous"></script>`

function walkHtmlFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkHtmlFiles(fullPath))
      continue
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith(HTML_SUFFIX)) {
      files.push(fullPath)
    }
  }

  return files
}

function hasBaiduAnalytics(content) {
  return content.includes('hm.baidu.com/hm.js?') || content.includes('window._hmt')
}

function hasGoogleAnalytics(content) {
  return content.includes('googletagmanager.com/gtag/js?id=') || content.includes("gtag('config'")
}

function hasGoogleAdsense(content) {
  return content.includes('pagead2.googlesyndication.com/pagead/js/adsbygoogle.js')
}

function injectSnippet(content, snippet) {
  const bodyCloseTag = /<\/body>/i
  if (bodyCloseTag.test(content)) {
    return content.replace(bodyCloseTag, `${snippet}\n</body>`)
  }

  const htmlCloseTag = /<\/html>/i
  if (htmlCloseTag.test(content)) {
    return content.replace(htmlCloseTag, `${snippet}\n</html>`)
  }

  return `${content}\n${snippet}\n`
}

function injectFavicon(content) {
  let foundIcon = false
  const normalized = content.replace(FAVICON_LINK_PATTERN, () => {
    if (foundIcon) return ''
    foundIcon = true
    return SITE_FAVICON_SNIPPET
  })

  if (foundIcon) return normalized

  const headCloseTag = /<\/head>/i
  if (headCloseTag.test(normalized)) {
    return normalized.replace(headCloseTag, `  ${SITE_FAVICON_SNIPPET}\n</head>`)
  }

  return `${SITE_FAVICON_SNIPPET}\n${normalized}`
}

function injectHeadSnippet(content, snippet) {
  const headCloseTag = /<\/head>/i
  if (headCloseTag.test(content)) {
    return content.replace(headCloseTag, `  ${snippet}\n</head>`)
  }

  return `${snippet}\n${content}`
}

function injectAnalytics(content) {
  let nextContent = injectFavicon(content)

  if (!hasGoogleAdsense(nextContent)) {
    nextContent = injectHeadSnippet(nextContent, googleAdsenseSnippet)
  }

  if (!hasBaiduAnalytics(nextContent)) {
    nextContent = injectSnippet(nextContent, baiduAnalyticsSnippet)
  }

  if (!hasGoogleAnalytics(nextContent)) {
    nextContent = injectSnippet(nextContent, googleAnalyticsSnippet)
  }

  return nextContent
}

if (!fs.existsSync(PUBLIC_DIR)) {
  console.error(`Public directory not found: ${PUBLIC_DIR}`)
  process.exit(1)
}

const htmlFiles = walkHtmlFiles(PUBLIC_DIR)
let updatedCount = 0

for (const filePath of htmlFiles) {
  const original = fs.readFileSync(filePath, 'utf8')
  const injected = injectSeo(injectAnalytics(original), filePath)

  if (injected === original) continue

  fs.writeFileSync(filePath, injected, 'utf8')
  updatedCount += 1
  console.log(`Updated static page shell: ${path.relative(process.cwd(), filePath)}`)
}

console.log(`Static page shell update complete. Updated ${updatedCount} HTML file(s).`)
