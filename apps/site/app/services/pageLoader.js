// Getting the sine page. Computers get the wide layout, phones the narrow one.
//
// The page is made from two small files, the measured layout and the letters it uses, by the same code that made the
// finished page file at build time (Layout.fromLayout), so it comes out exactly the same (scripts/check-compact.js proves
// it) while the website carries about 130 KB instead of about 1 MB. If those files are not there, the finished page file
// (data/sine-page*.json) is used instead: `npm run build:dist -- --classic` makes a website that way. ?classic on the
// address uses the finished page file while developing, to compare.
import { Layout } from '/core/index.js';
import { PHONE_MAX_WIDTH } from '../config.js';

export const isPhone = () => window.matchMedia(`(max-width: ${PHONE_MAX_WIDTH}px)`).matches;

// While developing, ?src=/preview/designer-page.json plays a page made in the designer.
function pageUrl() {
  const src = new URLSearchParams(window.location.search).get('src');
  if (src && /^\/(preview|data)\/[\w.-]+\.json$/.test(src)) return src;
  return isPhone() ? 'data/sine-page-narrow.json' : 'data/sine-page.json';
}

async function loadCompact() {
  const [layout, letters] = await Promise.all([
    fetch(isPhone() ? 'data/layout-narrow.json' : 'data/layout-wide.json', { cache: 'no-store' }),
    fetch('data/glyphs-used.json', { cache: 'no-store' }),
  ]);
  if (!layout.ok || !letters.ok) return null;
  const [L, G] = await Promise.all([layout.json(), letters.json()]);
  return Layout.fromLayout(L, G.glyphs, G.options);
}

async function loadFinished() {
  const r = await fetch(pageUrl(), { cache: 'no-store' });
  return r.ok ? await r.json() : null;
}

export async function loadPage() {
  const params = new URLSearchParams(window.location.search);
  try {
    if (!params.has('src') && !params.has('classic')) {
      const page = await loadCompact().catch(() => null);
      if (page) return page;
    }
    return await loadFinished();
  } catch (e) {
    return null; // no data yet
  }
}

// Calls onChange when the screen crosses between phone and computer width,
// which needs the other layout.
export function watchLayoutChange(onChange) {
  const was = isPhone();
  let t = 0;
  window.addEventListener('resize', () => {
    clearTimeout(t);
    t = setTimeout(() => { if (isPhone() !== was) onChange(); }, 300);
  });
}
