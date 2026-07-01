import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const indexPath = resolve(
  __dirname,
  "..",
  "node_modules",
  "@vercel",
  "nft",
  "out",
  "index.js",
);

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
  console.log("[patch-vercel-nft] Pattern not found — version may have changed, skipping ✗");
}
