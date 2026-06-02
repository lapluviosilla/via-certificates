"use client";

import { useEffect, useMemo, useState } from "react";
import CertificatePreview from "@/components/CertificatePreview";
import { CertData, Lang, LANGUAGES, STRINGS } from "@/lib/certificate";
import { Team } from "@/lib/teams";
import { generateBatchPdf, generatePdf, suggestedBatchFilename, suggestedFilename } from "@/lib/pdf";

// Today's date as YYYY-MM-DD in the viewer's local time.
function todayISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

const UI = {
  es: {
    heading: "Generador de certificados",
    sub: "Crea certificados de reconocimiento listos para imprimir.",
    name: "Nombre del participante",
    date: "Fecha",
    resource: "Nombre del recurso",
    secondName: "Segundo firmante",
    secondRole: "Organización del segundo firmante",
    signers: "Firmantes",
    twoSigners: "Dos",
    oneSigner: "Uno",
    signer: "Firma de",
    firstName: "Primer firmante",
    firstRole: "Cargo / organización del primer firmante",
    signature: "Firma (imagen)",
    signatureHint: "PNG con fondo transparente recomendado.",
    signatureChoose: "Elegir imagen…",
    signatureRemove: "Quitar",
    modeOne: "Uno",
    modeMany: "Varios",
    names: "Nombres (uno por línea)",
    namesPlaceholder: "Juan Pérez\nMaría López\nPedro Gómez",
    namesHint: (n: number) => `Se generarán ${n} certificado${n === 1 ? "" : "s"} (PDF de varias páginas).`,
    previewNote: (n: number) => `Vista previa: 1 de ${n}`,
    download: "Descargar PDF",
    downloadMany: (n: number) => `Descargar ${n} certificados`,
    working: "Generando…",
    hint: "Tamaño A4 horizontal · listo para imprimir a 300 ppp.",
  },
  en: {
    heading: "Certificate generator",
    sub: "Create print-ready recognition certificates.",
    name: "Participant name",
    date: "Date",
    resource: "Resource name",
    secondName: "Second signer",
    secondRole: "Second signer organisation",
    signers: "Signers",
    twoSigners: "Two",
    oneSigner: "One",
    signer: "Signed by",
    firstName: "First signer",
    firstRole: "First signer role / organisation",
    signature: "Signature (image)",
    signatureHint: "A transparent-background PNG works best.",
    signatureChoose: "Choose image…",
    signatureRemove: "Remove",
    modeOne: "One",
    modeMany: "Multiple",
    names: "Names (one per line)",
    namesPlaceholder: "John Smith\nMary Jones\nPeter Brown",
    namesHint: (n: number) => `${n} certificate${n === 1 ? "" : "s"} will be generated (multi-page PDF).`,
    previewNote: (n: number) => `Preview: 1 of ${n}`,
    download: "Download PDF",
    downloadMany: (n: number) => `Download ${n} certificates`,
    working: "Generating…",
    hint: "A4 landscape · print-ready at 300 dpi.",
  },
} as const;

// Editable-by-user fields only; the first signer comes from the team preset.
type FormState = Pick<CertData, "lang" | "name" | "date" | "resource" | "secondName" | "secondRole">;

type Mode = "single" | "batch";

export default function CertificateApp({ team }: { team: Team }) {
  const [form, setForm] = useState<FormState>({
    lang: "es",
    name: "",
    date: "",
    resource: "Explore",
    secondName: "",
    secondRole: "",
  });
  const [mode, setMode] = useState<Mode>("single");
  const [namesText, setNamesText] = useState("");
  const [singleSigner, setSingleSigner] = useState(false); // two signers by default
  const [busy, setBusy] = useState(false);

  // Free-form first signer (root URL only — `team.editable`). The signature is
  // an uploaded image, normalised to a PNG data URL entirely in the browser.
  const editable = !!team.editable;
  const [customName, setCustomName] = useState("");
  const [customRole, setCustomRole] = useState("");
  const [customSig, setCustomSig] = useState<string | undefined>(undefined);

  const t = UI[form.lang];
  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  // Default the date to today on mount (client-side, avoids hydration mismatch).
  useEffect(() => {
    setForm((f) => (f.date ? f : { ...f, date: todayISO() }));
  }, []);

  function onSignatureFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // Downscale to keep the PDF small; re-encode as PNG to preserve alpha.
        const maxW = 800;
        const scale = Math.min(1, maxW / img.width);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        setCustomSig(canvas.toDataURL("image/png"));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  // In batch mode the only thing that varies per certificate is the name —
  // one per non-empty line.
  const batchNames = useMemo(
    () => namesText.split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
    [namesText],
  );

  // The preview shows the single name, or the first of the batch list.
  const previewName = mode === "batch" ? batchNames[0] ?? "" : form.name;

  // First signer: team preset (locked) or the free-form custom inputs.
  const baseData: CertData = useMemo(
    () => ({
      ...form,
      firstName: editable ? customName : team.firstName,
      firstRole: editable ? customRole : team.firstRole[form.lang],
      signature: editable ? customSig : team.signature,
      singleSigner,
    }),
    [form, team, editable, customName, customRole, customSig, singleSigner],
  );
  const previewData: CertData = { ...baseData, name: previewName };

  async function onDownload() {
    setBusy(true);
    try {
      let blob: Blob;
      let filename: string;
      if (mode === "batch") {
        if (batchNames.length === 0) {
          alert(form.lang === "es" ? "Agrega al menos un nombre." : "Add at least one name.");
          return;
        }
        const datas = batchNames.map((name) => ({ ...baseData, name }));
        blob = await generateBatchPdf(datas);
        filename = suggestedBatchFilename(baseData, datas.length);
      } else {
        blob = await generatePdf(previewData);
        filename = suggestedFilename(previewData);
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Could not generate the PDF. See console for details.");
    } finally {
      setBusy(false);
    }
  }

  const d = STRINGS[form.lang].defaults;
  const downloadLabel = busy
    ? t.working
    : mode === "batch" && batchNames.length > 0
      ? t.downloadMany(batchNames.length)
      : t.download;

  return (
    <main className="app">
      <section className="panel">
        <div className="brand">
          <h1>{t.heading}</h1>
        </div>
        <p className="subtitle">{t.sub}</p>

        <div className="field">
          <label>{form.lang === "es" ? "Idioma" : "Language"}</label>
          <div className="lang-row">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                aria-pressed={form.lang === l.code}
                onClick={() => set({ lang: l.code as Lang })}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>{form.lang === "es" ? "Certificados" : "Certificates"}</label>
          <div className="lang-row">
            <button type="button" aria-pressed={mode === "single"} onClick={() => setMode("single")}>
              {t.modeOne}
            </button>
            <button type="button" aria-pressed={mode === "batch"} onClick={() => setMode("batch")}>
              {t.modeMany}
            </button>
          </div>
        </div>

        {mode === "single" ? (
          <div className="field">
            <label>{t.name}</label>
            <input value={form.name} onChange={(e) => set({ name: e.target.value })} />
          </div>
        ) : (
          <div className="field">
            <label>{t.names}</label>
            <textarea
              value={namesText}
              placeholder={t.namesPlaceholder}
              onChange={(e) => setNamesText(e.target.value)}
            />
            {batchNames.length > 0 && <p className="field-hint">{t.namesHint(batchNames.length)}</p>}
          </div>
        )}

        <div className="field">
          <label>{t.date}</label>
          <input type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} />
        </div>

        <div className="field">
          <label>{t.resource}</label>
          <input value={form.resource} onChange={(e) => set({ resource: e.target.value })} />
        </div>

        <div className="field">
          <label>{t.signers}</label>
          <div className="lang-row">
            <button type="button" aria-pressed={!singleSigner} onClick={() => setSingleSigner(false)}>
              {t.twoSigners}
            </button>
            <button type="button" aria-pressed={singleSigner} onClick={() => setSingleSigner(true)}>
              {t.oneSigner}
            </button>
          </div>
        </div>

        {!singleSigner && (
          <>
            <div className="field">
              <label>{t.secondName}</label>
              <input
                value={form.secondName}
                placeholder={d.secondName}
                onChange={(e) => set({ secondName: e.target.value })}
              />
            </div>

            <div className="field">
              <label>{t.secondRole}</label>
              <input value={form.secondRole} placeholder={d.secondRole} onChange={(e) => set({ secondRole: e.target.value })} />
            </div>
          </>
        )}

        {editable ? (
          /* Root URL: first signer is filled in by the user (name, role, image). */
          <>
            <div className="field">
              <label>{t.firstName}</label>
              <input value={customName} onChange={(e) => setCustomName(e.target.value)} />
            </div>
            <div className="field">
              <label>{t.firstRole}</label>
              <input value={customRole} onChange={(e) => setCustomRole(e.target.value)} />
            </div>
            <div className="field">
              <label>{t.signature}</label>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onSignatureFile} />
              {customSig && (
                <div className="sig-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={customSig} alt="signature preview" />
                  <button type="button" onClick={() => setCustomSig(undefined)}>
                    {t.signatureRemove}
                  </button>
                </div>
              )}
              <p className="field-hint">{t.signatureHint}</p>
            </div>
          </>
        ) : (
          /* Team URL: first signer is locked by the preset. */
          <div className="signer">
            <span className="signer-label">{t.signer}</span>
            <span className="signer-value">
              {team.firstName.replace(/,\s*$/, "")} · {team.firstRole[form.lang]}
            </span>
          </div>
        )}

        <button className="btn" onClick={onDownload} disabled={busy}>
          {downloadLabel}
        </button>
      </section>

      <section className="preview-wrap">
        <div className="preview">
          <div className="preview-canvas">
            <CertificatePreview data={previewData} />
          </div>
        </div>
        <p className="hint">
          {mode === "batch" && batchNames.length > 1 ? `${t.previewNote(batchNames.length)} · ` : ""}
          {t.hint}
        </p>
      </section>
    </main>
  );
}
