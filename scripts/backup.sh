#!/bin/bash
# Backup SQLite/Postgres + artifact storage.
# Run via cron: 0 2 * * * /path/to/scripts/backup.sh

set -euo pipefail

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups/$DATE"
mkdir -p "$BACKUP_DIR"

echo "📦 Starting backup to $BACKUP_DIR..."

# SQLite backup
if [ -f "data/research.db" ]; then
  cp data/research.db "$BACKUP_DIR/research.db"
  echo "  ✅ SQLite backed up"
fi

# Postgres backup (if configured)
if [ -n "${DATABASE_URL:-}" ]; then
  pg_dump "$DATABASE_URL" > "$BACKUP_DIR/postgres.sql" 2>/dev/null && \
    echo "  ✅ Postgres backed up" || \
    echo "  ⚠️  Postgres backup failed (DATABASE_URL set but pg_dump error)"
fi

# Artifact storage backup
if [ -d "upload" ]; then
  tar czf "$BACKUP_DIR/artifacts.tar.gz" upload/ 2>/dev/null && \
    echo "  ✅ Artifacts backed up" || \
    echo "  ⚠️  Artifacts backup failed"
fi

# Generated files
if [ -d "generated" ]; then
  tar czf "$BACKUP_DIR/generated.tar.gz" generated/ 2>/dev/null && \
    echo "  ✅ Generated files backed up" || \
    echo "  ⚠️  Generated backup failed"
fi

# Retention: keep last 30 days
find backups/ -type d -mtime +30 -exec rm -rf {} \; 2>/dev/null || true

echo "✅ Backup complete: $BACKUP_DIR"
echo "   Size: $(du -sh "$BACKUP_DIR" | cut -f1)"
