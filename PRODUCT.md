# Product

## Register

product

## Platform

web

## Users

Deepak, the owner, is composer's only user today. He opens it to browse or generate cricket content — records, anecdotes, bot-generated predictions/trivia, or freeform ideas — edit the copy, preview the rendered card, and then copy-paste or export the result manually into X, Instagram, WhatsApp, or Telegram. It's a solo internal tool, not a multi-user product, though it's built in a way that could grow to teammates later.

## Product Purpose

Composer is the human-in-the-loop content-authoring surface for The Cricket Fan brand. It complements — and never replaces — the automated X prediction bot: the bot posts predictions and trivia on its own schedule, while composer is where Deepak manually assembles one-off posts (a record, a story thread, a match reaction) from four sources — the curated content bank, the bot's own generators, on-demand AI generation, or freeform writing — renders them as a themed, on-brand card, and exports or copies for manual posting. Success looks like: an idea becomes a copy-ready post in a handful of clicks, the card preview is trustworthy (no surprises on export), and using it daily feels good, not like filling out a form.

## Positioning

The fastest, most trustworthy way to turn a cricket fact or idea into a copy-ready, on-brand post.

## Brand Personality

Fast and efficient first — minimal ceremony between an idea and a finished post. Polished and premium — worth opening every day, not a rough internal tool. Playful — cricket-fan energy in the details, not sterile or corporate. Reference pulled for inspiration: typetheme's "Social Media Manager's Kit" (Dribbble) — its editorial confidence (bold condensed type, one decisive accent color against near-black, color-coded content tiles, ring/donut stats instead of plain numbers) is the quality bar, not its literal red palette.

## Anti-references

None specified as a strong objection. The existing composer screens (plain HTML selects/inputs, no visual hierarchy, generic panel layout) are the de facto starting point to move past, but nothing was named as a thing to explicitly avoid.

## Design Principles

- **Speed over ceremony.** Every screen minimizes the distance between an idea and copy-ready output — fewer clicks, less chrome, no unnecessary confirmation steps.
- **The preview is the contract.** What the card preview shows must be exactly what gets exported or copied — no surprises between screen and clipboard.
- **Complement, don't duplicate.** Composer stays human-in-the-loop by design; it never posts on its own, and that boundary should read clearly in the UI (no "publish" language, no automation framing).
- **One brand, many surfaces.** Composer extends the cricket-fan identity already established elsewhere in the app (dark stadium theme, team-blue/team-yellow, Oswald display type) rather than inventing a separate design system.
- **Fail honestly.** Empty and error states always say why (bank not seeded, key missing, API unreachable) instead of failing silently or showing a generic message.

## Accessibility & Inclusion

Standard best practice: solid text contrast, keyboard-operable controls, `prefers-reduced-motion` respected throughout. No formal WCAG level or specific accommodation was requested.
