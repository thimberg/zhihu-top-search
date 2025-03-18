#!/usr/bin/env -S deno run --unstable --allow-net --allow-read --allow-write --import-map=import_map.json

import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";
import { format } from "std/datetime/mod.ts";
import { join } from "std/path/mod.ts";
import { exists } from "std/fs/mod.ts";

import type { SearchWord, TopSearch } from "./types.ts";
import { createArchive, createReadme, mergeWords } from "./utils.ts";

const response = await fetch("https://www.zhihu.com/billboard");

if (!response.ok) {
  console.error("zhihu.com Access Error!");
  console.error(response.statusText);
  Deno.exit(-1);
}

const html = await response.text();

// HTMLをパースする
const doc = new DOMParser().parseFromString(html, "text/html");
if (!doc) {
  console.error("Failed to parse zhihu.com HTML.");
  Deno.exit(-1);
}

// デバッグ: HTMLの最初の一部分を表示して、データの場所を確認する
//console.log(html.slice(0, 1000));  // HTMLの先頭1000文字を表示

// 必要なデータを含む要素を見つける
// これはHTMLの中身を目視で確認してから適切なCSSセレクタを設定するのに役立ちます
const scriptElements = doc.querySelectorAll("script");
scriptElements.forEach((element, index) => {
  console.log(`Script ${index}:`);
  //  console.log(element.textContent.slice(0, 1000));  // 先頭1000文字を表示
});

// 上記の内容を目視で確認して、適切な要素を選択します（仮に#data とします）
const dataElement = doc.querySelector("#HotList-itemTitle");
if (!dataElement) {
  console.error("No specific data element found.");
  Deno.exit(-1);
}

const jsonContent = dataElement.textContent;
let result: TopSearch;
try {
  result = JSON.parse(jsonContent);
} catch (e) {
  console.error("Failed to parse JSON from data element.");
  console.error(e);
  Deno.exit(-1);
}

const words = result.top_search.words;

if (words.length === 0) {
  console.error("No words found in the top search results.");
}

console.log(words);

const yyyyMMdd = format(new Date(), "yyyy-MM-dd");
const fullPath = join("raw", `${yyyyMMdd}.json`);

let wordsAlreadyDownload: SearchWord[] = [];
if (await exists(fullPath)) {
  const content = await Deno.readTextFile(fullPath);
  wordsAlreadyDownload = JSON.parse(content);
}

// 保存原始データ
const wordsAll = mergeWords(words, wordsAlreadyDownload);
await Deno.writeTextFile(fullPath, JSON.stringify(wordsAll, null, 2));

// README.md 更新
const readme = await createReadme(wordsAll);
await Deno.writeTextFile("./README.md", readme);

// archives 更新
const archiveText = createArchive(wordsAll, yyyyMMdd);
const archivePath = join("archives", `${yyyyMMdd}.md`);
await Deno.writeTextFile(archivePath, archiveText);

// 手動導出のチェックに必要（エラーやデバッグの回避）
console.log("Process completed successfully!");
