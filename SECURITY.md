# Security Policy

AgentYield is designed for local, explicit ingestion.

## Supported versions

| Version | Support |
|---|---|
| latest `main` | security fixes |
| older tags | best effort |

## Reporting

Please use [GitHub Security Advisories](https://github.com/TTAWDTT/agentyield/security/advisories/new)
for private reports. Include reproduction steps, affected version, and whether
local data can leave the machine.

## Expected guarantees

- No telemetry.
- No model calls.
- No automatic cloud export.
- Session text can be dropped before storage via `--privacy redact-text`.
- Receipt verification must fail when stored receipts are modified.
