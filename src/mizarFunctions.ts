import * as vscode from 'vscode';
import * as path from 'path';
import { makeDisplayProgress,MAX_OUTPUT } from './displayProgress';
import { countLines } from './countLines';
import * as cp from 'child_process';

const carrier = require('carrier');
const Makeenv = "makeenv";
export const Abstr = "abstr";
export const mizfiles = process.env.MIZFILES;

/**
 * @fn
 * fileNameで与えられたファイルに対して、makeenv,commandを実行し、"success","makeenv error","command error"
 * のいずれかを返す関数
 * @brief makeenv,commandを実行する関数
 * @param (channel) 結果を出力するチャンネル
 * @param (fileName) makeenv,commandが実行する対象のファイル名
 * @param (command) 実行するコマンド、デフォルトでは"verifier"となっている
 * @return コマンドの実行結果を,"success","makeenv error", "command error"で返す
 */
export async function mizar_verify(
    channel:vscode.OutputChannel, 
    fileName:string, 
    command:string="verifier",
    runningCmd: {process: cp.ChildProcess | null}
):Promise<string>
{
    // Mac,LinuxではMizarコマンドのディレクトリにパスが通っていることを前提とする
    let makeenv = Makeenv;
    if (process.platform === 'win32'){
        command = path.join(String(mizfiles), command);
        makeenv = path.join(String(mizfiles), makeenv);
    }
    const displayProgress = makeDisplayProgress();
    // makeenvの実行
    let makeenvProcess = require('child_process').spawn(makeenv,[fileName]);
    runningCmd['process'] = makeenvProcess;
    let isMakeenvSuccess = true;
    let isCommandSuccess = true;
    carrier.carry(makeenvProcess.stdout, (line:string) => {
        // -Vocabularies
        // -Vocabularies  [ 22]
        // -Requirements
        // -Requirements  [ 34]
        // 上記のような記述は出力しないようにする
        if (!/^-/.test(line)){
            channel.appendLine(line);
        }
        if (line.indexOf('*') !== -1){
            isMakeenvSuccess = false;
        }
    });
    // 非同期処理から実行結果を得るため、Promiseを利用している
    let result:Promise<string> = new Promise((resolve) => {
        makeenvProcess.on('close', () => {
            runningCmd['process'] = null;
            if (!isMakeenvSuccess){
                resolve('makeenv error');
                return;
            }
            channel.appendLine("Running " + path.basename(command)
                                + " on " + fileName + '\n');
            channel.appendLine("   Start |------------------------------------------------->| End");
            let [numberOfEnvironmentalLines,
                numberOfArticleLines] = countLines(fileName);
            let numberOfProgress:number = 0;
            let numberOfErrors:number = 0;
            let errorMsg = "\n**** Some errors detected.";
            let commandProcess = require('child_process').spawn(command,[fileName]);
            // 実行中のプロセスを保存（ユーザが実行を中断する場合に必要となる）
            runningCmd['process'] = commandProcess;
            carrier.carry(commandProcess.stdout, (line:string) => {
                // lineを渡してプログレスバーを表示する関数を呼び出す
                [numberOfProgress,numberOfErrors] = displayProgress(channel,line,
                    numberOfArticleLines,numberOfEnvironmentalLines);
                // コマンドが出力するテキストに「*」が1つでもあれば，エラーとなる
                if (line.indexOf('*') !== -1){
                    isCommandSuccess = false;
                }
                // Mizarコマンドが以下のようなエラーを出力すれば，errorMsgを更新
                // エラーの例1：「**** 2 errors detected」
                // エラーの例2：「**** One irrelevant 'theorems' directive detected.」
                let matched = line.match(/\*\*\*\*\s.+/);
                if (matched){
                    errorMsg = "\n" + matched[0];
                }
            }, null, /\r/);
            commandProcess.on('close', (code: number, signal: string) => {
                runningCmd['process'] = null;
                // ユーザがコマンドを中断した場合はクリア
                if (signal === 'SIGINT'){
                    channel.clear();
                }
                else{
                    // 最後の項目のプログレスバーがMAX_OUTPUT未満であれば、足りない分を補完
                    let appendChunk = "#".repeat(MAX_OUTPUT-numberOfProgress);
                    channel.append(appendChunk);
                    // エラーがあれば，エラー数を項目横に出力
                    if (numberOfErrors >= 1){
                        channel.appendLine(" *" + numberOfErrors);
                    }
                    else{
                        channel.appendLine("");
                    }
                    if (isCommandSuccess){
                        // エラーがないことが確定するため，errorMsgを空にする
                        errorMsg = "";
                        resolve('success');
                    }
                    else{
                        resolve('command error');
                    }
                    channel.appendLine("\nEnd.");
                    channel.appendLine(errorMsg);
                }
            });
        });
    });
    return await result;
}
