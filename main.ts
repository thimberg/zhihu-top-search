#!/usr/bin/env -S deno run --unstable --allow-net --allow-read --allow-write --import-map=import_map.json

import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";
import { format } from "std/datetime/mod.ts";
import { join } from "std/path/mod.ts";
import { exists } from "std/fs/mod.ts";
import { ensureDir } from "std/fs/mod.ts";

import type { SearchWord, TopSearch } from "./types.ts";
import { createArchive, createReadme, mergeWords } from "./utils.ts";

// APIエンドポイント
const url = "https://www.zhihu.com/api/v3/feed/topstory/hot-lists/total?limit=30";

// ヘッダー設定
const headers = {
  "User-Agent": "Mozilla/5.0",
};

const response = await fetch(url, { headers });

if (!response.ok) {
  console.error("zhihu.com Access Error!");
  console.error(response.statusText);
  Deno.exit(-1);
}

const result = await response.json();

const words: SearchWord[] = [];
result.forEach((item) => {
   const title = item.target.title;
   const url = item.target.url;

   if (title && url) {

     words.push({
       title: title.trim(),
       utl: url.trim(),
     });
   }
 });

//const words = result.data;

if (words.length === 0) {
  console.error("No search words found after parsing.");
  Deno.exit(-1);
}

console.log(words);

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
