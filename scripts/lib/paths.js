// Where things live. Every script and the dev server read the project's layout from here.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const at = (...p) => path.join(ROOT, ...p);

export const PATHS = {
  core: at('src', 'core'),
  widgets: at('src', 'widgets'),
  assets: at('assets'),
  // apps
  siteApp: at('apps', 'site'),
  plainApp: at('apps', 'plain'),
  designerApp: at('apps', 'designer'),
  measureApp: at('apps', 'measure'),
  portraitsApp: at('apps', 'portraits'),
  plainPage: at('apps', 'plain', 'index.html'), // the one place the words live
  blog: at('content', 'blog'), // one Markdown file per post: content/blog/<slug>.md and images in content/blog/<slug>/
  // data: what people author, and what the build generates
  source: at('data', 'source'),
  generated: at('data', 'generated'),
  preview: at('data', 'preview'),
  photos: at('data', 'source', 'photos'), // the photos the loader portraits are traced from
  portraits: at('data', 'generated', 'portraits.json'),
  glyphs: at('data', 'source', 'sine-glyphs.json'),
  editorState: at('data', 'source', 'editor.json'),
  // output
  dist: at('dist'),
};

// The two layouts of the sine page: a wide one for computers, a narrow one for phones.
// `maxWidth` is only used by the fallback flow layout, when a page has not been measured.
export const LAYOUTS = [
  { name: 'wide', page: 'sine-page.json', measured: 'layout-wide.json', maxWidth: 30 },
  { name: 'narrow', page: 'sine-page-narrow.json', measured: 'layout-narrow.json', maxWidth: 13 },
];
