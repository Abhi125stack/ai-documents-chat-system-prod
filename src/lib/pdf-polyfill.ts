// Browser-only globals that pdfjs-dist (pulled in by pdf-parse) touches at
// module-load time. They do not exist in the Node.js server runtime, so the
// upload route throws `ReferenceError: DOMMatrix is not defined` the moment it
// is instantiated in the production server bundle. Install them from
// @napi-rs/canvas (a dependency) BEFORE pdf-parse is imported.
//
// This module must be imported first in any server file that loads pdf-parse.
import { DOMMatrix, Path2D, ImageData } from "@napi-rs/canvas";

// Assign through a loose record: @napi-rs/canvas's constructor signatures differ
// slightly from lib.dom.d.ts, so assigning onto the typed `globalThis` globals is
// rejected. pdfjs only needs the runtime behaviour, not the exact types.
const g = globalThis as unknown as Record<string, unknown>;

if (typeof g.DOMMatrix === "undefined") g.DOMMatrix = DOMMatrix;
if (typeof g.Path2D === "undefined") g.Path2D = Path2D;
if (typeof g.ImageData === "undefined") g.ImageData = ImageData;
