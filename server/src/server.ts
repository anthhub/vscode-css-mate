import {
	createConnection,
	TextDocuments,
	Diagnostic,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	TextDocumentSyncKind,
	InitializeResult,
	_,
	CodeActionKind,
	Command,
	CodeAction,
	Position,
	TextDocumentEdit,
	TextEdit,
	Hover,
	HandlerResult,
	Location,
	TextDocumentPositionParams,
	DocumentLink,
	DefinitionLink,
	LocationLink,
	SymbolInformation,
	Definition
} from 'vscode-languageserver';
const sast = require('sast')

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

// 参数校验
import lint from './lint';

// 自动补全
import autoCompletion from './autoCompletion';
import * as path from 'path'
import { batchKebabAndCamel, batchKebabToCamel, getLintBodyMsg, getLintMsg, isLintBodyMsg, kebabToCamel, stringSimilarity } from './utils/common';
import ast from './utils/ast';
import { Cmd, Ext } from './const';

// 创建一个服务器连接。使用Node的IPC作为传输方式。
// 也包含所有的预览、建议等LSP特性
let connection = createConnection(ProposedFeatures.all);

// 创建一个简单的文本管理器。
// 文本管理器只支持全文本同步。
let documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let hasDiagnosticRelatedInformationCapability: boolean = false;

connection.onInitialize((params: InitializeParams) => {
	let capabilities = params.capabilities;

	// 客户端是否支持`workspace/configuration`请求?
	// 如果不是的话，降级到使用全局设置
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			completionProvider: {
				resolveProvider: true
			},
			referencesProvider: true,
			hoverProvider: true,
			codeActionProvider: true,
			declarationProvider: true,
			definitionProvider: true,
			typeDefinitionProvider: true,
			implementationProvider: true,
			documentLinkProvider: { resolveProvider: true },

			executeCommandProvider: {
				commands: [`${Ext.NAME}.${Cmd.LIST_AVAILABLE}`, `${Ext.NAME}.${Cmd.REPLACE_TO_RECOMMEND}`]
			}
		}
	};
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	}
	return result;
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// 为所有配置Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

// 配置示例
interface ExampleSettings {
	[prop: string]: any;
}

// 当客户端不支持`workspace/configuration`请求时，使用global settings
// 请注意，在这个例子中服务器使用的客户端并不是问题所在，而是这种情况还可能发生在其他客户端身上。
const defaultSettings: ExampleSettings = { warning: true };
let globalSettings: ExampleSettings = defaultSettings;

// 对所有打开的文档配置进行缓存
let documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// 重置所有已缓存的文档配置
		documentSettings.clear();
	} else {
		globalSettings = <ExampleSettings>(
			(change.settings[Ext.NAME] || defaultSettings)
		);
	}

	// 重新验证所有打开的文本文档
	documents.all().forEach(validateTextDocument);
});

// 获取配置
function getDocumentSettings(resource: string): Thenable<ExampleSettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: Ext.NAME
		});
		documentSettings.set(resource, result);
	}
	return result;
}

// 只保留打开文档的设置
documents.onDidClose(e => {
	documentSettings.delete(e.document.uri);
});

// 文档变更时触发（第一次打开或内容变更）
documents.onDidChangeContent(change => {
	validateTextDocument(change.document);
});

// lint文档函数
async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	let diagnostics: Diagnostic[] = [];
	// 获取当前文档设置
	let settings = await getDocumentSettings(textDocument.uri);

	const cwd = path.dirname(textDocument.uri).replace(/^file\:\/\//, "")

	// 校验
	diagnostics.push(...lint(textDocument, cwd, hasDiagnosticRelatedInformationCapability, settings));

	// 发送诊断结果
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

// 自动补全
autoCompletion(connection, documents);

// 监听文档变化
connection.onDidChangeWatchedFiles(_change => {
	connection.console.log('We received an file change event');
});


connection.onCodeAction((param) => {
	const { context, textDocument } = param
	const document = documents.get(textDocument.uri);
	if (document === undefined) {
		return;
	}

	const diagnostics = context.diagnostics.filter(
		(d) => d.code === Cmd.LINT_CLASS
	)
	if (!diagnostics?.length) {
		return
	}

	const cwd = path.dirname(document.uri).replace(/^file\:\/\//, "")
	const selectorsObject = ast(document, cwd);
	if (!selectorsObject) return []

	const codeActions: CodeAction[] = []

	diagnostics.forEach((diagnostic) => {
		const { message, tags, range } = diagnostic
		// 没有列出属性的情况
		if (isLintBodyMsg(message)) {
			const { body } = getLintBodyMsg(message)
			const { consumers, selectors } = selectorsObject[body]
			const selectorsArr: string[] = batchKebabToCamel(selectors.map((selector: any) => selector.value))
			const extra = {
				message,
				selectorsArr,
				body,
				range
			}
			codeActions.push(...selectorsArr.map((item) => CodeAction.create(item, Command.create(item, `${Ext.NAME}.${Cmd.LIST_AVAILABLE}`, document.uri, { ...extra, label: item }), CodeActionKind.QuickFix)))
			return
		}

		const [isComputed] = tags || []
		const { property, body } = getLintMsg(message)
		const { consumers, selectors } = selectorsObject[body]
		const func = isComputed > 0 ? batchKebabAndCamel : batchKebabToCamel
		const selectorsArr: string[] = func(selectors.map((selector: any) => selector.value))
		const matches = stringSimilarity(property, selectorsArr).ratings.filter((item: { rating: number; }) => item.rating > 0)
		const extra = {
			message,
			selectorsArr,
			body,
			isComputed,
			range
		}
		codeActions.push(...matches.map((item: { target: any; }) => {
			const label = item.target
			return CodeAction.create(label, Command.create(label, `${Ext.NAME}.${Cmd.REPLACE_TO_RECOMMEND}`, document.uri, { ...extra, label }), CodeActionKind.QuickFix)
		}))
	})
	return codeActions
});


connection.onExecuteCommand(async (param) => {
	if (!param.arguments?.length) {
		return;
	}

	const textDocument = documents.get(param.arguments[0]);
	if (textDocument === undefined) {
		return;
	}

	const {
		range,
		label,
		isComputed
	} = param.arguments[1]

	if (param.command === `${Ext.NAME}.${Cmd.LIST_AVAILABLE}`) {
		connection.workspace.applyEdit({
			documentChanges: [
				TextDocumentEdit.create({ uri: textDocument.uri, version: textDocument.version }, [
					TextEdit.insert(range.end, '.' + label)
				])
			]
		});

	} else if (param.command === `${Ext.NAME}.${Cmd.REPLACE_TO_RECOMMEND}`) {
		connection.workspace.applyEdit({
			documentChanges: [
				TextDocumentEdit.create({ uri: textDocument.uri, version: textDocument.version }, [
					TextEdit.replace(range, isComputed ? `'${label}'` : label)
				])
			]
		});
		return;
	}
});


connection.onHover((_textDocumentPosition: TextDocumentPositionParams) => {
	const document = documents.get(_textDocumentPosition.textDocument.uri);

	if (!document) {
		return null;
	}
	const offsetAt = document.offsetAt(_textDocumentPosition.position);

	const cwd = path.dirname(document.uri).replace(/^file\:\/\//, "")
	const selectorsObject = ast(document, cwd);
	if (!selectorsObject) return

	let contentsBody: Hover = { contents: '' }

	Object.keys(selectorsObject).forEach((ident: string) => {
		const { consumers, selectors, stylesheetTree } = selectorsObject[ident]
		consumers.forEach((node: any) => {
			const { type, computed, object } = node;
			if (type === 'Identifier') {
				// 没有属性的情况
				const { start, end, name } = node;
				if (offsetAt >= start && offsetAt <= end) {
					contentsBody.contents = `[${Ext.NAME}]\n` + '```scss\n' + sast.stringify(stylesheetTree).trim() + '\n```'
				}
			}
			if (object?.type === 'Identifier') {
				// 没有属性的情况
				const { start, end, name } = object;
				if (offsetAt >= start && offsetAt <= end) {
					contentsBody.contents = `[${Ext.NAME}]\n` + '```scss\n' + sast.stringify(stylesheetTree).trim() + '\n```'
				}
			}

			if (type === 'MemberExpression') {
				let { type, name, start, end, value } = node.property

				// 计算属性
				if (type === 'Identifier' && computed) {
					return
				}
				// 1 代表[]计算属性
				if (type === 'StringLiteral') {
					name = value
				}

				if (offsetAt >= start && offsetAt <= end) {
					const selector = selectors.find((selector: any) => kebabToCamel(selector.value) === kebabToCamel(name))
					if (!selector) {
						return
					}
					contentsBody.contents = `[${Ext.NAME}]\n` + '```scss\n' + sast.stringify(selector.pruleset).trim()+ '\n```'
				}
			}
		})
	})

	return contentsBody
});


connection.onDefinition(
	(textDocumentPositon: TextDocumentPositionParams): Definition => {
		// 能从请求中获取的信息
		const documentIdentifier = textDocumentPositon.textDocument;

		const document = documents.get(documentIdentifier.uri);
		if (!document) {
			return [];
		}

		const offsetAt = document.offsetAt(textDocumentPositon.position);

		const locations: Location[] = []

		const cwd = path.dirname(document.uri).replace(/^file\:\/\//, "")
		const selectorsObject = ast(document, cwd);
		if (!selectorsObject) return []

		Object.keys(selectorsObject).forEach((ident: string) => {
			const { consumers, selectors, styleOriginUrl, styleUrl, stylesheetTree } = selectorsObject[ident]
			consumers.forEach((node: any) => {
				const { type, computed, object } = node;
				if (type === 'Identifier') {
					// 没有属性的情况
					const { start, end, name } = node;
					if (offsetAt >= start && offsetAt <= end) {
						const { position: { start: selectorStart, end: selectorEnd } } = stylesheetTree

						locations.push(
							Location.create(styleUrl, {
								start: Position.create(selectorStart.line - 1, selectorStart.column - 1),
								end: Position.create(selectorEnd.line - 1, selectorEnd.column)
							})
						)
					}
				}
				if (object?.type === 'Identifier') {
					// 没有属性的情况
					const { start, end, name } = object;
					if (offsetAt >= start && offsetAt <= end) {
						const { position: { start: selectorStart, end: selectorEnd } } = stylesheetTree

						locations.push(
							Location.create(styleUrl, {
								start: Position.create(selectorStart.line - 1, selectorStart.column - 1),
								end: Position.create(selectorEnd.line - 1, selectorEnd.column)
							})
						)
					}
				}

				if (type === 'MemberExpression') {
					let { type, name, start, end, value } = node.property

					// 计算属性
					if (type === 'Identifier' && computed) {
						return
					}
					// 1 代表[]计算属性
					if (type === 'StringLiteral') {
						name = value
					}

					if (offsetAt >= start && offsetAt <= end) {
						const selector = selectors.find((selector: any) => kebabToCamel(selector.value) === kebabToCamel(name))
						if (!selector) {
							return
						}
						const { pruleset: { position: { start: selectorStart, end: selectorEnd } } } = selector

						locations.push(
							Location.create(styleUrl, {
								start: Position.create(selectorStart.line - 1, selectorStart.column - 1),
								end: Position.create(selectorEnd.line - 1, selectorEnd.column)
							})
						)

					}
				}


			})
		})

		return locations
	}
);


// 让文档管理器监听文档的打开，变动和关闭事件
documents.listen(connection);

// 连接后启动监听
connection.listen();