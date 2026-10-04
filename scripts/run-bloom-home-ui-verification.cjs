const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const root = resolve(__dirname, "..");
const output = mkdtempSync(join(tmpdir(), "bloom-home-ui-verification-"));
try {
  const compiler = require.resolve("typescript/bin/tsc");
  const compiled = spawnSync(process.execPath, [compiler, "scripts/verify-bloom-home-ui.ts", "--outDir", output,
    "--module", "commonjs", "--moduleResolution", "node", "--target", "ES2020", "--esModuleInterop",
    "--skipLibCheck", "--strict", "--noUncheckedIndexedAccess", "--exactOptionalPropertyTypes", "--pretty", "false"],
  { cwd: root, stdio: "inherit" });
  process.exitCode = compiled.status ?? 1;
  if (process.exitCode === 0) {
    const result = spawnSync(process.execPath, [join(output, "scripts", "verify-bloom-home-ui.js")], { cwd: root, stdio: "inherit" });
    process.exitCode = result.status ?? 1;
  }
} finally {
  rmSync(output, { recursive: true, force: true });
}
