# inkmote Agent Skill

An Agent Skill (on-ramp) that teaches Claude Code and compatible coding agents to
generate self-contained HTML presentation decks with inkmote's ink sand-painting
particle style.

## What it does

When installed, agents can generate single-file HTML decks featuring:
- Warm-white `#f4f3ee` background with ink-dark `#1e2124` round-stipple particles
- Particle "moments" on cover, section titles, key stats, and image slides
- Zero network or build dependency at deck-generation time (IIFE inlined)

## Install

### Option A — Claude Code plugin marketplace (recommended)

```
/plugin marketplace add https://github.com/<owner>/inkmote
/plugin install inkmote
```

> Note: `https://github.com/<owner>/inkmote` is a placeholder — replace with the
> published repo URL once the package is public.

### Option B — Manual clone

```bash
git clone https://github.com/<owner>/inkmote ~/.claude/skills/inkmote
```

Claude Code picks up any folder under `~/.claude/skills/` as an installed skill.

### Option C — Point any agent at the repo directly

Pass the agent the URL to this `SKILL.md`:

```
https://github.com/<owner>/inkmote/blob/main/skill/SKILL.md
```

The agent reads the skill description and body, then inlines
`skill/assets/inkmote.global.js` into the generated deck.

## Usage

After install, trigger the skill in Claude Code:

```
/inkmote  Generate a 5-slide deck about our Q3 results
```

Or reference it in a prompt:

```
Use the inkmote skill to build a presentation about climate data.
Include a stat slide for "2.7°C" and an image slide.
```

## Files

```
skill/
├── SKILL.md                      # Skill definition (frontmatter + agent instructions)
├── README.md                     # This file
├── assets/
│   └── inkmote.global.js         # Bundled IIFE — inlined into every generated deck
└── reference/
    └── deck-template.html        # Minimal 4-slide starting template
```

## Development

To rebuild the bundled IIFE after library changes:

```bash
npm run build
cp dist/index.global.js skill/assets/inkmote.global.js
```
