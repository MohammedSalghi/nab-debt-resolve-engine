import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

try {
  const indexPath = resolve(
    process.cwd(),
    "node_modules",
    "@vercel",
    "nft",
    "out",
    "index.js",
  );

  if (!existsSync(indexPath)) {
    console.log("[patch-vercel-nft] @vercel/nft not installed, skipping ✓");
    process.exit(0);
  }

  const original = readFileSync(indexPath, "utf8");

  const oldPattern = `exports.resolve = exports.nodeFileTrace = void 0;
__exportStar(require("./types"), exports);
var node_file_trace_1 = require("./node-file-trace");
Object.defineProperty(exports, "nodeFileTrace", { enumerable: true, get: function () { return node_file_trace_1.nodeFileTrace; } });
const resolve_dependency_1 = __importDefault(require("./resolve-dependency"));
exports.resolve = resolve_dependency_1.default;`;

  const newPattern = `__exportStar(require("./types"), exports);
var node_file_trace_1 = require("./node-file-trace");
const resolve_dependency_1 = __importDefault(require("./resolve-dependency"));
exports.nodeFileTrace = node_file_trace_1.nodeFileTrace;
exports.resolve = resolve_dependency_1.default;`;

  if (original.includes(oldPattern)) {
    const patched = original.replace(oldPattern, newPattern);
    writeFileSync(indexPath, patched, "utf8");
    console.log("[patch-vercel-nft] Patched @vercel/nft CJS exports for ESM interop ✓");
  } else if (original.includes(newPattern)) {
    console.log("[patch-vercel-nft] Already patched, skipping ✓");
  } else {
    console.log("[patch-vercel-nft] Pattern not found — version may have changed, skipping");
  }
} catch (err) {
  console.log("[patch-vercel-nft] Warning: could not patch @vercel/nft:", err.message);
}
