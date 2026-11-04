// A picture that shows next to a word while it is hovered (the "here" in the About text: "you can check one out here").
// It sits above the word (below it when there is no room above), fades in, and is only fetched the first time it is wanted.
export class PeekView {
  constructor(view) {
    this.view = view;
    this.card = document.createElement('div');
    this.card.style.cssText = 'position:absolute;z-index:5;width:240px;aspect-ratio:4/5;border-radius:11px;overflow:hidden;pointer-events:none;background:#1a1a19;'
      + 'box-shadow:0 20px 42px rgba(0,0,0,.6);opacity:0;transform:translateY(6px) scale(.98);transition:opacity .22s ease,transform .22s ease;display:none;';
    this.img = document.createElement('img');
    this.img.alt = 'A black-and-white pencil portrait I drew: a woman with flowers in her hair, her hand resting against her cheek';
    this.img.style.cssText = 'display:block;width:100%;height:100%;object-fit:cover;';
    this.card.appendChild(this.img);
    document.body.appendChild(this.card);
    this.timer = 0;
  }

  // link: the hovered { peek, box } (or null: hide)
  show(link) {
    clearTimeout(this.timer);
    this.pending = link;
    if (!link || !link.peek) {
      this.card.style.opacity = '0';
      this.card.style.transform = 'translateY(6px) scale(.98)';
      this.timer = setTimeout(() => { this.card.style.display = 'none'; }, 230);
      return;
    }
    if (!this.img.getAttribute('src')) this.img.src = link.peek; // fetched the first time it is wanted
    if (this.img.complete && this.img.naturalWidth) this.reveal(link);
    else this.img.onload = () => { if (this.pending === link) this.reveal(link); }; // not a blank card while it loads
  }

  reveal(link) {
    const { em, ox, oy } = this.view.geo, [x0, v0, x1, v1] = link.box;
    const w = 240, h = 300;
    const left = ox + x0 * em, right = ox + x1 * em, top = oy - v1 * em, bottom = oy - v0 * em; // the word, in the page
    let y = top - h - 12;
    if (y < window.scrollY + 8) y = bottom + 12; // no room above: below
    const x = Math.min(Math.max(8, (left + right) / 2 - w / 2), document.documentElement.clientWidth - w - 8);
    this.card.style.left = x.toFixed(1) + 'px';
    this.card.style.top = y.toFixed(1) + 'px';
    this.card.style.display = 'block';
    requestAnimationFrame(() => { this.card.style.opacity = '1'; this.card.style.transform = 'none'; });
  }
}
