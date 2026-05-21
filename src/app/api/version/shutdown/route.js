import { NextResponse } from "next/server";
import { killAppProcesses } from "@/lib/appUpdater";
import { requireDashboardAdmin } from "@/lib/auth/dashboardSession";

// Shutdown app to release file locks for manual update — admin only.
export async function POST(request) {
  const admin = await requireDashboardAdmin(request);
  if (!admin) {
    return NextResponse.json({ success: false, message: "Forbidden: admin only" }, { status: 403 });
  }

  try {
    await killAppProcesses();
  } catch { /* best effort */ }

  const response = NextResponse.json({ success: true, message: "Shutting down for manual update..." });

  setTimeout(() => process.exit(0), 500);

  return response;
}
