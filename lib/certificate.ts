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

export type Lang = "es" | "en" | "pt";

export const LANGUAGES: { code: Lang; label: string }[] = [
  { code: "es", label: "Español" },
  { code: "en", label: "English" },
  { code: "pt", label: "Português" },
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
  // Which visual design to render. Maps to a Design in lib/designs.ts (template +
  // banner + accent). Absent -> the original landscape "reconocimiento" design.
  design?: string;
  // Location line (Estudios design only, e.g. "Lima Perú,"). Falls back to the
  // language default when blank.
  location?: string;
  // Optional / advanced — fall back to language defaults when blank.
  firstName?: string; // first signer (default "Paul Strong")
  firstRole?: string; // first signer role line
  secondRole?: string; // co-signer org line
  signature?: string; // first signer's signature image (path under /public)
  secondSignature?: string; // second signer's signature image (optional)
  singleSigner?: boolean; // when true, omit the second signer (default: two)
}

// Font keys map to concrete faces in both renderers.
export type FontKey =
  | "serifBold"
  | "serifItalic"
  | "serifRegular"
  | "script"
  // Estudios template faces:
  | "sansBold" // Work Sans Bold — title + recipient name
  | "mono" // IBM Plex Mono Medium — labels, date, body, signer
  | "monoItalic"; // IBM Plex Mono Medium Italic — the verse

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
  pt: [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
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
  pt: {
    title: [
      { text: "CERTIFICADO", font: "serifBold" },
      { text: " de ", font: "serifItalic" },
      { text: "RECONHECIMENTO", font: "serifBold" },
    ],
    intro: "Este certificado é concedido a",
    dateLine: (d) => `Em ${d.day} de ${MONTHS.pt[d.month]} de ${d.year}`,
    completion: (r) => `por ter concluído o estudo ${r}`,
    footer: "Alcançando as nações através das nações",
    defaults: {
      firstName: "Paul Strong,",
      firstRole: "Líder da equipe Vía na Cidade do México",
      secondName: "Nome do mobilizador(a)",
      secondRole: "Nome da igreja",
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
  imageW: 147.8,
  imageH: 48.0,
  imageY: 402.0,
  nameY: 447,
  roleY: 462,
  nameSize: 10.8,
  roleSize: 10.8,
  // Signature rules are drawn by the renderer (removed from the background) so
  // they adapt to one- vs two-signer layouts. Colour/weight match the original.
  lineY: 435,
  lineWidth: 0.6,
  lineColor: { r: 127, g: 129, b: 109 },
  lineHex: "#7f816d",
  lineHalf: 102.65, // half-length of a single signature rule
};

export interface SignerSlot {
  cx: number; // centre x for the name/role text
  lineX1: number;
  lineX2: number;
  imageX?: number; // only the first signer carries a signature image
}

// First signer: centred when single, left when paired (original position).
export function firstSignerSlot(single: boolean): SignerSlot {
  if (single) {
    return { cx: CX, imageX: CX - SIGN.imageW / 2, lineX1: CX - SIGN.lineHalf, lineX2: CX + SIGN.lineHalf };
  }
  return { cx: 299, imageX: 231.5, lineX1: 197.6, lineX2: 402.9 };
}

// Second signer (only rendered when not single) — right-hand position.
export const SECOND_SIGNER_SLOT: SignerSlot = { cx: 546, lineX1: 439.1, lineX2: 644.7, imageX: 546 - SIGN.imageW / 2 };

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
  pt: 36 / 12.8, // "via" (no accent in Portuguese — same wordmark as English)
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

// ===========================================================================
// ESTUDIOS template — "Serie del Cristiano Global" / "CERTIFICADO DE ESTUDIOS".
//
// A4 *portrait*. All variable text is live (so EN/PT render and stay
// translatable); only the top halftone banner is a per-design raster
// (public/assets/estudios-banner-*.png, cropped from the original Canva PDF).
// Coordinates in PDF points, measured 1:1 from that PDF. The outer frame and
// accent rules are drawn in each design's accent colour (see lib/designs.ts).
// ===========================================================================

export const ESTUDIOS_PAGE = { w: 595.5, h: 842.25 } as const;
export const ECX = ESTUDIOS_PAGE.w / 2; // 297.75 — portrait centre line

export const ESTUDIOS = {
  // Banner raster: full width, top of page down to where the halftone has
  // faded to cream (the logo/location/title are drawn on cream below it).
  banner: { x: 0, y: 0, w: ESTUDIOS_PAGE.w, h: 255 },
  // Outer frame: thin stroke inset ~22pt, only the top-right corner rounded.
  // The banner bakes in the top edge + corner; this draws the rest below it.
  frame: { x0: 22, y0: 22, x1: 573.5, y1: 820, radius: 77, width: 1.4 },
  // "vía" wordmark, left-aligned on the content margin.
  logo: { x: 62, y: 271, h: 38 },
  // Location + date block (mono), left-aligned on the right half.
  location: { x: 411, y1: 293, y2: 312.5, size: 13, leading: 19.5 },
  // Two-line title (Work Sans Bold caps), centred.
  title: { cx: ECX, y1: 390, y2: 433, size: 35 },
  intro: { cx: ECX, y: 494, size: 11 }, // "Se concede con orgullo a:" (mono)
  // Accent rules flank the recipient name + sit below the verse.
  ruleX0: 62,
  ruleX1: 533,
  ruleWidth: 1.2,
  nameRuleTop: 517,
  nameRuleBottom: 580,
  name: { cx: ECX, y: 562, size: 46 }, // recipient (Work Sans Bold)
  completion: { cx: ECX, y: 602, size: 12.5 }, // "Por cumplir…" (mono)
  resource: { cx: ECX, y: 618, size: 13.5 }, // bold resource name (Work Sans Bold)
  verse: { cx: ECX, y1: 642, y2: 653, size: 10, leading: 11 }, // 2 lines (mono italic)
  verseRef: { cx: ECX, y: 664, size: 10 }, // scripture reference (mono italic)
  verseRule: 677,
} as const;

// Signature block (portrait). Role sits above the name (matches the PDF).
export const ESTUDIOS_SIGN = {
  imageW: 135,
  imageH: 46,
  imageY: 702,
  lineY: 752,
  lineWidth: 0.8,
  lineColor: { r: 127, g: 129, b: 109 },
  lineHex: "#7f816d",
  roleY: 770,
  nameY: 786,
  roleSize: 11,
  nameSize: 11,
  lineHalf: 92, // single-signer rule half-length
  twoHalf: 85, // two-signer rule half-length (narrower columns)
} as const;

// First signer: centred when single, left column when paired.
export function estudiosFirstSignerSlot(single: boolean): SignerSlot {
  if (single) {
    return {
      cx: ECX,
      imageX: ECX - ESTUDIOS_SIGN.imageW / 2,
      lineX1: ECX - ESTUDIOS_SIGN.lineHalf,
      lineX2: ECX + ESTUDIOS_SIGN.lineHalf,
    };
  }
  const cx = 180;
  return {
    cx,
    imageX: cx - ESTUDIOS_SIGN.imageW / 2,
    lineX1: cx - ESTUDIOS_SIGN.twoHalf,
    lineX2: cx + ESTUDIOS_SIGN.twoHalf,
  };
}

export const ESTUDIOS_SECOND_SIGNER_SLOT: SignerSlot = {
  cx: 416,
  lineX1: 416 - ESTUDIOS_SIGN.twoHalf,
  lineX2: 416 + ESTUDIOS_SIGN.twoHalf,
  imageX: 416 - ESTUDIOS_SIGN.imageW / 2,
};

// "vía" wordmark box for the Estudios design (left-aligned, fixed height).
export function estudiosLogoBox(lang: Lang): { x: number; y: number; w: number; h: number } {
  const h = ESTUDIOS.logo.h;
  return { x: ESTUDIOS.logo.x, y: ESTUDIOS.logo.y, w: h * LOGO_ASPECT[lang], h };
}

interface EstudiosStrings {
  titleLines: [string, string];
  intro: string;
  completion: string; // the "por cumplir…" line (resource drawn separately, bold)
  verse: [string, string]; // two body lines of the scripture
  verseRef: string; // the reference line
  dateLine: (d: { day: number; month: number; year: number }) => string;
  defaults: { location: string };
}

export const ESTUDIOS_STRINGS: Record<Lang, EstudiosStrings> = {
  es: {
    titleLines: ["CERTIFICADO DE", "ESTUDIOS"],
    intro: "Se concede con orgullo a:",
    completion: "Por cumplir satisfactoriamente todos los requisitos del estudio",
    verse: [
      "Y con tu sangre nos has redimido para Dios,",
      "de todo linaje y lengua y pueblo y nación\".",
    ],
    verseRef: "Apocalipsis 5:9b",
    dateLine: (d) => `${MONTHS.es[d.month]} ${d.day}, ${d.year}`,
    defaults: { location: "Lima Perú," },
  },
  en: {
    titleLines: ["CERTIFICATE OF", "STUDIES"],
    intro: "Proudly awarded to:",
    completion: "For satisfactorily completing all the requirements of the study",
    verse: [
      "\"and with your blood you ransomed people for God",
      "from every tribe and language and people and nation.\"",
    ],
    verseRef: "Revelation 5:9b",
    dateLine: (d) => `${MONTHS.en[d.month]} ${d.day}, ${d.year}`,
    defaults: { location: "Lima, Peru," },
  },
  pt: {
    titleLines: ["CERTIFICADO DE", "ESTUDOS"],
    intro: "Concedido com orgulho a:",
    completion: "Por cumprir satisfatoriamente todos os requisitos do estudo",
    verse: [
      "\"e com o teu sangue compraste para Deus homens",
      "de toda tribo, língua, povo e nação.\"",
    ],
    verseRef: "Apocalipse 5:9b",
    dateLine: (d) => `${MONTHS.pt[d.month]} ${d.day}, ${d.year}`,
    defaults: { location: "Lima, Peru," },
  },
};

export interface ResolvedEstudios {
  titleLines: [string, string];
  intro: string;
  name: string;
  completion: string;
  resource: string;
  dateLine: string;
  verse: [string, string];
  verseRef: string;
  location: string;
  firstName: string;
  firstRole: string;
  secondName: string;
  secondRole: string;
}

// Resolve Estudios content. `resourceText` is the effective resource label,
// computed by the caller from the selected design (bound name per language, or
// the user's free-text resource for the general variant).
export function resolveEstudios(data: CertData, resourceText: string): ResolvedEstudios {
  const s = ESTUDIOS_STRINGS[data.lang];
  const d = parseISO(data.date);
  return {
    titleLines: s.titleLines,
    intro: s.intro,
    name: data.name.trim() || "—",
    completion: s.completion,
    resource: (resourceText || "").trim(),
    dateLine: d ? s.dateLine(d) : "",
    verse: s.verse,
    verseRef: s.verseRef,
    location: (data.location ?? "").trim() || s.defaults.location,
    // First signer: team preset or custom input (strip a trailing comma — the
    // name is its own line here, not followed by a role on the same line).
    firstName: (data.firstName ?? "").trim().replace(/,\s*$/, ""),
    firstRole: (data.firstRole ?? "").trim(),
    secondName: data.secondName.trim() || STRINGS[data.lang].defaults.secondName,
    secondRole: (data.secondRole ?? "").trim() || STRINGS[data.lang].defaults.secondRole,
  };
}
