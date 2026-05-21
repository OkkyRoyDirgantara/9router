import { NextResponse } from "next/server";
import { getRecentLogs } from "@/lib/usageDb";
import { requireDashboardUser } from "@/lib/auth/dashboardSession";

export async function GET(request) {
  try {
    const user = await requireDashboardUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const opts = user.role === "admin" ? {} : { userId: user.userId };
    const logs = await getRecentLogs(200, opts);
    return NextResponse.json(logs);
  } catch (error) {
    console.error("[API ERROR] /api/usage/logs failed:", error);
    console.error("[API ERROR] Stack:", error?.stack);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}
