import * as vscode from 'vscode';
import { findBracketDiagnostics, findSemanticDiagnostics } from './language';
import { AnalyzerUnavailable, compileBuffer } from './analyzer';
import { DiagnosticSeverityName, PositionInfo } from './types';

const SEVERITIES: Record<DiagnosticSeverityName, vscode.DiagnosticSeverity> = {
    error: vscode.DiagnosticSeverity.Error,
    warning: vscode.DiagnosticSeverity.Warning,
    hint: vscode.DiagnosticSeverity.Hint
};

function toRange(entry: PositionInfo & { length: number }): vscode.Range {
    return new vscode.Range(
        entry.line,
        entry.character,
        entry.line,
        entry.character + entry.length
    );
}

export class XelDiagnostics {
    private readonly collection: vscode.DiagnosticCollection;

    private readonly pending = new Map<string, { timer?: ReturnType<typeof setTimeout>; controller: AbortController }>();
    private readonly output = vscode.window.createOutputChannel('silex-analyzer');
    private reportedUnavailable = false;

    constructor() {
        this.collection = vscode.languages.createDiagnosticCollection('silex-analyzer');
    }

    public update(document: vscode.TextDocument): void {
        const key = document.uri.toString();
        this.cancel(key);
        const config = vscode.workspace.getConfiguration('silex-analyzer', document.uri);
        if (!config.get('diagnostics.enable', true)) {
            this.collection.delete(document.uri);
            return;
        }
        const text = document.getText();
        const diagnostics: vscode.Diagnostic[] = [];

        for (const entry of findBracketDiagnostics(text)) {
            const diagnostic = new vscode.Diagnostic(toRange(entry), entry.message, vscode.DiagnosticSeverity.Error);
            diagnostic.source = 'silex-analyzer';
            diagnostic.code = entry.message.startsWith('Unclosed') ? 'unclosed-bracket' : 'unmatched-bracket';
            diagnostics.push(diagnostic);
        }

        for (const entry of findSemanticDiagnostics(text)) {
            const diagnostic = new vscode.Diagnostic(toRange(entry), entry.message, SEVERITIES[entry.severity]);
            diagnostic.source = 'silex-analyzer';
            diagnostic.code = entry.code;
            if (entry.code === 'unused-variable') {
                diagnostic.tags = [vscode.DiagnosticTag.Unnecessary];
            }
            diagnostics.push(diagnostic);
        }

        this.collection.set(document.uri, diagnostics);
        if (!vscode.workspace.isTrusted) { return; }
        const controller = new AbortController();
        const pending = { controller, timer: undefined as ReturnType<typeof setTimeout> | undefined };
        this.pending.set(key, pending);
        const version = document.version;
        pending.timer = setTimeout(async () => {
            try {
                const issue = await compileBuffer(text, config.get('cliPath', 'silex-cli'), controller.signal,
                    vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath);
                if (controller.signal.aborted || document.isClosed || document.version !== version) { return; }
                this.reportedUnavailable = false;
                if (issue) {
                    const range = document.validateRange(new vscode.Range(issue.line, issue.character, issue.line, issue.endCharacter));
                    const diagnostic = new vscode.Diagnostic(range, issue.message, vscode.DiagnosticSeverity.Error);
                    diagnostic.source = 'silex-analyzer';
                    diagnostic.code = 'compiler-error';
                    // Compiler validation supersedes the heuristic semantic checks.
                    this.collection.set(document.uri, [...diagnostics.filter(d => d.code === 'unused-variable' || d.code === 'unclosed-bracket' || d.code === 'unmatched-bracket'), diagnostic]);
                } else {
                    this.collection.set(document.uri, diagnostics.filter(d => d.code === 'unused-variable'));
                }
            } catch (error) {
                if (!controller.signal.aborted) {
                    this.output.appendLine(String(error));
                    if (error instanceof AnalyzerUnavailable && !this.reportedUnavailable) {
                        this.reportedUnavailable = true;
                        void vscode.window.showWarningMessage('Silex CLI is unavailable. Local lint remains active. Install silex-cli or set silex-analyzer.cliPath. See the silex-analyzer output for details.');
                    }
                }
            } finally {
                if (this.pending.get(key) === pending) { this.pending.delete(key); }
            }
        }, config.get('diagnostics.delay', 400));
    }

    private cancel(key: string): void {
        const pending = this.pending.get(key);
        if (pending) {
            clearTimeout(pending.timer);
            pending.controller.abort();
            this.pending.delete(key);
        }
    }

    public clear(uri: vscode.Uri): void {
        this.cancel(uri.toString());
        this.collection.delete(uri);
    }

    public dispose(): void {
        for (const key of this.pending.keys()) { this.cancel(key); }
        this.output.dispose();
        this.collection.dispose();
    }
}