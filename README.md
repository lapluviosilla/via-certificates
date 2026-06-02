# Vía Certificate Generator

A static, client-side tool that produces **print-ready A4 PDF certificates** that
faithfully reproduce `examplecertificate.pdf`. Built with Next.js (static export)
so it can be hosted directly on **Cloudflare Pages** and later dropped into a
larger Next.js app with minimal changes.

Everything runs in the browser — there is no backend. The PDF is generated
client-side with [jsPDF](https://github.com/parallax/jsPDF), with the real fonts
embedded, so output is crisp vector text on a 300 dpi decorative background.

The PDF is **permission-locked**: it opens with no password prompt, allows
printing and text copying, but disallows editing and annotations (enforced with
a random owner password set in [`lib/pdf.ts`](lib/pdf.ts)). These flags are a
casual-tamper deterrent, not strong security — they can be stripped by
determined tools. For true tamper-evidence you'd need a cryptographic digital
signature. To change what's allowed, edit `userPermissions`
(`'print' | 'copy' | 'modify' | 'annot-forms'`) in `lib/pdf.ts`.

## Customisable fields

| Field | Notes |
| --- | --- |
| **Participant name** | The recipient (script font, centred on the rule). |
| **Date** | Date picker; formatted per language (`El 14 de Noviembre de 2025` / `On November 14, 2025`). |
| **Resource name** | e.g. `Explore` — flows into the completion sentence. |
| **Second signer** | The co-signer on the right-hand signature. |

Under **Advanced options** you can also override the first signer, the first
signer's role, and the second signer's organisation. Blank fields fall back to
the per-language defaults.

## Single or batch

Toggle **One / Multiple** in the form. In *Multiple* mode you paste a list of
participant names (one per line) and get a single **multi-page PDF** — one
certificate per name. Everything else (date, resource, both signers) is shared
across the batch; only the participant name changes. The shared assets
(background, logo, signature) are embedded once and referenced by every page, so
a 30-name batch is barely larger than a single certificate.

## Teams / signers per URL

The **first signer** (name, role, and signature) is fixed per URL so the end
user can't change it — handy when several field teams share the tool:

| URL | First signer |
| --- | --- |
| `/` | Default team (`DEFAULT_TEAM_SLUG`) |
| `/<slug>` | That team's preset |

Teams are defined in [`lib/teams.ts`](lib/teams.ts). To add a field team: copy
the commented template, fill in `firstName` + `firstRole` (per language), drop
their signature PNG in `public/assets`, point `signature` at it, and rebuild —
each slug becomes its own static page (`/<slug>/`). Unknown slugs 404.

### Root URL = free-form mode

The **root URL `/`** uses an open preset (`CUSTOM_TEAM`, `editable: true`) where
the user types the first signer's name and role and **uploads a signature image
from their device**. The image is read with `FileReader`, downscaled and
re-encoded to a PNG **entirely in the browser** (it never leaves the device),
then embedded in the PDF — so generation stays fully client-side. This is meant
for one-off certificates; since it lets anyone produce any signer, **secure the
root URL** at the hosting layer (e.g. Cloudflare Access) while partners use their
locked `/<team>` URLs.

The first-signer fields are **not** shown as editable inputs; the form displays
them read-only and the user only edits the participant, date, resource and
second signer. (This is light, presentational control — combine it with a real
access gate, e.g. Cloudflare Access in front of the Pages site, to restrict who
can open the tool at all.)

## Languages

Spanish (`es`) and English (`en`) ship today. To add another language, add an
entry to `STRINGS` and `MONTHS` in [`lib/certificate.ts`](lib/certificate.ts)
and to `LANGUAGES`, plus a `UI` block in [`app/page.tsx`](app/page.tsx). The
arched title, body lines, signature roles and footer are all language-driven, so
no layout changes are needed.

## How the original is reproduced

The decorative frame, halftone background and the name/date/signature
underlines are all **baked into a single full-page background image** extracted
from the source PDF (`public/assets/background.png`). These are language-
independent, so the renderer only overlays:

- the brand logo (`public/assets/logo-{es,en}.png`) — **per language**, since the
  Spanish (`vía`) and English (`via`) wordmarks differ. The original logo was
  baked into the background, so it has been cleanly removed (halftone inpainted)
  and is now overlaid here, pinned to a fixed height and centred so logos of any
  width line up. Source vectors live in [`brand/`](brand);
- the arched title (`CERTIFICADO de RECONOCIMIENTO`), placed glyph-by-glyph along
  a circular arc — the same layout function feeds both the live SVG preview and
  the PDF, so they are pixel-identical;
- the script body lines and signature labels;
- the handwritten signature (`public/assets/signature.png`, transparent PNG).

To change a logo, replace the SVG in `brand/` and re-rasterise to
`public/assets/logo-<lang>.png` (transparent PNG); update the aspect ratio in
`LOGO_ASPECT` in [`lib/certificate.ts`](lib/certificate.ts) to match its viewBox.

All coordinates are in PDF points on the exact A4-landscape page
(`842.25 × 595.5 pt`) of the original, defined in
[`lib/certificate.ts`](lib/certificate.ts).

### Fonts

- **Title** — PT Serif (Bold / Italic), the original's actual font (OFL).
- **Script** — the original uses *Snell Roundhand* (proprietary, Apple/Linotype).
  We substitute **Pinyon Script** (OFL), the closest free formal-roundhand match.
  To swap it, replace `public/fonts/PinyonScript-Regular.ttf` and update the
  `FAMILY_SCRIPT` references in [`lib/fonts.ts`](lib/fonts.ts) and the
  `@font-face` in [`app/globals.css`](app/globals.css).

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
```

## Build & deploy to Cloudflare Pages

```bash
npm run build    # static site emitted to ./out
```

Cloudflare Pages settings:

- **Build command:** `npm run build`
- **Build output directory:** `out`
- **Framework preset:** Next.js (Static HTML Export)

Or deploy the `out/` directory directly with `wrangler pages deploy out`.

## Securing the pages (password per endpoint)

A Cloudflare Pages **advanced-mode Worker**, [`public/_worker.js`](public/_worker.js),
gates each page with **its own password** via HTTP Basic Auth, enforced at the
edge before anything is served:

| URL | Env var (secret) |
| --- | --- |
| `/` (free-form generator) | `GATE_ROOT` |
| `/cdmx` | `GATE_CDMX` |

It lives in `public/`, so `next build` copies it to **`out/_worker.js`** — the
gate travels *inside* the output directory and runs no matter how you deploy
`out/` (wrangler, git integration, or dashboard drag-and-drop). It serves static
files through the `ASSETS` binding after the auth check.

Set the passwords in the Cloudflare dashboard → your Pages project → **Settings →
Variables and Secrets** (mark them as *Secret*, set for Production and Preview).

Behaviour:

- Visitors get the browser's login prompt; **username is ignored**, they just
  enter the password. Each URL has a distinct realm, so the root and team
  passwords are independent — the root password will not open `/cdmx`.
- A zone whose variable is **unset is not protected**, so you can roll this out
  gradually. To lock everything, set every `GATE_*`.
- Only page documents are gated; shared static assets (`/_next`, `/assets`,
  `/fonts`) stay public so they load under any zone. They contain no participant
  data, but note the signer's `signature.png` is a public asset — if you need to
  hide it too, front the whole site with **Cloudflare Access** instead.
- **Adding a team:** add a zone to `ZONES` in `public/_worker.js` and set its
  `GATE_<SLUG>` secret.

Test locally with the Pages runtime (the Worker doesn't run under `next dev`):

```bash
cp .dev.vars.example .dev.vars   # set local passwords
npm run build
npx wrangler pages dev out       # serves out/ (incl. out/_worker.js)
```

## Integrating into an existing Next.js app

The rendering logic is framework-light and self-contained:

- [`lib/certificate.ts`](lib/certificate.ts) — geometry, i18n, layout (no deps).
- [`lib/fonts.ts`](lib/fonts.ts) — font definitions + shared canvas measurer.
- [`lib/pdf.ts`](lib/pdf.ts) — `generatePdf(data) => Promise<Blob>`.
- [`components/CertificatePreview.tsx`](components/CertificatePreview.tsx) — SVG preview.

Drop these into your app, copy `public/assets` and `public/fonts`, add the
`@font-face` rules, and remove `output: "export"` from `next.config.mjs` if you
no longer need a fully static build. `generatePdf` can be called from any client
component (it needs `window`/`document`, so keep it client-side).
