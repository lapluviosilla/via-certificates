import { Lang } from "./certificate";

// ---------------------------------------------------------------------------
// Certificate design registry.
//
// A "design" is a selectable look. It names a TEMPLATE (which renderer draws
// it) plus the variant data that template needs:
//   - reconocimiento : the original landscape "Certificado de Reconocimiento".
//   - estudios       : the portrait "Serie del Cristiano Global" certificates,
//                      each with its own banner art + accent colour. Three are
//                      bound to a specific resource; one ("general") is for any
//                      resource and takes a free-text resource name.
//
// The resource dropdown in the UI maps a chosen resource -> its design, and a
// design override lets the user pick any design directly.
// ---------------------------------------------------------------------------

export type Template = "reconocimiento" | "estudios";

export interface Design {
  id: string;
  template: Template;
  label: Record<Lang, string>; // shown in the design selector
  banner?: string; // /assets/estudios-banner-*.png (estudios only)
  frameHex?: string; // outer-frame colour (deep accent)
  ruleHex?: string; // accent-rule colour (lighter tint)
  resourceKey?: string; // binds a fixed resource name; absent => free-text resource
}

// Per-language resource names for the resource-bound Estudios designs.
export const RESOURCE_LABELS: Record<string, Record<Lang, string>> = {
  explore: { es: "Explore", en: "Explore", pt: "Explore" },
  mobilize: {
    es: "Movilizar el Cuerpo de Cristo",
    en: "Mobilizing the Body of Christ",
    pt: "Mobilizar o Corpo de Cristo",
  },
  nations: {
    es: "Recibiendo a las Naciones",
    en: "Welcoming the Nations",
    pt: "Recebendo as Nações",
  },
};

export const DESIGNS: Design[] = [
  {
    id: "estudios-explore",
    template: "estudios",
    resourceKey: "explore",
    banner: "/assets/estudios-banner-explore.png",
    frameHex: "#f15923",
    ruleHex: "#f69772",
    label: { es: "Estudios · Explore", en: "Studies · Explore", pt: "Estudos · Explore" },
  },
  {
    id: "estudios-mobilize",
    template: "estudios",
    resourceKey: "mobilize",
    banner: "/assets/estudios-banner-mobilize.png",
    frameHex: "#febf0f",
    ruleHex: "#fed666",
    label: {
      es: "Estudios · Movilizar el Cuerpo de Cristo",
      en: "Studies · Mobilizing the Body of Christ",
      pt: "Estudos · Mobilizar o Corpo de Cristo",
    },
  },
  {
    id: "estudios-nations",
    template: "estudios",
    resourceKey: "nations",
    banner: "/assets/estudios-banner-nations.png",
    frameHex: "#a16780",
    ruleHex: "#a16780",
    label: {
      es: "Estudios · Recibiendo a las Naciones",
      en: "Studies · Welcoming the Nations",
      pt: "Estudos · Recebendo as Nações",
    },
  },
  {
    id: "estudios-general",
    template: "estudios",
    banner: "/assets/estudios-banner-general.png",
    frameHex: "#003839",
    ruleHex: "#3d9a95",
    label: { es: "Estudios · General", en: "Studies · General", pt: "Estudos · Geral" },
  },
  {
    id: "reconocimiento",
    template: "reconocimiento",
    label: {
      es: "Reconocimiento (horizontal)",
      en: "Recognition (landscape)",
      pt: "Reconhecimento (horizontal)",
    },
  },
];

export const DEFAULT_DESIGN_ID = "estudios-explore";

export function getDesign(id?: string): Design {
  return DESIGNS.find((d) => d.id === id) ?? DESIGNS[0];
}

// The effective resource label for a design in a language, or undefined when the
// design takes a free-text resource (general / reconocimiento).
export function designResource(design: Design, lang: Lang): string | undefined {
  return design.resourceKey ? RESOURCE_LABELS[design.resourceKey][lang] : undefined;
}

// Options for the resource dropdown: the bound resources + "other" (free text).
// Each maps to the design the UI should select.
export const RESOURCE_OPTION_KEYS = ["explore", "mobilize", "nations", "other"] as const;
export type ResourceOptionKey = (typeof RESOURCE_OPTION_KEYS)[number];

export function designIdForResourceOption(key: ResourceOptionKey): string {
  return key === "other" ? "estudios-general" : `estudios-${key}`;
}

// Reverse: which resource-dropdown value represents the current design.
export function resourceOptionForDesign(design: Design): ResourceOptionKey {
  if (design.resourceKey && (RESOURCE_OPTION_KEYS as readonly string[]).includes(design.resourceKey)) {
    return design.resourceKey as ResourceOptionKey;
  }
  return "other";
}
