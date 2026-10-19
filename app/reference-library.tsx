"use client";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { extractPdf } from "../lib/pdf";
type Ref = {
  id: string;
  filename: string;
  storage_path: string;
  label: string;
  reason: string;
  confirmed: boolean;
};
type Check = {
  id: string;
  title: string;
  kind: string;
  phrase: string;
  correction: string;
  active: boolean;
};
export default function ReferenceLibrary({
  client,
}: {
  client: SupabaseClient;
}) {
  const [refs, setRefs] = useState<Ref[]>([]),
    [checks, setChecks] = useState<Check[]>([]),
    [files, setFiles] = useState<File[]>([]),
    [label, setLabel] = useState("Approved"),
    [reason, setReason] = useState(""),
    [selected, setSelected] = useState(""),
    [title, setTitle] = useState(""),
    [kind, setKind] = useState("required_phrase"),
    [phrase, setPhrase] = useState(""),
    [correction, setCorrection] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function load() {
    const r = await client
      .from("quotation_references")
      .select("*")
      .order("created_at", { ascending: false });
    if (r.error) throw r.error;
    setRefs(r.data);
    const c = await client
      .from("reference_checks")
      .select("*")
      .order("created_at", { ascending: false });
    if (c.error) throw c.error;
    setChecks(c.data);
  }
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, []);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Operation failed.");
    } finally {
      setBusy(false);
    }
  }
  async function upload() {
    if (files.length > 50) throw Error("Upload at most 50 PDFs per batch.");
    if (label === "Rejected" && !reason.trim())
      throw Error("Rejected examples need a reason.");
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) throw Error("Sign in again.");
    const results = [];
    for (const f of files) {
      let path = "";
      try {
        await extractPdf(f);
        const id = crypto.randomUUID();
        path = `${user.id}/${id}.pdf`;
        const up = await client.storage
          .from("quotation-references")
          .upload(path, f, { contentType: "application/pdf", upsert: false });
        if (up.error) throw up.error;
        const saved = await client
          .from("quotation_references")
          .insert({
            id,
            filename: f.name,
            storage_path: path,
            label,
            reason: reason.trim(),
            created_by: user.id,
          });
        if (saved.error) {
          const clean = await client.storage
            .from("quotation-references")
            .remove([path]);
          throw Error(
            saved.error.message +
              (clean.error
                ? " File cleanup failed; administrator cleanup needed."
                : ""),
          );
        }
        results.push(`${f.name}: uploaded as draft`);
      } catch (e) {
        results.push(
          `${f.name}: ${e instanceof Error ? e.message : "Upload failed"}`,
        );
      }
    }
    setFiles([]);
    setMessage(results.join("\n"));
  }
  return (
    <section>
      <h2>Admin · Reference Library</h2>
      <p>
        Private reference PDFs. Uploads are drafts; confirming an example does
        not create rules or change review decisions. Only explicitly activated
        checks below are consulted by the reviewer.
      </p>
      <label>Batch label</label>
      <select value={label} onChange={(e) => setLabel(e.target.value)}>
        <option>Approved</option>
        <option>Rejected</option>
      </select>
      <label>Reason / context (required for rejected examples)</label>
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} />
      <label>PDFs · up to 50 per batch, 10 MB / 30 pages each</label>
      <input
        type="file"
        multiple
        accept="application/pdf,.pdf"
        disabled={busy}
        onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
      />
      <p>
        {files.length} file(s) selected. Files in a batch share the label and
        reason; separate them when reasons differ.
      </p>
      <button disabled={busy || !files.length} onClick={() => run(upload)}>
        Upload drafts
      </button>
      <button disabled={busy} onClick={() => run(load)}>
        Refresh library
      </button>
      {message && (
        <p role="status" className="notice" style={{ whiteSpace: "pre-wrap" }}>
          {message}
        </p>
      )}
      <ul>
        {refs.map((r) => (
          <li key={r.id}>
            <strong>{r.filename}</strong> · {r.label} ·{" "}
            {r.confirmed ? "Confirmed" : "Draft"}
            <p>{r.reason}</p>
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const download = await client.storage
                    .from("quotation-references")
                    .download(r.storage_path);
                  if (download.error) throw download.error;
                  const url = URL.createObjectURL(download.data);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = r.filename;
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 60000);
                })
              }
            >
              Download PDF
            </button>
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const u = await client
                    .from("quotation_references")
                    .update({ confirmed: !r.confirmed })
                    .eq("id", r.id);
                  if (u.error) throw u.error;
                  setMessage(
                    r.confirmed
                      ? "Reference withdrawn; its checks are no longer effective."
                      : "Reference confirmed. No rules activated automatically.",
                  );
                })
              }
            >
              {r.confirmed ? "Withdraw" : "Confirm reference"}
            </button>
          </li>
        ))}
      </ul>
      <h2>Explicit reference-backed text checks</h2>
      <p>
        Use only wording that applies to every quotation. Required wording not
        found triggers human review; prohibited wording found triggers
        rejection. These are literal text checks—not visual comparison, AI
        training, or semantic interpretation.
      </p>
      <label>Confirmed source reference</label>
      <select value={selected} onChange={(e) => setSelected(e.target.value)}>
        <option value="">Select reference</option>
        {refs
          .filter((r) => r.confirmed)
          .map((r) => (
            <option key={r.id} value={r.id}>
              {r.filename}
            </option>
          ))}
      </select>
      <label>Check title</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} />
      <label>Check type</label>
      <select value={kind} onChange={(e) => setKind(e.target.value)}>
        <option value="required_phrase">Required phrase</option>
        <option value="forbidden_phrase">Prohibited phrase</option>
      </select>
      <label>Exact phrase (3–500 characters)</label>
      <textarea value={phrase} onChange={(e) => setPhrase(e.target.value)} />
      <label>Reason and correction</label>
      <textarea
        value={correction}
        onChange={(e) => setCorrection(e.target.value)}
      />
      <button
        disabled={
          busy ||
          !selected ||
          !title.trim() ||
          phrase.trim().length < 3 ||
          phrase.trim().length > 500 ||
          !correction.trim()
        }
        onClick={() =>
          run(async () => {
            const {
              data: { user },
            } = await client.auth.getUser();
            if (!user) throw Error("Sign in again.");
            const r = await client
              .from("reference_checks")
              .insert({
                reference_id: selected,
                title: title.trim(),
                kind,
                phrase: phrase.trim(),
                correction: correction.trim(),
                created_by: user.id,
                active: false,
              });
            if (r.error) throw r.error;
            setMessage("Draft check saved. Review it below before activation.");
            setTitle("");
            setPhrase("");
            setCorrection("");
          })
        }
      >
        Save draft check
      </button>
      <ul>
        {checks.map((c) => (
          <li key={c.id}>
            <strong>{c.title}</strong> · {c.kind} ·{" "}
            {c.active
              ? "Enabled (effective only with confirmed source)"
              : "Draft / disabled"}
            <p>
              Phrase: {c.phrase}
              <br />
              Correction: {c.correction}
            </p>
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const r = await client
                    .from("reference_checks")
                    .update({ active: !c.active })
                    .eq("id", c.id);
                  if (r.error) throw r.error;
                  setMessage(
                    c.active
                      ? "Check disabled."
                      : "Check activated for future reviews when its source is confirmed.",
                  );
                })
              }
            >
              {c.active ? "Disable check" : "Activate check"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
