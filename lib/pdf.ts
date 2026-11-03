import { jsPDF } from "jspdf";
import {
  CertData,
  INK,
  LINES,
  PAGE,
  SIGN,
  TITLE,
  CX,
  logoBox,
  logoSrc,
  FontKey,
  SignerSlot,
  firstSignerSlot,
  SECOND_SIGNER_SLOT,
  layoutArch,
  resolveContent,
  // Estudios template
  ESTUDIOS_PAGE,
  ESTUDIOS,
  ESTUDIOS_SIGN,
  estudiosFirstSignerSlot,
  ESTUDIOS_SECOND_SIGNER_SLOT,
  estudiosLogoBox,
  resolveEstudios,
} from "./certificate";
import { getDesign, designResource, Design } from "./designs";
import { FONT_FACES, makeMeasurer } from "./fonts";

// jsPDF rotates counter-clockwise for positive angles; our tangent angle is
// +ve on the right (top leans right), which is a clockwise tilt -> negate.
const ARCH_ANGLE_SIGN = -1;

const ASSET_BG = "/assets/background.png";
const ASSET_LOGO = { es: "/assets/logo-es.png", en: "/assets/logo-en.png" };

// Estudios text colours (sampled from the original PDF).
const EST_INK: [number, number, number] = [3, 85, 89]; // name, location, signer
const EST_SUB: [number, number, number] = [60, 155, 151]; // title, intro, completion, verse

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ---- asset caches (load once) --------------------------------------------
let fontsPromise: Promise<Record<string, string>> | null = null;
let imagesPromise: Promise<{ bg: string; logoEs: string; logoEn: string }> | null = null;
// Signature + per-design images vary by URL — cache each PNG data URL by URL.
const pngPromises = new Map<string, Promise<string>>();

function arrayBufferToBase64(buf: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function fetchBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return arrayBufferToBase64(await res.arrayBuffer());
}

function loadFonts(): Promise<Record<string, string>> {
  if (!fontsPromise) {
    fontsPromise = (async () => {
      const out: Record<string, string> = {};
      await Promise.all(
        FONT_FACES.map(async (f) => {
          out[f.url] = await fetchBase64(f.url);
        }),
      );
      return out;
    })();
  }
  return fontsPromise;
}

function loadImages() {
  if (!imagesPromise) {
    imagesPromise = (async () => {
      const png = (b: string) => `data:image/png;base64,${b}`;
      const [bg, logoEs, logoEn] = await Promise.all([
        fetchBase64(ASSET_BG),
        fetchBase64(ASSET_LOGO.es),
        fetchBase64(ASSET_LOGO.en),
      ]);
      return { bg: png(bg), logoEs: png(logoEs), logoEn: png(logoEn) };
    })();
  }
  return imagesPromise;
}

// Generic cached PNG loader (signatures, banners, per-language logos).
function loadPng(url: string): Promise<string> {
  // Uploaded images arrive as ready-to-use data URLs — pass through.
  if (url.startsWith("data:")) return Promise.resolve(url);
  if (!pngPromises.has(url)) {
    pngPromises.set(url, fetchBase64(url).then((b) => `data:image/png;base64,${b}`));
  }
  return pngPromises.get(url)!;
}

// jsPDF font name + style for a given FontKey.
const JS_FONT: Record<FontKey, { name: string; style: string }> = {
  serifBold: { name: "PTSerifCert", style: "bold" },
  serifItalic: { name: "PTSerifCert", style: "italic" },
  serifRegular: { name: "PTSerifCert", style: "normal" },
  script: { name: "PinyonScriptCert", style: "normal" },
  sansBold: { name: "WorkSansCert", style: "bold" },
  mono: { name: "PlexMonoCert", style: "normal" },
  monoItalic: { name: "PlexMonoCert", style: "italic" },
};

// Random owner password — never surfaced to the user; it only exists to enforce
// the permission flags. Without it the flags could be cleared by simply re-saving.
function randomOwnerPassword(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

type JsPDF = InstanceType<typeof jsPDF>;
type Images = Awaited<ReturnType<typeof loadImages>>;

// ---------------------------------------------------------------------------
// Reconocimiento (landscape) — original renderer, unchanged.
// ---------------------------------------------------------------------------
function drawReconocimiento(
  doc: JsPDF,
  data: CertData,
  images: Images,
  signature: string | null,
  secondSignature: string | null,
  measure: ReturnType<typeof makeMeasurer>,
) {
  const content = resolveContent(data);
  doc.setTextColor(INK.r, INK.g, INK.b);

  // Background (full bleed).
  doc.addImage(images.bg, "PNG", 0, 0, PAGE.w, PAGE.h, "bg", "FAST");

  // Brand logo (per language).
  const logo = data.lang === "en" ? images.logoEn : images.logoEs;
  const lb = logoBox(data.lang);
  doc.addImage(logo, "PNG", lb.x, lb.y, lb.w, lb.h, `logo-${data.lang}`, "FAST");

  // Arched title — same layout function the preview uses.
  const arch = layoutArch(content.title, measure);
  doc.setFontSize(TITLE.size);
  for (const g of arch) {
    if (g.char === " ") continue;
    const jf = JS_FONT[g.font];
    doc.setFont(jf.name, jf.style);
    doc.text(g.char, g.x, g.y, {
      align: "center",
      baseline: "alphabetic",
      angle: g.angleDeg * ARCH_ANGLE_SIGN,
    });
  }

  // Script body lines.
  doc.setFont("PinyonScriptCert", "normal");
  const scriptLines: [string, number, number][] = [
    [content.intro, LINES.intro.y, LINES.intro.size],
    [content.name, LINES.name.y, LINES.name.size],
    [content.dateLine, LINES.date.y, LINES.date.size],
    [content.completion, LINES.completion.y, LINES.completion.size],
    [content.footer, LINES.footer.y, LINES.footer.size],
  ];
  for (const [text, y, size] of scriptLines) {
    doc.setFontSize(size);
    doc.text(text, CX, y, { align: "center", baseline: "alphabetic" });
  }

  // Signature blocks: rule + (first only) image + name/role.
  const label = (text: string, x: number, y: number, size: number, bold: boolean) => {
    doc.setFont("PTSerifCert", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.text(text, x, y, { align: "center", baseline: "alphabetic" });
  };
  doc.setDrawColor(SIGN.lineColor.r, SIGN.lineColor.g, SIGN.lineColor.b);
  doc.setLineWidth(SIGN.lineWidth);
  const drawBlock = (slot: SignerSlot, name: string, role: string, img: string | null, alias: string) => {
    doc.line(slot.lineX1, SIGN.lineY, slot.lineX2, SIGN.lineY);
    if (img && slot.imageX !== undefined) {
      doc.addImage(img, "PNG", slot.imageX, SIGN.imageY, SIGN.imageW, SIGN.imageH, alias, "FAST");
    }
    label(name, slot.cx, SIGN.nameY, SIGN.nameSize, true);
    label(role, slot.cx, SIGN.roleY, SIGN.roleSize, false);
  };

  drawBlock(firstSignerSlot(!!data.singleSigner), content.firstName, content.firstRole, signature, `sig:${data.signature}`);
  if (!data.singleSigner) {
    drawBlock(SECOND_SIGNER_SLOT, content.secondName, content.secondRole, secondSignature, `sig2:${data.secondSignature}`);
  }
}

// ---------------------------------------------------------------------------
// Estudios (portrait) — "Serie del Cristiano Global".
// ---------------------------------------------------------------------------
function drawEstudios(
  doc: JsPDF,
  data: CertData,
  design: Design,
  banner: string | null,
  logo: string,
  signature: string | null,
  secondSignature: string | null,
) {
  const resourceText = designResource(design, data.lang) ?? data.resource;
  const c = resolveEstudios(data, resourceText);
  const frame = hexToRgb(design.frameHex ?? "#035559");
  const rule = hexToRgb(design.ruleHex ?? "#3c9b97");
  const P = ESTUDIOS_PAGE;

  // Cream surface.
  doc.setFillColor(255, 254, 247);
  doc.rect(0, 0, P.w, P.h, "F");

  // Top banner (bakes in the top frame edge + rounded corner).
  if (banner) {
    doc.addImage(banner, "PNG", ESTUDIOS.banner.x, ESTUDIOS.banner.y, ESTUDIOS.banner.w, ESTUDIOS.banner.h, `estbanner:${design.id}`, "FAST");
  }

  // Outer frame below the banner: left/right verticals + bottom edge.
  doc.setDrawColor(frame[0], frame[1], frame[2]);
  doc.setLineWidth(ESTUDIOS.frame.width);
  doc.line(ESTUDIOS.frame.x0, ESTUDIOS.banner.h, ESTUDIOS.frame.x0, ESTUDIOS.frame.y1);
  doc.line(ESTUDIOS.frame.x1, ESTUDIOS.banner.h, ESTUDIOS.frame.x1, ESTUDIOS.frame.y1);
  doc.line(ESTUDIOS.frame.x0, ESTUDIOS.frame.y1, ESTUDIOS.frame.x1, ESTUDIOS.frame.y1);

  // Logo (per language).
  const lb = estudiosLogoBox(data.lang);
  doc.addImage(logo, "PNG", lb.x, lb.y, lb.w, lb.h, `estlogo-${data.lang}`, "FAST");

  // Text helpers.
  const mono = (text: string, x: number, y: number, size: number, opts?: { align?: "center" | "left"; italic?: boolean; color?: [number, number, number] }) => {
    doc.setFont("PlexMonoCert", opts?.italic ? "italic" : "normal");
    doc.setFontSize(size);
    const col = opts?.color ?? EST_INK;
    doc.setTextColor(col[0], col[1], col[2]);
    doc.text(text, x, y, { align: opts?.align ?? "center", baseline: "alphabetic" });
  };
  const sans = (text: string, x: number, y: number, size: number, color: [number, number, number]) => {
    doc.setFont("WorkSansCert", "bold");
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(text, x, y, { align: "center", baseline: "alphabetic" });
  };
  const accentRule = (y: number) => {
    doc.setDrawColor(rule[0], rule[1], rule[2]);
    doc.setLineWidth(ESTUDIOS.ruleWidth);
    doc.line(ESTUDIOS.ruleX0, y, ESTUDIOS.ruleX1, y);
  };

  // Location + date.
  mono(c.location, ESTUDIOS.location.x, ESTUDIOS.location.y1, ESTUDIOS.location.size, { align: "left" });
  mono(c.dateLine, ESTUDIOS.location.x, ESTUDIOS.location.y2, ESTUDIOS.location.size, { align: "left" });

  // Title (two lines) — IBM Plex Mono, uppercase (matches the original).
  mono(c.titleLines[0], ESTUDIOS.title.cx, ESTUDIOS.title.y1, ESTUDIOS.title.size, { color: EST_SUB });
  mono(c.titleLines[1], ESTUDIOS.title.cx, ESTUDIOS.title.y2, ESTUDIOS.title.size, { color: EST_SUB });

  // Intro.
  mono(c.intro, ESTUDIOS.intro.cx, ESTUDIOS.intro.y, ESTUDIOS.intro.size, { color: EST_SUB });

  // Name between rules.
  accentRule(ESTUDIOS.nameRuleTop);
  sans(c.name, ESTUDIOS.name.cx, ESTUDIOS.name.y, ESTUDIOS.name.size, EST_INK);
  accentRule(ESTUDIOS.nameRuleBottom);

  // Completion + bold resource.
  mono(c.completion, ESTUDIOS.completion.cx, ESTUDIOS.completion.y, ESTUDIOS.completion.size, { color: EST_SUB });
  if (c.resource) {
    sans(`${c.resource}.`, ESTUDIOS.resource.cx, ESTUDIOS.resource.y, ESTUDIOS.resource.size, EST_SUB);
  }

  // Verse + reference, then a rule.
  mono(c.verse[0], ESTUDIOS.verse.cx, ESTUDIOS.verse.y1, ESTUDIOS.verse.size, { italic: true, color: EST_SUB });
  mono(c.verse[1], ESTUDIOS.verse.cx, ESTUDIOS.verse.y2, ESTUDIOS.verse.size, { italic: true, color: EST_SUB });
  mono(c.verseRef, ESTUDIOS.verseRef.cx, ESTUDIOS.verseRef.y, ESTUDIOS.verseRef.size, { italic: true, color: EST_SUB });
  accentRule(ESTUDIOS.verseRule);

  // Signature block(s): image + rule + role (top) + name (bottom).
  const drawSigner = (slot: SignerSlot, name: string, role: string, img: string | null, alias: string) => {
    if (img && slot.imageX !== undefined) {
      doc.addImage(img, "PNG", slot.imageX, ESTUDIOS_SIGN.imageY, ESTUDIOS_SIGN.imageW, ESTUDIOS_SIGN.imageH, alias, "FAST");
    }
    doc.setDrawColor(ESTUDIOS_SIGN.lineColor.r, ESTUDIOS_SIGN.lineColor.g, ESTUDIOS_SIGN.lineColor.b);
    doc.setLineWidth(ESTUDIOS_SIGN.lineWidth);
    doc.line(slot.lineX1, ESTUDIOS_SIGN.lineY, slot.lineX2, ESTUDIOS_SIGN.lineY);
    mono(role, slot.cx, ESTUDIOS_SIGN.roleY, ESTUDIOS_SIGN.roleSize);
    mono(name, slot.cx, ESTUDIOS_SIGN.nameY, ESTUDIOS_SIGN.nameSize);
  };
  drawSigner(estudiosFirstSignerSlot(!!data.singleSigner), c.firstName, c.firstRole, signature, `sig:${data.signature}`);
  if (!data.singleSigner) {
    drawSigner(ESTUDIOS_SECOND_SIGNER_SLOT, c.secondName, c.secondRole, secondSignature, `sig2:${data.secondSignature}`);
  }
}

function createDoc(w: number, h: number, orientation: "landscape" | "portrait"): JsPDF {
  return new jsPDF({
    orientation,
    unit: "pt",
    format: [w, h],
    // Permission lock: opens with no password prompt (empty user password) but
    // disallows modification. Printing and text copying stay allowed.
    // Note: these flags are a casual-tamper deterrent, not strong security.
    encryption: {
      userPassword: "",
      ownerPassword: randomOwnerPassword(),
      userPermissions: ["print", "copy"],
    },
  });
}

function registerFonts(doc: JsPDF, fontData: Record<string, string>) {
  for (const f of FONT_FACES) {
    const vfsName = f.url.split("/").pop()!;
    doc.addFileToVFS(vfsName, fontData[f.url]);
    doc.addFont(vfsName, f.jsName, f.jsStyle);
  }
}

// Generate a single-certificate PDF.
export async function generatePdf(data: CertData): Promise<Blob> {
  return generateBatchPdf([data]);
}

// Generate one multi-page PDF — one certificate per entry in `datas` (e.g. a
// pasted list of names sharing the same date/resource/signers/design).
export async function generateBatchPdf(datas: CertData[]): Promise<Blob> {
  if (datas.length === 0) throw new Error("No certificates to generate.");

  // A batch shares one design (chosen in the UI). Page size/orientation follow
  // the template of the first entry.
  const design = getDesign(datas[0].design);
  const estudios = design.template === "estudios";
  const pageW = estudios ? ESTUDIOS_PAGE.w : PAGE.w;
  const pageH = estudios ? ESTUDIOS_PAGE.h : PAGE.h;
  const orientation: "landscape" | "portrait" = estudios ? "portrait" : "landscape";

  const [fontData, images] = await Promise.all([loadFonts(), loadImages()]);

  // Resolve each distinct signature once (a batch usually shares its signers).
  const sigUrls = Array.from(
    new Set(datas.flatMap((d) => [d.signature, d.secondSignature]).filter(Boolean) as string[]),
  );
  const sigPairs = await Promise.all(sigUrls.map(async (u) => [u, await loadPng(u)] as const));
  const sigByUrl = new Map(sigPairs);

  // Estudios needs the design's banner and a per-language logo.
  let banner: string | null = null;
  const estLogos = new Map<string, string>();
  if (estudios) {
    if (design.banner) banner = await loadPng(design.banner);
    const langs = Array.from(new Set(datas.map((d) => d.lang)));
    await Promise.all(langs.map(async (l) => estLogos.set(l, await loadPng(logoSrc(l)))));
  }

  const doc = createDoc(pageW, pageH, orientation);
  registerFonts(doc, fontData);

  const docTitle = datas[0].lang === "es" ? "Certificados" : "Certificates";
  const resourceText = designResource(design, datas[0].lang) ?? datas[0].resource;
  doc.setProperties({ title: `${docTitle} ${resourceText}`.trim(), author: "Vía" });

  const measure = makeMeasurer();
  datas.forEach((data, i) => {
    if (i > 0) doc.addPage([pageW, pageH], orientation);
    const sig = data.signature ? sigByUrl.get(data.signature) ?? null : null;
    const sig2 = data.secondSignature ? sigByUrl.get(data.secondSignature) ?? null : null;
    if (estudios) {
      drawEstudios(doc, data, design, banner, estLogos.get(data.lang)!, sig, sig2);
    } else {
      drawReconocimiento(doc, data, images, sig, sig2, measure);
    }
  });

  return doc.output("blob");
}

const slugify = (s: string, fallback: string) =>
  (s.trim() || fallback).replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");

// Effective resource for filenames (design-bound label or free-text resource).
function resourceFor(data: CertData): string {
  const design = getDesign(data.design);
  return designResource(design, data.lang) ?? data.resource;
}

export function suggestedFilename(data: CertData): string {
  const base = data.lang === "es" ? "Certificado" : "Certificate";
  const { name } = resolveContent(data);
  return `${base}-${slugify(resourceFor(data), "resource")}-${slugify(name, "certificate")}.pdf`;
}

export function suggestedBatchFilename(data: CertData, count: number): string {
  const base = data.lang === "es" ? "Certificados" : "Certificates";
  return `${base}-${slugify(resourceFor(data), "resource")}-${count}.pdf`;
}
