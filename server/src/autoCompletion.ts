import path = require('path');
import {
    TextDocuments,
    CompletionItem,
    CompletionItemKind,
    TextDocumentPositionParams,
    Connection,
    _,
} from 'vscode-languageserver';
import {
    TextDocument
} from 'vscode-languageserver-textdocument';
import { CallHierarchy } from 'vscode-languageserver/lib/callHierarchy.proposed';
import { SemanticTokens } from 'vscode-languageserver/lib/sematicTokens.proposed';
import { Ext } from './const';
import ast from './utils/ast';
import { batchKebabToCamel, stringSimilarity } from './utils/common';



export default function autoCompletion(connection: Connection<_, _, _, _, _, _, CallHierarchy & SemanticTokens>, documents: TextDocuments<TextDocument>) {
    connection.onCompletion(
        (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] | null => {
            const document = documents.get(_textDocumentPosition.textDocument.uri);
            if (!document) {
                return null;
            }
            const text = document.getText({
                start: document.positionAt(0),
                end: _textDocumentPosition.position
            });

            let completionItems: CompletionItem[] = [];

            const cwd = path.dirname(document.uri).replace(/^file\:\/\//, "")
            const selectorsObject = ast(document, cwd);
            if (!selectorsObject) return []

            Object.keys(selectorsObject).forEach((ident: string) => {
                const target = text.match(new RegExp(`${ident}\.([a-zA-Z][a-zA-Z0-9]*)$`))?.[1]
                if (target) {
                    const { consumers, selectors } = selectorsObject[ident]
                    const selectorsArr: string[] = batchKebabToCamel(selectors.map((selector: any) => selector.value))
                    const matches = stringSimilarity(target, selectorsArr).ratings.filter((item: { rating: number; }) => item.rating > 0)

                    completionItems.push(...matches.map((item: { target: any; }) => ({
                        label: item.target,
                        kind: CompletionItemKind.Property,
                        detail: item.target,
                        documentation: Ext.NAME
                    })))
                }

            })

            return completionItems
        }
    );


    connection.onCompletionResolve(
        (item: CompletionItem): CompletionItem => {
            return {
                ...item,
            };
        }
    );
}