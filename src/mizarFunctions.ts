import * as vscode from 'vscode';
import * as path from 'path';
import {calculateProgressDiff, MAX_OUTPUT} from './calculateProgress';
import {countLines} from './countLines';
import * as cp from 'child_process';
// NOTE: 「import * as from 'carrier';」と記述すると，
// なぜかモジュールが存在しない旨のエラーが出る
const carrier = require('carrier');
const Makeenv = 'makeenv';
export const ABSTR = 'abstr';
export const MIZFILES = process.env.MIZFILES;

/**
 * 項目を横並びにするために文字列の後にスペースを追加する関数
 * 指定文字数までスペースを追加する
 * @param {string} str スペースを追加する文字列
 * @param {number} num 何文字までスペースを追加するかを指定する数
 * @return {string} num文字までスペースを追加した文字列
 */
function padSpace(str:string, num = 9) {
  const padding = ' ';
  return str + padding.repeat(num - str.length);
}

/**
 * @fn
 * プログレスバーの足りない「#」を追加する関数
 * エラーがあれば，その数もプログレスバーの横にappendされる
 * @param {string} outputText 出力テキスト
 * @param {number} numberOfProgress プログレス数（「#」の数）
 * @param {number} numberOfErrors エラー数，プログレス横に出力される
 * @return {string} 
 */
function addMissingHashTags(
    outputText:string,
    numberOfProgress:number,
    numberOfErrors:number):string{
  if (MAX_OUTPUT < numberOfProgress) {
    return outputText;
  }
  outputText += '#'.repeat(MAX_OUTPUT - numberOfProgress);
  if (numberOfErrors > 0){
    outputText += ' *' + numberOfErrors;
  }
  outputText += '\n';
  return outputText;
  // channel.replace(outputText);
}

/**
 * fileNameで与えられたファイルに対して，makeenvとcommandを実行する関数
 * @param {vscode.OutputChannel} channel 結果を出力するチャンネル
 * @param {string} fileName makeenv,commandが実行する対象のファイル名
 * @param {string} command 実行するコマンド、デフォルトでは"verifier"となっている
 * @param {Object} runningCmd 実行中のコマンドを保持するオブジェクト，実行していない場合はnull
 * @return {Promise<string>}
 * コマンドの実行結果を,"success","makeenv error", "command error"で返す
 */
export async function mizarVerify(
    channel:vscode.OutputChannel,
    fileName:string,
    command = 'verifier',
    runningCmd: {process: cp.ChildProcess | null},
):Promise<string> {
  // Mac,LinuxではMizarコマンドのディレクトリにパスが通っていることを前提とする
  let makeenv = Makeenv;
  // 出力している「#」の数を保存する変数
  let numberOfProgress = 0;
  // mizarが出力したエラーの数を保持する変数
  let numberOfErrors = 0;
  // Parser,MSM,Analyzer等のコマンドから取得した項目をpushするリスト
  // 出力から得た項目(Parser,MSM等)が「コマンドを実行してから初めて得た項目なのか」を判定するために利用する
  const phases:string[] = [];
  if (process.platform === 'win32') {
    command = path.join(String(MIZFILES), command);
    makeenv = path.join(String(MIZFILES), makeenv);
  }
  // makeenvの実行
  const makeenvProcess = cp.spawn(makeenv, [fileName]);
  runningCmd.process = makeenvProcess;
  let isMakeenvSuccess = true;
  let isCommandSuccess = true;
  let outputText = 'Running ' + path.basename(command) + ' on ' + fileName + '\n\n'
              + '   Start |------------------------------------------------->| End\n';
  carrier.carry(makeenvProcess.stdout, (line:string) => {
    // -Vocabularies
    // -Vocabularies  [ 22]
    // -Requirements
    // -Requirements  [ 34]
    // 上記のような記述は出力しないようにする
    if (!/^-/.test(line)) {
      channel.appendLine(line);
    }
    if (line.indexOf('*') !== -1) {
      isMakeenvSuccess = false;
    }
  });
  // NOTE: 非同期実装の理由はコマンドの出力結果を逐一取得し，そのプログレスを表示するため
  const result:Promise<string> = new Promise((resolve) => {
    makeenvProcess.on('close', () => {
      runningCmd.process = null;
      if (!isMakeenvSuccess) {
        resolve('makeenv error');
        return;
      }
      const [numberOfEnvironmentalLines, numberOfArticleLines] =
                                                    countLines(fileName);
      let errorMsg = '\n**** Some errors detected.';
      const commandProcess = cp.spawn(command, [fileName]);
      // 実行中のプロセスを保存
      // NOTE:ユーザが実行を中断する時に必要になる
      runningCmd.process = commandProcess;
      carrier.carry(commandProcess.stdout, (line:string) => {
        // コマンドが出力するテキストに「*」が1つでもあれば，エラーとなる
        // NOTE:コマンドによっては「**** One irrelevant 'theorems' directive detected.」
        //      のようなメッセージだけで「*」が出力される場合があるため，最優先でチェックする
        if (line.indexOf('*') !== -1) {
          isCommandSuccess = false;
        }
        // Parser   [3482 *2] などを正規表現として抜き出し，
        // 「Parser」や「3482」「2」にあたる部分をグループ化している
        const cmdOutput = line.match(/^(\w+) +\[ *(\d+) *\**(\d*)\].*$/);
        if (cmdOutput === null) {
          return;
        }
        const phase = cmdOutput[1];
        const numberOfParsedLines = Number(cmdOutput[2]);
        numberOfErrors = Number(cmdOutput[3]);
        // 初めて出力された項目で実行
        if (phases.indexOf(phase) === -1) {
          // 直前の項目の#がMAX_OUTPUT未満であれば，足りない分の「#」を追加
          if (phases.length !== 0) {
            outputText = addMissingHashTags(outputText, numberOfProgress, numberOfErrors);
            channel.replace(outputText);
          }
          outputText += padSpace(phase) + ':'
          // 出力の項目を横並びにするために，スペースを補完する
          // OutputChannelに追加した項目として，phasesにpush
          phases.push(phase);
          // 新しい項目なので，プログレスを初期化する
          numberOfProgress = 0;
        }
        // 進捗の差（「#」の数）を計算
        const progressDiff = calculateProgressDiff(
            numberOfArticleLines,
            numberOfEnvironmentalLines,
            numberOfParsedLines,
            numberOfProgress);
        const appendChunk = '#'.repeat(progressDiff);
        if (appendChunk.length >= 1){
          outputText += appendChunk;
          channel.replace(outputText);
        }
        numberOfProgress += progressDiff;
        // Mizarコマンドが以下のようなエラーを出力すれば，errorMsgを更新
        // エラーの例：「**** One irrelevant 'theorems' directive detected.」
        const matched = line.match(/\*\*\*\*\s.+/);
        if (matched) {
          errorMsg = '\n' + matched[0];
        }
      }, null, /\r/);
      commandProcess.on('close', (code: number, signal: string) => {
        runningCmd.process = null;
        // ユーザがコマンドを中断した場合はクリア
        // FIXME: WindowsとLinuxで挙動が違うため，原因を調査
        // Windowsはcodeがnull，signalが'SIGINT'
        // Linuxはcodeが99，siganalがnullになる
        if (code === 99 || signal === 'SIGINT') {
          outputText = '';
          channel.clear();
        } else {
          // プログレスバーがMAX_OUTPUT未満であれば，足りない分の補完とエラー数の追加
          outputText = addMissingHashTags(outputText, numberOfProgress, numberOfErrors);
          channel.replace(outputText);
          if (isCommandSuccess) {
            // エラーがないことが確定するため，errorMsgを空にする
            errorMsg = '';
            resolve('success');
          } else {
            resolve('command error');
          }
          outputText += '\nEnd.\n';
          outputText += errorMsg;
          channel.replace(outputText);
        }
      });
    });
  });
  return result;
}
