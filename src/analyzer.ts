import { execFile } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface CompilerIssue {
    message: string;
    line: number;
    character: number;
    endCharacter: number;
}

/** The CLI currently emits anyhow text, with one-based inclusive lexer spans. */
export function parseCompilerError(output: string, source: string): CompilerIssue {
    const message = output.replace(/\x1b\[[0-9;]*m/g, '').trim().replace(/^Error:\s*/, '');
    const location = /(?:error at )?line (\d+),? column (\d+)(?: to (\d+))?/i.exec(message);
    const lines = source.split(/\r?\n/);
    const line = Math.max(0, Math.min(lines.length - 1, Number(location?.[1] ?? 1) - 1));
    const chars = Array.from(lines[line]);
    const start = Math.max(0, Math.min(chars.length, Number(location?.[2] ?? 1) - 1));
    const end = Math.max(start + 1, Math.min(chars.length, Number(location?.[3] ?? location?.[2] ?? 1)));
    return {
        message: message || 'Silex compilation failed.', line,
        character: chars.slice(0, start).join('').length,
        endCharacter: chars.slice(0, end).join('').length
    };
}

export class AnalyzerUnavailable extends Error {}

export async function compileBuffer(
    source: string, executable: string, signal: AbortSignal, cwd?: string
): Promise<CompilerIssue | undefined> {
    const directory = await mkdtemp(join(tmpdir(), 'silex-analyzer-'));
    try {
        const input = join(directory, 'buffer.slx');
        await writeFile(input, source, 'utf8');
        if (signal.aborted) { return; }
        return await new Promise((resolve, reject) => {
            execFile(executable, ['compile', input, '-o', join(directory, 'buffer.slxc')], {
                cwd, signal, timeout: 15000, maxBuffer: 1024 * 1024,
                windowsHide: true, env: { ...process.env, NO_COLOR: '1' }
            }, (error, stdout, stderr) => {
                if (signal.aborted) { resolve(undefined); }
                else if (!error) { resolve(undefined); }
                else if ((error as NodeJS.ErrnoException).code === 'ENOENT' ||
                    (error as NodeJS.ErrnoException).code === 'EACCES' || error.killed) {
                    reject(new AnalyzerUnavailable(`Cannot run Silex CLI '${executable}': ${error.message}`));
                } else {
                    resolve(parseCompilerError(stderr || stdout || error.message, source));
                }
            });
        });
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
}
