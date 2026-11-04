// For a page with no script of its own (the plain site): start the loader, and let it
// go once the page has finished loading.
import { startLoader } from './index.js';

const loaded = document.readyState === 'complete'
  ? Promise.resolve()
  : new Promise((resolve) => window.addEventListener('load', resolve, { once: true }));
startLoader({ ready: Promise.all([loaded, document.fonts.ready]) });
