import path from 'node:path';
import { expect, it } from 'vitest';
import ts from 'typescript';

it('emits the actual API with Vercel compiler defaults without weakening strict validation', () => {
  const cwd = process.cwd();
  const entry = path.join(cwd, 'api/index.ts');
  const configPath = ts.findConfigFile(path.dirname(entry), ts.sys.fileExists.bind(ts.sys));
  expect(configPath).toBeDefined();
  if (configPath === undefined) throw new Error('API configuration missing');
  const raw = ts.readConfigFile(configPath, ts.sys.readFile.bind(ts.sys)).config as {
    compilerOptions: Record<string, unknown>;
  };
  // @vercel/node 12.0.2 register/readConfig/fixConfig applies these before extends.
  // Source: https://github.com/vercel/vercel/blob/main/packages/node/src/typescript.ts
  raw.compilerOptions = {
    ...raw.compilerOptions,
    sourceMap: true,
    inlineSourceMap: false,
    inlineSources: true,
    declaration: false,
    noEmit: false,
    outDir: '$$ts-node$$',
  };
  raw.compilerOptions.target ??= 'ES2021';
  raw.compilerOptions.esModuleInterop ??= true;
  if (raw.compilerOptions.module === undefined) {
    Object.assign(raw.compilerOptions, {
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      strict: false,
    });
  }
  const parsed = ts.parseJsonConfigFileContent(
    raw,
    ts.sys,
    path.dirname(configPath),
    undefined,
    configPath,
  );
  const service = ts.createLanguageService({
    getScriptFileNames: () => parsed.fileNames,
    getScriptVersion: () => '',
    getScriptSnapshot: (name) => {
      const text = ts.sys.readFile(name);
      return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
    },
    getCurrentDirectory: () => cwd,
    getCompilationSettings: () => parsed.options,
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    fileExists: ts.sys.fileExists.bind(ts.sys),
    readFile: ts.sys.readFile.bind(ts.sys),
    readDirectory: ts.sys.readDirectory.bind(ts.sys),
    directoryExists: ts.sys.directoryExists.bind(ts.sys),
    getDirectories: ts.sys.getDirectories.bind(ts.sys),
  });
  try {
    const output = service.getEmitOutput(entry);
    const diagnostics = [
      ...parsed.errors,
      ...service.getCompilerOptionsDiagnostics(),
      ...service.getSemanticDiagnostics(entry),
      ...service.getSyntacticDiagnostics(entry),
    ].map((item) => `${item.code}: ${ts.flattenDiagnosticMessageText(item.messageText, ' ')}`);
    expect(output.emitSkipped, diagnostics.join('\n')).toBe(false);
    expect(diagnostics).toEqual([]);
    expect(output.outputFiles.some((file) => file.name.endsWith('/index.js'))).toBe(true);
    expect(parsed.options.strict).toBe(true);
    expect(parsed.options.strictNullChecks ?? parsed.options.strict).toBe(true);
    expect(parsed.options.exactOptionalPropertyTypes).toBe(true);
    expect(parsed.options.noEmitOnError).toBe(true);
    const root = ts.readConfigFile(path.join(cwd, 'tsconfig.json'), ts.sys.readFile.bind(ts.sys))
      .config as {
      compilerOptions: { noEmit: boolean };
    };
    expect(root.compilerOptions.noEmit).toBe(true);
  } finally {
    service.dispose();
  }
});
