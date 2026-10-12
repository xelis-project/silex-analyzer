import * as vscode from 'vscode';
import { XelHoverProvider } from './providers/hoverProvider';
import { XelCompletionProvider } from './providers/completionProvider';
import { XelSignatureHelpProvider } from './providers/signatureHelpProvider';
import { XelDocumentSymbolProvider } from './providers/documentSymbolProvider';
import { XelDefinitionProvider } from './providers/definitionProvider';
import { XelReferenceProvider } from './providers/referenceProvider';
import { XelFoldingRangeProvider } from './providers/foldingProvider';
import { XelWorkspaceSymbolProvider } from './providers/workspaceSymbolProvider';
import { XelSemanticTokensProvider, XVM_SEMANTIC_TOKEN_LEGEND } from './providers/semanticTokensProvider';
import { XelDocumentHighlightProvider } from './providers/documentHighlightProvider';
import { XelCodeActionProvider } from './providers/codeActionProvider';
import { XelFormattingProvider } from './providers/formattingProvider';
import { XelDiagnostics } from './diagnostics';

const LANGUAGE_ID = 'xvm';

export function activate(context: vscode.ExtensionContext) {
    const diagnostics = new XelDiagnostics();

    context.subscriptions.push(
        diagnostics,
        vscode.commands.registerCommand('silex-analyzer.check', () => {
            const document = vscode.window.activeTextEditor?.document;
            if (document?.languageId === LANGUAGE_ID) { diagnostics.update(document); }
        }),
        vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('silex-analyzer')) {
                for (const document of vscode.workspace.textDocuments) {
                    if (document.languageId === LANGUAGE_ID) { diagnostics.update(document); }
                }
            }
        }),
        vscode.workspace.onDidGrantWorkspaceTrust(() => {
            for (const document of vscode.workspace.textDocuments) {
                if (document.languageId === LANGUAGE_ID) { diagnostics.update(document); }
            }
        }),
        vscode.languages.registerHoverProvider(LANGUAGE_ID, new XelHoverProvider()),
        vscode.languages.registerCompletionItemProvider(
            LANGUAGE_ID,
            new XelCompletionProvider(),
            '.',
            ':'
        ),
        vscode.languages.registerSignatureHelpProvider(
            LANGUAGE_ID,
            new XelSignatureHelpProvider(),
            '(',
            ','
        ),
        vscode.languages.registerDocumentSymbolProvider(LANGUAGE_ID, new XelDocumentSymbolProvider()),
        vscode.languages.registerDefinitionProvider(LANGUAGE_ID, new XelDefinitionProvider()),
        vscode.languages.registerReferenceProvider(LANGUAGE_ID, new XelReferenceProvider()),
        vscode.languages.registerFoldingRangeProvider(LANGUAGE_ID, new XelFoldingRangeProvider()),
        vscode.languages.registerWorkspaceSymbolProvider(new XelWorkspaceSymbolProvider()),
        vscode.languages.registerDocumentSemanticTokensProvider(
            LANGUAGE_ID,
            new XelSemanticTokensProvider(),
            XVM_SEMANTIC_TOKEN_LEGEND
        ),
        vscode.languages.registerDocumentHighlightProvider(LANGUAGE_ID, new XelDocumentHighlightProvider()),
        vscode.languages.registerDocumentFormattingEditProvider(LANGUAGE_ID, new XelFormattingProvider()),
        vscode.languages.registerCodeActionsProvider(
            LANGUAGE_ID,
            new XelCodeActionProvider(),
            { providedCodeActionKinds: XelCodeActionProvider.providedCodeActionKinds }
        ),
        vscode.workspace.onDidOpenTextDocument(document => {
            if (document.languageId === LANGUAGE_ID) {
                diagnostics.update(document);
            }
        }),
        vscode.workspace.onDidChangeTextDocument(event => {
            if (event.document.languageId === LANGUAGE_ID) {
                diagnostics.update(event.document);
            }
        }),
        vscode.workspace.onDidCloseTextDocument(document => {
            diagnostics.clear(document.uri);
        })
    );

    for (const document of vscode.workspace.textDocuments) {
        if (document.languageId === LANGUAGE_ID) {
            diagnostics.update(document);
        }
    }
}

export function deactivate() {}
