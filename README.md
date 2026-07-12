# 🔬 Deep Research Engine

An open-source-style **multi-round deep research engine** that surpasses single-pass tools (Perplexity, Grok) and rivals Gemini/ChatGPT Deep Research — built with Next.js 16, TypeScript, and a triple-fallback resilient architecture.

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8) ![License](https://img.shields.io/badge/License-MIT-green)

## ✨ Features

### 🧠 Multi-Round Research Pipeline (surpasses single-pass tools)
1. **Plan** — Generates a structured research outline (title + summary + 5-9 sections) before any searching.
2. **Decompose** — Breaks the query into focused sub-questions.
3. **Round 1** — For each sub-question (in parallel): search → read → extract findings.
4. **Gap Analysis** — Reviews round-1 findings, identifies what's missing, generates follow-up questions.
5. **Round 2** — Processes gap-filling sub-questions (in parallel).
6. **Synthesize** — Writes a comprehensive long-form report following the plan outline.

### 🛡️ Triple Resilient Architecture
- **6-model NVIDIA LLM fallback chain** — if one model fails (429/500/timeout), the next is tried instantly.
- **3-engine search fallback chain** — Tavily → Z.AI → DuckDuckGo (unlimited free).
- **2-backend page reader fallback** — Z.AI page_reader → direct HTTP fetch (free, unlimited).

### 🎨 Gemini-Inspired UI
- Blue → violet → pink brand gradient.
- "Hello there" greeting with gradient text.
- Floating rounded input card with gradient send button.
- Suggestion chips, research plan card, gap analysis card, stage chips, animated progress.
- Light/dark mode, fully responsive.

### 📝 Giant Prompt Support
- Accepts up to **100,000 characters** (≈25,000 tokens) of research briefs.
- Auto-detects "Large prompt" (>4K chars) and "Mega prompt" (>15K chars).
- Adapts decomposition strategy and token budget to prompt size.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ / Bun
- An NVIDIA API key (free at https://build.nvidia.com/)
- (Optional) A Tavily API key (free at https://tavily.com/)

### Installation

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/deep-research-engine.git
cd deep-research-engine

# Install dependencies
bun install

# Configure environment
cp .env.example .env
# Edit .env and add your NVIDIA_API_KEY and TAVILY_API_KEY

# Start the dev server
bun run dev
```

Open http://localhost:3000 in your browser.

## ⚙️ Configuration

All settings live in `.env`. Key options:

| Variable | Default | Description |
|---|---|---|
| `LLM_PROVIDER` | `nvidia` | `nvidia` or `zai` (free fallback) |
| `SMART_LLM_MODELS` | 6 models | Comma-separated NVIDIA fallback chain |
| `FAST_LLM` | `meta/llama-3.1-8b-instruct` | For quick sub-question generation |
| `RETRIEVER` | `tavily` | `tavily`, `zai`, or `duckduckgo` |
| `SEARCH_DEPTH` | `advanced` | `standard` (2-3 min), `deep` (5-7 min), `advanced` (10-15 min) |
| `NUM_SUB_QUERIES` | `7` | Sub-questions to generate (advanced) |
| `MAX_LINKS_PER_QUERY` | `15` | Pages to read per sub-question |
| `NUM_GAP_QUERIES` | `3` | Round-2 gap-filling questions |
| `REPORT_MAX_TOKENS` | `6000` | Final report length cap |

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│  Next.js 16 Frontend (Gemini-inspired UI)           │
└─────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────┐
│  API Routes (/api/research/start|status|result)     │
└─────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────┐
│  Research Engine (6-stage multi-round pipeline)     │
│  Plan → Decompose → Round 1 → Gap Analysis →        │
│  Round 2 → Synthesize                               │
└─────────────────────────────────────────────────────┘
           ↓
┌─────────────────┬──────────────────┬────────────────┐
│  LLM Provider   │  Retriever       │  Page Reader   │
│  (6 NVIDIA      │  (Tavily →       │  (Z.AI →       │
│   models)       │   Z.AI → DDG)    │   Direct fetch)│
└─────────────────┴──────────────────┴────────────────┘
```

## 📊 Performance

| Depth | Pages Read | Time | Rounds |
|---|---|---|---|
| Standard | ~12 | 2-4 min | 1 |
| Deep | ~40 | 5-7 min | 2 |
| Advanced | ~105 | 10-15 min | 2 |

## 💰 Cost

**$0/month** — runs entirely on free tiers:
- NVIDIA NIM (free tier with 6 models)
- Tavily (1000 free searches/month)
- Z.AI SDK (free, unlimited)
- DuckDuckGo (free, unlimited)
- Direct page fetch (free, unlimited)

## 🛠️ Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 4 + shadcn/ui (New York)
- **LLMs:** NVIDIA NIM (6-model fallback) + Z.AI SDK
- **Search:** Tavily + Z.AI web_search + DuckDuckGo
- **Icons:** Lucide React
- **Animations:** Framer Motion

## 📄 License

MIT — free to use, modify, and distribute.

## 🙏 Acknowledgments

- UI design inspired by Gemini Deep Research.
- Multi-round research pattern inspired by GPT Researcher.
- Built with the Z.ai Code development platform.
