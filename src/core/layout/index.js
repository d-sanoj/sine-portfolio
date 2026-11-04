// Layout: from content (or a measured layout) to a sine page.
//   Layout.compose(content, glyphs, options)    flow layout: close, used when nothing was measured
//   Layout.fromLayout(measured, glyphs, options) exact layout: every letter where the browser put it
import { compose } from './flow.js';
import { fromLayout } from './measured.js';
import { DEFAULTS, STYLES, BOLD } from './styles.js';

export const Layout = { DEFAULTS, STYLES, BOLD, compose, fromLayout };
