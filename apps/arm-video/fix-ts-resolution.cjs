// Workaround for a pnpm-hoisting ambiguity: this monorepo has three
// coexisting `typescript` majors (5.9.3 here, 7.0.2 in apps/public etc).
// @remotion/bundler's esbuild-loader does a bare `require('typescript')`
// from deep inside the pnpm store, and Node's realpath-following module
// resolution walks past this package's local 5.9.3 up to a hoisted 7.0.2,
// which lacks the `ts.sys` API the loader calls unconditionally. Redirect
// just that one require to the version this app actually depends on.
const Module = require("node:module");
const path = require("node:path");

const localTypescript = require.resolve("typescript", { paths: [path.join(__dirname, "node_modules")] });

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request === "typescript" && parent?.filename?.includes("esbuild-loader")) {
    return localTypescript;
  }
  return originalResolve.call(this, request, parent, ...rest);
};
