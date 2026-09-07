import assert from 'node:assert/strict'
import fs from 'node:fs'

const origin = process.argv[2] || 'http://localhost:3000'
const config = JSON.parse(fs.readFileSync(new URL('../src/config/site-seo.json', import.meta.url), 'utf8'))
async function request(path) {
  const response = await fetch(new URL(path, origin), { redirect: 'manual', signal: AbortSignal.timeout(30000) })
  return { response, body: await response.text() }
}
const { response: sitemapResponse, body: sitemap } = await request('/sitemap.xml')
assert.equal(sitemapResponse.status, 200)
assert(!sitemap.includes('<lastmod>'), 'Do not emit unverified modification dates')
const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1].replace(/&amp;/g, '&'))
assert(urls.length > 50, 'Expected complete tool and blog sitemap')
assert.equal(new Set(urls).size, urls.length, 'Duplicate sitemap URLs')
assert(urls.includes(config.siteUrl + '/amazon-ads-analyzer/index.html'))
assert(!urls.includes(config.siteUrl + '/functionality/amazon-ads-analyzer'))
const queue = [...urls]
await Promise.all(Array.from({ length: 4 }, async () => {
  while (queue.length) {
    const url = queue.shift()
    assert(url.startsWith(config.siteUrl + '/'))
    const { response, body } = await request(new URL(url).pathname)
    assert.equal(response.status, 200, url + ' must be a final 200 page')
    const canonical = body.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1]
    assert(canonical, url + ' missing canonical')
    assert.equal(new URL(canonical).href, new URL(url).href, url + ' canonical mismatch')
    assert(/<title>[^<]+<\/title>/.test(body), url + ' missing title')
    assert(/<meta[^>]*name="description"[^>]*content="[^"]+"/.test(body), url + ' missing description')
    assert(!/<meta[^>]*name="robots"[^>]*content="[^"]*noindex/.test(body), url + ' unexpectedly noindex')
  }
}))
for (const path of ['/functionality/nonexistent-seo-test', '/functionality/invoice-generator', '/blog/nonexistent-seo-test']) {
  assert.equal((await request(path)).response.status, 404, path)
}
const redirect = await request('/functionality/amazon-ads-analyzer')
assert.equal(redirect.response.status, 308)
assert.equal(redirect.response.headers.get('location'), '/amazon-ads-analyzer/index.html')
const home = (await request('/')).body
assert(home.includes('href="/functionality/ad-calc"'), 'Home must link directly to tools')
assert(home.includes('跨境工具魔方'))
assert((await request('/functionality/ad-calc')).body.includes('最高 CPC'), 'Tool instructions must be server-rendered')
assert((await request('/robots.txt')).body.includes(config.siteUrl + '/sitemap.xml'))
const posts = JSON.parse((await request('/api/published/blog?pageSize=100')).body)
assert.equal(posts.total, 9)
assert(posts.items.every(post => post.status === 'published' && post.content))
console.log('PASS: ' + urls.length + ' final sitemap pages, metadata, canonical, redirects, 404, public blog and server-rendered tool instructions')
