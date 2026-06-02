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
  FontKey,
  SignerSlot,
  firstSignerSlot,
  SECOND_SIGNER_SLOT,
  layoutArch,
  resolveContent,
} from "./certificate";
import { FONT_FACES, makeMeasurer } from "./fonts";

// jsPDF rotates counter-clockwise for positive angles; our tangent angle is
// +ve on the right (top leans right), which is a clockwise tilt -> negate.
const ARCH_ANGLE_SIGN = -1;

const ASSET_BG = "/assets/background.png";
const ASSET_LOGO = { es: "/assets/logo-es.png", en: "/assets/logo-en.png" };

// ---- asset caches (load once) --------------------------------------------
let fontsPromise: Promise<Record<string, string>> | null = null;
let imagesPromise: Promise<{ bg: string; logoEs: string; logoEn: string }> | null = null;
// Signature images vary by team — cache each by URL.
const signaturePromises = new Map<string, Promise<string>>();

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

function loadSignature(url: string): Promise<string> {
  // Uploaded signatures arrive as ready-to-use PNG data URLs — pass through.
  if (url.startsWith("data:")) return Promise.resolve(url);
  if (!signaturePromises.has(url)) {
    signaturePromises.set(url, fetchBase64(url).then((b) => `data:image/png;base64,${b}`));
  }
  return signaturePromises.get(url)!;
}

// jsPDF font name + style for a given FontKey.
const JS_FONT: Record<FontKey, { name: string; style: string }> = {
  serifBold: { name: "PTSerifCert", style: "bold" },
  serifItalic: { name: "PTSerifCert", style: "italic" },
  serifRegular: { name: "PTSerifCert", style: "normal" },
  script: { name: "PinyonScriptCert", style: "normal" },
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

// Draw one certificate onto the current page of `doc`. Images are added with
// stable aliases so that, across a multi-page batch, each asset is embedded
// only once and every page references the same copy (keeps the file small).
function drawCertificate(
  doc: JsPDF,
  data: CertData,
  images: Images,
  signature: string | null,
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
  const drawBlock = (slot: SignerSlot, name: string, role: string, img: string | null) => {
    doc.line(slot.lineX1, SIGN.lineY, slot.lineX2, SIGN.lineY);
    if (img && slot.imageX !== undefined) {
      doc.addImage(img, "PNG", slot.imageX, SIGN.imageY, SIGN.imageW, SIGN.imageH, `sig:${data.signature}`, "FAST");
    }
    label(name, slot.cx, SIGN.nameY, SIGN.nameSize, true);
    label(role, slot.cx, SIGN.roleY, SIGN.roleSize, false);
  };

  drawBlock(firstSignerSlot(!!data.singleSigner), content.firstName, content.firstRole, signature);
  if (!data.singleSigner) {
    drawBlock(SECOND_SIGNER_SLOT, content.secondName, content.secondRole, null);
  }
}

function createDoc(): JsPDF {
  return new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: [PAGE.w, PAGE.h],
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
// pasted list of names sharing the same date/resource/signers).
export async function generateBatchPdf(datas: CertData[]): Promise<Blob> {
  if (datas.length === 0) throw new Error("No certificates to generate.");

  const [fontData, images] = await Promise.all([loadFonts(), loadImages()]);

  // Resolve each distinct signature once (a batch usually shares one signer).
  const sigUrls = Array.from(new Set(datas.map((d) => d.signature).filter(Boolean) as string[]));
  const sigPairs = await Promise.all(sigUrls.map(async (u) => [u, await loadSignature(u)] as const));
  const sigByUrl = new Map(sigPairs);

  const doc = createDoc();
  registerFonts(doc, fontData);

  const first = resolveContent(datas[0]);
  const docTitle = datas[0].lang === "es" ? "Certificados" : "Certificates";
  doc.setProperties({ title: `${docTitle} ${first.resource}`, author: "Vía" });

  const measure = makeMeasurer();
  datas.forEach((data, i) => {
    if (i > 0) doc.addPage([PAGE.w, PAGE.h], "landscape");
    const sig = data.signature ? sigByUrl.get(data.signature) ?? null : null;
    drawCertificate(doc, data, images, sig, measure);
  });

  return doc.output("blob");
}

const slugify = (s: string, fallback: string) =>
  (s.trim() || fallback).replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");

export function suggestedFilename(data: CertData): string {
  const base = data.lang === "es" ? "Certificado" : "Certificate";
  const { resource, name } = resolveContent(data);
  return `${base}-${slugify(resource, "resource")}-${slugify(name, "certificate")}.pdf`;
}

export function suggestedBatchFilename(data: CertData, count: number): string {
  const base = data.lang === "es" ? "Certificados" : "Certificates";
  const { resource } = resolveContent(data);
  return `${base}-${slugify(resource, "resource")}-${count}.pdf`;
}
