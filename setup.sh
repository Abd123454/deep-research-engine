
# ---------- Tesseract language data ----------
# eng.traineddata is required for OCR (vision/document analysis).
# It's a 5MB binary — excluded from git to keep the repo lean.
# Downloaded automatically on first setup.
if [ ! -f eng.traineddata ]; then
  echo "📥 Downloading eng.traineddata (5MB, Tesseract OCR data)..."
  curl -L -o eng.traineddata https://github.com/tesseract-ocr/tessdata/raw/main/eng.traineddata
  if [ $? -eq 0 ]; then
    echo "✅ eng.traineddata downloaded"
  else
    echo "⚠️  Failed to download eng.traineddata. OCR features will not work."
    echo "   Manual download: curl -L -o eng.traineddata https://github.com/tesseract-ocr/tessdata/raw/main/eng.traineddata"
  fi
fi
