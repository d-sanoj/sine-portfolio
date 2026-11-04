// The sine site. This file only wires the pieces together:
//   model/       the page ready to animate      view/        drawing it
//   controller/  time, links, the keyboard      services/    getting the page file
// Press Space to replay.
import { PageModel } from './model/PageModel.js';
import { CanvasView } from './view/CanvasView.js';
import { PlayController } from './controller/PlayController.js';
import { LinkController } from './controller/LinkController.js';
import { loadPage, watchLayoutChange } from './services/pageLoader.js';
import { GatherController } from './controller/GatherController.js';
import { ScrollController } from './controller/ScrollController.js';
import { HintController } from './controller/HintController.js';
import { RealTextView } from './view/RealTextView.js';
import { startLoader } from '/widgets/loader/index.js';

// The big portrait loader covers the screen while the page file arrives. When it is done,
// the portrait dissolves into a circle, which divides into the letters' circles.
const pageReady = loadPage();
const loader = startLoader({ ready: pageReady, mode: 'circle' });
const page = await pageReady;
if (!page) {
  console.warn('No sine page yet. Run: npm run build');
} else {
  const canvas = document.getElementById('c');
  const model = new PageModel(page);
  const view = new CanvasView(canvas, model);
  const play = new PlayController(view, model, { delay: 0.15 });
  const links = new LinkController(canvas, view, model, play);
  const real = new RealTextView(view, model); // the bits that stay real text
  real.onPointerMove((e) => links.onMove(e));
  const scroll = new ScrollController(view, model, play); // content animates in as it scrolls into view
  new HintController(view, model); // over a link, "click" forms below it
  play.onStart = () => scroll.stop();
  play.onDone = () => scroll.start();

  view.resize();
  real.place();
  let busy = true; // while the circles are gathering, nothing else draws on the canvas
  const circle = await loader.circle; // the portrait, a circle again (null when there is no loader to show)
  if (circle) {
    loader.showPage();
    await new GatherController(view, model).run(circle, { onStart: () => loader.release({ instant: true }) });
    busy = false;
    play.complete(); // every letter on screen has formed as its circle landed
    scroll.start();
    real.show();
  } else {
    busy = false;
    play.play();
    real.show();
  }

  window.addEventListener('resize', () => { view.resize(); real.place(); scroll.reset(); if (!busy) play.redraw(); });
  window.addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); play.play(); } });
  watchLayoutChange(() => window.location.reload()); // crossing between phone and computer width needs the other layout
}
