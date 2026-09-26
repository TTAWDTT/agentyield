# AgentYield

![CI](https://github.com/TTAWDTT/agentyield/actions/workflows/ci.yml/badge.svg)
![License](https://img.shields.io/badge/license-MIT-green)

**面向 AI coding agent 的本地优先 ROI 与证据账本。**

大多数工具止步于 token 看板。AgentYield 把“模型消耗了什么”和“Git 里真实改变了什么”
连接起来，输出可解释的收益报告和防篡改证据。

本项目由 **Codex** 独立设计、开发并持续迭代。

## 为什么做

AI coding 工具通常能告诉你：

- 用了多少 token；
- 花了多少钱。

但通常不能回答：

- 哪些 session 真的产生了提交？
- 多少消耗换来了多少代码变更？
- 哪些工作流的产出 / 1,000 output tokens 最高？
- 证据能否离线审计、导出、验证？

AgentYield 是这个缺口的本地优先答案。无遥测、无账号、无模型调用。

## 安装

```bash
npm install -g agentyield
```

或从源码运行：

```bash
npm install
npm run build
node dist/src/cli.js --help
```

## 快速开始

```bash
agentyield init
agentyield discover --agent codex --days 7
agentyield ingest --agent codex --auto --days 7 --dry-run
agentyield ingest --agent codex --auto --days 7
agentyield git --days 30
agentyield report --days 30
agentyield dashboard --port 4173
```

`agentyield doctor` 只统计本机可能存在的 Claude Code / Codex session 日志文件数量，
不会读取内容。

## 衡量什么

AgentYield 输出保守、可追溯的指标：

- **输入 / 输出 / 缓存 token** 跨适配器归一化；
- **供应商声明成本**：有就记录，没有就不猜价格；
- **本地 Git 提交与文件 churn**；
- **Session 到 Commit 的归因**，并明确标注置信度；
- **Yield ratio**：每 1,000 output tokens 产生的提交数；
- **零提交消耗面**：有成本或 token 但没有关联提交的 session；
- **哈希链 receipts**：可离线验证的证据快照。

AgentYield 不会因为 token 增减就断言开发者效率，报告会展示计算依据。

## Receipts

```bash
agentyield receipt --commit 1234567 --session-id <id>
agentyield verify
```

Receipt 存储在 `.agentyield/receipts.jsonl`。每条 receipt 包含前一条 hash 和自身
canonical SHA-256 hash，因此静默篡改可被发现。

## 适配器

第一版使用一个很小的归一化事件模型：

```json
{"type":"turn","ts":"2026-09-26T10:00:00Z","session_id":"s1","agent":"codex","model":"example","usage":{"input_tokens":1200,"output_tokens":480}}
```

首批适配器：

- Claude Code JSONL；
- Codex CLI response stream；
- AgentYield generic event stream。

字段映射见 [`docs/ADAPTERS.md`](docs/ADAPTERS.md)。

## 隐私模式\n\n如果团队只要度量、不要文本，可以在导入前剥离 prompt/output：\n\n```bash\nagentyield init --privacy redact-text\nagentyield ingest --agent codex --auto --days 7\n```\n\n`redact-text` 模式保留时间、模型、工具名、token、声明成本、session id 和归因证据，\n但不会保留 prompt/output 文本。\n\n## 隐私

- 数据保留在本地仓库或显式选择的项目目录；
- 无遥测、无模型调用、无远程账号；
- 报告可移除 prompt 与 output 文本；
- `doctor` 只计数候选日志文件，不读取内容。

## 商业模型

核心代码 MIT 开源。个人工作流保持开放。潜在付费扩展见
[`docs/MONETIZATION.md`](docs/MONETIZATION.md)，但本地账本和基础报告不会闭源。

## 开发

```bash
npm install
npm test
npm run build
```

CI 会在 Node 22 / 24 上运行类型检查、测试和构建。

## 状态

`v0.1.0` 是第一个公开开发里程碑：

- 本地账本；
- Claude Code、Codex、generic JSONL 导入；
- Git 归因与报告；
- 本地 dashboard；
- 哈希链 receipts；
- CI 与包元数据。

本项目正由 Codex 持续迭代。






