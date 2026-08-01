const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = resolve(__dirname, "..");
const outputDirectory = mkdtempSync(
  join(tmpdir(), "bloom-e2e-runtime-verification-")
);

function runCommand(command, arguments_) {
  const result = spawnSync(command, arguments_, {
    cwd: projectRoot,
    stdio: "inherit"
  });

  if (result.error) {
    console.error("Bloom E2E runtime verification could not start.");
    return 1;
  }

  return result.status ?? 1;
}

function runVerification() {
  const typescriptCompiler = require.resolve("typescript/bin/tsc");
  const compileStatus = runCommand(process.execPath, [
    typescriptCompiler,
    "scripts/verify-bloom-e2e-runtime.ts",
    "--outDir",
    outputDirectory,
    "--module",
    "commonjs",
    "--moduleResolution",
    "node",
    "--target",
    "ES2020",
    "--esModuleInterop",
    "--skipLibCheck",
    "--strict",
    "--noUncheckedIndexedAccess",
    "--exactOptionalPropertyTypes",
    "--pretty",
    "false"
  ]);

  if (compileStatus !== 0) {
    return compileStatus;
  }

  return runCommand(process.execPath, [
    join(outputDirectory, "scripts", "verify-bloom-e2e-runtime.js")
  ]);
}

try {
  process.exitCode = runVerification();
} finally {
  rmSync(outputDirectory, { recursive: true, force: true });
}
