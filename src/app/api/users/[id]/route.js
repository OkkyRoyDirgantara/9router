import { NextResponse } from "next/server";
import { getUserById, updateUser, deleteUser } from "@/lib/localDb";
import { requireDashboardAdmin } from "@/lib/auth/dashboardSession";

export const dynamic = "force-dynamic";

// GET /api/users/[id]
export async function GET(request, { params }) {
  try {
    const admin = await requireDashboardAdmin(request);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { id } = await params;
    const user = await getUserById(id);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/users/[id] - reset password / toggle active / change role / rename
export async function PATCH(request, { params }) {
  try {
    const admin = await requireDashboardAdmin(request);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { id } = await params;
    const body = await request.json();
    const patch = {};
    if (body.username !== undefined) patch.username = body.username;
    if (body.password !== undefined) patch.password = body.password;
    if (body.role !== undefined) patch.role = body.role;
    if (body.isActive !== undefined) patch.isActive = body.isActive;
    const user = await updateUser(id, patch);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json({ user });
  } catch (error) {
    const status = /not found|exists|required|invalid|admin|at least|empty/.test(error.message) ? 400 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

// DELETE /api/users/[id]
export async function DELETE(request, { params }) {
  try {
    const admin = await requireDashboardAdmin(request);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { id } = await params;
    if (id === admin.userId) {
      return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
    }
    const ok = await deleteUser(id);
    if (!ok) return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    const status = /admin|not found/.test(error.message) ? 400 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
