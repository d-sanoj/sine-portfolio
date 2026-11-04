// Which URL shows which folder, and which files the designer tools may write.
// The first group mirrors the published website (see scripts/lib/dist.js); the second
// group only exists while developing.
import path from 'node:path';
import { PATHS } from '../scripts/lib/paths.js';

export const ROUTES = [
  // published
  { prefix: '/boring/', dir: PATHS.plainApp },
  { prefix: '/core/', dir: PATHS.core },
  { prefix: '/widgets/', dir: PATHS.widgets },
  { prefix: '/assets/', dir: PATHS.assets },
  { prefix: '/data/', dir: PATHS.generated },
  // development only
  { prefix: '/designer/', dir: PATHS.designerApp },
  { prefix: '/measure/', dir: PATHS.measureApp },
  { prefix: '/portraits/', dir: PATHS.portraitsApp },
  { prefix: '/photos/', dir: PATHS.photos },
  { prefix: '/source/', dir: PATHS.source },
  { prefix: '/preview/', dir: PATHS.preview },
  // everything else is the sine site
  { prefix: '/', dir: PATHS.siteApp },
];

// The only files the tools may write (POST /api/save/<name>).
export const WRITABLE = {
  'editor.json': path.join(PATHS.source, 'editor.json'),
  'designer-text.txt': path.join(PATHS.source, 'designer-text.txt'),
  'sine-glyphs.json': path.join(PATHS.source, 'sine-glyphs.json'),
  'designer-page.json': path.join(PATHS.preview, 'designer-page.json'),
  'layout-wide.json': path.join(PATHS.generated, 'layout-wide.json'),
  'layout-narrow.json': path.join(PATHS.generated, 'layout-narrow.json'),
  'portraits.json': PATHS.portraits,
  'portraits-contact.png': path.join(PATHS.preview, 'portraits-contact.png'),
};
