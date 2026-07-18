#!/usr/bin/env python3
"""Strip HTML tags and extract readable text from page_reader JSON output."""
import json
import re
import sys
from html import unescape

def html_to_text(html: str) -> str:
    # Remove scripts, styles, comments
    html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r'<!--.*?-->', '', html, flags=re.DOTALL)
    # Block elements → newlines
    html = re.sub(r'</(p|div|h[1-6]|li|ul|ol|pre|blockquote|table|tr|br)>', '\n', html, flags=re.IGNORECASE)
    html = re.sub(r'<br\s*/?>', '\n', html, flags=re.IGNORECASE)
    # Remove all remaining tags
    html = re.sub(r'<[^>]+>', '', html)
    # Unescape entities
    html = unescape(html)
    # Collapse whitespace
    html = re.sub(r'[ \t]+', ' ', html)
    html = re.sub(r'\n[ \t]+', '\n', html)
    html = re.sub(r'\n{3,}', '\n\n', html)
    return html.strip()

def main(path: str) -> None:
    with open(path, 'r', encoding='utf-8') as f:
        obj = json.load(f)
    data = obj.get('data', obj)
    title = data.get('title', '')
    url = data.get('url', '')
    pub = data.get('publishedTime', '')
    html = data.get('html', '')
    text = html_to_text(html)
    out_path = path.replace('.json', '.txt')
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(f"URL: {url}\nTITLE: {title}\nPUBLISHED: {pub}\n\n{text}\n")
    print(f"Wrote {out_path} ({len(text)} chars)")

if __name__ == '__main__':
    for p in sys.argv[1:]:
        try:
            main(p)
        except Exception as e:
            print(f"FAILED {p}: {e}", file=sys.stderr)
