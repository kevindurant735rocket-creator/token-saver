#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { resolve } from 'path';

const cmd = process.argv[2];
const args = process.argv.slice(3);

function help() {
  console.log(`
token-saver (ts) — LLM token 省流器

  分析:
     ts count <file>         估算文件/文本的 token 数
     ts breakdown <file>     按行分析 token 分布

  压缩:
     ts compress <file> [ratio]  压缩文本 (默认保留50%)
     ts dedup <file>             去重冗余行

  上下文:
     ts context <file> [max] 截取上下文窗口 (默认4000 token)
     ts head <file> <lines>  只看前N行
     ts tail <file> <lines>  只看后N行
     ts strip <file>         去除注释/空行/日志

  预算:
     ts budget <tokens>      计算该预算能读多少文件
`);
}

// 估算 token 数 (约4字符=1 token)
function countTokens(text) {
  return Math.ceil(text.length / 4);
}

function readFile(file) {
  const p = resolve(file);
  if (!existsSync(p)) { console.error('✗ 不存在:', file); process.exit(1); }
  return readFileSync(p, 'utf-8');
}

switch (cmd) {
  case 'count': {
    const text = args[0] ? readFile(args[0]) : '';
    const t = countTokens(text);
    const size = statSync(resolve(args[0])).size;
    console.log(`📊 ${args[0] || 'stdin'}
   字符: ${text.length.toLocaleString()}
   Token: ${t.toLocaleString()} (≈${(t/1000).toFixed(1)}K)
   文件: ${(size/1024).toFixed(1)} KB
   预估成本: $${(t/1000*0.003).toFixed(4)} (GPT-4o)`);
    break;
  }

  case 'breakdown': {
    const text = readFile(args[0]);
    const lines = text.split('\n');
    const total = countTokens(text);
    console.log(`📊 ${args[0]} — 每行token分布 (共${total} token):`);
    const items = lines.map((l, i) => ({ line: i+1, tokens: countTokens(l), text: l.slice(0,60) }))
                      .sort((a,b) => b.tokens - a.tokens)
                      .slice(0, 15);
    items.forEach(({line, tokens, text}) => {
      const bar = '█'.repeat(Math.min(tokens / total * 40, 40));
      console.log(`  ${line.toString().padStart(4)} │${bar} ${tokens}t │ ${text}`);
    });
    break;
  }

  case 'compress': {
    const text = readFile(args[0]);
    const ratio = parseFloat(args[1]) || 0.5;
    const lines = text.split('\n');
    // 保留: 非空首行 + 随机采样剩余行
    const keep = Math.max(Math.floor(lines.length * ratio), 10);
    const nonEmpty = lines.map((l, i) => ({l, i, e: l.trim().length}))
                          .filter(x => x.e > 0);
    // 保留最长的行 (有内容) + 随机
    const sorted = nonEmpty.sort((a,b) => b.e - a.e).slice(0, keep);
    const result = sorted.sort((a,b) => a.i - b.i).map(x => x.l).join('\n');
    const saved = countTokens(text) - countTokens(result);
    console.log(`📦 压缩: ${lines.length}行 → ${result.split('\n').length}行 (省 ${saved} token)`);
    if (args[2]) writeFileSync(resolve(args[2]), result);
    else console.log('\n' + result);
    break;
  }

  case 'dedup': {
    const text = readFile(args[0]);
    const lines = text.split('\n');
    const seen = new Set();
    const deduped = lines.filter(l => { const k = l.trim(); if (seen.has(k) || !k) return false; seen.add(k); return true; });
    const saved = countTokens(text) - countTokens(deduped.join('\n'));
    console.log(`🔁 去重: ${lines.length}行 → ${deduped.length}行 (省 ${saved} token)`);
    if (args[1]) writeFileSync(resolve(args[1]), deduped.join('\n'));
    else console.log(deduped.join('\n'));
    break;
  }

  case 'context': {
    const text = readFile(args[0]);
    const maxTokens = parseInt(args[1]) || 4000;
    const lines = text.split('\n');
    // 保留首部 + 尾部, 丢弃中间
    const targetChars = maxTokens * 4;
    if (text.length <= targetChars) { console.log(text); break; }
    const headChars = Math.floor(targetChars * 0.4);
    const tailChars = targetChars - headChars;
    let head = '', tail = '', chars = 0;
    for (const l of lines) { if (chars + l.length + 1 > headChars) break; head += l + '\n'; chars += l.length + 1; }
    chars = 0;
    for (let i = lines.length-1; i >= 0; i--) { if (chars + lines[i].length + 1 > tailChars) break; tail = lines[i] + '\n' + tail; chars += lines[i].length + 1; }
    console.log(`📐 上下文窗口 ${maxTokens}t:\n`);
    console.log(head);
    console.log(`... (省略 ${text.length - chars} 字符) ...\n`);
    console.log(tail);
    break;
  }

  case 'head': {
    const text = readFile(args[0]);
    const n = parseInt(args[1]) || 20;
    console.log(text.split('\n').slice(0, n).join('\n'));
    break;
  }

  case 'tail': {
    const text = readFile(args[0]);
    const n = parseInt(args[1]) || 20;
    console.log(text.split('\n').slice(-n).join('\n'));
    break;
  }

  case 'strip': {
    const text = readFile(args[0]);
    const result = text.split('\n')
      .filter(l => {
        const t = l.trim();
        return t && !t.startsWith('#') && !t.startsWith('//') && !t.startsWith('/*') && !t.startsWith('*');
      }).join('\n');
    const saved = countTokens(text) - countTokens(result);
    console.log(`✂️ 剥离: 省 ${saved} token (${((saved/countTokens(text))*100).toFixed(0)}%)`);
    if (args[1]) writeFileSync(resolve(args[1]), result);
    else console.log('\n' + result);
    break;
  }

  case 'budget': {
    const budget = parseInt(args[0]) || 10000;
    const perFile = budget * 4; // chars
    console.log(`💰 预算: ${budget} token`);
    console.log(`   可读约 ${Math.floor(budget / 2000)} 个中小文件 (每个~2K token)`);
    console.log(`   或 ${Math.floor(budget / 500)} 个短文件 (每个~500 token)`);
    console.log(`   或 ${Math.floor(budget / 8000)} 个大文件 (每个~8K token)`);
    break;
  }

  default: help();
}
