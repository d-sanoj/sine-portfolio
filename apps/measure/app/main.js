// Measures the plain page at each width and saves the numbers.
import { LAYOUTS } from './config.js';
import { measurePage } from './services/measurePage.js';
import { save } from './services/save.js';
import { log } from './view/log.js';

try {
  for (const L of LAYOUTS) {
    log('Measuring at ' + L.width + ' px wide ...');
    const data = await measurePage(L);
    const chars = data.groups.reduce((n, g) => n + g.chars.length, 0);
    await save(L.file, data);
    log('  saved data/generated/' + L.file + ': ' + chars + ' characters, ' + data.rules.length + ' lines, page height ' + data.height + ' px');
  }
  log('\nDone. Now run: npm run build:dist');
  window.__extractDone = true;
} catch (e) {
  log('FAILED: ' + e.message);
  window.__extractError = e.message;
}
