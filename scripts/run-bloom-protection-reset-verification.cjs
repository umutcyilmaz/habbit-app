const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = resolve(__dirname, "..");
const outputDirectory = mkdtempSync(
  join(tmpdir(), "bloom-protection-reset-verification-")
);

function runCommand(command, arguments_) {
  const result = spawnSync(command, arguments_, {
    cwd: projectRoot,
    stdio: "inherit"
  });

  if (result.error) {
    console.error("Bloom Protection and Reset verification could not start.");
    return 1;
  }

  return result.status ?? 1;
}

function runVerification() {
  const typescriptCompiler = require.resolve("typescript/bin/tsc");
  const compileStatus = runCommand(process.execPath, [
    typescriptCompiler,
    "scripts/verify-bloom-protection-reset.ts",
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
    join(
      outputDirectory,
      "scripts",
      "verify-bloom-protection-reset.js"
    )
  ]);
}

try {
  process.exitCode = runVerification();
} finally {
  rmSync(outputDirectory, { recursive: true, force: true });
}
