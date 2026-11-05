// Measures the plain page at each width and saves the numbers.
import { LAYOUTS } from './config.js';
import { measurePage } from './services/measurePage.js';
import { save } from './services/save.js';
import { log } from './view/log.js';

try {
  for (const L of LAYOUTS) {
    log('Measuring at ' + L.width + ' px wide ...');
    const data = await measurePage({ ...L, greeting: 'evening' }); // always as it reads in the evening, whatever time it is now
    // the greeting reads differently by time of day, and everything below it stays where it is: so the words of the other
    // greetings are measured too (the page above is measured as the evening one) and the sine page picks one when it loads
    data.greetings = {};
    for (const name of ['morning', 'afternoon']) {
      log('  ... and the ' + name + ' greeting');
      const v = await measurePage({ ...L, greeting: name });
      data.greetings[name] = v.groups.filter((g) => g.greet);
    }
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
