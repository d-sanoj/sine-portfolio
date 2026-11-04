// The letter designer. This file only wires the pieces together:
//   model/       the glyphs, the fit, the anchors, what is saved for the build
//   view/        canvases, panels, readouts
//   controller/  mouse, buttons, tracing, settings, files
//   services/    the tracer, the dev server, downloads
import { DesignerModel } from './model/DesignerModel.js';
import { buildData } from './model/exportData.js';
import { Storage } from './services/storage.js';
import { Canvases } from './view/Canvases.js';
import { EditorView } from './view/EditorView.js';
import { PreviewView } from './view/PreviewView.js';
import { ChromeView } from './view/ChromeView.js';
import { RefreshController } from './controller/RefreshController.js';
import { EditorPointerController } from './controller/EditorPointerController.js';
import { ToolbarController } from './controller/ToolbarController.js';
import { TraceController } from './controller/TraceController.js';
import { PreviewController } from './controller/PreviewController.js';
import { FileController } from './controller/FileController.js';

const model = new DesignerModel();
const storage = new Storage(model);
await storage.load();

const chrome = new ChromeView(model);
chrome.applySettings();
chrome.showServerMode();

const canvases = new Canvases();
const editor = new EditorView(model, canvases);
const preview = new PreviewView(model, canvases);
const refresher = new RefreshController({ model, chrome, editor, preview, canvases, storage });
const parts = { model, canvases, refresher, chrome };

new ToolbarController(parts);
new EditorPointerController(parts);
const tracer = new TraceController(parts);
new PreviewController(parts);
new FileController(parts);

window.addEventListener('resize', () => refresher.relayout());
refresher.relayout();
refresher.refresh();

// Exposed so the page can be driven from the console or tests.
window.sineEditor = {
  get state() { return model.state; },
  buildData: () => buildData(model.state.glyphs),
  refresh: () => refresher.refresh(),
  traceMany: (chars) => tracer.traceMany(chars),
  saveAll: () => refresher.saveNow(),
};
