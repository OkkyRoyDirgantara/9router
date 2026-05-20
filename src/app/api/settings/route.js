import { NextResponse } from "next/server";
import {
  getSettings,
  updateSettings,
  getUserSettings,
  updateUserSettings,
} from "@/lib/localDb";
import { USER_SCOPED_SETTING_KEYS } from "@/lib/db/schema";
import { applyOutboundProxyEnv } from "@/lib/network/outboundProxy";
import { resetComboRotation } from "open-sse/services/combo.js";
import { requireDashboardUser } from "@/lib/auth/dashboardSession";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SETTINGS_RESPONSE_HEADERS = { "Cache-Control": "no-store" };
const USER_KEYS = new Set(USER_SCOPED_SETTING_KEYS);

function splitBody(body) {
  const userPatch = {};
  const globalPatch = {};
  for (const [k, v] of Object.entries(body || {})) {
    if (USER_KEYS.has(k)) userPatch[k] = v;
    else globalPatch[k] = v;
  }
  return { userPatch, globalPatch };
}

export async function GET(request) {
  try {
    const user = await requireDashboardUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const settings = await getSettings();
    const userSettings = await getUserSettings(user.userId);
    const { password: _pw, oidcClientSecret, ...safeSettings } = settings;
    const merged = { ...safeSettings, ...userSettings };
    merged.oidcConfigured = !!(safeSettings.oidcIssuerUrl && safeSettings.oidcClientId && oidcClientSecret);

    const enableRequestLogs = process.env.ENABLE_REQUEST_LOGS === "true";
    const enableTranslator = process.env.ENABLE_TRANSLATOR === "true";

    return NextResponse.json({
      ...merged,
      enableRequestLogs,
      enableTranslator,
      hasPassword: true, // per-user password lives in users table
      currentUser: { id: user.userId, username: user.username, role: user.role },
    }, { headers: SETTINGS_RESPONSE_HEADERS });
  } catch (error) {
    console.log("Error getting settings:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const user = await requireDashboardUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();

    // Password changes belong to /api/auth/me/password — not handled here anymore.
    if (body.newPassword || body.currentPassword) {
      return NextResponse.json(
        { error: "Use /api/auth/me/password to change your password" },
        { status: 400 }
      );
    }

    const { userPatch, globalPatch } = splitBody(body);
    const wantsGlobalChange = Object.keys(globalPatch).length > 0;
    if (wantsGlobalChange && user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 });
    }

    if (
      Object.prototype.hasOwnProperty.call(globalPatch, "oidcClientSecret") &&
      (!globalPatch.oidcClientSecret || !String(globalPatch.oidcClientSecret).trim())
    ) {
      delete globalPatch.oidcClientSecret;
    }

    const settings = wantsGlobalChange ? await updateSettings(globalPatch) : await getSettings();
    const userSettings = Object.keys(userPatch).length
      ? await updateUserSettings(user.userId, userPatch)
      : await getUserSettings(user.userId);

    if (
      Object.prototype.hasOwnProperty.call(userPatch, "outboundProxyEnabled") ||
      Object.prototype.hasOwnProperty.call(userPatch, "outboundProxyUrl") ||
      Object.prototype.hasOwnProperty.call(userPatch, "outboundNoProxy")
    ) {
      applyOutboundProxyEnv({ ...settings, ...userSettings });
    }

    if (
      Object.prototype.hasOwnProperty.call(userPatch, "comboStrategy") ||
      Object.prototype.hasOwnProperty.call(userPatch, "comboStickyRoundRobinLimit") ||
      Object.prototype.hasOwnProperty.call(userPatch, "comboStrategies")
    ) {
      resetComboRotation();
    }

    const { password: _pw, oidcClientSecret, ...safeSettings } = settings;
    const merged = { ...safeSettings, ...userSettings };
    merged.oidcConfigured = !!(safeSettings.oidcIssuerUrl && safeSettings.oidcClientId && oidcClientSecret);
    return NextResponse.json(merged, { headers: SETTINGS_RESPONSE_HEADERS });
  } catch (error) {
    console.log("Error updating settings:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
