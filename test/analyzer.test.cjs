const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, writeFile, chmod, rm, readdir } = require('node:fs/promises');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { compileBuffer, parseCompilerError, AnalyzerUnavailable } = require('../dist/analyzer');

test('parser errors map one-based inclusive spans to editor positions', () => {
    const issue = parseCompilerError('Error: failed to parse Silex source: error at line 2, column 5 to 7: invalid type', 'fn main() {\n    foo\n}');
    assert.equal(issue.line, 1);
    assert.equal(issue.character, 4);
    assert.equal(issue.endCharacter, 7);
    assert.match(issue.message, /invalid type/);
});

test('lexer errors, ANSI output, Unicode and locationless failures', () => {
    assert.deepEqual(parseCompilerError('\x1b[31mLexer error at line 1 column 3: bad token\x1b[0m', '😀 x'), {
        message: 'Lexer error at line 1 column 3: bad token', line: 0, character: 3, endCharacter: 4
    });
    assert.equal(parseCompilerError('Error: failed to compile Silex source\nCaused by: bad return', 'fn main() {}').line, 0);
    const issue = parseCompilerError('error at line 99, column 99 to 100: EOF', 'x');
    assert.equal(issue.character, 1);
});

test('CLI compiles the unsaved buffer, reports failure and cleans up temporary files', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'silex-test-'));
    const executable = join(directory, 'fake-cli');
    const record = join(directory, 'input-path');
    try {
        await writeFile(executable, `#!/usr/bin/env node\nconst fs = require('node:fs');\nconst args = process.argv.slice(2);\nfs.writeFileSync(${JSON.stringify(record)}, args[1]);\nif (args[0] !== 'compile' || args[2] !== '-o') process.exit(2);\nconst source = fs.readFileSync(args[1], 'utf8');\nif (source === 'invalid') { fs.writeSync(2, 'Error: error at line 1, column 1 to 7: bad source'); process.exit(1); }\nif (source === 'slow') { setTimeout(() => {}, 30000); } else { fs.writeFileSync(args[3], 'bytecode'); }\n`);
        await chmod(executable, 0o755);
        assert.equal(await compileBuffer('valid', executable, new AbortController().signal), undefined);
        const input = await require('node:fs/promises').readFile(record, 'utf8');
        await assert.rejects(readdir(require('node:path').dirname(input)), { code: 'ENOENT' });
        assert.match((await compileBuffer('invalid', executable, new AbortController().signal)).message, /bad source/);
        const controller = new AbortController();
        const check = compileBuffer('slow', executable, controller.signal);
        setTimeout(() => controller.abort(), 100);
        assert.equal(await check, undefined);
        await assert.rejects(compileBuffer('valid', join(directory, 'missing'), new AbortController().signal), AnalyzerUnavailable);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});
