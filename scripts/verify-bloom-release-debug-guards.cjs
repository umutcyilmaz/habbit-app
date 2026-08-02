const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const failures = [];

function assertInvariant(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

function read(relativePath) {
  const absolutePath = path.join(projectRoot, relativePath);

  try {
    return fs.readFileSync(absolutePath, "utf8");
  } catch {
    failures.push(relativePath + ": file is missing or unreadable.");
    return "";
  }
}

function parse(relativePath, sourceText) {
  const sourceFile = ts.createSourceFile(
    relativePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  for (const diagnostic of sourceFile.parseDiagnostics) {
    failures.push(
      relativePath + ": could not be parsed (" +
        ts.flattenDiagnosticMessageText(diagnostic.messageText, " ") +
        ")."
    );
  }

  return sourceFile;
}

function visit(node, callback) {
  callback(node);
  node.forEachChild((child) => visit(child, callback));
}

function hasModifier(node, kind) {
  return node.modifiers?.some((modifier) => modifier.kind === kind) === true;
}

function findNamedImport(sourceFile, moduleSuffix, importedName) {
  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      !statement.moduleSpecifier.text.endsWith(moduleSuffix)
    ) {
      continue;
    }

    const bindings = statement.importClause?.namedBindings;

    if (!bindings || !ts.isNamedImports(bindings)) {
      continue;
    }

    for (const element of bindings.elements) {
      const sourceName = element.propertyName?.text ?? element.name.text;

      if (sourceName === importedName) {
        return element.name.text;
      }
    }
  }

  return null;
}

function containsJsxTag(node, tagName) {
  let found = false;

  visit(node, (current) => {
    if (
      (ts.isJsxSelfClosingElement(current) &&
        current.tagName.getText() === tagName) ||
      (ts.isJsxOpeningElement(current) &&
        current.tagName.getText() === tagName)
    ) {
      found = true;
    }
  });

  return found;
}

function countJsxTags(sourceFile, tagName) {
  let count = 0;

  visit(sourceFile, (node) => {
    if (
      (ts.isJsxSelfClosingElement(node) && node.tagName.getText() === tagName) ||
      (ts.isJsxOpeningElement(node) && node.tagName.getText() === tagName)
    ) {
      count += 1;
    }
  });

  return count;
}

function findFunction(sourceFile, functionName) {
  let result = null;

  visit(sourceFile, (node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === functionName) {
      result = node;
    }
  });

  return result;
}

function returnExpression(statement) {
  if (ts.isReturnStatement(statement)) {
    return statement.expression ?? null;
  }

  if (ts.isBlock(statement) && statement.statements.length === 1) {
    const onlyStatement = statement.statements[0];
    return onlyStatement && ts.isReturnStatement(onlyStatement)
      ? onlyStatement.expression ?? null
      : null;
  }

  return null;
}

function isNegatedIdentifier(expression, identifierName) {
  return (
    ts.isPrefixUnaryExpression(expression) &&
    expression.operator === ts.SyntaxKind.ExclamationToken &&
    ts.isIdentifier(expression.operand) &&
    expression.operand.text === identifierName
  );
}

function hasJsxAttributeValue(node, attributeName, value) {
  let found = false;

  visit(node, (current) => {
    if (
      (!ts.isJsxSelfClosingElement(current) &&
        !ts.isJsxOpeningElement(current)) ||
      !current.attributes
    ) {
      return;
    }

    for (const property of current.attributes.properties) {
      if (
        !ts.isJsxAttribute(property) ||
        property.name.getText() !== attributeName
      ) {
        continue;
      }

      if (property.initializer && ts.isStringLiteral(property.initializer)) {
        found = property.initializer.text === value;
      }
    }
  });

  return found;
}

function listFiles(directory, extensionPattern) {
  const absoluteDirectory = path.join(projectRoot, directory);

  if (!fs.existsSync(absoluteDirectory)) {
    return [];
  }

  const files = [];

  for (const entry of fs.readdirSync(absoluteDirectory, {
    withFileTypes: true
  })) {
    const relativePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...listFiles(relativePath, extensionPattern));
    } else if (extensionPattern.test(entry.name)) {
      files.push(relativePath);
    }
  }

  return files;
}

function verifyDebugBoundary() {
  const relativePath = "src/shared/runtime/debugTools.ts";
  const source = read(relativePath);
  const sourceFile = parse(relativePath, source);
  const resolver = findFunction(sourceFile, "resolveDebugToolsEnabled");
  let flagDeclaration = null;
  let flagStatement = null;

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === "debugToolsEnabled"
      ) {
        flagDeclaration = declaration;
        flagStatement = statement;
      }
    }
  }

  assertInvariant(
    resolver !== null && hasModifier(resolver, ts.SyntaxKind.ExportKeyword),
    relativePath + ": must export resolveDebugToolsEnabled for focused verification."
  );
  assertInvariant(
    flagDeclaration !== null &&
      flagStatement !== null &&
      hasModifier(flagStatement, ts.SyntaxKind.ExportKeyword),
    relativePath + ": must export the centralized debugToolsEnabled flag."
  );
  assertInvariant(
    flagDeclaration?.initializer?.getText().includes("__DEV__") === true,
    relativePath + ": debugToolsEnabled must be derived from __DEV__."
  );
  assertInvariant(
    !source.includes("process.env") &&
      !source.includes("EXPO_PUBLIC") &&
      !source.includes("E2E") &&
      !source.includes("e2eMode") &&
      !source.includes("storage"),
    relativePath + ": debug tools must not depend on environment flags, E2E mode, or storage."
  );

  if (source.length > 0) {
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020
      },
      fileName: relativePath
    }).outputText;

    function evaluate(isDevelopment) {
      const module = { exports: {} };
      const context = {
        __DEV__: isDevelopment,
        module,
        exports: module.exports,
        process: {
          env: new Proxy({}, {
            get() {
              return "1";
            }
          })
        }
      };

      vm.runInNewContext(output, context, { filename: relativePath });
      return module.exports;
    }

    try {
      const releaseExports = evaluate(false);
      const developmentExports = evaluate(true);

      assertInvariant(
        releaseExports.resolveDebugToolsEnabled(false) === false &&
          releaseExports.debugToolsEnabled === false,
        relativePath + ": release evaluation must disable debug tools."
      );
      assertInvariant(
        developmentExports.resolveDebugToolsEnabled(true) === true &&
          developmentExports.debugToolsEnabled === true,
        relativePath + ": development evaluation must keep debug tools available."
      );
    } catch (error) {
      failures.push(
        relativePath + ": runtime evaluation failed (" +
          (error instanceof Error ? error.message : String(error)) +
          ")."
      );
    }
  }
}

function verifyQuizPreview() {
  const relativePath =
    "src/features/onboarding/screens/OnboardingQuizScreen.tsx";
  const source = read(relativePath);
  const sourceFile = parse(relativePath, source);
  const debugFlag = findNamedImport(
    sourceFile,
    "/shared/runtime/debugTools",
    "debugToolsEnabled"
  );
  let guardedPanel = false;

  visit(sourceFile, (node) => {
    if (
      ts.isConditionalExpression(node) &&
      debugFlag !== null &&
      ts.isIdentifier(node.condition) &&
      node.condition.text === debugFlag &&
      containsJsxTag(node.whenTrue, "TestScoringPreviewPanel")
    ) {
      guardedPanel = true;
    }
  });

  assertInvariant(
    debugFlag !== null,
    relativePath + ": must import the centralized debug-tools boundary."
  );
  assertInvariant(
    !source.includes("SHOW_QUIZ_SCORING_PREVIEW"),
    relativePath + ": scoring preview must not use the old hard-coded flag."
  );
  assertInvariant(
    guardedPanel && countJsxTags(sourceFile, "TestScoringPreviewPanel") === 1,
    relativePath + ": scoring preview must render only behind debugToolsEnabled."
  );
  assertInvariant(
    findFunction(sourceFile, "TestScoringPreviewPanel") !== null &&
      source.includes("Test scoring preview"),
    relativePath + ": development scoring-preview source must remain available."
  );
  assertInvariant(
    !source.includes("process.env") && !source.includes("EXPO_PUBLIC_E2E_MODE"),
    relativePath + ": environment values must not enable the preview."
  );
}

function verifyDebugRoute() {
  const relativePath = "app/debug/bloom-state.tsx";
  const source = read(relativePath);
  const sourceFile = parse(relativePath, source);
  const debugFlag = findNamedImport(
    sourceFile,
    "/shared/runtime/debugTools",
    "debugToolsEnabled"
  );
  const redirectName = findNamedImport(sourceFile, "expo-router", "Redirect");
  const debugScreenName = findNamedImport(
    sourceFile,
    "/features/debug/screens/BloomStateDebugScreen",
    "BloomStateDebugScreen"
  );
  let routeFunction = null;

  for (const statement of sourceFile.statements) {
    if (
      ts.isFunctionDeclaration(statement) &&
      hasModifier(statement, ts.SyntaxKind.DefaultKeyword)
    ) {
      routeFunction = statement;
    }
  }

  const statements = routeFunction?.body?.statements ?? [];
  const firstStatement = statements[0];
  const guardReturn =
    firstStatement && ts.isIfStatement(firstStatement)
      ? returnExpression(firstStatement.thenStatement)
      : null;
  const laterDebugRender = statements.slice(1).some(
    (statement) => {
      const expression = returnExpression(statement);
      return (
        expression !== null &&
        debugScreenName !== null &&
        containsJsxTag(expression, debugScreenName)
      );
    }
  );

  assertInvariant(
    debugFlag !== null && redirectName !== null && debugScreenName !== null,
    relativePath + ": must import the shared guard, Redirect, and debug screen."
  );
  assertInvariant(
    firstStatement !== undefined &&
      ts.isIfStatement(firstStatement) &&
      debugFlag !== null &&
      isNegatedIdentifier(firstStatement.expression, debugFlag),
    relativePath + ": the first route statement must reject release access."
  );
  assertInvariant(
    guardReturn !== null &&
      redirectName !== null &&
      containsJsxTag(guardReturn, redirectName) &&
      hasJsxAttributeValue(guardReturn, "href", "/"),
    relativePath + ": release access must immediately redirect to the root entry."
  );
  assertInvariant(
    laterDebugRender,
    relativePath + ": development must still render BloomStateDebugScreen after the guard."
  );
  assertInvariant(
    !source.includes("useBloomLocalState") && !source.includes("process.env"),
    relativePath + ": the route boundary must not read state or environment flags."
  );
}

function verifyDevelopmentSources() {
  const debugScreenPath =
    "src/features/debug/screens/BloomStateDebugScreen.tsx";
  const debugScreenSource = read(debugScreenPath);
  const debugScreenFile = parse(debugScreenPath, debugScreenSource);
  const debugScreenFunction = findFunction(
    debugScreenFile,
    "BloomStateDebugScreen"
  );
  const navigationSource = read("src/constants/navigation.ts");
  const bootstrapSource = read(".maestro/subflows/open-debug-state.yaml");

  assertInvariant(
    debugScreenFunction !== null &&
      hasModifier(debugScreenFunction, ts.SyntaxKind.ExportKeyword) &&
      debugScreenSource.includes("useBloomLocalState"),
    debugScreenPath + ": Maestro's development state inspector must remain intact."
  );
  assertInvariant(
    navigationSource.includes('debugBloomState: "/debug/bloom-state"'),
    "src/constants/navigation.ts: development debug route must remain registered."
  );
  assertInvariant(
    bootstrapSource.includes("tms:///debug/bloom-state") &&
      bootstrapSource.includes("bloom.debug.state"),
    ".maestro/subflows/open-debug-state.yaml: development deep-link bootstrap must remain."
  );
}

function verifyProgressEntry() {
  const relativePath = "src/features/progress/screens/ProgressScreen.tsx";
  const source = read(relativePath);
  const sourceFile = parse(relativePath, source);
  const debugFlag = findNamedImport(
    sourceFile,
    "/shared/runtime/debugTools",
    "debugToolsEnabled"
  );
  let guardedEntry = false;

  visit(sourceFile, (node) => {
    if (
      ts.isConditionalExpression(node) &&
      debugFlag !== null &&
      ts.isIdentifier(node.condition) &&
      node.condition.text === debugFlag &&
      node.whenTrue.getText().includes("Open debug state")
    ) {
      guardedEntry = true;
    }
  });

  assertInvariant(
    debugFlag !== null && guardedEntry,
    relativePath + ": Progress debug entry must share the centralized boundary."
  );
}

function verifyArousalIdentifier() {
  const relativePath =
    "src/features/arousal-control/screens/MainPracticeScreen.tsx";
  const source = read(relativePath);
  const sourceFile = parse(relativePath, source);
  let stableIdentifierFound = false;

  visit(sourceFile, (node) => {
    if (
      !ts.isJsxAttribute(node) ||
      node.name.getText() !== "testID" ||
      node.initializer === undefined
    ) {
      return;
    }

    const attributeSource = node.getText();

    if (
      ts.isStringLiteral(node.initializer) &&
      node.initializer.text === "bloom.arousal.practice.mode"
    ) {
      stableIdentifierFound = true;
    }

    assertInvariant(
      !attributeSource.includes("draft.mode"),
      relativePath + ": testID must not expose the selected draft mode."
    );
  });

  assertInvariant(
    stableIdentifierFound,
    relativePath + ": stable bloom.arousal.practice.mode testID is missing."
  );

  const maestroFiles = listFiles(".maestro", /\.ya?ml$/);
  let maestroStableIdentifierFound = false;

  for (const maestroPath of maestroFiles) {
    const maestroSource = read(maestroPath);

    if (maestroSource.includes("bloom.arousal.practice.mode")) {
      maestroStableIdentifierFound = true;
    }

    assertInvariant(
      !maestroSource.includes("bloom.arousal.practice.mode."),
      maestroPath + ": stale value-bearing Arousal mode selector remains."
    );
  }

  assertInvariant(
    maestroStableIdentifierFound,
    ".maestro: stable Arousal practice-mode selector is not exercised."
  );
}

function verifyNoPersistenceCoupling() {
  for (const relativePath of listFiles("src/storage", /\.tsx?$/)) {
    const source = read(relativePath);
    assertInvariant(
      !source.includes("debugToolsEnabled") &&
        !source.includes("shared/runtime/debugTools"),
      relativePath + ": debug-tools availability must not be persisted."
    );
  }
}

verifyDebugBoundary();
verifyQuizPreview();
verifyDebugRoute();
verifyDevelopmentSources();
verifyProgressEntry();
verifyArousalIdentifier();
verifyNoPersistenceCoupling();

if (failures.length > 0) {
  console.error("Bloom release debug guard verification failed:");

  for (const failure of failures) {
    console.error("- " + failure);
  }

  process.exitCode = 1;
} else {
  console.log("Bloom release debug guard verification passed.");
}
