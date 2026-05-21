import { NextResponse } from "next/server";
import { exportDb, importDb, exportUserDb, importUserDb, getSettings } from "@/lib/localDb";
import { applyOutboundProxyEnv } from "@/lib/network/outboundProxy";
import { requireDashboardUser } from "@/lib/auth/dashboardSession";

export async function GET(request) {
  try {
    const user = await requireDashboardUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = user.role === "admin"
      ? await exportDb()
      : await exportUserDb(user.userId);
    return NextResponse.json(payload);
  } catch (error) {
    console.log("Error exporting database:", error);
    return NextResponse.json({ error: "Failed to export database" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await requireDashboardUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await request.json();

    if (user.role === "admin") {
      await importDb(payload);
      // Re-apply proxy env immediately after a full DB import.
      try {
        const settings = await getSettings();
        applyOutboundProxyEnv(settings);
      } catch (err) {
        console.warn("[Settings][DatabaseImport] Failed to re-apply outbound proxy env:", err);
      }
    } else {
      // Non-admin: only import data scoped to this user. userId is always
      // rewritten to the caller's id inside importUserDb, so a payload cannot
      // claim resources owned by anyone else.
      await importUserDb(user.userId, payload);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.log("Error importing database:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to import database" },
      { status: 400 }
    );
  }
}
