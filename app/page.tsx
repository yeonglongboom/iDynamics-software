"use client";
import { useEffect, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { reviewText } from "../lib/review.mjs";
type Rule = { id: number; training_months: number };
type Result = ReturnType<typeof reviewText>;
let client: SupabaseClient | undefined;
function db() {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
      key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key)
      throw Error(
        "Supabase connection is not configured. Contact your administrator.",
      );
    client = createClient(url, key);
  }
  return client;
}
export default function Home() {
  const [email, setEmail] = useState(""),
    [code, setCode] = useState(""),
    [sent, setSent] = useState(false),
    [role, setRole] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [rule, setRule] = useState<Rule>(),
    [months, setMonths] = useState(1),
    [result, setResult] = useState<Result>(),
    [invite, setInvite] = useState("");
  async function load() {
    const s = db();
    const {
      data: { user },
      error,
    } = await s.auth.getUser();
    if (error || !user) {
      setRole("");
      return;
    }
    const member = await s
      .from("members")
      .select("role")
      .eq("email", user.email?.toLowerCase())
      .single();
    if (member.error || !member.data) {
      setRole("");
      throw Error(
        "Your account is not on the team access list, or database setup is incomplete.",
      );
    }
    setRole(member.data.role);
    const r = await s
      .from("rule_versions")
      .select("*")
      .order("id", { ascending: false })
      .limit(1)
      .single();
    if (r.error) throw r.error;
    setRule(r.data);
    setMonths(r.data.training_months);
  }
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
    let unsubscribe: (() => void) | undefined;
    try {
      const { data } = db().auth.onAuthStateChange(() => {
        setTimeout(() => load().catch((e) => setMessage(e.message)), 0);
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Authentication unavailable.",
      );
    }
    return () => unsubscribe?.();
  }, []);
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Operation failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function signIn() {
    if (!sent) {
      const { error } = await db().auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      setSent(true);
      setMessage(
        "Check your email. Enter the verification code if supplied, or follow the sign-in link.",
      );
    } else {
      const { error } = await db().auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: "email",
      });
      if (error) throw error;
      await load();
    }
  }
  async function check(file: File) {
    setResult(undefined);
    if (!rule) throw Error("Rules have not loaded.");
    if (file.size > 10 * 1024 * 1024) throw Error("Maximum PDF size is 10 MB.");
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
    }).promise;
    try {
      if (doc.numPages > 30) throw Error("Maximum length is 30 pages.");
      const pages = [];
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n),
          content = await page.getTextContent();
        pages.push(
          content.items
            .map((item) =>
              "str" in item
                ? item.str + ("hasEOL" in item && item.hasEOL ? "\n" : " ")
                : "",
            )
            .join(""),
        );
      }
      const checked = reviewText(pages, rule.training_months);
      setResult(checked);
      const {
        data: { user },
      } = await db().auth.getUser();
      if (!user) throw Error("Please sign in again.");
      const saved = await db().from("reviews").insert({
        user_id: user.id,
        filename: file.name,
        rule_version: rule.id,
        status: checked.status,
        findings: checked.findings,
      });
      if (saved.error)
        throw Error(
          "Review displayed but could not be saved: " + saved.error.message,
        );
      setMessage(
        "Review saved using rule version " +
          rule.id +
          ". PDF remains on your device.",
      );
    } finally {
      await doc.loadingTask.destroy();
    }
  }
  return (
    <>
      <header>
        <div className="brand">
          iDynamics{" "}
          <span style={{ fontWeight: 400 }}> / Quotation Checker</span>
        </div>
        <span>
          INTERNAL WORKSPACE{" "}
          {role && (
            <button
              onClick={() =>
                action(async () => {
                  await db().auth.signOut();
                  setRole("");
                  setResult(undefined);
                })
              }
            >
              Sign out
            </button>
          )}
        </span>
      </header>
      <main>
        <small>SALES OPERATIONS / DOCUMENT QUALITY</small>
        <h1>Confidence in every quotation.</h1>
        <p>
          Review PDFs against your team’s standard terms. Clear findings,
          versioned rules, no rejection overrides.
        </p>
        {message && (
          <p role="status" className="notice">
            {message}
          </p>
        )}
        {!role ? (
          <section style={{ maxWidth: 500 }}>
            <h2>Sign in to your workspace</h2>
            <p>Only approved team members can access rules and save reviews.</p>
            <label>Work email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
            {sent && (
              <>
                <label>Email verification code</label>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoComplete="one-time-code"
                />
              </>
            )}
            <button disabled={busy || !email} onClick={() => action(signIn)}>
              {sent ? "Verify code" : "Send sign-in email"}
            </button>
          </section>
        ) : (
          <>
            <div className="grid">
              <section>
                <h2>Review a quotation</h2>
                <p>
                  Upload a PDF, up to 10 MB / 30 pages. This initial version
                  checks extracted text and training validity. It does not yet
                  perform full visual or arithmetic validation.
                </p>
                <label>Quotation PDF</label>
                <input
                  disabled={busy || !rule}
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) action(() => check(file));
                    e.target.value = "";
                  }}
                />
                {busy && <p>Working…</p>}
                {result && (
                  <div>
                    <h2 className="status">{result.status}</h2>
                    <ul>
                      {result.findings.map((f, i) => (
                        <li key={i}>
                          {f.page && <strong>Page {f.page}: </strong>}
                          {f.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
              <section>
                <h2>Active standard</h2>
                <p>
                  Training validity:{" "}
                  <strong>exactly {rule?.training_months} month(s)</strong>
                </p>
                <small>
                  Rule version {rule?.id}. Rejected quotations must be edited
                  and uploaded again.
                </small>
                <p className="notice">
                  Full layout and business validation is not implemented yet.
                  Results cannot grant approval.
                </p>
              </section>
            </div>
            {role === "admin" && (
              <section>
                <h2>Admin · Rules & access</h2>
                <label>Training validity (months)</label>
                <input
                  type="number"
                  min="1"
                  max="36"
                  value={months}
                  onChange={(e) => setMonths(Number(e.target.value))}
                />
                <button
                  disabled={
                    busy ||
                    !Number.isInteger(months) ||
                    months < 1 ||
                    months > 36
                  }
                  onClick={() =>
                    action(async () => {
                      const {
                        data: { user },
                      } = await db().auth.getUser();
                      if (!user) throw Error("Sign in again.");
                      const r = await db().from("rule_versions").insert({
                        training_months: months,
                        created_by: user.id,
                      });
                      if (r.error) throw r.error;
                      await load();
                      setMessage(
                        "New rule version activated. Existing reviews are unchanged.",
                      );
                    })
                  }
                >
                  Activate new version
                </button>
                <p>
                  Past reviews retain their original rule version. Additional
                  rule types and draft testing are not available in this initial
                  release.
                </p>
                <label>Add sales team member</label>
                <input
                  type="email"
                  value={invite}
                  onChange={(e) => setInvite(e.target.value)}
                  placeholder="colleague@company.com"
                />
                <button
                  disabled={busy || !invite.includes("@")}
                  onClick={() =>
                    action(async () => {
                      const r = await db().from("members").insert({
                        email: invite.trim().toLowerCase(),
                        role: "sales",
                      });
                      if (r.error) throw r.error;
                      setInvite("");
                      setMessage(
                        "Team member added. They can now sign in using their email.",
                      );
                    })
                  }
                >
                  Grant sales access
                </button>
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}
