import { NextResponse } from "next/server";
import { getApiKeys, createApiKey } from "@/lib/localDb";
import { getConsistentMachineId } from "@/shared/utils/machineId";
import { requireDashboardUser } from "@/lib/auth/dashboardSession";

export const dynamic = "force-dynamic";

function sanitizeList(value) {
  if (!Array.isArray(value)) return null;
  const cleaned = value
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);
  return cleaned.length ? Array.from(new Set(cleaned)) : null;
}

// GET /api/keys - List API keys (scoped to current user; admin sees all when ?all=1)
export async function GET(request) {
  try {
    const user = await requireDashboardUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(request.url);
    const wantAll = user.role === "admin" && url.searchParams.get("all") === "1";
    const keys = await getApiKeys(wantAll ? null : user.userId);
    return NextResponse.json({ keys });
  } catch (error) {
    console.log("Error fetching keys:", error);
    return NextResponse.json({ error: "Failed to fetch keys" }, { status: 500 });
  }
}

// POST /api/keys - Create new API key
export async function POST(request) {
  try {
    const user = await requireDashboardUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { name, allowedProviders, allowedConnectionIds } = body;
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const machineId = await getConsistentMachineId();
    const apiKey = await createApiKey({
      name,
      machineId,
      userId: user.userId,
      allowedProviders: sanitizeList(allowedProviders),
      allowedConnectionIds: sanitizeList(allowedConnectionIds),
    });

    return NextResponse.json({
      key: apiKey.key,
      name: apiKey.name,
      id: apiKey.id,
      machineId: apiKey.machineId,
      allowedProviders: apiKey.allowedProviders,
      allowedConnectionIds: apiKey.allowedConnectionIds,
    }, { status: 201 });
  } catch (error) {
    console.log("Error creating key:", error);
    return NextResponse.json({ error: "Failed to create key" }, { status: 500 });
  }
}
