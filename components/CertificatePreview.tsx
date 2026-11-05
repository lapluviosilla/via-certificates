"use client";

import { useEffect, useState } from "react";
import {
  CertData,
  INK_HEX,
  LINES,
  PAGE,
  SIGN,
  TITLE,
  CX,
  logoBox,
  logoSrc,
  ArchGlyph,
  layoutArch,
  resolveContent,
  firstSignerSlot,
  SECOND_SIGNER_SLOT,
  // Estudios template
  ESTUDIOS_PAGE,
  ECX,
  ESTUDIOS,
  ESTUDIOS_SIGN,
  estudiosFirstSignerSlot,
  ESTUDIOS_SECOND_SIGNER_SLOT,
  estudiosLogoBox,
  resolveEstudios,
  SignerSlot,
} from "@/lib/certificate";
import { getDesign, designResource } from "@/lib/designs";
import { FAMILY_SCRIPT, FAMILY_SERIF, FAMILY_SANS, FAMILY_MONO, makeMeasurer, ensureFontsLoaded } from "@/lib/fonts";

const ASSET_BG = "/assets/background.png";

// Estudios text colours (sampled from the original PDF).
const EST_INK = "#035559"; // recipient name, location, signer — deep teal
const EST_SUB = "#3c9b97"; // title, intro, completion, resource, verse — P2 teal

const fontProps: Record<string, { family: string; weight?: number; style?: string }> = {
  serifBold: { family: FAMILY_SERIF, weight: 700 },
  serifItalic: { family: FAMILY_SERIF, weight: 400, style: "italic" },
  serifRegular: { family: FAMILY_SERIF, weight: 400 },
  script: { family: FAMILY_SCRIPT, weight: 400 },
};

export default function CertificatePreview({ data }: { data: CertData }) {
  const design = getDesign(data.design);
  if (design.template === "estudios") {
    return <EstudiosPreview data={data} design={design} />;
  }
  return <ReconocimientoPreview data={data} />;
}

// ---------------------------------------------------------------------------
// Estudios (portrait) — "Serie del Cristiano Global".
// ---------------------------------------------------------------------------
function EstudiosPreview({
  data,
  design,
}: {
  data: CertData;
  design: ReturnType<typeof getDesign>;
}) {
  const resourceText = designResource(design, data.lang) ?? data.resource;
  const c = resolveEstudios(data, resourceText);
  const frame = design.frameHex ?? EST_INK;
  const rule = design.ruleHex ?? EST_SUB;

  const Mono = ({ x, y, size, text, anchor = "middle", italic = false, fill = EST_INK }: {
    x: number; y: number; size: number; text: string; anchor?: "middle" | "start"; italic?: boolean; fill?: string;
  }) => (
    <text x={x} y={y} fontFamily={FAMILY_MONO} fontWeight={500} fontStyle={italic ? "italic" : "normal"} fontSize={size} fill={fill} textAnchor={anchor}>
      {text}
    </text>
  );
  const Sans = ({ x, y, size, text, fill }: { x: number; y: number; size: number; text: string; fill: string }) => (
    <text x={x} y={y} fontFamily={FAMILY_SANS} fontWeight={700} fontSize={size} fill={fill} textAnchor="middle">
      {text}
    </text>
  );
  const Rule = ({ y }: { y: number }) => (
    <line x1={ESTUDIOS.ruleX0} y1={y} x2={ESTUDIOS.ruleX1} y2={y} stroke={rule} strokeWidth={ESTUDIOS.ruleWidth} />
  );

  const SignerBlock = ({ slot, name, role, img }: { slot: SignerSlot; name: string; role: string; img?: string }) => (
    <g>
      {img && slot.imageX !== undefined && (
        <image href={img} x={slot.imageX} y={ESTUDIOS_SIGN.imageY} width={ESTUDIOS_SIGN.imageW} height={ESTUDIOS_SIGN.imageH} preserveAspectRatio="xMidYMid meet" style={{ pointerEvents: "none" }} />
      )}
      <line x1={slot.lineX1} y1={ESTUDIOS_SIGN.lineY} x2={slot.lineX2} y2={ESTUDIOS_SIGN.lineY} stroke={ESTUDIOS_SIGN.lineHex} strokeWidth={ESTUDIOS_SIGN.lineWidth} />
      {/* Role on top, name below (matches the PDF). */}
      <Mono x={slot.cx} y={ESTUDIOS_SIGN.roleY} size={ESTUDIOS_SIGN.roleSize} text={role} />
      <Mono x={slot.cx} y={ESTUDIOS_SIGN.nameY} size={ESTUDIOS_SIGN.nameSize} text={name} />
    </g>
  );

  const first = estudiosFirstSignerSlot(!!data.singleSigner);

  return (
    <svg
      viewBox={`0 0 ${ESTUDIOS_PAGE.w} ${ESTUDIOS_PAGE.h}`}
      width="100%"
      style={{ display: "block", height: "auto" }}
      role="img"
      aria-label="Certificate preview"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Cream page surface */}
      <rect x={0} y={0} width={ESTUDIOS_PAGE.w} height={ESTUDIOS_PAGE.h} fill="#fffef7" />

      {/* Top banner (per design): bakes in the top frame edge + rounded corner */}
      {design.banner && (
        <image href={design.banner} x={ESTUDIOS.banner.x} y={ESTUDIOS.banner.y} width={ESTUDIOS.banner.w} height={ESTUDIOS.banner.h} preserveAspectRatio="none" />
      )}

      {/* Outer frame below the banner: left + right verticals and the bottom edge */}
      <g stroke={frame} strokeWidth={ESTUDIOS.frame.width} fill="none" strokeLinecap="square">
        <line x1={ESTUDIOS.frame.x0} y1={ESTUDIOS.banner.h} x2={ESTUDIOS.frame.x0} y2={ESTUDIOS.frame.y1} />
        <line x1={ESTUDIOS.frame.x1} y1={ESTUDIOS.banner.h} x2={ESTUDIOS.frame.x1} y2={ESTUDIOS.frame.y1} />
        <line x1={ESTUDIOS.frame.x0} y1={ESTUDIOS.frame.y1} x2={ESTUDIOS.frame.x1} y2={ESTUDIOS.frame.y1} />
      </g>

      {/* Brand logo (per language) */}
      {(() => {
        const b = estudiosLogoBox(data.lang);
        return <image href={logoSrc(data.lang)} x={b.x} y={b.y} width={b.w} height={b.h} preserveAspectRatio="xMidYMid meet" />;
      })()}

      {/* Location + date (left-aligned, right half) */}
      <Mono x={ESTUDIOS.location.x} y={ESTUDIOS.location.y1} size={ESTUDIOS.location.size} text={c.location} anchor="start" />
      <Mono x={ESTUDIOS.location.x} y={ESTUDIOS.location.y2} size={ESTUDIOS.location.size} text={c.dateLine} anchor="start" />

      {/* Title (two lines) — IBM Plex Mono, uppercase (matches the original) */}
      <Mono x={ESTUDIOS.title.cx} y={ESTUDIOS.title.y1} size={ESTUDIOS.title.size} text={c.titleLines[0]} fill={EST_SUB} />
      <Mono x={ESTUDIOS.title.cx} y={ESTUDIOS.title.y2} size={ESTUDIOS.title.size} text={c.titleLines[1]} fill={EST_SUB} />

      {/* Intro */}
      <Mono x={ESTUDIOS.intro.cx} y={ESTUDIOS.intro.y} size={ESTUDIOS.intro.size} text={c.intro} fill={EST_SUB} />

      {/* Name between two accent rules */}
      <Rule y={ESTUDIOS.nameRuleTop} />
      <Sans x={ESTUDIOS.name.cx} y={ESTUDIOS.name.y} size={ESTUDIOS.name.size} text={c.name} fill={EST_INK} />
      <Rule y={ESTUDIOS.nameRuleBottom} />

      {/* Completion line + bold resource */}
      <Mono x={ESTUDIOS.completion.cx} y={ESTUDIOS.completion.y} size={ESTUDIOS.completion.size} text={c.completion} fill={EST_SUB} />
      {c.resource && (
        <Sans x={ESTUDIOS.resource.cx} y={ESTUDIOS.resource.y} size={ESTUDIOS.resource.size} text={`${c.resource}.`} fill={EST_SUB} />
      )}

      {/* Verse (two lines) + reference, then a rule */}
      <Mono x={ESTUDIOS.verse.cx} y={ESTUDIOS.verse.y1} size={ESTUDIOS.verse.size} text={c.verse[0]} italic fill={EST_SUB} />
      <Mono x={ESTUDIOS.verse.cx} y={ESTUDIOS.verse.y2} size={ESTUDIOS.verse.size} text={c.verse[1]} italic fill={EST_SUB} />
      <Mono x={ESTUDIOS.verseRef.cx} y={ESTUDIOS.verseRef.y} size={ESTUDIOS.verseRef.size} text={c.verseRef} italic fill={EST_SUB} />
      <Rule y={ESTUDIOS.verseRule} />

      {/* Signature block(s) */}
      <SignerBlock slot={first} name={c.firstName} role={c.firstRole} img={data.signature} />
      {!data.singleSigner && (
        <SignerBlock slot={ESTUDIOS_SECOND_SIGNER_SLOT} name={c.secondName} role={c.secondRole} img={data.secondSignature} />
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Reconocimiento (landscape) — the original design (unchanged).
// ---------------------------------------------------------------------------
function ScriptLine({ y, size, text }: { y: number; size: number; text: string }) {
  return (
    <text x={CX} y={y} fontFamily={FAMILY_SCRIPT} fontSize={size} fill={INK_HEX} textAnchor="middle">
      {text}
    </text>
  );
}

function ReconocimientoPreview({ data }: { data: CertData }) {
  const content = resolveContent(data);
  const [arch, setArch] = useState<ArchGlyph[]>([]);

  useEffect(() => {
    let alive = true;
    ensureFontsLoaded().then(() => {
      if (!alive) return;
      const measure = makeMeasurer();
      setArch(layoutArch(content.title, measure));
    });
    return () => {
      alive = false;
    };
    // Re-layout when the title text (i.e. language) changes.
  }, [data.lang]);

  return (
    <svg
      viewBox={`0 0 ${PAGE.w} ${PAGE.h}`}
      width="100%"
      style={{ display: "block", height: "auto" }}
      role="img"
      aria-label="Certificate preview"
      onContextMenu={(e) => e.preventDefault()}
    >
      <image href={ASSET_BG} x={0} y={0} width={PAGE.w} height={PAGE.h} preserveAspectRatio="none" />

      {/* Brand logo (per language) */}
      {(() => {
        const b = logoBox(data.lang);
        return (
          <image
            href={logoSrc(data.lang)}
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            preserveAspectRatio="xMidYMid meet"
          />
        );
      })()}

      {/* Arched title */}
      <g>
        {arch.map((g, i) => {
          const fp = fontProps[g.font];
          return (
            <text
              key={i}
              x={g.x}
              y={g.y}
              fontFamily={fp.family}
              fontWeight={fp.weight}
              fontStyle={fp.style}
              fontSize={TITLE.size}
              fill={INK_HEX}
              textAnchor="middle"
              transform={`rotate(${g.angleDeg} ${g.x} ${g.y})`}
            >
              {g.char === " " ? " " : g.char}
            </text>
          );
        })}
      </g>

      {/* Script body lines */}
      <ScriptLine y={LINES.intro.y} size={LINES.intro.size} text={content.intro} />
      <ScriptLine y={LINES.name.y} size={LINES.name.size} text={content.name} />
      <ScriptLine y={LINES.date.y} size={LINES.date.size} text={content.dateLine} />
      <ScriptLine y={LINES.completion.y} size={LINES.completion.size} text={content.completion} />
      <ScriptLine y={LINES.footer.y} size={LINES.footer.size} text={content.footer} />

      {/* Signature blocks (drawn rule + image + name/role) */}
      {(() => {
        const first = firstSignerSlot(!!data.singleSigner);
        const Block = ({ slot, name, role, img }: { slot: typeof first; name: string; role: string; img?: string }) => (
          <g>
            <line
              x1={slot.lineX1}
              y1={SIGN.lineY}
              x2={slot.lineX2}
              y2={SIGN.lineY}
              stroke={SIGN.lineHex}
              strokeWidth={SIGN.lineWidth}
            />
            {img && slot.imageX !== undefined && (
              <image href={img} x={slot.imageX} y={SIGN.imageY} width={SIGN.imageW} height={SIGN.imageH} preserveAspectRatio="xMidYMid meet" style={{ pointerEvents: "none" }} />
            )}
            <text x={slot.cx} y={SIGN.nameY} fontFamily={FAMILY_SERIF} fontWeight={700} fontSize={SIGN.nameSize} fill={INK_HEX} textAnchor="middle">
              {name}
            </text>
            <text x={slot.cx} y={SIGN.roleY} fontFamily={FAMILY_SERIF} fontWeight={400} fontSize={SIGN.roleSize} fill={INK_HEX} textAnchor="middle">
              {role}
            </text>
          </g>
        );
        return (
          <>
            <Block slot={first} name={content.firstName} role={content.firstRole} img={data.signature} />
            {!data.singleSigner && (
              <Block slot={SECOND_SIGNER_SLOT} name={content.secondName} role={content.secondRole} img={data.secondSignature} />
            )}
          </>
        );
      })()}
    </svg>
  );
}
