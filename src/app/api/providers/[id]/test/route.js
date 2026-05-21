import { NextResponse } from "next/server";
import { testSingleConnection } from "./testUtils.js";
import { requireDashboardUser } from "@/lib/auth/dashboardSession";

// POST /api/providers/[id]/test - Test connection (scoped to caller)
export async function POST(request, { params }) {
  try {
    const user = await requireDashboardUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const ownerScope = user.role === "admin" ? null : user.userId;
    const result = await testSingleConnection(id, ownerScope);

    if (result.error === "Connection not found") {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    return NextResponse.json({
      valid: result.valid,
      error: result.error,
      refreshed: result.refreshed || false,
    });
  } catch (error) {
    console.log("Error testing connection:", error);
    return NextResponse.json({ error: "Test failed" }, { status: 500 });
  }
}
