import {
    Diagnostic,
    DiagnosticSeverity,
    DiagnosticTag,
} from 'vscode-languageserver';
import {
    TextDocument
} from 'vscode-languageserver-textdocument';
import { Cmd, Ext } from './const';
import ast from './utils/ast';
import { batchKebabAndCamel, createLintBodyMsg, createLintMsg, stringSimilarity } from './utils/common';


export default function lint(textDocument: TextDocument, cwd: string, hasDiagnosticRelatedInformationCapability: boolean, settings: any) {
    let diagnostics: Diagnostic[] = [];

    const selectorsObject = ast(textDocument, cwd);
    if (!selectorsObject) return []


    Object.keys(selectorsObject).forEach((ident: string) => {
        const { consumers, selectors } = selectorsObject[ident]
        const selectorsArr: string[] = batchKebabAndCamel(selectors.map((selector: any) => selector.value))


        consumers?.forEach((node: any) => {
            const { type, computed } = node;
            if (type === 'MemberExpression') {
                let { name, start, end, type, value } = node.property

                // 计算属性
                if (type === 'Identifier' && computed) {
                    return
                }
                let tags: DiagnosticTag[] = []
                // 1 代表[]计算属性
                if (type === 'StringLiteral') {
                    name = value
                    tags.push(1)
                }

                const range = {
                    start: textDocument.positionAt(start),
                    end: textDocument.positionAt(end)
                };
                if (!selectorsArr.includes(name)) {
                    const similar = stringSimilarity(name, selectorsArr)

                    diagnostics.push({
                        severity: DiagnosticSeverity.Error,
                        range,
                        message: createLintMsg(ident, name, similar.best.target),
                        source: Ext.NAME,
                        code: Cmd.LINT_CLASS,
                        tags
                    });
                }
            } else if (type === 'Identifier') {
                // 没有属性的情况
                const { start, end, name } = node;
                const range = {
                    start: textDocument.positionAt(start),
                    end: textDocument.positionAt(end)
                };

                diagnostics.push({
                    severity: DiagnosticSeverity.Error,
                    range,
                    message: createLintBodyMsg(ident),
                    source: Ext.NAME,
                    code: Cmd.LINT_CLASS,
                });
            }
        })

    })

    return diagnostics;
}

