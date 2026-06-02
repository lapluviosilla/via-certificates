import { Lang } from "./certificate";

// ---------------------------------------------------------------------------
// Team / signer presets, selected by URL.
//
//   /            -> the default team (DEFAULT_TEAM_SLUG)
//   /<slug>      -> that team's preset
//
// Each team locks the FIRST signer (name, role per language, and signature) so
// the end-user can't change it. To add a field team: copy the template below,
// drop their signature PNG in /public/assets, and reference it. New slugs are
// generated as static pages at build time (see app/[team]/page.tsx).
// ---------------------------------------------------------------------------

export interface Team {
  slug: string;
  label: string; // shown read-only in the form so the mobiliser sees who signs
  firstName: string; // first signer name (same across languages)
  firstRole: Record<Lang, string>; // role/org line, per language
  signature?: string; // path to signature PNG; omit for "no signature image"
  // When true the first signer (name, role, signature) is filled in by the end
  // user rather than locked — used at the root URL for one-off certificates.
  editable?: boolean;
}

// Open / free-form preset used at the root URL: the user types the signer name
// and role and uploads a signature from their device. Secure this URL (e.g.
// behind Cloudflare Access) since it lets anyone produce any signer.
export const CUSTOM_TEAM: Team = {
  slug: "",
  label: "Personalizado",
  firstName: "",
  firstRole: { es: "", en: "" },
  signature: undefined,
  editable: true,
};

export const TEAMS: Record<string, Team> = {
  cdmx: {
    slug: "cdmx",
    label: "Vía CDMX",
    firstName: "Pablo Strong,",
    firstRole: {
      es: "Líder del equipo Vía en CDMX",
      en: "Vía Team Leader, Mexico City",
    },
    signature: "/assets/signature.png",
  },

  // --- Template for another field team (uncomment, fill in, add signature) ---
  // toluca: {
  //   slug: "toluca",
  //   label: "Equipo Toluca",
  //   firstName: "Nombre Apellido,",
  //   firstRole: {
  //     es: "Líder del equipo en Toluca",
  //     en: "Team Leader, Toluca",
  //   },
  //   signature: "/assets/signature-toluca.png", // drop this file in /public/assets
  // },
};

export const DEFAULT_TEAM_SLUG = "cdmx";

export function getTeam(slug?: string): Team {
  return (slug ? TEAMS[slug] : undefined) ?? TEAMS[DEFAULT_TEAM_SLUG];
}
