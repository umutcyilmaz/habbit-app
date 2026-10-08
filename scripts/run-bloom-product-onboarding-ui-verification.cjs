const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const output = mkdtempSync(join(tmpdir(), "bloom-product-onboarding-ui-"));
const cwd = resolve(__dirname, "..");
function run(command, args) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  return result.status ?? 1;
}
try {
  const compiled = run(process.execPath, [require.resolve("typescript/bin/tsc"), "scripts/verify-bloom-product-onboarding-ui.ts", "--outDir", output,
    "--module", "commonjs", "--moduleResolution", "node", "--target", "ES2020", "--esModuleInterop", "--skipLibCheck", "--strict",
    "--noUncheckedIndexedAccess", "--exactOptionalPropertyTypes", "--pretty", "false"]);
  process.exitCode = compiled || run(process.execPath, [join(output, "scripts", "verify-bloom-product-onboarding-ui.js")]);
} finally { rmSync(output, { recursive: true, force: true }); }
