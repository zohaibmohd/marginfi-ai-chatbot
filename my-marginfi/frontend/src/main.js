"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/main.tsx
const react_1 = __importDefault(require("react"));
const client_1 = require("react-dom/client");
const App_1 = __importDefault(require("./App")); // removed .tsx extension
(0, client_1.createRoot)(document.getElementById('root')).render(<react_1.default.StrictMode>
    <App_1.default />
  </react_1.default.StrictMode>);
