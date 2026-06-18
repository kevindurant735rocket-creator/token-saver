# token-saver 💰

LLM token 省流器。估算、压缩、去重、预算管理。

## 安装

```bash
npm install -g .
```

## 用法

```bash
# 估算一个文件的 token 数
ts count bigfile.log

# 看哪几行最占 token
ts breakdown large.txt

# 压缩到原来的一半
ts compress long.txt 0.3 compressed.txt

# 去重冗余行
ts dedup messy.log clean.log

# 只看首尾（省上下文）
ts context large.txt 4000

# 去掉注释和空行
ts strip code.py clean.py

# 预算规划
ts budget 50000
```
