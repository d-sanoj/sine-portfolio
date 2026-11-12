// The portrait loader. A page needs an empty <div id="sine-loader"></div> as the first
// thing in its body (with the small style that makes it cover the screen) and then
//
//   import { startLoader } from 'widgets/loader/index.js';
//   const loader = startLoader({ ready: somePromise, mode: 'fade' });
//
// It shows a circle that becomes a portrait drawn from sine waves, holds, dissolves,
// and does it again with another random portrait, until `ready` settles. Then:
//
//   mode 'fade' (the default)  the loader fades away; `loader.finished` resolves as it starts to.
//   mode 'circle'              the portrait dissolves into a circle and `await loader.circle` gives
//                              it, { x, y, r } in page pixels, for the page to divide into its
//                              letters' circles. The page then calls loader.showPage() (the
//                              loader's background goes, the circle stays) and loader.release().
//
// If it cannot run (no portraits, no element, ?noloader, reduced motion) it removes itself at
// once and `finished` resolves straight away and `circle` is null: the page just starts.
import { PortraitSet } from './model/PortraitSet.js';
import { PortraitView } from './view/PortraitView.js';
import { LoaderController } from './controller/LoaderController.js';

function skipped(root) {
  if (root) root.remove();
  document.documentElement.style.overflow = '';
  return { finished: Promise.resolve(), circle: Promise.resolve(null), showPage() {}, release() {} };
}

export function startLoader({ ready, mode = 'fade' }) {
  const root = document.getElementById('sine-loader');
  if (!root) return skipped(null);
  if (new URLSearchParams(window.location.search).has('noloader')) return skipped(root); // used by apps/measure
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return skipped(root);
  const savedOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = 'hidden'; // no scrolling behind the loader

  // Show the loader's circle at once, before the portraits have arrived: otherwise the loader is
  // a black panel until the portrait file has been fetched and drawn. The controller takes the
  // circle over (and removes this ring) as soon as it starts.
  const ring = document.createElement('div');
  ring.setAttribute('aria-hidden', 'true');
  ring.style.cssText = 'position:absolute;left:50%;top:50%;width:min(96vw,96vh);height:min(96vw,96vh);transform:translate(-50%,-50%);border:1px solid #ffffff;border-radius:50%;';
  root.appendChild(ring);

  let controller = null;
  const started = PortraitSet.load().then((set) => {
    ring.remove();
    if (!set) { skipped(root); return null; }
    controller = new LoaderController({ root, set, view: new PortraitView(root), ready, savedOverflow, mode });
    return controller;
  });
  return {
    finished: started.then((c) => (c ? c.finished : undefined)),
    circle: started.then((c) => (c ? c.circle : null)),
    showPage() { if (controller) controller.showPage(); },
    release(options) { if (controller) controller.release(options); },
  };
}
