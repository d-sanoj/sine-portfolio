// Content: anything the page can be made from, read into blocks.
//   Content.parse(text | blocks)  ->  { blocks, notes }
//   Content.resolve(word, glyphs) ->  the text of a word as it will really be drawn
//
// Two ways to write the content (detected automatically):
//   plain markup  "# Heading", "**bold**", "[label](https://address)", one line per line
//   an HTML page  h1-h6, p, li, ul/ol, br, b/strong, a href, div/section/...
import { resolve } from './characters.js';
import { parseMarkup } from './markup.js';
import { parseHtml, looksLikeHtml } from './html.js';

// Text in either format, or ready blocks.
function parse(input) {
  if (Array.isArray(input)) return { blocks: input, notes: [] };
  return looksLikeHtml(input) ? parseHtml(input) : parseMarkup(input);
}

export const Content = { parse, resolve };
