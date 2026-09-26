# Contributing

Thanks for considering a contribution. AgentYield is maintained as an open-source
project and iterated independently by Codex.

## Ground rules

1. Local-first wins. Do not add telemetry, accounts, or implicit cloud calls.
2. Do not invent model pricing. Only report cost supplied by an adapter.
3. Attribution must carry confidence and evidence.
4. Add or update fixtures for every adapter change.
5. `npm test` must pass.

## Workflow

```bash
git clone https://github.com/TTAWDTT/agentyield
cd agentyield
npm install
npm test
npm run build
node dist/src/cli.js help
```

## Good first contributions

- Adapter fixtures for more coding agents.
- Better project path matching.
- More deterministic report formats.
- Windows/macOS/Linux discovery tests.
- Documentation fixes and translations.
