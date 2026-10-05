import "@testing-library/jest-dom";
import { TextDecoder, TextEncoder } from "node:util";

Object.assign(global, { TextEncoder, TextDecoder });
window.scrollTo = jest.fn();
