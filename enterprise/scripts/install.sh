#!/bin/bash
# Enterprise installation script — one-command setup.
set -e

echo "=== Quaesitor Enterprise Setup ==="

# Check Docker
if ! command -v docker &> /dev/null; then
  echo "Error: Docker is required. Install from https://docs.docker.com/get-docker/"
  exit 1
fi

# Check Docker Compose
if ! docker compose version &> /dev/null; then
  echo "Error: Docker Compose is required."
  exit 1
fi

# Create .env if not exists
if [ ! -f .env.enterprise ]; then
  cp .env.enterprise.example .env.enterprise
  echo "Created .env.enterprise — edit it to set your passwords"
fi

# Start all services
echo "Starting services..."
docker compose -f docker-compose.enterprise.yml --env-file .env.enterprise up -d

# Wait for app to be ready
echo "Waiting for app to start..."
for i in $(seq 1 30); do
  if curl -s http://localhost:3000/api/health | grep -q "ok\|degraded"; then
    echo "✓ Quaesitor is running at http://localhost:3000"
    echo "✓ MinIO console at http://localhost:9001"
    echo "✓ Grafana at http://localhost:3001"
    echo "✓ Prometheus at http://localhost:9090"
    echo ""
    echo "Next: pull an Ollama model: docker exec -it quaesitor-ollama ollama pull llama3.1:8b"
    exit 0
  fi
  sleep 2
done

echo "Error: App didn't start within 60 seconds. Check logs: docker compose -f docker-compose.enterprise.yml logs"
exit 1
