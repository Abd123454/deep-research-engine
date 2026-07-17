---
name: frontend-design-skill
description: Best practices for creating HTML/React frontend artifacts
version: 1.0.0
---

# Frontend Design Skill

## When to use
- HTML pages, React components, interactive widgets
- When the user asks for a web app or UI

## Design tokens
- Background: #f0eee6 (ivory), Card: #faf9f5
- Text: #141413, Muted: #87867f
- Primary: #d97757 (clay), Border: #cccbc8
- Font: serif for content, sans for UI
- Radius: 24px cards, 8px buttons, 12px inputs
- NO box-shadows — elevation via surface tone + borders

## Rules
- Responsive (mobile-first)
- Accessible (semantic HTML, aria labels)
- No external CSS frameworks — inline styles or Tailwind classes
- Use window.storage API for persistence
- Keep artifacts self-contained (no external dependencies except CDN fonts)
