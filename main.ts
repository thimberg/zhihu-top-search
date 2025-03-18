#!/usr/bin/env -S deno run --unstable --allow-net --allow-read --allow-write --import-map=import_map.json

import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";
import { format } from "std/datetime/mod.ts";
import { join } from "std/path/mod.ts";
import { exists } from "std/fs/mod.ts";
import { ensureDir } from "std/fs/mod.ts";

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

// デバッグ用: script要素の内容をデバッグで表示
const scriptElements = doc.querySelectorAll("script");
scriptElements.forEach((element, index) => {
  console.log(`Script ${index}:`);
  // console.log(element.textContent.slice(0, 1000));  // 先頭1000文字を表示
});

// 必要なデータを含む要素を見つける
const topSearchItems = doc.querySelectorAll(".HotList-itemBody");
if (topSearchItems.length === 0) {
  console.error("No top search items found.");
  Deno.exit(-1);
}

console.log(topSearchItems.length);

// 各検索ワード情報を抽出
const words: SearchWord[] = [];
topSearchItems.forEach((item) => {
  const titleElement = item.querySelector(".HotList-itemTitle");

  if (titleElement) {
    words.push({
      title: titleElement.textContent.trim(),
    });
  }
});

if (words.length === 0) {
  console.error("No search words found after parsing.");
  Deno.exit(-1);
}

//console.log(words);

const yyyyMMdd = format(new Date(), "yyyy-MM-dd");
const year = yyyyMMdd.substring(0, 4);
const fullPath = join("raw", `${yyyyMMdd}.json`);

await ensureDir("raw");

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
const archiveDir = join("archives", year);
const archivePath = join(archiveDir, `${yyyyMMdd}.md`);
await ensureDir(archiveDir);
await Deno.writeTextFile(archivePath, archiveText);

// 手動導出のチェックに必要（エラーやデバッグの回避）
console.log("Process completed successfully!");
