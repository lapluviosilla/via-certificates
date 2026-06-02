// ---------------------------------------------------------------------------
// Vía Certificate — single source of truth for geometry, i18n and layout.
//
// All coordinates are in PDF points (pt) on an A4-landscape page, matching the
// original `examplecertificate.pdf` 1:1 so the live preview and the generated
// PDF are pixel-identical. The decorative frame, halftone, logo and the
// name/date/signature rules all live baked into `background.png`; this module
// only positions the variable text, the title arch and the signature image.
// ---------------------------------------------------------------------------

export const PAGE = { w: 842.25, h: 595.5 } as const;
export const CX = PAGE.w / 2; // 421.125 — horizontal centre line

// Brand ink colour used for every piece of text (sampled from the original).
export const INK = { r: 0, g: 56, b: 57 } as const;
export const INK_HEX = "#003839";

export type Lang = "es" | "en";

export const LANGUAGES: { code: Lang; label: string }[] = [
  { code: "es", label: "Español" },
  { code: "en", label: "English" },
];

// ---------------------------------------------------------------------------
// User-supplied data. Only the first four are the "core" customisable fields;
// the rest carry sensible per-language defaults but stay editable so the tool
// is reusable for other teams / signatories later.
// ---------------------------------------------------------------------------
export interface CertData {
  lang: Lang;
  name: string; // recipient
  date: string; // ISO yyyy-mm-dd
  resource: string; // e.g. "Explore"
  secondName: string; // co-signer (second signature)
  // Optional / advanced — fall back to language defaults when blank.
  firstName?: string; // first signer (default "Paul Strong")
  firstRole?: string; // first signer role line
  secondRole?: string; // co-signer org line
  signature?: string; // first signer's signature image (path under /public)
}

// Font keys map to concrete faces in both renderers.
export type FontKey = "serifBold" | "serifItalic" | "serifRegular" | "script";

interface TitleSegment {
  text: string;
  font: FontKey;
}

interface Strings {
  title: TitleSegment[];
  intro: string;
  dateLine: (d: { day: number; month: number; year: number }) => string;
  completion: (resource: string) => string;
  footer: string;
  defaults: {
    firstName: string;
    firstRole: string;
    secondName: string;
    secondRole: string;
    resource: string;
  };
}

const MONTHS: Record<Lang, string[]> = {
  es: [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ],
  en: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
};

export const STRINGS: Record<Lang, Strings> = {
  es: {
    title: [
      { text: "CERTIFICADO", font: "serifBold" },
      { text: " de ", font: "serifItalic" },
      { text: "RECONOCIMIENTO", font: "serifBold" },
    ],
    intro: "Este certificado se otorga a",
    dateLine: (d) => `El ${d.day} de ${MONTHS.es[d.month]} de ${d.year}`,
    completion: (r) => `por haber completado el estudio ${r}`,
    footer: "Alcanzando a las naciones a través de las naciones",
    defaults: {
      firstName: "Paul Strong,",
      firstRole: "Líder del equipo Vía en CDMX",
      secondName: "Movilizador/a",
      secondRole: "Iglesia Toluca",
      resource: "Explore",
    },
  },
  en: {
    title: [
      { text: "CERTIFICATE", font: "serifBold" },
      { text: " of ", font: "serifItalic" },
      { text: "RECOGNITION", font: "serifBold" },
    ],
    intro: "This certificate is awarded to",
    dateLine: (d) => `On ${MONTHS.en[d.month]} ${d.day}, ${d.year}`,
    completion: (r) => `for completing the ${r} study`,
    footer: "Reaching the nations through the nations",
    defaults: {
      firstName: "Paul Strong,",
      firstRole: "Vía Team Leader, Mexico City",
      secondName: "Mobilizer Name",
      secondRole: "Church Name",
      resource: "Explore",
    },
  },
};

// Parse an ISO date string without timezone surprises (treat as local Y-M-D).
export function parseISO(iso: string): { day: number; month: number; year: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return { year: +m[1], month: +m[2] - 1, day: +m[3] };
}

// ---------------------------------------------------------------------------
// Resolve raw user data + language defaults into the concrete strings to draw.
// ---------------------------------------------------------------------------
export interface ResolvedContent {
  title: TitleSegment[];
  intro: string;
  name: string;
  resource: string;
  dateLine: string;
  completion: string;
  footer: string;
  firstName: string;
  firstRole: string;
  secondName: string;
  secondRole: string;
}

export function resolveContent(data: CertData): ResolvedContent {
  const s = STRINGS[data.lang];
  const d = parseISO(data.date);
  const resource = data.resource.trim() || s.defaults.resource;
  return {
    title: s.title,
    intro: s.intro,
    name: data.name.trim() || "—",
    resource,
    dateLine: d ? s.dateLine(d) : "",
    completion: s.completion(resource),
    footer: s.footer,
    // First signer is always provided (team preset or custom input); use as-is
    // so a blank custom signer renders empty rather than falling back.
    firstName: (data.firstName ?? "").trim(),
    firstRole: (data.firstRole ?? "").trim(),
    secondName: data.secondName.trim() || s.defaults.secondName,
    secondRole: (data.secondRole ?? "").trim() || s.defaults.secondRole,
  };
}

// ---------------------------------------------------------------------------
// Static layout (baselines in pt, derived from the original PDF text spans).
// ---------------------------------------------------------------------------
export const LINES = {
  intro: { y: 231, size: 26.1, font: "script" as FontKey },
  name: { y: 283, size: 27.5, font: "script" as FontKey },
  date: { y: 327, size: 21.5, font: "script" as FontKey },
  completion: { y: 372, size: 22.5, font: "script" as FontKey },
  footer: { y: 518, size: 21.0, font: "script" as FontKey },
};

export const SIGN = {
  image: { x: 231.5, y: 402.0, w: 147.8, h: 48.0 },
  left: { cx: 299, nameY: 447, roleY: 462 },
  right: { cx: 546, nameY: 447, roleY: 462 },
  nameSize: 10.8,
  roleSize: 10.8,
};

// Brand logo (overlaid per language — ES/EN use different wordmarks, with
// different aspect ratios). The baked-in logo has been removed from the
// background, so this overlay is the single source for the mark. We pin a fixed
// height centred on the original logo position and derive width per language,
// so logos of any width stay vertically consistent and centred.
export const LOGO = { cx: 419, y: 80.2, h: 24.7 };

// Aspect ratios (width/height) taken from each logo's SVG viewBox.
const LOGO_ASPECT: Record<Lang, number> = {
  es: 232.18 / 72.4, // "vía"
  en: 36 / 12.8, // "via"
};

export function logoSrc(lang: Lang): string {
  return `/assets/logo-${lang}.png`;
}

export function logoBox(lang: Lang): { x: number; y: number; w: number; h: number } {
  const w = LOGO.h * LOGO_ASPECT[lang];
  return { x: LOGO.cx - w / 2, y: LOGO.y, w, h: LOGO.h };
}

// Title arch — a circular arc; text sits on top of the circle (rainbow ∩).
export const TITLE = {
  cx: CX,
  cy: 1085, // circle centre well below the page
  r: 905,
  size: 37,
  baseRotation: 0,
};

// ---------------------------------------------------------------------------
// Arch glyph placement. Given a width-measuring function (canvas measureText,
// shared by both renderers) it returns the centre point + tangent angle for
// every glyph of the title. Each glyph is placed independently centred on the
// arc, so metric differences between renderers never accumulate into drift.
// ---------------------------------------------------------------------------
export interface ArchGlyph {
  char: string;
  font: FontKey;
  x: number;
  y: number;
  angleDeg: number; // tangent angle, +ve = right side (top leans right)
}

export type MeasureFn = (char: string, font: FontKey, sizePt: number) => number;

export function layoutArch(segments: TitleSegment[], measure: MeasureFn): ArchGlyph[] {
  const { cx, cy, r, size } = TITLE;

  // Flatten into per-glyph entries with advance widths.
  const glyphs: { char: string; font: FontKey; w: number }[] = [];
  for (const seg of segments) {
    for (const char of seg.text) {
      glyphs.push({ char, font: seg.font, w: measure(char, seg.font, size) });
    }
  }
  const total = glyphs.reduce((a, g) => a + g.w, 0);

  const out: ArchGlyph[] = [];
  let cursor = 0; // distance along baseline from the left edge
  for (const g of glyphs) {
    const centre = cursor + g.w / 2; // glyph centre along the baseline
    const arcPos = centre - total / 2; // signed distance from the apex
    const phi = arcPos / r; // radians; +ve to the right
    out.push({
      char: g.char,
      font: g.font,
      x: cx + r * Math.sin(phi),
      y: cy - r * Math.cos(phi),
      angleDeg: (phi * 180) / Math.PI,
    });
    cursor += g.w;
  }
  return out;
}
