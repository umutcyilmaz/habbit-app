"use strict";

const { readFileSync, readdirSync } = require("node:fs");
const { basename, join, relative, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");
const vm = require("node:vm");
const ts = require("typescript");

const projectRoot = resolve(__dirname, "..");
const normalIdentity = {
  name: "Bloom",
  iosBundleIdentifier: "com.umutcyilmaz.bloom",
  scheme: "tms"
};
const e2eIdentity = {
  name: "Bloom E2E",
  iosBundleIdentifier: "com.umutcyilmaz.bloom.e2e",
  androidPackage: "com.umutcyilmaz.bloom.e2e",
  scheme: "tms-e2e"
};
const failures = [];

verifyExpoIdentities();
verifyPackageCommands();
verifyMaestroIdentity();
verifyDevelopmentOnlyTimerShortening();

if (failures.length > 0) {
  console.error("Bloom E2E app identity verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log("Bloom E2E app identity verification passed.");
}

function verifyExpoIdentities() {
  const defaultConfig = resolveExpoConfig({});
  const e2eConfig = resolveExpoConfig({ APP_VARIANT: "e2e" });
  const publicFlagOnlyConfig = resolveExpoConfig({ EXPO_PUBLIC_E2E_MODE: "1" });

  if (defaultConfig !== null) {
    verifyResolvedIdentity(defaultConfig, {
      label: "Default Expo config",
      name: normalIdentity.name,
      iosBundleIdentifier: normalIdentity.iosBundleIdentifier,
      scheme: normalIdentity.scheme
    });
  }

  if (e2eConfig !== null) {
    verifyResolvedIdentity(e2eConfig, {
      label: "APP_VARIANT=e2e Expo config",
      name: e2eIdentity.name,
      iosBundleIdentifier: e2eIdentity.iosBundleIdentifier,
      androidPackage: e2eIdentity.androidPackage,
      scheme: e2eIdentity.scheme
    });
  }

  if (defaultConfig !== null && e2eConfig !== null) {
    check(
      defaultConfig.ios?.bundleIdentifier !== e2eConfig.ios?.bundleIdentifier,
      "Default and E2E iOS bundle identifiers must be different."
    );
  }

  if (publicFlagOnlyConfig !== null) {
    verifyResolvedIdentity(publicFlagOnlyConfig, {
      label: "EXPO_PUBLIC_E2E_MODE-only Expo config",
      name: normalIdentity.name,
      iosBundleIdentifier: normalIdentity.iosBundleIdentifier,
      scheme: normalIdentity.scheme
    });
  }
}

function resolveExpoConfig(environmentOverrides) {
  const environment = { ...process.env };
  delete environment.APP_VARIANT;
  delete environment.EXPO_PUBLIC_E2E_MODE;
  Object.assign(environment, environmentOverrides);

  let expoCli;
  try {
    expoCli = require.resolve("expo/bin/cli");
  } catch (error) {
    failures.push(
      `Could not resolve the installed Expo CLI: ${formatError(error)}`
    );
    return null;
  }

  const result = spawnSync(
    process.execPath,
    [expoCli, "config", "--type", "public", "--json"],
    {
      cwd: projectRoot,
      encoding: "utf8",
      env: environment
    }
  );

  const variantLabel = environmentOverrides.APP_VARIANT === "e2e"
    ? "APP_VARIANT=e2e"
    : environmentOverrides.EXPO_PUBLIC_E2E_MODE === "1"
      ? "EXPO_PUBLIC_E2E_MODE=1 without APP_VARIANT"
      : "default environment";

  if (result.error) {
    failures.push(
      `Expo config could not start for ${variantLabel}: ${result.error.message}`
    );
    return null;
  }

  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "no output").trim();
    failures.push(
      `Expo config failed for ${variantLabel} (exit ${String(result.status)}): ${detail}`
    );
    return null;
  }

  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    failures.push(
      `Expo config returned invalid JSON for ${variantLabel}: ${formatError(error)}`
    );
    return null;
  }
}

function verifyResolvedIdentity(config, expected) {
  check(
    config.name === expected.name,
    `${expected.label} must resolve name ${JSON.stringify(expected.name)}; received ${JSON.stringify(config.name)}.`
  );
  check(
    config.ios?.bundleIdentifier === expected.iosBundleIdentifier,
    `${expected.label} must resolve iOS bundle identifier ${expected.iosBundleIdentifier}; received ${JSON.stringify(config.ios?.bundleIdentifier)}.`
  );
  check(
    isExactScheme(config.scheme, expected.scheme),
    `${expected.label} must resolve only scheme ${expected.scheme}; received ${JSON.stringify(config.scheme)}.`
  );

  if (expected.androidPackage !== undefined) {
    check(
      config.android?.package === expected.androidPackage,
      `${expected.label} must resolve Android package ${expected.androidPackage}; received ${JSON.stringify(config.android?.package)}.`
    );
  }
}

function isExactScheme(actual, expected) {
  return actual === expected ||
    (Array.isArray(actual) && actual.length === 1 && actual[0] === expected);
}

function verifyPackageCommands() {
  const packageJson = readJson("package.json");
  if (packageJson === null) {
    return;
  }

  const scripts = packageJson.scripts;
  if (scripts === null || typeof scripts !== "object" || Array.isArray(scripts)) {
    failures.push("package.json must contain a scripts object.");
    return;
  }

  const startE2E = scripts["start:e2e"];
  check(
    typeof startE2E === "string",
    "package.json must define start:e2e."
  );

  if (typeof startE2E === "string") {
    const tokens = tokenizeCommand(startE2E);
    check(
      tokens.includes("APP_VARIANT=e2e"),
      "start:e2e must set APP_VARIANT=e2e."
    );
    check(
      tokens.includes("EXPO_PUBLIC_E2E_MODE=1"),
      "start:e2e must set EXPO_PUBLIC_E2E_MODE=1."
    );
    check(
      tokens.includes("--dev-client"),
      "start:e2e must start Expo with --dev-client."
    );
    check(
      commandUsesOnlyPort(tokens, "8082"),
      "start:e2e must explicitly use only Metro port 8082."
    );
    check(
      commandRequestsLocalhost(tokens),
      "start:e2e must request Expo's supported localhost host mode."
    );
  }

  const iosE2E = scripts["ios:e2e"];
  check(
    typeof iosE2E === "string",
    "package.json must define ios:e2e."
  );

  if (typeof iosE2E === "string") {
    const tokens = tokenizeCommand(iosE2E);
    check(
      tokens.includes("APP_VARIANT=e2e"),
      "ios:e2e must select APP_VARIANT=e2e."
    );
    check(
      tokens.includes("EXPO_PUBLIC_E2E_MODE=1"),
      "ios:e2e must enable the development-only E2E runtime mode."
    );
    check(
      tokens.includes("prebuild") && commandUsesOptionValue(tokens, "--platform", "ios"),
      "ios:e2e must synchronize the generated iOS project with the E2E Expo config."
    );
    check(
      tokens.includes("run:ios"),
      "ios:e2e must build and install the E2E iOS application."
    );
    check(
      commandUsesOnlyPort(tokens, "8082"),
      "ios:e2e must explicitly use only Metro port 8082."
    );
    check(
      !tokens.includes("--no-bundler"),
      "ios:e2e must not combine its explicit Metro port with --no-bundler."
    );
  }

  const iosE2ERebuild = scripts["ios:e2e:rebuild"];
  check(
    typeof iosE2ERebuild === "string",
    "package.json must define ios:e2e:rebuild."
  );

  if (typeof iosE2ERebuild === "string") {
    const tokens = tokenizeCommand(iosE2ERebuild);
    check(
      tokens.includes("APP_VARIANT=e2e") &&
        tokens.includes("prebuild") &&
        tokens.includes("--clean") &&
        commandUsesOptionValue(tokens, "--platform", "ios"),
      "ios:e2e:rebuild must explicitly clean-regenerate the E2E iOS project."
    );
  }

  for (const [scriptName, command] of Object.entries(scripts)) {
    if (typeof command !== "string") {
      continue;
    }

    const tokens = tokenizeCommand(command);
    const selectsE2EIdentity = tokens.includes("APP_VARIANT=e2e");
    const isExplicitE2ECommand = /(?:^|:)e2e(?:$|[-:])/.test(scriptName);

    check(
      !selectsE2EIdentity || isExplicitE2ECommand,
      `Non-E2E package command ${scriptName} must not set APP_VARIANT=e2e.`
    );
    check(
      !tokens.includes("--clean") || scriptName === "ios:e2e:rebuild",
      `Only the clearly named ios:e2e:rebuild command may clean generated native files; found --clean in ${scriptName}.`
    );

    if (isExplicitE2ECommand) {
      check(
        !containsExactNumber(command, "8081"),
        `E2E package command ${scriptName} must never request port 8081.`
      );

      for (const segment of splitCommandSegments(tokens)) {
        if (isExpoStartSegment(segment)) {
          check(
            commandRequestsLocalhost(segment),
            `E2E Expo start command ${scriptName} must request localhost host mode.`
          );
        }
      }
    }
  }
}

function verifyMaestroIdentity() {
  const maestroDirectory = join(projectRoot, ".maestro");
  let yamlFiles;
  try {
    yamlFiles = listFilesRecursively(maestroDirectory)
      .filter((filePath) => /\.ya?ml$/i.test(filePath));
  } catch (error) {
    failures.push(`Could not inspect .maestro: ${formatError(error)}`);
    return;
  }

  check(yamlFiles.length > 0, ".maestro must contain active YAML flows.");

  let clearStateCount = 0;
  let e2eDebugLinkCount = 0;

  for (const filePath of yamlFiles) {
    const relativePath = relative(projectRoot, filePath);
    const source = readText(relativePath);
    if (source === null) {
      continue;
    }

    const appIds = getYamlScalarValues(source, "appId");
    const isConfigFile = basename(filePath).toLowerCase() === "config.yaml" ||
      basename(filePath).toLowerCase() === "config.yml";

    if (!isConfigFile) {
      check(
        appIds.length > 0,
        `${relativePath} must declare appId ${e2eIdentity.iosBundleIdentifier}.`
      );
    }

    for (const appId of appIds) {
      check(
        appId === e2eIdentity.iosBundleIdentifier,
        `${relativePath} has appId ${JSON.stringify(appId)}; only ${e2eIdentity.iosBundleIdentifier} is allowed.`
      );
    }

    const bloomIdentifiers = source.match(
      /com\.umutcyilmaz\.bloom(?:\.[A-Za-z0-9_-]+)*/g
    ) ?? [];
    for (const identifier of bloomIdentifiers) {
      check(
        identifier === e2eIdentity.iosBundleIdentifier,
        `${relativePath} contains disallowed exact Bloom identifier ${identifier}.`
      );
    }

    check(
      !/(^|[^A-Za-z0-9_-])tms:\/\//m.test(source),
      `${relativePath} must not use the normal tms:// URL scheme.`
    );

    if (source.includes("tms-e2e:///debug/bloom-state")) {
      e2eDebugLinkCount += 1;
    }
    const clearStateValues = getYamlScalarValues(source, "clearState");
    if (clearStateValues.length > 0) {
      clearStateCount += clearStateValues.filter((value) => value === "true").length;
      check(
        appIds.length > 0 && appIds.every(
          (appId) => appId === e2eIdentity.iosBundleIdentifier
        ),
        `${relativePath} uses clearState without targeting only ${e2eIdentity.iosBundleIdentifier}.`
      );
    }
  }

  check(
    e2eDebugLinkCount > 0,
    "An active Maestro flow must retain the tms-e2e:///debug/bloom-state development deep link."
  );
  check(
    clearStateCount > 0,
    "At least one Maestro bootstrap flow must retain clearState: true for the isolated E2E app."
  );

  verifyMaestroBootstrapServerSelector();
}

function verifyMaestroBootstrapServerSelector() {
  const relativePath = ".maestro/subflows/open-bloom.yaml";
  const source = readText(relativePath);
  if (source === null) {
    return;
  }

  const serverSelectorSources = getYamlScalarValues(source, "text")
    .filter((value) => value.includes("http://") &&
      (value.includes("localhost") || value.includes("8082")));

  check(
    serverSelectorSources.length > 0,
    `${relativePath} must include a Metro server selector for localhost or an IPv4 address on port 8082.`
  );

  const rawServerSelectors = compileSelectorGroup(
    serverSelectorSources.filter((selector) => !selector.includes("Connected to")),
    relativePath,
    "Metro server"
  );
  const connectedServerSelectors = compileSelectorGroup(
    serverSelectorSources.filter((selector) => selector.includes("Connected to")),
    relativePath,
    "connected Metro server"
  );

  verifySelectorGroup(
    rawServerSelectors,
    relativePath,
    "Metro server",
    [
      "http://localhost:8082",
      "http://127.0.0.1:8082",
      "http://192.168.1.42:8082"
    ],
    [
      "http://localhost:8081",
      "http://localhost:80820",
      "http://127.0.0.1:8081",
      "http://127.0.0:8082",
      "http://example.com:8082",
      "http://localhost:8082/path",
      "http://localhost:8082?query=1",
      "https://localhost:8082",
      "prefix http://localhost:8082",
      "http://localhost:8082 suffix"
    ]
  );

  if (connectedServerSelectors.length > 0) {
    verifySelectorGroup(
      connectedServerSelectors,
      relativePath,
      "connected Metro server",
      [
        "Connected to:, http://localhost:8082",
        "Connected to: http://localhost:8082",
        "Connected to: http://127.0.0.1:8082",
        "Connected to: http://192.168.1.42:8082"
      ],
      [
        "Connected to:, http://localhost:8081",
        "Connected to: http://localhost:8081",
        "Connected to: http://localhost:80820",
        "Connected to: http://example.com:8082",
        "Connected to: http://localhost:8082/path",
        "prefix Connected to: http://localhost:8082",
        "Connected to: http://localhost:8082 suffix"
      ]
    );
  }
}

function compileSelectorGroup(selectorSources, relativePath, label) {
  const expressions = [];

  for (const selector of selectorSources) {
    let expression;
    try {
      expression = new RegExp(selector);
    } catch (error) {
      failures.push(
        `${relativePath} has an invalid ${label} selector ${JSON.stringify(selector)}: ${formatError(error)}`
      );
      continue;
    }
    expressions.push(expression);
  }

  return expressions;
}

function verifySelectorGroup(
  expressions,
  relativePath,
  label,
  allowedValues,
  disallowedValues
) {
  check(
    expressions.length > 0,
    `${relativePath} must include a valid ${label} selector.`
  );

  for (const allowed of allowedValues) {
    check(
      expressions.some((expression) =>
        regularExpressionMatches(expression, allowed)
      ),
      `${relativePath} ${label} selectors must accept ${allowed}.`
    );
  }

  for (const expression of expressions) {
    check(
      allowedValues.some((allowed) =>
        regularExpressionMatches(expression, allowed)
      ),
      `${relativePath} contains a ${label} selector that matches no approved localhost or IPv4 URL on port 8082.`
    );

    for (const disallowed of disallowedValues) {
      check(
        !regularExpressionMatches(expression, disallowed),
        `${relativePath} ${label} selector must reject ${disallowed}.`
      );
    }
  }
}

function verifyDevelopmentOnlyTimerShortening() {
  const relativePath = "src/shared/runtime/e2eMode.ts";
  const source = readText(relativePath);
  if (source === null) {
    return;
  }

  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    },
    fileName: relativePath,
    reportDiagnostics: true
  });

  const errors = (transpiled.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error
  );
  if (errors.length > 0) {
    failures.push(
      `${relativePath} could not be evaluated: ${errors.map(formatDiagnostic).join("; ")}`
    );
    return;
  }

  const productionModule = evaluateCommonJs(
    transpiled.outputText,
    relativePath,
    false,
    "1"
  );
  const developmentModule = evaluateCommonJs(
    transpiled.outputText,
    relativePath,
    true,
    "1"
  );

  if (productionModule === null || developmentModule === null) {
    return;
  }

  check(
    productionModule.resolveE2EMode?.({
      isDevelopment: false,
      environmentValue: "1"
    }) === false,
    "EXPO_PUBLIC_E2E_MODE=1 must not enable E2E mode when isDevelopment is false."
  );
  check(
    developmentModule.resolveE2EMode?.({
      isDevelopment: true,
      environmentValue: "1"
    }) === true,
    "EXPO_PUBLIC_E2E_MODE=1 must continue enabling E2E mode in development."
  );
  check(
    productionModule.isE2EMode === false,
    "The runtime E2E flag must evaluate false when __DEV__ is false."
  );
  check(
    developmentModule.isE2EMode === true,
    "The runtime E2E flag must evaluate true when __DEV__ is true and EXPO_PUBLIC_E2E_MODE=1."
  );

  const productionDurations = productionModule.resolveBloomTimerDurations?.({
    isDevelopment: false,
    environmentValue: "1"
  });
  check(
    durationsEqual(productionDurations, productionModule.productionTimerDurations),
    "Production must keep normal timer durations even when EXPO_PUBLIC_E2E_MODE=1."
  );
}

function evaluateCommonJs(outputText, relativePath, isDevelopment, e2eValue) {
  const moduleRecord = { exports: {} };
  const context = {
    __DEV__: isDevelopment,
    exports: moduleRecord.exports,
    module: moduleRecord,
    process: {
      env: {
        EXPO_PUBLIC_E2E_MODE: e2eValue
      }
    },
    require(specifier) {
      throw new Error(`Unexpected runtime import ${specifier}`);
    }
  };

  try {
    vm.runInNewContext(outputText, context, {
      filename: join(projectRoot, relativePath)
    });
    return moduleRecord.exports;
  } catch (error) {
    failures.push(`${relativePath} runtime evaluation failed: ${formatError(error)}`);
    return null;
  }
}

function durationsEqual(actual, expected) {
  return actual !== null && actual !== undefined &&
    expected !== null && expected !== undefined &&
    actual.pauseRoundSeconds === expected.pauseRoundSeconds &&
    actual.resetSeconds === expected.resetSeconds &&
    actual.arousalPauseSeconds === expected.arousalPauseSeconds;
}

function getYamlScalarValues(source, key) {
  const values = [];
  const keyPattern = escapeRegularExpression(key);
  const expression = new RegExp(`^\\s*${keyPattern}\\s*:\\s*(.*?)\\s*$`);

  for (const line of source.split(/\r?\n/)) {
    if (/^\s*#/.test(line)) {
      continue;
    }
    const match = expression.exec(line);
    if (match === null) {
      continue;
    }
    const rawValue = stripYamlComment(match[1] ?? "").trim();
    values.push(unquote(rawValue));
  }

  return values;
}

function stripYamlComment(value) {
  let singleQuoted = false;
  let doubleQuoted = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === "'" && !doubleQuoted) {
      singleQuoted = !singleQuoted;
    } else if (character === '"' && !singleQuoted && value[index - 1] !== "\\") {
      doubleQuoted = !doubleQuoted;
    } else if (character === "#" && !singleQuoted && !doubleQuoted) {
      return value.slice(0, index);
    }
  }

  return value;
}

function unquote(value) {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if (first === '"' && last === '"') {
      try {
        return JSON.parse(value);
      } catch {
        return value.slice(1, -1);
      }
    }
    if (first === "'" && last === "'") {
      return value.slice(1, -1).replace(/''/g, "'");
    }
  }
  return value;
}

function tokenizeCommand(command) {
  return (command.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [])
    .map(unquote);
}

function commandUsesOnlyPort(tokens, port) {
  const portValues = getCommandOptionValues(tokens, ["--port", "-p"]);
  return portValues.length > 0 && portValues.every((value) => value === port);
}

function commandRequestsLocalhost(tokens) {
  return tokens.includes("--localhost") ||
    commandUsesOptionValue(tokens, "--host", "localhost") ||
    commandUsesOptionValue(tokens, "-m", "localhost");
}

function getCommandOptionValues(tokens, options) {
  const values = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (options.includes(token)) {
      values.push(tokens[index + 1] ?? "");
      continue;
    }

    for (const option of options) {
      const prefix = `${option}=`;
      if (token.startsWith(prefix)) {
        values.push(token.slice(prefix.length));
      }
    }
  }

  return values;
}

function containsExactNumber(command, number) {
  const escapedNumber = escapeRegularExpression(number);
  return new RegExp(`(^|[^0-9])${escapedNumber}([^0-9]|$)`).test(command);
}

function splitCommandSegments(tokens) {
  const segments = [[]];

  for (const token of tokens) {
    if (token === "&&" || token === "||" || token === ";") {
      segments.push([]);
    } else {
      segments[segments.length - 1].push(token);
    }
  }

  return segments;
}

function isExpoStartSegment(tokens) {
  return tokens.includes("expo") && tokens.includes("start");
}

function regularExpressionMatches(expression, value) {
  expression.lastIndex = 0;
  return expression.test(value);
}

function commandUsesOptionValue(tokens, option, value) {
  return tokens.includes(`${option}=${value}`) ||
    tokens.some((token, index) => token === option && tokens[index + 1] === value);
}

function listFilesRecursively(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursively(entryPath));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}

function readJson(relativePath) {
  const source = readText(relativePath);
  if (source === null) {
    return null;
  }
  try {
    return JSON.parse(source);
  } catch (error) {
    failures.push(`${relativePath} is not valid JSON: ${formatError(error)}`);
    return null;
  }
}

function readText(relativePath) {
  try {
    return readFileSync(join(projectRoot, relativePath), "utf8");
  } catch (error) {
    failures.push(`Could not read ${relativePath}: ${formatError(error)}`);
    return null;
  }
}

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatDiagnostic(diagnostic) {
  return ts.flattenDiagnosticMessageText(diagnostic.messageText, " ");
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

function check(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}
