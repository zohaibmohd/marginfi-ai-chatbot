"use strict";

const { defineConfig } = require("vite");
const react = require("@vitejs/plugin-react").default;

module.exports = defineConfig({
  plugins: [react()],
});