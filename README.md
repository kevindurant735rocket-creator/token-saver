# token-saver

Shrink text before it reaches an LLM context window. For prompt-budget nerds.

One file, zero dependencies, ~160 lines of Node. It estimates token counts,
strips noise lines, and tells you what a token budget buys you.

## Real output

```
$ ts count sample.js
📊 sample.js
   字符: 280
   Token: 70 (≈0.1K)
   文件: 0.3 KB
   预估成本: $0.0002 (GPT-4o)

$ ts breakdown sample.js
📊 sample.js — 每行token分布 (共70 token):
     5 │███████ 13t │ function handler(req, res) { res.send("hello"); }
     9 │███████ 13t │ function handler(req, res) { res.send("hello"); }
     3 │██████ 11t │ // this is a comment line that takes space
     1 │█████ 9t │ const express = require("express");
     7 │█████ 9t │ const express = require("express");
     2 │███ 6t │ const app = express();
    10 │███ 6t │ module.exports = app;
     6 │██ 5t │ app.listen(3000);

$ ts dedup sample.js
🔁 去重: 11行 → 6行 (省 22 token)

$ ts budget 50000
💰 预算: 50000 token
   可读约 25 个中小文件 (每个~2K token)
   或 100 个短文件 (每个~500 token)
   或 6 个大文件 (每个~8K token)
```

## Install

```bash
npm install -g .
```

Requires Node 18+ (ESM). Installs the `ts` binary.

## Usage

```bash
ts count <file>                    # estimate tokens + cost
ts breakdown <file>                # top 15 lines by token cost, with bars
ts compress <file> [ratio] [out]   # default ratio 0.5
ts dedup <file> [out]              # drop duplicate + blank lines
ts context <file> [max]            # head+tail window, default 4000 tokens
ts head <file> <lines>             # default 20
ts tail <file> <lines>             # default 20
ts strip <file> [out]              # drop #, //, /*, * and blank lines
ts budget <tokens>                 # how many files a budget covers
```

Commands taking an `[out]` argument write there instead of stdout.

中文说明：`ts` 按「4 字符 ≈ 1 token」粗估 token 数，用 `compress` / `dedup` /
`strip` / `context` 压缩要塞进 LLM 上下文的文本，用 `budget` 规划预算。

## How the estimate works

Every number here is `Math.ceil(text.length / 4)`. That is the whole model.
Cost is hardcoded at $0.003 per 1K tokens ("GPT-4o").

## What this is not

- **Not a tokenizer.** No BPE, no vocabulary, no model awareness. English code
  lands near 4 chars/token; CJK is closer to 1 char/token, so Chinese files get
  underestimated by roughly 4x.
- **`compress` is not summarization.** It sorts lines by length and keeps the
  longest N. No model, no semantics. On prose you lose meaning; on logs and
  structured dumps it is fine.
- **`strip` is a line-prefix filter,** not a comment parser. It drops any line
  starting with `#`, `//`, `/*`, or `*` — that takes out real code (`#define`,
  shebangs, JSDoc bodies) and it never touches inline comments.
- **`context` silently drops the middle.** Head + tail plus a
  `... (省略 N 字符) ...` marker; no seam markers in the text itself.
- **`budget` is arithmetic,** not measurement — the 2K / 500 / 8K file sizes are
  hardcoded.
- **No stdin.** `ts count` with no argument crashes on `statSync(undefined)`,
  even though the help text implies otherwise.
- Single file. No tests, no config, no library API.

## Requirements

Node 18+. No runtime dependencies.

## License

MIT