#!/bin/bash
set -euo pipefail

echo "🚀 Quaesitor Setup"
echo "=================="

# 1. Check prerequisites
if ! command -v bun &> /dev/null && ! command -v npm &> /dev/null; then
  echo "❌ Neither bun nor npm found. Install one of them first."
  exit 1
fi

# 2. Install dependencies
echo "📦 Installing dependencies..."
if command -v bun &> /dev/null; then
  bun install
else
  npm install
fi

# 3. Copy .env.example to .env if not exists
if [ ! -f .env ]; then
  cp .env.example .env
  echo "📝 Created .env from .env.example — edit it to add your API keys"
fi

# 4. Generate Prisma client
echo "🔧 Generating Prisma client..."
bunx prisma generate 2>/dev/null || npx prisma generate

# 5. Download Tesseract OCR data
if [ ! -f eng.traineddata ]; then
  echo "📥 Downloading eng.traineddata (5MB)..."
  curl -L -o eng.traineddata https://github.com/tesseract-ocr/tessdata/raw/main/eng.traineddata
fi

# 6. Check NVIDIA_API_KEY
if grep -q "NVIDIA_API_KEY=" .env && ! grep -q "NVIDIA_API_KEY=$" .env; then
  echo "✅ NVIDIA_API_KEY is set"
else
  echo "⚠️  NVIDIA_API_KEY is not set. Get a free key at https://build.nvidia.com/"
fi

echo ""
echo "✅ Setup complete! Run: bun run dev"
