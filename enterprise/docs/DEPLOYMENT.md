# Quaesitor Enterprise — Self-Hosted Deployment

## Quick Start

```bash
cd enterprise
cp .env.enterprise.example .env.enterprise
# Edit .env.enterprise with your passwords
chmod +x scripts/install.sh
./scripts/install.sh
```

## Services

| Service | Port | Purpose |
|---|---|---|
| App | 3000 | Quaesitor web app |
| Worker | — | Background job processor |
| PostgreSQL | 5432 | Database |
| Redis | 6379 | Queue + cache |
| MinIO | 9001 | S3-compatible storage |
| Ollama | 11434 | Local LLM (privacy) |
| Prometheus | 9090 | Metrics |
| Grafana | 3001 | Dashboards |

## Air-Gapped Mode

The enterprise edition runs in air-gapped mode by default (`AIR_GAPPED=true`):
- All LLM requests go to Ollama only (no cloud calls)
- No data leaves your network
- No external API keys needed

Pull models:
```bash
docker exec -it quaesitor-ollama ollama pull llama3.1:8b
docker exec -it quaesitor-ollama ollama pull llama3.1:70b
```

## Backup

```bash
./scripts/backup.sh
```

## Restore

```bash
./scripts/restore.sh backup_2026-07-16.tar.gz
```

## Compliance

- **Audit logs**: Every action is recorded in the `audit_logs` table
- **Data residency**: All data stays on your servers
- **SSO/SAML**: Configurable via environment variables
- **No telemetry**: Sentry, PostHog are disabled in air-gapped mode
