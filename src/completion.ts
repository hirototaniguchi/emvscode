import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';

const jsonObject1 = JSON.parse(fs.readFileSync(path.join(__dirname, '../json', 'output1.json'), 'utf8'));
const keywords1 = jsonObject1.completions;

const jsonObject2 = JSON.parse(fs.readFileSync(path.join(__dirname, '../json', 'output2.json'), 'utf8'));
const keywords2 = jsonObject2.completions;

const jsonObject3 = JSON.parse(fs.readFileSync(path.join(__dirname, '../json', 'output3.json'), 'utf8'));
const keywords3 = jsonObject3.completions;

const jsonObject4 = JSON.parse(fs.readFileSync(path.join(__dirname, '../json', 'output4.json'), 'utf8'));
const keywords4 = jsonObject4.completions;

const jsonObject5 = JSON.parse(fs.readFileSync(path.join(__dirname, '../json', 'output5.json'), 'utf8'));
const keywords5 = jsonObject5.completions;

const reservedWords = [
    "threom", "scheme", "definition", "registration", "notation",
    "schemes", "constructors", "definitions", "theorems", "vocabulary",
    "clusters", "signature", "requirements", "proof", "now", "end", "hereby",
    "case", "suppose", "for", "ex", "not", "&", "or", "implies", "iff", "st",
    "holds", "being", "assume", "cases", "given", "hence", "let", "per", "take",
    "thus", "and", "antonym", "attr", "as", "be", "begin", "canceled", "cluster",
    "coherence", "compatibility", "consider", "consistency", "contradiction", "correctness",
    "def", "deffunc", "defpred", "environ", "equals", "existence", "func",
    "if", "irreflecivity", "it", "means", "mode", "of", "otherwise", "over",
    "pred", "provided", "qua", "reconsider", "redefine", "reflexivity", "reserve",
    "struct", "such", "synonym", "that", "then", "thesis", "where", "associativity",
    "commutativity", "connectedness", "irreflexivity", "reflexivity", "symmetry",
    "uniqueness", "transitivity", "idempotence", "asymmetry", "projectivity", "involutiveness"
];

export class Completion implements vscode.CompletionItemProvider{
    public provideCompletionItems(
        document:vscode.TextDocument,
        position:vscode.Position,
        token:vscode.CancellationToken,
        context:vscode.CompletionContext
    ):vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList>
    {
        let items:vscode.CompletionItem[] = [];
        let line = document.lineAt(position.line);
        let startPosition = new vscode.Position(position.line, 0);
        let endPosition = position;
        let range = new vscode.Range(startPosition, endPosition);
        let inputText = document.getText(range);
        let completionList = new vscode.CompletionList();
        let splited = inputText.split(' ');

        // 処理時間の計測
        const startTime = performance.now();

        // ユーザが現在の行で入力したスペースの数
        let inputLength = splited.length - 1;
        vscode.window.showInformationMessage(inputLength.toString());

        // 予約語は必ず候補として含めておく
        for (let kw of reservedWords){
            let item = new vscode.CompletionItem(kw);
            items.push(item);
        }

        // 現在の行にユーザが何も入力していない場合，予約語のみを候補にする
        if (inputLength <= 0){
            completionList.items = items;
            return completionList;
        }

        // ユーザの入力数（スペースの数）が1以上2未満であれば，2-gram,3-gramを使う必要がある．
        if (inputLength === 1){
            let keywords = keywords2.concat(keywords3);
            for (let kw of keywords){
                // !FIXME:indexOfでバグ発生
                // 「Subset of X」と「set」のような部分集合であっても，一致してしまい，候補がおかしい
                if (kw.startsWith(splited[inputLength-1]) === false){
                    continue;
                }
                let item = new vscode.CompletionItem(kw.slice(inputText.length-1, kw.length));
                items.push(item);
            }
        }
        // ユーザの入力数（スペースの数）が3未満であれば，3-gram,4-gramを使う必要がある．
        else if (inputLength === 2){
            let keywords = keywords3.concat(keywords4);
            for (let kw of keywords){
                if (kw.startsWith(splited[inputLength-2]+' '+splited[inputLength-1]) === false){
                    continue;
                }
                let item = new vscode.CompletionItem(kw.slice(inputText.length-1, kw.length));
                items.push(item);
            }
        }
        // ユーザの入力数（スペースの数）が3以上であれば，4-gram,5-gramを使う必要がある．
        else{
            let keywords = keywords4.concat(keywords5);
            for (let kw of keywords){
                if (kw.startsWith(splited[inputLength-3]+ ' ' +splited[inputLength-2] + ' ' + splited[inputLength-1]) === false){
                    continue;
                }
                let item = new vscode.CompletionItem(kw.slice(inputText.length-1, kw.length));
                items.push(item);
            }
        }


        // if (splited.length >= 1){
        //     for (let kw of keywords2){
        //         if (kw.indexOf(inputText) === -1){
        //             continue;
        //         }
        //         // TODO:length-1が正しいか確認
        //         let item = new vscode.CompletionItem(kw.slice(inputText.length-1, kw.length));
        //         items.push(item);
        //     }
        // }

        // if (splited.length >= 1){
        //     for (let kw of keywords3){
        //         if (kw.indexOf(inputText) === -1){
        //             continue;
        //         }

        //         // TODO:length-1が正しいか確認
        //         let item = new vscode.CompletionItem(kw.slice(inputText.length-1, kw.length));
        //         items.push(item);
        //     }
        // }

        // if (splited.length >= 1){
        //     for (let kw of keywords4){
        //         if (kw.indexOf(inputText) === -1){
        //             continue;
        //         }
        //         // TODO:length-1が正しいか確認
        //         let item = new vscode.CompletionItem(kw.slice(inputText.length-1, kw.length));
        //         items.push(item);
        //     }
        // }

        // if (splited.length >= 1){
        //     for (let kw of keywords5){
        //         if (kw.indexOf(inputText) === -1){
        //             continue;
        //         }
        //         // TODO:length-1が正しいか確認
        //         let item = new vscode.CompletionItem(kw.slice(inputText.length-1, kw.length));
        //         items.push(item);
        //     }
        // }

        const endTime = performance.now();
        console.log('処理時間：', endTime-startTime);

        // trueに設定することで，タイピングされるたびにこのメソッドが呼び出される
        completionList.items = items;
        return completionList;
    }
}