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
} from "@/lib/certificate";
import { FAMILY_SCRIPT, FAMILY_SERIF, makeMeasurer, ensureFontsLoaded } from "@/lib/fonts";

const ASSET_BG = "/assets/background.png";

const fontProps: Record<string, { family: string; weight?: number; style?: string }> = {
  serifBold: { family: FAMILY_SERIF, weight: 700 },
  serifItalic: { family: FAMILY_SERIF, weight: 400, style: "italic" },
  serifRegular: { family: FAMILY_SERIF, weight: 400 },
  script: { family: FAMILY_SCRIPT, weight: 400 },
};

function ScriptLine({ y, size, text }: { y: number; size: number; text: string }) {
  return (
    <text
      x={CX}
      y={y}
      fontFamily={FAMILY_SCRIPT}
      fontSize={size}
      fill={INK_HEX}
      textAnchor="middle"
    >
      {text}
    </text>
  );
}

export default function CertificatePreview({ data }: { data: CertData }) {
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
              {g.char === " " ? " " : g.char}
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

      {/* Signature image (first signer, from the team preset) */}
      {data.signature && (
        <image
          href={data.signature}
          x={SIGN.image.x}
          y={SIGN.image.y}
          width={SIGN.image.w}
          height={SIGN.image.h}
          preserveAspectRatio="xMidYMid meet"
        />
      )}

      {/* Signature labels */}
      <text x={SIGN.left.cx} y={SIGN.left.nameY} fontFamily={FAMILY_SERIF} fontWeight={700} fontSize={SIGN.nameSize} fill={INK_HEX} textAnchor="middle">
        {content.firstName}
      </text>
      <text x={SIGN.left.cx} y={SIGN.left.roleY} fontFamily={FAMILY_SERIF} fontWeight={400} fontSize={SIGN.roleSize} fill={INK_HEX} textAnchor="middle">
        {content.firstRole}
      </text>
      <text x={SIGN.right.cx} y={SIGN.right.nameY} fontFamily={FAMILY_SERIF} fontWeight={700} fontSize={SIGN.nameSize} fill={INK_HEX} textAnchor="middle">
        {content.secondName}
      </text>
      <text x={SIGN.right.cx} y={SIGN.right.roleY} fontFamily={FAMILY_SERIF} fontWeight={400} fontSize={SIGN.roleSize} fill={INK_HEX} textAnchor="middle">
        {content.secondRole}
      </text>
    </svg>
  );
}
