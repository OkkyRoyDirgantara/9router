import { NextResponse } from "next/server";
import { getComboById, updateCombo, deleteCombo, getComboByName } from "@/lib/localDb";
import { resetComboRotation } from "open-sse/services/combo.js";
import { requireDashboardUser } from "@/lib/auth/dashboardSession";

const VALID_NAME_REGEX = /^[a-zA-Z0-9_.\-]+$/;

function ownerScope(user) {
  if (!user) return undefined;
  return user.role === "admin" ? null : user.userId;
}

// GET /api/combos/[id]
export async function GET(request, { params }) {
  try {
    const user = await requireDashboardUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const combo = await getComboById(id, ownerScope(user));
    if (!combo) return NextResponse.json({ error: "Combo not found" }, { status: 404 });
    return NextResponse.json(combo);
  } catch (error) {
    console.log("Error fetching combo:", error);
    return NextResponse.json({ error: "Failed to fetch combo" }, { status: 500 });
  }
}

// PUT /api/combos/[id]
export async function PUT(request, { params }) {
  try {
    const user = await requireDashboardUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const body = await request.json();
    const scope = ownerScope(user);

    if (body.name) {
      if (!VALID_NAME_REGEX.test(body.name)) {
        return NextResponse.json({ error: "Name can only contain letters, numbers, -, _ and ." }, { status: 400 });
      }
      const existing = await getComboByName(body.name, scope ?? null);
      if (existing && existing.id !== id) {
        return NextResponse.json({ error: "Combo name already exists" }, { status: 400 });
      }
    }

    const prev = await getComboById(id, scope);
    const combo = await updateCombo(id, body, scope);
    if (!combo) return NextResponse.json({ error: "Combo not found" }, { status: 404 });

    if (prev?.name) resetComboRotation(prev.name);
    if (combo.name && combo.name !== prev?.name) resetComboRotation(combo.name);

    return NextResponse.json(combo);
  } catch (error) {
    console.log("Error updating combo:", error);
    return NextResponse.json({ error: "Failed to update combo" }, { status: 500 });
  }
}

// DELETE /api/combos/[id]
export async function DELETE(request, { params }) {
  try {
    const user = await requireDashboardUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const scope = ownerScope(user);
    const prev = await getComboById(id, scope);
    const success = await deleteCombo(id, scope);
    if (!success) return NextResponse.json({ error: "Combo not found" }, { status: 404 });

    if (prev?.name) resetComboRotation(prev.name);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.log("Error deleting combo:", error);
    return NextResponse.json({ error: "Failed to delete combo" }, { status: 500 });
  }
}
