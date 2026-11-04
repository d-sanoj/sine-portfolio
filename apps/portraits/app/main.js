// The portrait tracer. Wires the pieces together:
//   model/ the portraits and results   view/ the gallery   controller/ tracing and saving   services/ image work
import { PortraitModel } from './model/PortraitModel.js';
import { GalleryView } from './view/GalleryView.js';
import { TraceController } from './controller/TraceController.js';

const model = new PortraitModel();
const view = new GalleryView(model);
const controller = new TraceController(model, view);
window.portraits = { model, controller }; // for the console and tests
