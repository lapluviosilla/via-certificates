import type { FontKey, MeasureFn } from "./certificate";

// CSS family names declared via @font-face in globals.css.
export const FAMILY_SERIF = "PTSerifCert";
export const FAMILY_SCRIPT = "PinyonScriptCert";
// Estudios template families.
export const FAMILY_SANS = "WorkSansCert"; // Work Sans Bold
export const FAMILY_MONO = "PlexMonoCert"; // IBM Plex Mono Medium (+ italic)

// Concrete font files (served from /public/fonts) + how to address each face.
export interface FontFace {
  key: FontKey;
  url: string;
  family: string;
  weight: number;
  style: "normal" | "italic";
  // jsPDF registration handles below.
  jsName: string;
  jsStyle: "normal" | "bold" | "italic";
}

export const FONT_FACES: FontFace[] = [
  { key: "serifBold", url: "/fonts/PTSerif-Bold.ttf", family: FAMILY_SERIF, weight: 700, style: "normal", jsName: "PTSerifCert", jsStyle: "bold" },
  { key: "serifItalic", url: "/fonts/PTSerif-Italic.ttf", family: FAMILY_SERIF, weight: 400, style: "italic", jsName: "PTSerifCert", jsStyle: "italic" },
  { key: "serifRegular", url: "/fonts/PTSerif-Regular.ttf", family: FAMILY_SERIF, weight: 400, style: "normal", jsName: "PTSerifCert", jsStyle: "normal" },
  { key: "script", url: "/fonts/PinyonScript-Regular.ttf", family: FAMILY_SCRIPT, weight: 400, style: "normal", jsName: "PinyonScriptCert", jsStyle: "normal" },
  // Estudios faces.
  { key: "sansBold", url: "/fonts/WorkSans-Bold.ttf", family: FAMILY_SANS, weight: 700, style: "normal", jsName: "WorkSansCert", jsStyle: "bold" },
  { key: "mono", url: "/fonts/IBMPlexMono-Medium.ttf", family: FAMILY_MONO, weight: 500, style: "normal", jsName: "PlexMonoCert", jsStyle: "normal" },
  { key: "monoItalic", url: "/fonts/IBMPlexMono-MediumItalic.ttf", family: FAMILY_MONO, weight: 500, style: "italic", jsName: "PlexMonoCert", jsStyle: "italic" },
];

const FACE_BY_KEY = Object.fromEntries(FONT_FACES.map((f) => [f.key, f])) as Record<FontKey, FontFace>;

// CSS `font` shorthand for a key at a given px size — used for canvas measuring
// and could be reused for DOM rendering.
export function cssFont(key: FontKey, px: number): string {
  const f = FACE_BY_KEY[key];
  const style = f.style === "italic" ? "italic " : "";
  const weight = `${f.weight} `;
  return `${style}${weight}${px}px "${f.family}"`;
}

// A canvas-backed measurer shared by the SVG preview and the PDF generator so
// the arched title is laid out identically in both.
export function makeMeasurer(): MeasureFn {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  return (char, font, sizePt) => {
    ctx.font = cssFont(font, sizePt);
    return ctx.measureText(char).width;
  };
}

// Ensure all faces are loaded into document.fonts before measuring/rendering.
export async function ensureFontsLoaded(): Promise<void> {
  await Promise.all(
    FONT_FACES.map((f) => {
      const style = f.style === "italic" ? "italic " : "";
      return document.fonts.load(`${style}${f.weight} 40px "${f.family}"`);
    }),
  );
  await document.fonts.ready;
}
