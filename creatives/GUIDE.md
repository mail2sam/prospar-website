# Prospar Creative System — Team Guide

*For any team member (including new joinees) producing Prospar creatives with Claude Code.
Read this once fully; after that, the "Quick start" is all you need per creative.*

---

## Quick start (per creative)

Open Claude Code in the project folder and say:

> Read `prototype/creatives/GUIDE.md` and `D:\ClaudeCode\Prospar\Investment-Vision-Context.md`.
> Create a new creative titled "\<your topic>" using the \<comparison | ladder | table | chart | quote> layout.
> Message: \<one sentence — what the viewer should conclude>.
> Data: \<the numbers, or point Claude to the source file>.
> Then export the PNG and show it to me.

Claude will draft the HTML in `prototype/creatives/`, export a 1080×1080 PNG into `creatives/png/`,
and show it for review. **Nothing is published until a partner approves** (see Workflow).

---

## 1. What this system is

- Every creative is a small **HTML file** in `prototype/creatives/` styled by `creative.css`
  (which shares the website's brand tokens). HTML in, LinkedIn-ready PNG out.
- Export: `powershell -ExecutionPolicy Bypass -File export-creatives.ps1` → writes `png/<name>.png`
  (1080×1080, via headless Microsoft Edge).
- Approved creatives also get an **Insight page** on the website (`insight-<name>.html`) —
  that page is the client-shareable link (WhatsApp/LinkedIn preview shows the creative).

## 2. Folder map

```
prototype/
  assets/prospar-theme.css     ← website theme (brand source of truth)
  assets/prospar-logo.svg      ← the logo (never redraw, never recolor)
  creatives/
    creative.css               ← 1080×1080 frame + creative components
    GUIDE.md                   ← this file
    export-creatives.ps1       ← PNG exporter
    <name>.html                ← one file per creative
    png/<name>.png             ← exported output
  insights.html                ← Insights hub on the website
  insight-<name>.html          ← shareable page per approved creative
```

## 3. Brand rules (non-negotiable)

| Element | Rule |
|---|---|
| Colors | Use ONLY the CSS variables in `creative.css` (navy `--pc-navy`, gold `--pc-gold`, ink/muted grays, blue `--pc-invested`, green `--pc-gains`). Red/green (`--pc-bad`/`--pc-good`) only for bad-vs-good verdicts, never decoration. |
| Logo | `../assets/prospar-logo.svg` in the navy head band, height 62px. Never stretched, recolored, or redrawn. |
| Fonts | System stack (Segoe UI) via `--pc-font`. No Google Fonts, no downloads. |
| Frame | `.cr-frame` is exactly 1080×1080. Content must fit — if it overflows, cut words, not the footer. |
| Head band | Logo + "Prospar / CONSULTING LLP" + corner tag (`Investor Education` by default). |
| Footer | ALWAYS present: source/credit line + market-risk disclaimer + "prospar." wordmark. |
| Numbers | Indian formats (₹, L, Cr). Return assumptions **≤ 12% p.a.** and labelled "assumed". |

## 4. The five layouts (pick one)

1. **Comparison** (`.cr-compare`, see `sip-continue.html`) — bad-vs-good panels + verdict strip.
   Use for: stop-vs-continue, FD-vs-SIP, property-vs-fund, save-vs-borrow.
2. **Ladder / framework** (`.cr-ladder`, see `stages-of-wealth.html`) — stacked rungs, gold top.
   Use for: stages, steps, hierarchies, product ladders.
3. **Table card** — a compact `.pc-table`-style grid inside the frame.
   Use for: product-comparison matrices, tax reckoner, horizon guides.
4. **Chart card** — one SVG chart (ask Claude to draw it with the website's chart style).
   Use for: Nifty history, monthly gain/loss counts, drawdown snapshots.
5. **Quote / concept card** — kicker + big statement + verdict.
   Use for: philosophy lines ("SIP works for you; EMI makes you work for money").

## 5. Content tiers & credit (from Investment-Vision-Context.md §5)

- **Tier A — Original**: our message, our math → publish freely once approved.
- **Tier B — Public data, our drawing**: NSE/BSE/AMFI/SEBI/RBI/IMF numbers redrawn in our style →
  footer must carry `Source: <origin>, <date range>`. Never imitate another firm's layout.
- **Tier C — Third-party creatives**: NEVER re-skin. Share only the original with clear credit,
  outside this system.

**Hard no's:** celebrity photos/portraits (implies endorsement) · screen-grabbed slides ·
another brand's watermark in frame · "assured/guaranteed returns" wording · unlabelled assumptions ·
returns above 12% in illustrations.

## 6. Workflow (supervised — no exceptions)

1. **Draft** — create/edit the HTML; export PNG; self-check with §7.
2. **Review** — show the PNG to the approving partner (Ruchika / designated reviewer)
   side-by-side with the reference material. Iterate.
3. **Approve** — reviewer says yes in writing (chat is fine).
4. **Publish** — only after approval:
   - `git add` the HTML + PNG (+ insight page) → commit → push (goes live on GitHub Pages).
   - Post the PNG on LinkedIn; circulate the insight-page link to clients.
5. Log the approval date in the commit message.

## 7. Pre-export checklist

- [ ] Fits the 1080×1080 frame — nothing cut off (open the HTML in a browser and look).
- [ ] Footer: source line + disclaimer + brand present.
- [ ] Every number checked against the source worksheet; assumptions labelled.
- [ ] Tier identified; Tier B has its `Source:` line.
- [ ] No hard-no violations (§5).
- [ ] File named in kebab-case (`inflation-eroder.html`), title tag set.
- [ ] PNG re-exported AFTER the last edit (easy to forget).

## 8. Useful prompts for Claude Code

- *"List all creatives and their approval status from git history."*
- *"Rebuild <name> with the headline changed to … and re-export."*
- *"Create the insight page for the approved creative <name>, with a WhatsApp share button and a deep link to the <tool> calculator pre-filled with <scenario>."*
- *"Refresh the data in <name> from <source file> and update the date stamp."*

## 9. Assumption defaults (house view — keep consistent)

Equity 12% · Hybrid 10% · Debt 7% · Inflation 6% · Education inflation 8–10% ·
Gold 8% · Salary step-up 10%. Change only with partner sign-off.
