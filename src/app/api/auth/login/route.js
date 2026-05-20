import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import {
  getSettings,
  verifyPassword,
  userCount,
  createUser,
  getUserByUsername,
} from "@/lib/localDb";
import { setDashboardAuthCookie } from "@/lib/auth/dashboardSession";
import { isOidcConfigured } from "@/lib/auth/oidc";

function isTunnelRequest(request, settings) {
  const host = (request.headers.get("host") || "").split(":")[0].toLowerCase();
  const tunnelHost = settings.tunnelUrl ? new URL(settings.tunnelUrl).hostname.toLowerCase() : "";
  const tailscaleHost = settings.tailscaleUrl ? new URL(settings.tailscaleUrl).hostname.toLowerCase() : "";
  return (tunnelHost && host === tunnelHost) || (tailscaleHost && host === tailscaleHost);
}

// First-run bootstrap: when no users exist yet, accept the legacy global
// password or INITIAL_PASSWORD and provision an `admin` user on the fly.
async function bootstrapAdminIfNeeded(settings, password) {
  const total = await userCount();
  if (total > 0) return null;

  const storedHash = settings.password;
  let ok = false;
  if (storedHash) {
    try { ok = await bcrypt.compare(password, storedHash); } catch { ok = false; }
  } else {
    ok = password === (process.env.INITIAL_PASSWORD || "123456");
  }
  if (!ok) return null;

  return await createUser({ username: "admin", password, role: "admin" });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const username = typeof body?.username === "string" ? body.username.trim() : "admin";
    const password = body?.password;
    const settings = await getSettings();

    if (isTunnelRequest(request, settings) && settings.tunnelDashboardAccess !== true) {
      return NextResponse.json({ error: "Dashboard access via tunnel is disabled" }, { status: 403 });
    }

    if (settings.authMode === "oidc" && isOidcConfigured(settings)) {
      return NextResponse.json({ error: "Password login is disabled. Use OIDC sign in." }, { status: 403 });
    }

    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "Password required" }, { status: 400 });
    }

    let user = await verifyPassword(username, password);

    // First-run: no users yet. Bootstrap an admin from legacy password.
    if (!user) {
      const bootstrapped = await bootstrapAdminIfNeeded(settings, password);
      if (bootstrapped && (username === "admin" || !username)) {
        user = await getUserByUsername("admin");
        // Strip hash before returning to caller
        if (user) {
          const { passwordHash: _h, ...safe } = user;
          user = safe;
        }
      }
    }

    if (!user) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    const cookieStore = await cookies();
    await setDashboardAuthCookie(cookieStore, request, {
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    return NextResponse.json({
      success: true,
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
