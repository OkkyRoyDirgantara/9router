import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getUserByUsername, updateUser } from "@/lib/localDb";
import { requireDashboardUser } from "@/lib/auth/dashboardSession";

export const dynamic = "force-dynamic";

// PATCH /api/auth/me/password - change own password
export async function PATCH(request) {
  try {
    const me = await requireDashboardUser(request);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { currentPassword, newPassword } = body || {};
    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 4) {
      return NextResponse.json({ error: "newPassword must be at least 4 characters" }, { status: 400 });
    }

    const existing = await getUserByUsername(me.username);
    if (!existing) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const ok = await bcrypt.compare(currentPassword || "", existing.passwordHash);
    if (!ok) return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });

    await updateUser(me.userId, { password: newPassword });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
