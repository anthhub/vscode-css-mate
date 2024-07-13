import {
    TextDocument
} from 'vscode-languageserver-textdocument';
import traverse from "@babel/traverse";
const parser = require('@babel/parser');
const sast = require('sast')
import * as path from 'path'
import * as fs from 'fs'
import { traverseJSX } from './jsx'
import { traverseStylesheet } from './css'


// js、ts、jsx、tsx解析递归
function parseAndTraverse(astObj: any, cwd: string) {

    const jsxAttributes: any[] = []
    const selectorsObject: any = {}

    traverse(astObj, {
        JSXAttribute: ({ node }: any) => {
            if (node.name.type === 'JSXIdentifier' && node.name.name === 'className') {
                jsxAttributes.push(node)
            }
        },
        ImportDeclaration: ({ node }: any) => {
            const styleOriginUrl = node.source.value
            if (styleOriginUrl.includes('.scss')) {
                const idents = node?.specifiers?.map((item: any) => item.local.name)

                const styleUrl = path.join(cwd, styleOriginUrl)
                const cssContent = fs.readFileSync(styleUrl, { encoding: 'utf8' })
                const stylesheetTree = sast.parse(cssContent, { syntax: 'scss' })
                const selectors = traverseStylesheet(stylesheetTree)

                idents.forEach((ident: string) => {
                    selectorsObject[ident] = { selectors, styleUrl, styleOriginUrl, stylesheetTree }
                })
            }
        },
    });

    Object.keys(selectorsObject).forEach((ident: string) => {
        const consumers = jsxAttributes.map((node: any) => traverseJSX(ident, node.value))
        selectorsObject[ident].consumers = consumers.flat(Infinity).filter(Boolean)
    })

    return selectorsObject
}

/*
@desc 生产AST遍历函数
@param callback 节点访问回调，参数path，节点，start节点需要累积的位置，在校验定位时，需要用此矫正位置信息
*/
export default function ast(textDocument: TextDocument, cwd: string) {

    const text = textDocument.getText();
    const { languageId } = textDocument;

    if (['javascript', 'typescript', 'javascriptreact', 'typescriptreact'].indexOf(languageId) > -1) {
        const astObj = parser.parse(text, {
            sourceType: "module",
            plugins: [ // 增加插件支持jsx、ts以及提案中的语法
                "jsx",
                "typescript",
                ["decorators", { decoratorsBeforeExport: true }],
                "classProperties",
                "classPrivateProperties",
                "classPrivateMethods",
                "classStaticBlock",
                "doExpressions",
                "exportDefaultFrom",
                "functionBind",
                "importAssertions",
                "moduleStringNames",
                "partialApplication",
                ["pipelineOperator", { proposal: "minimal" }],
                "privateIn",
                ["recordAndTuple", { syntaxType: "hash" }],
                "throwExpressions",
                "topLevelAwait"
            ]
        });

        return parseAndTraverse(astObj, cwd)
    }

}


