"use client";
import { useEffect, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { usernameEmail } from "../lib/accounts.mjs";
import ReferenceLibrary from "./reference-library";
import { extractPdfDetails } from "../lib/pdf";
import { applyReferenceChecks } from "../lib/reference-checks.mjs";
import { tableFindings } from "../lib/table.mjs";
import { reviewText } from "../lib/review.mjs";
type Rule = { id: number; training_months: number };
type Result = ReturnType<typeof reviewText>;
let client: SupabaseClient | undefined;
function db() {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
      key =
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
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
    [password, setPassword] = useState(""),
    [newPassword, setNewPassword] = useState(""),
    [currentPassword, setCurrentPassword] = useState(""),
    [temporary, setTemporary] = useState(""),
    [accountList, setAccountList] = useState<
      {
        email: string;
        role: string;
        active: boolean;
        must_change_password: boolean;
      }[]
    >([]),
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
      .select("role,active,must_change_password")
      .eq("email", user.email?.toLowerCase())
      .single();
    if (member.error || !member.data) {
      setRole("");
      throw Error(
        "Your account is not on the team access list, or database setup is incomplete.",
      );
    }
    if (!member.data.active) {
      setRole("");
      throw Error("Account disabled. Contact your administrator.");
    }
    if (member.data.must_change_password) {
      setRole("change-password");
      return;
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
  async function accountAction(
    actionName: string,
    extra: Record<string, string> = {},
  ) {
    const {
      data: { session },
    } = await db().auth.getSession();
    const response = await fetch("/api/accounts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      },
      body: JSON.stringify({ action: actionName, ...extra }),
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || "Account operation failed.");
    if (data.members) setAccountList(data.members);
    if (data.message) setMessage(data.message);
  }
  async function signIn() {
    const { error } = await db().auth.signInWithPassword({
      email: usernameEmail(email),
      password,
    });
    setPassword("");
    if (error)
      throw Error(
        "Sign-in failed. Check your username/password or try again later.",
      );
    await load();
  }
  async function check(file: File) {
    setResult(undefined);
    if (!rule) throw Error("Rules have not loaded.");
    const { pages, tables } = await extractPdfDetails(file);
    const references = await db().rpc("active_reference_checks");
    if (references.error)
      throw Error(
        "Reference checks could not be loaded. Complete the library database setup before reviewing.",
      );
    const checked = reviewText(pages, rule.training_months);
    checked.findings.push(...tableFindings(tables, pages));
    checked.findings.push(
      ...applyReferenceChecks(pages, references.data ?? []),
    );
    if (checked.findings.some((f) => f.error)) checked.status = "Rejected";
    setResult(checked);
    const {
      data: { user },
    } = await db().auth.getUser();
    if (!user) throw Error("Please sign in again.");
    const saved = await db()
      .from("reviews")
      .insert({
        user_id: user.id,
        filename: file.name,
        rule_version: rule.id,
        status: checked.status,
        findings: checked.findings,
        reference_check_ids: (references.data ?? []).map((c) => c.id),
        reference_checks_snapshot: references.data ?? [],
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
  }
  function passwordForm() {
    return (
      <>
        <label htmlFor="current-password">Current password</label>
        <input
          id="current-password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <label htmlFor="new-password">New password (12–128 characters)</label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <button
          disabled={busy || !currentPassword || newPassword.length < 12}
          onClick={() =>
            action(async () => {
              try {
                await accountAction("change-password", {
                  currentPassword,
                  password: newPassword,
                });
                await load();
              } finally {
                setNewPassword("");
                setCurrentPassword("");
              }
            })
          }
        >
          Change password
        </button>
      </>
    );
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
            <label htmlFor="username">Username</label>
            <input
              id="username"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your username"
            />
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              disabled={busy || !email || !password}
              onClick={() => action(signIn)}
            >
              Sign in
            </button>
            <p>
              No registration. Ask your administrator for an account or a
              password reset.
            </p>
          </section>
        ) : role === "change-password" ? (
          <section>
            <h2>Change your temporary password</h2>
            <p>You must set a new password before accessing quotations.</p>
            {passwordForm()}
          </section>
        ) : (
          <>
            <section>
              <h2>Change your password</h2>
              {passwordForm()}
            </section>
            <div className="grid">
              <section>
                <h2>Review a quotation</h2>
                <p>
                  Upload a PDF, up to 10 MB / 30 pages. This initial version
                  checks text, training validity, supported monetary summaries
                  and isolated numeric rows. It does not yet perform full visual
                  or comprehensive arithmetic validation.
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
            {role === "admin" && <ReferenceLibrary client={db()} />}
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
                <h2>Manage sales accounts</h2>
                <label htmlFor="new-username">Username</label>
                <input
                  id="new-username"
                  value={invite}
                  onChange={(e) => setInvite(e.target.value)}
                  placeholder="e.g. sales.jane"
                />
                <label htmlFor="temporary-password">
                  Temporary password (12–128 characters)
                </label>
                <input
                  id="temporary-password"
                  type="password"
                  autoComplete="new-password"
                  value={temporary}
                  onChange={(e) => setTemporary(e.target.value)}
                />
                <button
                  disabled={busy || !invite || temporary.length < 12}
                  onClick={() =>
                    action(async () => {
                      try {
                        await accountAction("create", {
                          username: invite,
                          password: temporary,
                        });
                      } finally {
                        setTemporary("");
                      }
                    })
                  }
                >
                  Create sales account
                </button>
                <button
                  disabled={busy || !invite || temporary.length < 12}
                  onClick={() =>
                    action(async () => {
                      try {
                        await accountAction("reset", {
                          username: invite,
                          password: temporary,
                        });
                      } finally {
                        setTemporary("");
                      }
                    })
                  }
                >
                  Reset password
                </button>
                <button
                  disabled={busy || !invite}
                  onClick={() =>
                    action(() => accountAction("disable", { username: invite }))
                  }
                >
                  Disable account
                </button>
                <button
                  disabled={busy || !invite}
                  onClick={() =>
                    action(() => accountAction("enable", { username: invite }))
                  }
                >
                  Enable account
                </button>
                <button
                  disabled={busy}
                  onClick={() => action(() => accountAction("list"))}
                >
                  Refresh account list
                </button>
                <ul>
                  {accountList.map((m) => (
                    <li key={m.email}>
                      {m.email.split("@")[0]} · {m.role} ·{" "}
                      {m.active ? "Active" : "Disabled"}
                      {m.must_change_password
                        ? " · Password change required"
                        : ""}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}
