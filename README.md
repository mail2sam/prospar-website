# Prospar Financial Tools — Prototype

**Live site: https://mail2sam.github.io/prospar-website/**

Complete prototype of the calculator section for the Prospar Consulting website.
**18 interactive tools + landing page**, zero dependencies — plain HTML/CSS/JS,
portable into any site framework later.

## Run locally

```bash
python -m http.server 8787 --directory .
```

Open http://localhost:8787 (opening files directly also works).

## Test the engine

```bash
node assets/finance-engine.js --test
```

35 self-tests cross-checked against standard published calculator values.

## Shared foundation (edit once, every tool inherits)

| File | Role |
|---|---|
| `assets/prospar-theme.css` | Brand tokens (navy `#14304d`, gold `#c9a227`), cards, sliders, chips, stats, charts, tables, responsive + print rules. **Rebrand here.** |
| `assets/finance-engine.js` | All financial math, one convention everywhere (monthly compounding, annuity-due instalments, annual step-up). FV/SIP/step-up, EMI + amortization + prepayment, retirement corpus (growing annuity), depletion, SWP + max-safe-withdrawal solver, NPS, FIRE, CAGR, compounding frequencies. |
| `assets/prospar-ui.js` | Input bindings (slider+number pairs, chips, toggles), stat cards, SVG charts (area / stacked-bar / donut) with hover tooltips, tables, CSV export, share links, print, URL state. |

Chart colors are color-blind-safe (validated): blue `#2f6bb3`, green `#0e9d6e`,
purple `#7c58c9`, orange `#d97706`, rose `#c2417e`; gold reserved for goal/reference
lines; red/green status only for verdicts.

## The 18 tools

**Invest & Grow** — `sip-calculator` (invest + goal modes, step-up, inflation toggle),
`lumpsum-calculator`, `stepup-sip-calculator` (flat-vs-step-up comparison band),
`compound-interest-calculator` (any frequency + effective annual yield),
`cagr-calculator` (benchmark context, negative-CAGR handling).

**Life Goals** — `goal-sip-calculator` (inflation-aware, preset chips),
`child-education-calculator` (course presets, cost-of-delay nudge),
`child-marriage-calculator` (budget presets, optional gold sub-goal),
`dream-home-calculator` (down-payment mode, EMI preview, affordability),
`vehicle-planner` (save-vs-finance comparison).

**Loans** — `home-loan-emi-calculator` (amortization bars + prepayment savings),
`vehicle-loan-emi-calculator` (true cost of the vehicle).

**Retirement & Freedom** — `retirement-calculator` (accumulation + depletion mountain,
runs-out marker), `after-retirement-calculator` ("lasts till age X" + safe spend),
`fire-calculator` (3 tiers, freedom ages, no lead gates), `nps-calculator`
(step-up contributions, pension in today's money), `swp-calculator`
(max-safe-withdrawal finder), `net-worth-calculator` (balance sheet, composition
donut, localStorage save, deliberately **no** URL share for privacy).

## Patterns every tool follows

Live recalculation (no Submit buttons) · sensible Indian defaults on load ·
lakh/crore formatting · assumptions stated as chips on every page ·
year-by-year table + CSV download · copy-shareable-link (state in URL) ·
print/PDF · mobile results-first layout · SEBI-appropriate disclaimer.

## Pending / next phase

- Real branding (logo, colors, fonts) — swap in `prospar-theme.css`.
- Firm's disclaimer/registration wording — currently a generic placeholder.
- "Talk to an advisor" CTA target (WhatsApp/email/form).
- Optional advanced tools: multi-bucket SWP simulator, XIRR, historical SIP backtest (needs NAV data source).
- Dark mode (CSS variable structure is ready).
