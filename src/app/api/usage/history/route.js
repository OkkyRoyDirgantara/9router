import { NextResponse } from "next/server";
import { getUsageStats } from "@/lib/usageDb";
import { requireDashboardUser } from "@/lib/auth/dashboardSession";

export async function GET(request) {
  try {
    const user = await requireDashboardUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const opts = user.role === "admin" ? {} : { userId: user.userId };
    const stats = await getUsageStats("all", opts);
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching usage stats:", error);
    return NextResponse.json({ error: "Failed to fetch usage stats" }, { status: 500 });
  }
}
