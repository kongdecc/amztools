import fs from 'fs'
import path from 'path'

const BAIDU_ANALYTICS_ID = 'f41283b760f768032fa2b7990826c3c3'
const GOOGLE_ANALYTICS_ID = 'G-MDVMB3KBBP'
const PUBLIC_DIR = path.join(process.cwd(), 'public')
const HTML_SUFFIX = '.html'
const SITE_FAVICON_SNIPPET = '<link rel="icon" href="/api/favicon" />'
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

function injectAnalytics(content) {
  let nextContent = injectFavicon(content)

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
  const injected = injectAnalytics(original)

  if (injected === original) continue

  fs.writeFileSync(filePath, injected, 'utf8')
  updatedCount += 1
  console.log(`Updated static page shell: ${path.relative(process.cwd(), filePath)}`)
}

console.log(`Static page shell update complete. Updated ${updatedCount} HTML file(s).`)
