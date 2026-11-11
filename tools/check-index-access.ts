// Type-checks src/lib/ and src/analysis/ with `noUncheckedIndexedAccess` on (LIB-18b). tsc has no per-directory
// options, and a separate project would also report every file these directories import, so this asks the compiler
// for the diagnostics of these directories' files only. Part of `npm run typecheck`, after `tsc -b`.
import path from 'node:path';
import ts from 'typescript';

const STRICT_DIRS = ['src/lib', 'src/analysis'];

const root = path.resolve(import.meta.dirname, '..');
const configPath = path.join(root, 'tsconfig.app.json');
const parsed = ts.getParsedCommandLineOfConfigFile(configPath, { noUncheckedIndexedAccess: true }, {
  ...ts.sys,
  onUnRecoverableConfigFileDiagnostic: (d) => {
    throw new Error(ts.flattenDiagnosticMessageText(d.messageText, '\n'));
  },
});
if (!parsed) throw new Error(`cannot read ${configPath}`);

const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options });
const dirs = STRICT_DIRS.map((d) => path.join(root, d) + path.sep);
const inScope = (f: ts.SourceFile) => dirs.some((d) => path.resolve(f.fileName).startsWith(d));

const diagnostics = program
  .getSourceFiles()
  .filter(inScope)
  .flatMap((f) => [...program.getSyntacticDiagnostics(f), ...program.getSemanticDiagnostics(f)]);

if (diagnostics.length) {
  const host: ts.FormatDiagnosticsHost = {
    getCanonicalFileName: (f) => f,
    getCurrentDirectory: () => root,
    getNewLine: () => '\n',
  };
  process.stderr.write(ts.formatDiagnostics(diagnostics, host));
  process.stderr.write(`\n${diagnostics.length} error(s) with noUncheckedIndexedAccess in ${STRICT_DIRS.join(', ')}\n`);
  process.exit(2);
}
