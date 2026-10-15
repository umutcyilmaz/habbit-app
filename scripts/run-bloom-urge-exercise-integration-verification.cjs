const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = resolve(__dirname, "..");
const outputDirectory = mkdtempSync(join(tmpdir(), "bloom-urge-exercise-integration-"));

function run(command, arguments_) {
  const result = spawnSync(command, arguments_, { cwd:projectRoot, stdio:"inherit" });
  if (result.error) {
    console.error("Bloom Urge exercise integration verification could not start.");
    return 1;
  }
  return result.status ?? 1;
}

try {
  const compiler = require.resolve("typescript/bin/tsc");
  const compileStatus = run(process.execPath, [compiler, "scripts/verify-bloom-urge-exercise-integration.ts", "--outDir", outputDirectory,
    "--module", "commonjs", "--moduleResolution", "node", "--target", "ES2020", "--esModuleInterop", "--skipLibCheck", "--strict",
    "--noUncheckedIndexedAccess", "--exactOptionalPropertyTypes", "--pretty", "false"]);
  process.exitCode = compileStatus === 0
    ? run(process.execPath, [join(outputDirectory, "scripts", "verify-bloom-urge-exercise-integration.js")])
    : compileStatus;
} finally {
  rmSync(outputDirectory, { recursive:true, force:true });
}
