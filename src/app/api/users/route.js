import { NextResponse } from "next/server";
import { listUsers, createUser } from "@/lib/localDb";
import { requireDashboardAdmin } from "@/lib/auth/dashboardSession";

export const dynamic = "force-dynamic";

// GET /api/users (admin)
export async function GET(request) {
  try {
    const admin = await requireDashboardAdmin(request);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const users = await listUsers();
    return NextResponse.json({ users });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Failed to list users" }, { status: 500 });
  }
}

// POST /api/users (admin) - create a new user
export async function POST(request) {
  try {
    const admin = await requireDashboardAdmin(request);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = await request.json();
    const { username, password, role = "user", isActive = true } = body || {};
    const user = await createUser({ username, password, role, isActive });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    const status = /already exists|required|invalid|at least/.test(error.message) ? 400 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
