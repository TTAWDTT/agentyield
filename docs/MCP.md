# MCP server

AgentYield can expose the local ledger to MCP-compatible coding agents over
stdio.

## Start

```bash
agentyield mcp --root /path/to/project
```

For local development from source:

```bash
node dist/src/cli.js mcp --root /path/to/project
```

## Tools

| Tool | Purpose |
| --- | --- |
| `agentyield_report` | Build a local yield report. |
| `agentyield_sessions` | Return the top sessions by output tokens. |
| `agentyield_receipts` | Return hash-chained receipts for offline audit. |

## Example client configuration

```json
{
  "mcpServers": {
    "agentyield": {
      "command": "node",
      "args": ["/absolute/path/to/agentyield/dist/src/cli.js", "mcp"]
    }
  }
}
```

The MCP server never calls a model, sends telemetry, or reads files outside the
selected ledger unless a user explicitly passes a pricing file path.
