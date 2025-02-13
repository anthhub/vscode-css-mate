import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient';
import lintClient from './provider/lintClient';

let client: LanguageClient;

export function activate(context: vscode.ExtensionContext) {
	// 启动服务，server端处理lint
	client = lintClient(context);
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
