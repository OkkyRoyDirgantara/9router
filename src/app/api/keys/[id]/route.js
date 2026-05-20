import { NextResponse } from "next/server";
import { deleteApiKey, getApiKeyById, updateApiKey } from "@/lib/localDb";
import { requireDashboardUser } from "@/lib/auth/dashboardSession";

function sanitizeList(value) {
  if (!Array.isArray(value)) return null;
  const cleaned = value
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);
  return cleaned.length ? Array.from(new Set(cleaned)) : null;
}

function ownerScope(user) {
  if (!user) return undefined;
  return user.role === "admin" ? null : user.userId;
}

// GET /api/keys/[id]
export async function GET(request, { params }) {
  try {
    const user = await requireDashboardUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const key = await getApiKeyById(id, ownerScope(user));
    if (!key) return NextResponse.json({ error: "Key not found" }, { status: 404 });
    return NextResponse.json({ key });
  } catch (error) {
    console.log("Error fetching key:", error);
    return NextResponse.json({ error: "Failed to fetch key" }, { status: 500 });
  }
}

// PUT /api/keys/[id] - Update key
export async function PUT(request, { params }) {
  try {
    const user = await requireDashboardUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const body = await request.json();

    const scope = ownerScope(user);
    const existing = await getApiKeyById(id, scope);
    if (!existing) return NextResponse.json({ error: "Key not found" }, { status: 404 });

    const updateData = {};
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.name !== undefined) updateData.name = body.name;
    if ("allowedProviders" in body) updateData.allowedProviders = sanitizeList(body.allowedProviders);
    if ("allowedConnectionIds" in body) updateData.allowedConnectionIds = sanitizeList(body.allowedConnectionIds);

    const updated = await updateApiKey(id, updateData, scope);
    return NextResponse.json({ key: updated });
  } catch (error) {
    console.log("Error updating key:", error);
    return NextResponse.json({ error: "Failed to update key" }, { status: 500 });
  }
}

// DELETE /api/keys/[id]
export async function DELETE(request, { params }) {
  try {
    const user = await requireDashboardUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const deleted = await deleteApiKey(id, ownerScope(user));
    if (!deleted) return NextResponse.json({ error: "Key not found" }, { status: 404 });
    return NextResponse.json({ message: "Key deleted successfully" });
  } catch (error) {
    console.log("Error deleting key:", error);
    return NextResponse.json({ error: "Failed to delete key" }, { status: 500 });
  }
}
