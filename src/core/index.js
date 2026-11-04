// The core: pure logic shared by every app and by the build. No DOM, no Node, no files.
//
//   sine/     the math of sine series
//   content/  reading text, markup and HTML into blocks
//   layout/   turning blocks (or a measured layout) into a sine page
//   render/   drawing a finished page on a 2D canvas context
export { Sine } from './sine/index.js';
export { Content } from './content/index.js';
export { Layout } from './layout/index.js';
export { PageCanvas } from './render/page-canvas.js';
export * as Morph from './animate/morph.js';
