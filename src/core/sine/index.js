// The sine math, as one object: Sine.trace, Sine.fit, Sine.select ...
//   series.js     draw, trim and do arithmetic on a finished series
//   fit.js        turn drawn points into a series
//   transform.js  move, scale and roughen a stored series
import { trace, runs, select, cmul, toMap, fromMap } from './series.js';
import { H, loopPath, fit, routeGlyph, fitRoute } from './fit.js';
import { affineTerms, affinePoint, jitter } from './transform.js';

export const Sine = { H, loopPath, fit, routeGlyph, fitRoute, runs, select, trace, toMap, fromMap, cmul, affineTerms, affinePoint, jitter };
