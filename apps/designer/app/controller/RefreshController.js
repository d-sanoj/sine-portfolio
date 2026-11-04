// Keeps the screen and the saved files up to date after any change.
// Every other controller just says "something changed" with refresh().
export class RefreshController {
  constructor({ model, chrome, editor, preview, canvases, storage }) {
    Object.assign(this, { model, chrome, editor, preview, canvases, storage });
    this.raf = 0;
    this.saveTimer = 0;
  }

  // redraw everything on the next frame, and save shortly after that
  refresh() {
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(() => {
      const data = this.chrome.update((i) => { this.model.select(i); this.refresh(); });
      this.editor.draw();
      this.preview.draw(data);
      this.saveSoon(); // after drawing, so the preview page is there to be saved
    });
  }

  // the window changed size
  relayout() {
    this.canvases.layout();
    this.editor.draw();
  }

  saveSoon() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveNow(), 400);
  }

  async saveNow() {
    clearTimeout(this.saveTimer);
    this.chrome.setSavedMessage(await this.storage.saveAll());
  }
}
