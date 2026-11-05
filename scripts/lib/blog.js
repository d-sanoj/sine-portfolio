// Turns content/blog/*.md into the plain pages at /blog/, and fills the latest three
// notes into the home page. Images must have alt text or this refuses to build.
import fs from 'node:fs';
import path from 'node:path';
import { PATHS } from './paths.js';
import { BlogError, parseMarkdown, inlineHtml } from './markdown.js';
import { gifFirstFrame, encodePNG, imageSize } from './gif.js';

export { BlogError };

export const SITE = process.env.SITE_ORIGIN || 'https://sanoj.dev';
// Bump when the home-page markup changes, so a publish rebuilds the sine layout.
export const HOME_VERSION = '2';

const CSS = fs.readFileSync(new URL('./blog.css', import.meta.url), 'utf8');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const LANG = {
  js: 'JavaScript', javascript: 'JavaScript', ts: 'TypeScript', typescript: 'TypeScript',
  py: 'Python', python: 'Python', rb: 'Ruby', sh: 'Shell', bash: 'Shell', shell: 'Shell',
  html: 'HTML', css: 'CSS', json: 'JSON', sql: 'SQL', go: 'Go', rs: 'Rust', rust: 'Rust',
  md: 'Markdown', yml: 'YAML', yaml: 'YAML', c: 'C', cpp: 'C++', java: 'Java', svg: 'SVG',
};

const SECTION_RE = /<!-- blog:section -->[\s\S]*?<!-- \/blog:section -->/;
const LATEST_RE = /<!-- blog:latest -->[\s\S]*?<!-- \/blog:latest -->/;

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function displayDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return d + ' ' + MONTHS[m - 1] + ' ' + y;
}

function eachBlock(blocks, fn) {
  for (const b of blocks || []) {
    fn(b);
    if (b.type === 'list') for (const item of b.items) eachBlock(item, fn);
    if (b.type === 'quote') eachBlock(b.blocks, fn);
    if (b.describe) eachBlock(b.describe, fn);
  }
}

function svgAnimated(text) {
  return /<\s*(animate|animateTransform|animateMotion|set)\b/i.test(text)
    || /@keyframes/i.test(text)
    || /\banimation(?:-name)?\s*:/i.test(text);
}

function svgViewBox(text) {
  const vb = /viewBox\s*=\s*["']([^"']+)["']/i.exec(text);
  if (!vb) return null;
  const p = vb[1].trim().split(/[\s,]+/).map(Number);
  if (p.length === 4 && p[2] > 0 && p[3] > 0) return { width: Math.round(p[2]), height: Math.round(p[3]) };
  return null;
}

// Inlines an SVG so a diagram uses the page font and an animation can be paused.
function inlineSvg(text, alt, titleId, animated) {
  let svg = text.replace(/^\uFEFF/, '').replace(/<\?xml[\s\S]*?\?>/g, '').replace(/<!DOCTYPE[^>]*>/gi, '');
  const ids = [];
  svg.replace(/\sid="([^"]+)"/g, (_, id) => { ids.push(id); return ''; });
  const prefix = titleId + '-';
  svg = svg.replace(/\sid="([^"]+)"/g, (_, id) => ` id="${prefix}${id}"`);
  // only rewrite references, not colours like #c9dcee
  for (const id of [...new Set(ids)].sort((a, b) => b.length - a.length)) {
    svg = svg.replaceAll('url(#' + id + ')', 'url(#' + prefix + id + ')');
    svg = svg.replaceAll('href="#' + id + '"', 'href="#' + prefix + id + '"');
    svg = svg.replaceAll("href='#" + id + "'", "href='#" + prefix + id + "'");
  }
  svg = svg.replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '');
  const pause = animated ? `<style>
@media (prefers-reduced-motion: reduce) {
  svg.blog-anim:not(.is-playing), svg.blog-anim:not(.is-playing) * { animation-play-state: paused !important; }
}
svg.blog-anim.is-paused, svg.blog-anim.is-paused * { animation-play-state: paused !important; }
</style>` : '';
  svg = svg.replace(/<svg\b([^>]*)>/i, (_, attrs) => {
    let a = attrs.replace(/\s(?:role|aria-labelledby)\s*=\s*("[^"]*"|'[^']*')/gi, '');
    if (animated) {
      if (!/\bclass\s*=/.test(a)) a += ' class="blog-anim"';
      else a = a.replace(/\bclass\s*=\s*(["'])([\s\S]*?)\1/, (m, q, cls) => `class=${q}${cls} blog-anim${q}`);
    }
    return `<svg${a} role="img" aria-labelledby="${titleId}">${pause}<title id="${titleId}">${esc(alt)}</title>`;
  });
  if (/viewBox\s*=/i.test(svg)) svg = svg.replace(/(<svg\b[^>]*?)\s(?:width|height)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '$1');
  return svg;
}

function assertSafeSvg(text, file, src) {
  if (/<\s*script\b/i.test(text)) throw new BlogError(file + ': SVG "' + src + '" contains a <script>. Remove it.');
  if (/<\s*foreignObject\b/i.test(text)) throw new BlogError(file + ': SVG "' + src + '" contains a foreignObject. Remove it.');
  if (/\son[a-z]+\s*=/i.test(text)) throw new BlogError(file + ': SVG "' + src + '" has an event handler. Remove it.');
  if (/javascript\s*:/i.test(text)) throw new BlogError(file + ': SVG "' + src + '" has a javascript: link. Remove it.');
}

function resolveAsset(src, post) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith('//') || src.startsWith('/') || src.split(/[\\/]/).includes('..')) {
    throw new BlogError(post.file + ': image "' + src + '" must be a file in content/blog/' + post.slug + '/ (not a web address)');
  }
  const root = path.resolve(post.dir) + path.sep;
  const abs = path.resolve(post.dir, src);
  if (!abs.startsWith(root)) throw new BlogError(post.file + ': image "' + src + '" escapes the post folder');
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    throw new BlogError(post.file + ': image "' + src + '" was not found at content/blog/' + post.slug + '/' + src);
  }
  return abs;
}

function checkAlt(img, post) {
  const where = post.file + ':' + img.line;
  const decorative = !!img.attrs.decorative;
  const alt = (img.alt || '').trim();
  if (decorative) {
    if (alt) throw new BlogError(where + ': a decorative image has to have empty alt. Write ![](' + img.src + '){decorative}.');
    if (img.caption) throw new BlogError(where + ': a decorative image cannot have a caption');
    if (img.describe) throw new BlogError(where + ': a decorative image cannot have a :::describe block');
    return;
  }
  if (!alt) {
    throw new BlogError(where + ': image "' + img.src + '" has no alt text.\n'
      + 'Describe it: ![' + 'What the picture shows' + '](' + img.src + ')\n'
      + 'Or mark it decorative: ![](' + img.src + '){decorative}');
  }
}

// Fills in how each image is published: a still frame for a GIF, inlined SVG, and so on.
function preparePost(post) {
  if (post.description.length > 220) {
    console.warn(post.file + ': description is ' + post.description.length + ' characters. Keep it to one sentence (the plain home shows it; the sine home only draws the title and date).');
  }
  if (post.cover) {
    const abs = resolveAsset(post.cover, post);
    if (!post.coverAlt || !post.coverAlt.trim()) throw new BlogError(post.file + ': cover needs coverAlt');
    post.coverAbs = abs;
    post.coverSize = imageSize(fs.readFileSync(abs)) || svgViewBox(fs.readFileSync(abs, 'utf8'));
  }
  let n = 0;
  eachBlock(post.blocks, (b) => {
    if (b.type !== 'image') return;
    checkAlt(b, post);
    const abs = resolveAsset(b.src, post);
    const ext = path.extname(b.src).toLowerCase();
    b.abs = abs;
    b.decorative = !!b.attrs.decorative;
    if (b.decorative) { b.kind = 'img'; return; }
    if (ext === '.gif' && !b.attrs.poster) {
      let frame;
      try { frame = gifFirstFrame(fs.readFileSync(abs)); }
      catch (e) { throw new BlogError(post.file + ':' + b.line + ': could not read GIF "' + b.src + '" (' + e.message + ')'); }
      b.width = frame.width;
      b.height = frame.height;
      if (frame.animated && !b.attrs.static) {
        b.kind = 'gif';
        b.posterName = path.basename(b.src, ext) + '.still.png';
        const posted = path.join(post.dir, b.posterName);
        if (fs.existsSync(posted)) b.posterPNG = null;
        else b.posterPNG = encodePNG(frame.width, frame.height, frame.rgba);
        return;
      }
      b.kind = 'img';
      return;
    }
    if (ext === '.svg') {
      const text = fs.readFileSync(abs, 'utf8');
      assertSafeSvg(text, post.file, b.src);
      const animated = !b.attrs.static && (b.attrs.animated || svgAnimated(text));
      const size = svgViewBox(text);
      if (size) { b.width = size.width; b.height = size.height; }
      b.kind = animated ? 'svg' : 'svg-still';
      b.svgText = text;
      b.titleId = 'figsvg-' + (++n);
      return;
    }
    if (b.attrs.animated || b.attrs.poster) {
      if (!b.attrs.poster) throw new BlogError(post.file + ':' + b.line + ': animated image "' + b.src + '" needs a still frame: {animated poster=still.png}');
      resolveAsset(b.attrs.poster, post);
      b.kind = 'gif';
      b.posterName = b.attrs.poster;
      b.posterPNG = null;
      const dim = imageSize(fs.readFileSync(abs));
      if (dim) { b.width = dim.width; b.height = dim.height; }
      return;
    }
    b.kind = 'img';
    const dim = imageSize(fs.readFileSync(abs));
    if (dim) { b.width = dim.width; b.height = dim.height; }
  });
}

export function loadPosts(dir = PATHS.blog) {
  if (!fs.existsSync(dir)) return [];
  const names = fs.readdirSync(dir).filter((n) => !n.startsWith('.'));
  const posts = [];
  const slugs = new Set();
  for (const name of names) {
    const abs = path.join(dir, name);
    if (fs.statSync(abs).isDirectory()) continue;
    if (!name.endsWith('.md')) throw new BlogError('content/blog/' + name + ' is not a post. Add notes as slug.md next to an optional slug/ folder of images.');
    const slug = name.slice(0, -3);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new BlogError('content/blog/' + name + ': use lowercase words separated by hyphens');
    const parsed = parseMarkdown(fs.readFileSync(abs, 'utf8'), 'content/blog/' + name);
    if (parsed.meta.slug && parsed.meta.slug !== slug) {
      throw new BlogError('content/blog/' + name + ': slug is ' + parsed.meta.slug + ' but the file name is ' + slug);
    }
    const post = {
      slug, file: 'content/blog/' + name, dir: path.join(dir, slug),
      title: parsed.meta.title, date: parsed.meta.date, description: parsed.meta.description,
      cover: parsed.meta.cover, coverAlt: parsed.meta.coverAlt, draft: parsed.meta.draft, lang: parsed.meta.lang,
      blocks: parsed.blocks,
    };
    if (!post.draft) preparePost(post);
    posts.push(post);
    slugs.add(slug);
  }
  for (const name of names) {
    const abs = path.join(dir, name);
    if (fs.statSync(abs).isDirectory() && !slugs.has(name)) throw new BlogError('content/blog/' + name + '/ has no ' + name + '.md next to it');
  }
  posts.sort((a, b) => b.date.localeCompare(a.date) || b.slug.localeCompare(a.slug));
  return posts;
}

export function publishedPosts(dir) {
  return loadPosts(dir).filter((p) => !p.draft);
}

function homeItem(post, i) {
  const n = String(i + 1).padStart(2, '0');
  // Description is plain-only: the sine home draws just the title and the date.
  return '        <li>\n'
    + '          <span class="num">' + n + '</span>\n'
    + '          <div>\n'
    + '            <h3><a href="../blog/' + esc(post.slug) + '/">' + esc(post.title) + '</a></h3>\n'
    + '            <div class="links">\n'
    + '              <span class="item"><time datetime="' + post.date + '">' + esc(displayDate(post.date)) + '</time></span>\n'
    + '              <span class="item" data-plain-only>' + esc(post.description) + '</span>\n'
    + '            </div>\n'
    + '          </div>\n'
    + '        </li>';
}

// Latest three published notes, in the same list the projects use. Empty removes the section.
export function applyHome(html, posts) {
  if (!SECTION_RE.test(html) || !LATEST_RE.test(html)) {
    throw new BlogError('apps/plain/index.html is missing the <!-- blog:section --> / <!-- blog:latest --> markers');
  }
  const list = (posts || []).filter((p) => !p.draft).slice(0, 3);
  if (!list.length) return html.replace(SECTION_RE, '');
  const items = list.map(homeItem).join('\n');
  return html.replace(LATEST_RE, '<!-- blog:latest -->\n' + items + '\n        <!-- /blog:latest -->');
}

export function injectHome(html, dir = PATHS.blog) {
  return applyHome(html, publishedPosts(dir));
}

function mapHref(href, ctx) {
  const raw = href.replace(/&amp;/g, '&');
  if (/^(https?:|mailto:|tel:)/i.test(raw) || raw.startsWith('/')) return raw;
  if (raw.startsWith('#')) return ctx.pageUrl ? ctx.pageUrl + raw : raw;
  const slug = raw.replace(/^\.\//, '').replace(/\.md$/, '').replace(/\/$/, '').replace(/^\.\.\//, '');
  if (ctx.slugs && ctx.slugs.has(slug)) {
    const rel = ctx.depth > 1 ? '../' + slug + '/' : slug + '/';
    return ctx.pageUrl ? new URL(rel, ctx.pageUrl).href : rel;
  }
  if (ctx.pageUrl && raw && !raw.startsWith('#')) {
    try { return new URL(raw, ctx.pageUrl).href; } catch (e) { return raw; }
  }
  return raw;
}

function rewriteHrefs(html, ctx) {
  return html.replace(/href="([^"]*)"/g, (_, href) => 'href="' + esc(mapHref(href, ctx)) + '"');
}

function renderInline(src, ctx) {
  return rewriteHrefs(inlineHtml(src), ctx);
}

const ANIM_SCRIPT = `<script>
(function () {
  document.documentElement.classList.add('js');
  var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  var figs = [].slice.call(document.querySelectorAll('figure.anim'));
  function paint(fig, playing) {
    var img = fig.querySelector('img[data-animated-src]');
    var svg = fig.querySelector('svg');
    var btn = fig.querySelector('.anim-control');
    if (img) img.src = playing ? img.getAttribute('data-animated-src') : img.getAttribute('data-still-src');
    if (svg) {
      svg.classList.toggle('is-playing', playing);
      svg.classList.toggle('is-paused', !playing);
      if (svg.pauseAnimations) {
        if (playing) svg.unpauseAnimations();
        else { svg.pauseAnimations(); try { svg.setCurrentTime(0); } catch (e) {} }
      }
    }
    if (btn) {
      btn.setAttribute('aria-pressed', playing ? 'true' : 'false');
      btn.textContent = playing ? 'Pause animation' : 'Play animation';
    }
    fig._playing = playing;
  }
  figs.forEach(function (fig) { paint(fig, !mq.matches); });
  figs.forEach(function (fig) {
    var btn = fig.querySelector('.anim-control');
    if (!btn) return;
    btn.addEventListener('click', function () { paint(fig, !fig._playing); });
  });
  if (mq.addEventListener) mq.addEventListener('change', function () {
    figs.forEach(function (fig) { paint(fig, !mq.matches); });
  });
})();
</script>`;

function renderBlocks(blocks, ctx) {
  return blocks.map((b) => renderBlock(b, ctx)).join('\n');
}

function renderBlock(b, ctx) {
  if (b.type === 'heading') {
    return '<h' + b.level + ' id="' + esc(b.id) + '">' + renderInline(b.text, ctx) + '</h' + b.level + '>';
  }
  if (b.type === 'p') return '<p>' + rewriteHrefs(b.html, ctx) + '</p>';
  if (b.type === 'hr') return '<hr>';
  if (b.type === 'quote') return '<blockquote>\n' + renderBlocks(b.blocks, ctx) + '\n</blockquote>';
  if (b.type === 'list') {
    const tag = b.ordered ? 'ol' : 'ul';
    return '<' + tag + '>\n' + b.items.map((item) => '<li>\n' + renderBlocks(item, ctx) + '\n</li>').join('\n') + '\n</' + tag + '>';
  }
  if (b.type === 'code') {
    ctx.code = (ctx.code || 0) + 1;
    const id = 'code-' + ctx.code;
    const name = LANG[b.lang.toLowerCase()] || (b.lang ? b.lang : 'Code');
    return '<div class="code-block"><p class="code-label" id="' + id + '">' + esc(name) + '</p><pre><code aria-labelledby="' + id + '" translate="no">' + esc(b.text) + '</code></pre></div>';
  }
  if (b.type === 'table') {
    ctx.table = (ctx.table || 0) + 1;
    const id = 'table-' + ctx.table;
    const label = b.caption ? ' aria-labelledby="' + id + '-cap"' : ' aria-label="Table"';
    const cap = b.caption ? '<caption id="' + id + '-cap">' + renderInline(b.caption, ctx) + '</caption>' : '';
    const th = b.header.map((cell, i) => {
      const align = b.align[i] && b.align[i] !== 'left' ? ' class="' + b.align[i] + '"' : '';
      return '<th scope="col"' + align + '>' + renderInline(cell, ctx) + '</th>';
    }).join('');
    const rows = b.rows.map((row) => '<tr>' + row.map((cell, i) => {
      const align = b.align[i] && b.align[i] !== 'left' ? ' class="' + b.align[i] + '"' : '';
      return '<td' + align + '>' + renderInline(cell, ctx) + '</td>';
    }).join('') + '</tr>').join('\n');
    return '<div class="table-wrap" role="region" tabindex="0"' + label + '><table>' + cap + '<thead><tr>' + th + '</tr></thead><tbody>\n' + rows + '\n</tbody></table></div>';
  }
  if (b.type === 'image') return renderFigure(b, ctx);
  return '';
}

function wh(b) {
  if (!b.width || !b.height) return '';
  return ' width="' + b.width + '" height="' + b.height + '"';
}

function renderFigure(b, ctx) {
  if (b.decorative) {
    const src = (ctx.assetBase || '') + b.src;
    return '<p><img src="' + esc(src) + '" alt=""></p>';
  }
  ctx.fig = (ctx.fig || 0) + 1;
  const id = 'fig-' + ctx.fig;
  const base = ctx.assetBase || '';
  let media = '';
  let button = '';
  const anim = b.kind === 'gif' || b.kind === 'svg';
  if (b.kind === 'svg' || b.kind === 'svg-still') {
    if (!b.svgHtml) b.svgHtml = inlineSvg(b.svgText, b.alt.trim(), b.titleId || id + '-title', b.kind === 'svg');
    media = b.svgHtml;
  } else if (b.kind === 'gif') {
    const still = base + b.posterName;
    const gif = base + b.src;
    media = '<img src="' + esc(still) + '" alt="' + esc(b.alt.trim()) + '" data-still-src="' + esc(still) + '" data-animated-src="' + esc(gif) + '"' + wh(b) + '>';
  } else {
    media = '<img src="' + esc(base + b.src) + '" alt="' + esc(b.alt.trim()) + '"' + wh(b) + '>';
  }
  if (anim) {
    button = '<button type="button" class="anim-control" aria-pressed="false" aria-controls="' + id + '-media">Play animation</button>';
  }
  const cap = b.caption ? '<figcaption>' + renderInline(b.caption, ctx) + '</figcaption>' : '';
  let desc = '';
  if (b.describe) {
    const summary = anim ? 'Text description of this animation' : 'Text description of this diagram';
    desc = '<details class="longdesc"><summary>' + summary + '</summary><div class="longdesc-body">\n' + renderBlocks(b.describe, ctx) + '\n</div></details>';
  }
  return '<figure class="figure' + (anim ? ' anim' : '') + '" id="' + id + '">'
    + '<div class="figure-media" id="' + id + '-media">' + media + '</div>'
    + button + cap + desc + '</figure>';
}

const HOME_PREF_SCRIPT = `<script>
(function () {
  var KEY = 'sanoj-home';
  var root = __ROOT__;
  var boring = __BORING__;
  function prefer() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function apply() {
    var v = prefer();
    var href = v === 'plain' ? boring : root;
    document.querySelectorAll('[data-home]').forEach(function (a) { a.setAttribute('href', href); });
  }
  apply();
})();
</script>`;

function shell(opts) {
  const depth = opts.depth;
  const up = '../'.repeat(depth);
  const css = CSS.replaceAll('__FONT__', up + 'assets/fonts/JosefinSans-VF.ttf');
  const home = up || './';
  const blog = depth > 1 ? '../' : './';
  const feed = (depth > 1 ? '../' : '') + 'feed.xml';
  const current = opts.current === 'blog' ? ' aria-current="page"' : '';
  const anim = opts.animated ? ANIM_SCRIPT : '';
  return '<!doctype html>\n<html lang="' + esc(opts.lang || 'en') + '">\n<head>\n'
    + '<meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
    + '<title>' + esc(opts.title) + '</title>\n'
    + '<meta name="description" content="' + esc(opts.description) + '">\n'
    + '<meta name="author" content="Sanoj">\n'
    + '<meta name="color-scheme" content="dark">\n'
    + '<meta name="theme-color" content="#131313">\n'
    + '<link rel="canonical" href="' + esc(opts.canonical) + '">\n'
    + '<link rel="alternate" type="application/atom+xml" title="Sanoj · Blog" href="' + feed + '">\n'
    + '<meta property="og:site_name" content="Sanoj">\n'
    + '<meta property="og:title" content="' + esc(opts.ogTitle || opts.title) + '">\n'
    + '<meta property="og:description" content="' + esc(opts.description) + '">\n'
    + '<meta property="og:type" content="' + (opts.ogType || 'website') + '">\n'
    + '<meta property="og:url" content="' + esc(opts.canonical) + '">\n'
    + (opts.ogImage ? '<meta property="og:image" content="' + esc(opts.ogImage) + '">\n<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:image" content="' + esc(opts.ogImage) + '">\n' : '<meta name="twitter:card" content="summary">\n')
    + '<meta name="twitter:title" content="' + esc(opts.ogTitle || opts.title) + '">\n'
    + '<meta name="twitter:description" content="' + esc(opts.description) + '">\n'
    + (opts.published ? '<meta property="article:published_time" content="' + opts.published + '">\n' : '')
    + (opts.noindex ? '<meta name="robots" content="noindex">\n' : '')
    + '<link rel="icon" href="' + up + 'assets/favicon.svg?v=2" type="image/svg+xml">\n'
    + '<link rel="icon" href="' + up + 'assets/favicon-32.png?v=2" type="image/png" sizes="32x32">\n'
    + '<link rel="apple-touch-icon" href="' + up + 'assets/apple-touch-icon.png?v=2">\n'
    + '<link rel="preload" href="' + up + 'assets/fonts/JosefinSans-VF.ttf" as="font" type="font/ttf" crossorigin>\n'
    + (opts.extraHead || '')
    + '<style>\n' + css + '\n</style>\n</head>\n<body>\n'
    + '<header class="top">\n'
    + '<a class="skip" href="#content">Skip to content</a>\n'
    + '<div class="wrap">\n'
    + '<a class="brand" href="' + home + '" data-home>Sanoj</a>\n'
    + '<nav class="links" aria-label="Main">\n'
    + '<span class="item"><a href="' + home + '" data-home>Home</a></span>\n'
    + '<span class="item"><a href="' + blog + '"' + current + '>Blog</a></span>\n'
    + '<span class="item"><a href="https://github.com/d-sanoj">GitHub</a></span>\n'
    + '</nav>\n</div>\n</header>\n'
    + '<main id="content" tabindex="-1">\n<div class="wrap">\n' + opts.body + '\n</div>\n</main>\n'
    + '<footer>\n<div class="wrap">\n<p>Sanoj</p>\n<p><a href="' + feed + '">Feed</a></p>\n</div>\n</footer>\n'
    + anim + '\n'
    + HOME_PREF_SCRIPT.replace('__ROOT__', JSON.stringify(home || './')).replace('__BORING__', JSON.stringify((up || './') + 'boring/'))
    + '\n</body>\n</html>\n';
}

function hasAnim(blocks) {
  let yes = false;
  eachBlock(blocks, (b) => { if (b.type === 'image' && (b.kind === 'gif' || b.kind === 'svg')) yes = true; });
  return yes;
}

export function renderIndex(posts) {
  const published = posts.filter((p) => !p.draft);
  const items = published.length
    ? '<ul class="post-list">\n' + published.map((p) => (
      '<li><article>\n<h2><a href="' + esc(p.slug) + '/">' + esc(p.title) + '</a></h2>\n'
      + '<p class="meta"><time datetime="' + p.date + '">' + esc(displayDate(p.date)) + '</time></p>\n'
      + '<p>' + esc(p.description) + '</p>\n</article></li>'
    )).join('\n') + '\n</ul>'
    : '<p>No notes yet.</p>';
  const description = 'Notes by Sanoj on AI and how things work.';
  return shell({
    title: 'Blog · Sanoj',
    description,
    depth: 1,
    canonical: SITE + '/blog/',
    current: 'blog',
    ogTitle: 'Blog · Sanoj',
    body: '<p class="label">Notes</p>\n<h1>Blog</h1>\n<p>Short explainers of AI and the tools around it. The newest note is first.</p>\n' + items,
  });
}

export function renderPost(post, posts) {
  if (post.draft && !post.kind && post.blocks) {
    // a draft opened while developing: check its images now, and say it is a draft
    try { preparePost(post); } catch (e) { throw e; }
  }
  const slugs = new Set(posts.filter((p) => !p.draft).map((p) => p.slug));
  const pageUrl = SITE + '/blog/' + post.slug + '/';
  const ctx = { slugs, depth: 2, pageUrl: null, assetBase: '' };
  const prose = renderBlocks(post.blocks, ctx);
  const ctxAbs = { slugs, depth: 2, pageUrl, assetBase: pageUrl };
  post.html = prose;
  post.htmlAbsolute = renderBlocks(post.blocks, ctxAbs);
  const cover = post.cover ? pageUrl + post.cover : '';
  const draft = post.draft ? '<p class="draft" role="status">This is a draft. It is not on the public site.</p>\n' : '';
  const body = draft
    + '<article>\n<header class="article-head">\n<p class="label">Blog</p>\n<h1>' + esc(post.title) + '</h1>\n'
    + '<p class="meta"><time datetime="' + post.date + '">' + esc(displayDate(post.date)) + '</time></p>\n</header>\n'
    + '<div class="prose">\n' + prose + '\n<p class="back"><a href="../">All notes</a></p>\n</div>\n</article>';
  return shell({
    title: post.title + ' · Sanoj',
    ogTitle: post.title,
    description: post.description,
    depth: 2,
    lang: post.lang,
    canonical: pageUrl,
    ogType: 'article',
    ogImage: cover,
    published: post.date + 'T00:00:00Z',
    noindex: !!post.draft,
    animated: hasAnim(post.blocks),
    body,
  });
}

export function renderFeed(posts) {
  const published = posts.filter((p) => !p.draft);
  const updated = (published[0] ? published[0].date : '2026-01-01') + 'T00:00:00Z';
  const entries = published.map((p) => {
    if (!p.htmlAbsolute) renderPost(p, posts);
    return '<entry>\n'
      + '<title>' + esc(p.title) + '</title>\n'
      + '<link href="' + SITE + '/blog/' + p.slug + '/"/>\n'
      + '<id>' + SITE + '/blog/' + p.slug + '/</id>\n'
      + '<updated>' + p.date + 'T00:00:00Z</updated>\n'
      + '<published>' + p.date + 'T00:00:00Z</published>\n'
      + '<summary>' + esc(p.description) + '</summary>\n'
      + '<content type="html">' + esc(p.htmlAbsolute) + '</content>\n'
      + '</entry>';
  }).join('\n');
  return '<?xml version="1.0" encoding="utf-8"?>\n'
    + '<feed xmlns="http://www.w3.org/2005/Atom">\n'
    + '<title>Sanoj · Blog</title>\n'
    + '<subtitle>Notes on AI and how things work.</subtitle>\n'
    + '<link href="' + SITE + '/blog/feed.xml" rel="self"/>\n'
    + '<link href="' + SITE + '/blog/"/>\n'
    + '<updated>' + updated + '</updated>\n'
    + '<id>' + SITE + '/blog/</id>\n'
    + '<author><name>Sanoj</name></author>\n'
    + entries + '\n</feed>\n';
}

function renderMissing() {
  return shell({
    title: 'Not found · Sanoj',
    description: 'That note is not on this blog.',
    depth: 1,
    canonical: SITE + '/blog/',
    body: '<h1>No such note</h1>\n<p>That page is not on the blog. The notes that are live are <a href="./">listed here</a>.</p>',
  });
}

function copyDirFiles(from, to) {
  if (!fs.existsSync(from)) return;
  for (const name of fs.readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const src = path.join(from, name);
    if (fs.statSync(src).isDirectory()) throw new BlogError('content/blog image folders are flat; ' + name + ' contains another folder');
    fs.copyFileSync(src, path.join(to, name));
  }
}

function writeStills(post, dir) {
  eachBlock(post.blocks, (b) => {
    if (b.type === 'image' && b.posterPNG) fs.writeFileSync(path.join(dir, b.posterName), b.posterPNG);
  });
}

export function buildBlog(outDir, dir = PATHS.blog) {
  const posts = loadPosts(dir);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), renderIndex(posts));
  fs.writeFileSync(path.join(outDir, 'feed.xml'), renderFeed(posts));
  const published = posts.filter((p) => !p.draft);
  for (const post of published) {
    const dest = path.join(outDir, post.slug);
    fs.mkdirSync(dest, { recursive: true });
    copyDirFiles(post.dir, dest);
    writeStills(post, dest);
    fs.writeFileSync(path.join(dest, 'index.html'), renderPost(post, posts));
  }
  return published.length;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.xml': 'application/atom+xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.txt': 'text/plain; charset=utf-8',
};

function stillFor(post, name) {
  if (!name.endsWith('.still.png')) return null;
  const gifName = name.slice(0, -'.still.png'.length) + '.gif';
  const gifPath = path.join(post.dir, gifName);
  if (!fs.existsSync(gifPath)) return null;
  const frame = gifFirstFrame(fs.readFileSync(gifPath));
  return encodePNG(frame.width, frame.height, frame.rgba);
}

// Dev server: /blog and /blog/... from the Markdown, including drafts so a note can be previewed.
export function handleBlog(pathname, dir = PATHS.blog) {
  let posts;
  try { posts = loadPosts(dir); }
  catch (e) { return { status: 500, type: 'text/plain; charset=utf-8', body: e.message + '\n' }; }
  if (pathname === '/blog') return { status: 301, location: '/blog/' };
  const rel = pathname.slice('/blog/'.length);
  if (rel === '' || rel === 'index.html') return { status: 200, type: MIME['.html'], body: renderIndex(posts) };
  if (rel === 'feed.xml') return { status: 200, type: MIME['.xml'], body: renderFeed(posts) };
  const postPath = /^([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/.exec(rel);
  if (postPath && !rel.endsWith('/') && !rel.includes('.')) return { status: 301, location: '/blog/' + postPath[1] + '/' };
  if (postPath) {
    const post = posts.find((p) => p.slug === postPath[1]);
    if (!post) return { status: 404, type: MIME['.html'], body: renderMissing() };
    try { return { status: 200, type: MIME['.html'], body: renderPost(post, posts) }; }
    catch (e) { return { status: 500, type: 'text/plain; charset=utf-8', body: e.message + '\n' }; }
  }
  const filePath = /^([a-z0-9]+(?:-[a-z0-9]+)*)\/([^/]+)$/.exec(rel);
  if (filePath && !filePath[2].split('/').includes('..')) {
    const post = posts.find((p) => p.slug === filePath[1]);
    if (!post) return { status: 404, type: 'text/plain; charset=utf-8', body: 'not found\n' };
    const abs = path.resolve(post.dir, filePath[2]);
    const root = path.resolve(post.dir) + path.sep;
    if (!abs.startsWith(root)) return { status: 404, type: 'text/plain; charset=utf-8', body: 'not found\n' };
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      return { status: 200, type: MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream', body: fs.readFileSync(abs) };
    }
    const generated = stillFor(post, filePath[2]);
    if (generated) return { status: 200, type: 'image/png', body: generated };
  }
  return { status: 404, type: MIME['.html'], body: renderMissing() };
}
