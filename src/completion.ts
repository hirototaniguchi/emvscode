import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

const jsonObject2 = JSON.parse(fs.readFileSync(path.join(__dirname, '../json', 'output2.json'), 'utf8'));
const keywords2 = jsonObject2.completions;

const jsonObject3 = JSON.parse(fs.readFileSync(path.join(__dirname, '../json', 'output3.json'), 'utf8'));
const keywords3 = jsonObject3.completions;

const jsonObject4 = JSON.parse(fs.readFileSync(path.join(__dirname, '../json', 'output4.json'), 'utf8'));
const keywords4 = jsonObject4.completions;

// Mizarの予約語
const reservedWords = [
    "threom", "scheme", "definition", "registration", "notation",
    "schemes", "constructors", "definitions", "theorems", "vocabulary",
    "clusters", "signature", "requirements", "proof", "now", "end", "hereby",
    "case", "suppose", "for", "ex", "not", "&", "or", "implies", "iff", "st",
    "holds", "being", "assume", "cases", "given", "hence", "let", "per", "take",
    "thus", "and", "antonym", "attr", "as", "be", "begin", "canceled", "cluster",
    "coherence", "compatibility", "consider", "consistency", "contradiction", 
    "correctness","def", "deffunc", "defpred", "environ", "equals", "existence", 
    "func","if", "irreflecivity", "it", "means", "mode", "of", "otherwise", "over",
    "pred", "provided", "qua", "reconsider", "redefine", "reflexivity", "reserve",
    "struct", "such", "synonym", "that", "then", "thesis", "where", "associativity",
    "commutativity", "connectedness", "irreflexivity", "reflexivity", "symmetry",
    "uniqueness", "transitivity", "idempotence", "asymmetry", "projectivity", 
    "involutiveness"
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
        let startPosition = new vscode.Position(position.line, 0);
        let endPosition = position;
        let range = new vscode.Range(startPosition, endPosition);
        let inputText = document.getText(range);
        let completionList = new vscode.CompletionList();
        let splited = inputText.split(' ');
        let keywords:Array<string> = [];
        // 予測のために使う，直前のテキスト
        let recentInputText;
        // ユーザが現在の行で入力し単語数（スペースの数）
        let inputLength = splited.length - 1;

        // 入力補完に利用するN-gramの数
        let N = 3;
        let sliced:String[] = [];
        // 利用するN-gramに応じて，切り出しを行う
        // bi-gramの場合は直前の単語のみを切り出す
        if (inputLength >= N){
            sliced = splited.slice(inputLength-N+1, inputLength);
        }
        else{
            sliced = splited.slice(0, inputLength);
        }
        recentInputText = sliced.join(' ') + ' ';
        if (sliced.length === 1){
            keywords = keywords2;
        }
        else if (sliced.length === 2){
            keywords = keywords3;
        }
        else{
            keywords = keywords4;
        }

        let countItems = 0;
        for (let kw of keywords){
            if (kw.startsWith(recentInputText) === false){
                continue;
            }
            countItems++;
            let item = new vscode.CompletionItem(
                        kw.slice(recentInputText.length, kw.length), 0);
            // 確率の高い5つは候補の上位に表示させる
            if (countItems <= 5){
                // REVIEW:
                //「!」がトップに表示されることを確認したのみなので，要見直し
                item.sortText = "!".repeat(countItems);
            }
            items.push(item);
        }

        // 提示する候補がなく，かつユーザが何か文字を打った場合は予約語を提示
        if (items.length === 0 && context.triggerKind === 0){
            for (let kw of reservedWords){
                let item = new vscode.CompletionItem(kw, 13);
                items.push(item);
            }
        }

        completionList.items = items;
        return completionList;
    }
}
