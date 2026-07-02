import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const patches = [
  // Pattern for formatted version (root install)
  {
    name: "formatted",
    old: `exports.resolve = exports.nodeFileTrace = void 0;
__exportStar(require("./types"), exports);
var node_file_trace_1 = require("./node-file-trace");
Object.defineProperty(exports, "nodeFileTrace", { enumerable: true, get: function () { return node_file_trace_1.nodeFileTrace; } });
const resolve_dependency_1 = __importDefault(require("./resolve-dependency"));
exports.resolve = resolve_dependency_1.default;`,
    new: `__exportStar(require("./types"), exports);
var node_file_trace_1 = require("./node-file-trace");
const resolve_dependency_1 = __importDefault(require("./resolve-dependency"));
exports.nodeFileTrace = node_file_trace_1.nodeFileTrace;
exports.resolve = resolve_dependency_1.default;`,
  },
  // Pattern for minified version (nested copies, e.g. inside nf3's bundle)
  {
    name: "minified",
    old: `exports.resolve=exports.nodeFileTrace=void 0,__exportStar(require("./types"),exports);var node_file_trace_1=require("./node-file-trace");Object.defineProperty(exports,"nodeFileTrace",{enumerable:!0,get:function(){return node_file_trace_1.nodeFileTrace}});const resolve_dependency_1=__importDefault(require("./resolve-dependency"));exports.resolve=resolve_dependency_1.default;`,
    new: `__exportStar(require("./types"),exports);var node_file_trace_1=require("./node-file-trace");const resolve_dependency_1=__importDefault(require("./resolve-dependency"));exports.nodeFileTrace=node_file_trace_1.nodeFileTrace;exports.resolve=resolve_dependency_1.default;`,
  },
];

// Pure-Node recursive search for every node_modules/**/@vercel/nft directory.
// Avoids shelling out to a platform-specific tool (e.g. `powershell`), which
// does not exist on Netlify's Linux build containers and would silently
// no-op the patch there.
function findVercelNftDirs(dir, depth, results) {
  if (depth < 0) return;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const full = join(dir, entry.name);
    if (entry.name === "@vercel") {
      const nftDir = join(full, "nft");
      try {
        if (statSync(nftDir).isDirectory()) results.push(nftDir);
      } catch {
        // no nft dir under this @vercel scope
      }
      continue;
    }
    if (entry.name === "node_modules" || !entry.name.startsWith(".")) {
      findVercelNftDirs(full, depth - 1, results);
    }
  }
}

try {
  const nftDirs = [];
  findVercelNftDirs(join(root, "node_modules"), 6, nftDirs);

  if (nftDirs.length === 0) {
    console.log("[patch-vercel-nft] @vercel/nft not installed, skipping ✓");
    process.exit(0);
  }

  let patchedCount = 0;
  for (const nftDir of nftDirs) {
    const indexPath = resolve(nftDir, "out", "index.js");
    try {
      const original = readFileSync(indexPath, "utf8");
      let modified = false;

      for (const { name, old, new: newCode } of patches) {
        if (original.includes(old)) {
          const patched = original.replace(old, newCode);
          writeFileSync(indexPath, patched, "utf8");
          console.log(`[patch-vercel-nft] Patched ${indexPath} (${name}) ✓`);
          modified = true;
          patchedCount++;
          break;
        }
      }

      if (!modified) {
        console.log(
          `[patch-vercel-nft] Already patched or pattern not found: ${indexPath}`,
        );
      }
    } catch (err) {
      console.log(
        `[patch-vercel-nft] Warning: could not patch ${indexPath}:`,
        err.message,
      );
    }
  }

  if (patchedCount > 0) {
    console.log(
      `[patch-vercel-nft] Patched ${patchedCount} copy/ies of @vercel/nft ✓`,
    );
  } else {
    console.log(
      "[patch-vercel-nft] All copies already patched or pattern not found ✓",
    );
  }
} catch (err) {
  console.log(
    "[patch-vercel-nft] Warning: could not patch @vercel/nft:",
    err.message,
  );
}
