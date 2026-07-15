import fs from 'fs'
import path from 'path'

const BAIDU_ANALYTICS_ID = 'f41283b760f768032fa2b7990826c3c3'
const PUBLIC_DIR = path.join(process.cwd(), 'public')
const HTML_SUFFIX = '.html'

const analyticsSnippet = [
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

function injectAnalytics(content) {
  if (hasBaiduAnalytics(content)) return content

  const bodyCloseTag = /<\/body>/i
  if (bodyCloseTag.test(content)) {
    return content.replace(bodyCloseTag, `${analyticsSnippet}\n</body>`)
  }

  const htmlCloseTag = /<\/html>/i
  if (htmlCloseTag.test(content)) {
    return content.replace(htmlCloseTag, `${analyticsSnippet}\n</html>`)
  }

  return `${content}\n${analyticsSnippet}\n`
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
  console.log(`Injected Baidu analytics: ${path.relative(process.cwd(), filePath)}`)
}

console.log(`Static analytics injection complete. Updated ${updatedCount} HTML file(s).`)
