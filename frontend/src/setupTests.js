import "@testing-library/jest-dom";
import { TextDecoder, TextEncoder } from "node:util";

// jsdom ne fournit ni TextEncoder (requis par React Router) ni le défilement.
Object.assign(global, { TextEncoder, TextDecoder });
window.scrollTo = jest.fn();
