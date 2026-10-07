import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import { injectStaticImageAd } from '../scripts/static-image-ad.mjs';

const source = readFileSync(new URL('../public/static-image-ad.js', import.meta.url), 'utf8');
const config = { enabled: true, showLabel: true, imageUrl: '/ad.png', linkUrl: 'https://example.com', openInNewTab: true, imageWidth: 1200, imageHeight: 240, pagePath: '/cpsc_efiling_screening_tool.html' };

function browser(overrides = {}, embedded = false) {
  const element = tagName => ({ tagName: tagName.toUpperCase(), children: [], style: {}, attributes: {},
    appendChild(node) { this.children.push(node); },
    setAttribute(key, value) { this.attributes[key] = value; } });
  const footer = element('footer');
  const body = element('body');
  body.children.push(footer);
  body.insertBefore = (node, target) => {
    const index = body.children.indexOf(target);
    body.children.splice(index < 0 ? body.children.length : index, 0, node);
  };
  const document = { body, createElement: element, getElementById(id) {
    return id === 'static-image-ad-config' ? { textContent: JSON.stringify({ ...config, ...overrides }) } : body.children.find(node => node.id === id);
  } };
  const window = { location: { pathname: config.pagePath }, self: {}, top: {} };
  if (!embedded) window.top = window.self;
  const run = () => vm.runInNewContext(source, { window, document });
  run();
  return { body, footer, run };
}

test('standalone ad is before footer; labels, mobile image and links respect config', () => {
  const { body, footer, run } = browser({ showLabel: false, mobileImageUrl: '/mobile.png', mobileImageWidth: 750, mobileImageHeight: 300 });
  const ad = body.children[0];
  assert.equal(body.children[1], footer);
  assert.equal(ad.children.length, 1);
  const link = ad.children[0];
  assert.equal(link.rel, 'sponsored noopener noreferrer');
  assert.equal(link.children[0].children[0].srcset, '/mobile.png');
  run();
  assert.equal(body.children.length, 2, 'Repeated script does not duplicate ad');
  assert.equal(browser().body.children[0].children[0].textContent, '广告');
});

test('embedded, disabled, empty and wrong-page tools do not insert an ad', () => {
  for (const result of [browser({}, true), browser({ enabled: false }), browser({ imageUrl: '' }), browser({ pagePath: '/another.html' })]) {
    assert.equal(result.body.children.length, 1);
  }
});

test('build injection is idempotent and safely serializes image config', () => {
  const settings = { placements: { 'detail-bottom': { ...config, alt: '</script><script>bad()</script>' } } };
  const html = '<html><body><main>Tool</main></body></html>';
  const once = injectStaticImageAd(html, settings, config.pagePath);
  assert.equal(injectStaticImageAd(once, settings, config.pagePath), once);
  assert.equal((once.match(/id="static-image-ad-config"/g) || []).length, 1);
  assert.ok(!once.includes('</script><script>bad()'));
});
