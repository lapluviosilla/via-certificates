// Cloudflare Pages advanced-mode Worker — HTTP Basic Auth gate, one password
// per page. Lives in /public so `next build` copies it to /out/_worker.js, so
// the gate travels INSIDE the deployed output directory (works no matter how
// you upload `out/` — wrangler, git integration, or dashboard drag-and-drop).
//
// Each "zone" (a URL or URL subtree) is protected by its own password, read
// from an environment variable / secret set in the Cloudflare Pages dashboard:
//
//   GATE_ROOT  ->  /        (free-form one-off generator)
//   GATE_CDMX  ->  /cdmx    (Vía CDMX team)
//
// Notes:
//   • A zone whose variable is unset/empty is NOT protected (roll out gradually;
//     keeps `wrangler pages dev` usable without secrets).
//   • Page documents (HTML + App Router .txt payloads) are gated, and so is each
//     team's locked signature image (/assets/signature-<slug>.png) — it is gated
//     behind THAT team's password so it is not a public asset anyone can grab.
//     The browser already holds the password (the visitor entered it to load the
//     page), so the preview and generated PDF still fetch the signature fine.
//   • Other shared static assets (/_next, /fonts, and the rest of /assets) stay
//     public so they load under any zone's credentials — they carry no signature
//     or participant data.
//   • The username is ignored; users just enter the password.
//
// To add a team: add a zone here (gate its page paths AND its
// /assets/signature-<slug>.png) AND set its env var in the dashboard.

const ZONES = [
  {
    env: "GATE_ROOT",
    realm: "Via Certificates",
    match: (p) => p === "/" || p === "/index.txt" || p === "/index.html",
  },
  {
    env: "GATE_CDMX",
    realm: "Via Certificates - CDMX",
    // Gate the /cdmx pages AND this team's locked signature image, so the
    // signature is only served to a visitor who has the CDMX password.
    match: (p) => p === "/cdmx" || p.startsWith("/cdmx/") || p === "/assets/signature-cdmx.png",
  },
];

// Strip a trailing slash (but keep root "/").
function normalize(pathname) {
  const p = pathname.replace(/\/+$/, "");
  return p === "" ? "/" : p;
}

// Length-independent constant-time-ish compare.
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function passwordMatches(request, expected) {
  const header = request.headers.get("Authorization") || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme !== "Basic" || !encoded) return false;
  let decoded;
  try {
    decoded = atob(encoded);
  } catch {
    return false;
  }
  // "username:password" — take everything after the first ":".
  const password = decoded.slice(decoded.indexOf(":") + 1);
  return safeEqual(password, expected);
}

function unauthorized(realm) {
  return new Response("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${realm}", charset="UTF-8"`,
      "Cache-Control": "no-store",
    },
  });
}

export default {
  async fetch(request, env) {
    const path = normalize(new URL(request.url).pathname);
    const zone = ZONES.find((z) => z.match(path));

    if (zone) {
      const expected = env[zone.env];
      // Enforce only when a password is configured for this zone.
      if (expected && !passwordMatches(request, expected)) {
        return unauthorized(zone.realm);
      }
    }

    // Authorised (or not a gated page): serve the static asset from `out/`.
    return env.ASSETS.fetch(request);
  },
};
