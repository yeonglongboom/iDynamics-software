import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { usernameEmail, validatePassword } from "../../../lib/accounts.mjs";
export async function POST(req: NextRequest) {
  try {
    if (req.headers.get("origin") !== req.nextUrl.origin)
      return NextResponse.json(
        { error: "Invalid request origin." },
        { status: 403 },
      );
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key =
      process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    const publicKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key || !publicKey)
      return NextResponse.json(
        {
          error:
            "Server account management is not configured. Contact your administrator.",
        },
        { status: 503 },
      );
    const service = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!token)
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const {
      data: { user },
      error,
    } = await service.auth.getUser(token);
    if (error || !user)
      return NextResponse.json({ error: "Sign in again." }, { status: 401 });
    const { data: member, error: memberError } = await service
      .from("members")
      .select("*")
      .eq("email", user.email?.toLowerCase())
      .single();
    if (memberError || !member?.active || (member.auth_user_id && member.auth_user_id !== user.id))
      return NextResponse.json(
        { error: "Account is not active." },
        { status: 403 },
      );
    const body = await req.json();
    if (body.action === "change-password") {
      const password = validatePassword(body.password);
      if (password === body.currentPassword)
        throw Error("Choose a different password.");
      const verifier = createClient(url, publicKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const verified = await verifier.auth.signInWithPassword({
        email: user.email!,
        password: String(body.currentPassword ?? ""),
      });
      if (verified.error)
        return NextResponse.json(
          {
            error: "Current password is incorrect or sign-in is rate limited.",
          },
          { status: 403 },
        );
      await verifier.auth.signOut({ scope: "local" });
      const updated = await service.auth.admin.updateUserById(user.id, {
        password,
      });
      if (updated.error) throw Error("Password could not be updated.");
      const flags = await service
        .from("members")
        .update({ must_change_password: false, auth_user_id: user.id })
        .eq("email", member.email);
      if (flags.error)
        throw Error(
          "Password changed, but account setup needs administrator assistance.",
        );
      return NextResponse.json({ message: "Password changed." });
    }
    if (member.role !== "admin" || member.must_change_password)
      return NextResponse.json(
        { error: "Administrator access required." },
        { status: 403 },
      );
    if (body.action === "list") {
      const result = await service
        .from("members")
        .select("email,role,active,must_change_password")
        .order("email");
      if (result.error) throw Error("Could not load accounts.");
      return NextResponse.json({ members: result.data });
    }
    const email = usernameEmail(body.username);
    if (email === member.email)
      throw Error(
        "Use Change password for your own account. You cannot reset or disable yourself.",
      );
    if (body.action === "create") {
      const password = validatePassword(body.password);
      const created = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (created.error || !created.data.user)
        throw Error(
          "Account could not be created. Username may already exist.",
        );
      const saved = await service
        .from("members")
        .insert({
          email,
          role: "sales",
          active: true,
          must_change_password: true,
          auth_user_id: created.data.user.id,
        });
      if (saved.error) {
        await service.auth.admin.deleteUser(created.data.user.id);
        throw Error("Membership could not be created.");
      }
      return NextResponse.json({
        message:
          "Account created. Share the temporary password privately. First login requires a new password.",
      });
    }
    const target = await service
      .from("members")
      .select("*")
      .eq("email", email)
      .single();
    if (target.error || !target.data || target.data.role !== "sales")
      throw Error("Sales account not found.");
    if (body.action === "reset") {
      const password = validatePassword(body.password);
      if (!target.data.auth_user_id)
        throw Error("Account requires migration by the administrator.");
      const flags = await service
        .from("members")
        .update({ must_change_password: true })
        .eq("email", email);
      if (flags.error) throw Error("Could not lock account for reset.");
      const reset = await service.auth.admin.updateUserById(
        target.data.auth_user_id,
        { password },
      );
      if (reset.error)
        throw Error(
          "Reset failed; account remains locked for password change. Retry reset.",
        );
      return NextResponse.json({
        message:
          "Temporary password reset. User must change it before accessing quotations.",
      });
    }
    if (body.action === "disable" || body.action === "enable") {
      const updated = await service
        .from("members")
        .update({ active: body.action === "enable" })
        .eq("email", email);
      if (updated.error) throw Error("Could not update access.");
      return NextResponse.json({
        message:
          body.action === "disable"
            ? "Account disabled. Existing sessions cannot access application data."
            : "Account enabled.",
      });
    }
    throw Error("Unknown operation.");
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Account operation failed." },
      { status: 400 },
    );
  }
}
