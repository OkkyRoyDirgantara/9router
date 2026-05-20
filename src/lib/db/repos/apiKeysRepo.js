import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";
import { parseJson, stringifyJson } from "../helpers/jsonCol.js";

function parseList(value) {
  if (value == null || value === "") return null;
  if (Array.isArray(value)) return value.length ? value.slice() : null;
  const parsed = parseJson(value, null);
  if (Array.isArray(parsed)) return parsed.length ? parsed : null;
  return null;
}

function serializeList(value) {
  if (value == null) return null;
  if (!Array.isArray(value)) return null;
  if (value.length === 0) return null;
  return stringifyJson(value);
}

function rowToKey(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId || null,
    key: row.key,
    name: row.name,
    machineId: row.machineId,
    isActive: row.isActive === 1 || row.isActive === true,
    allowedProviders: parseList(row.allowedProviders),
    allowedConnectionIds: parseList(row.allowedConnectionIds),
    createdAt: row.createdAt,
  };
}

export async function getApiKeys(userId) {
  const db = await getAdapter();
  const rows = userId
    ? db.all(`SELECT * FROM apiKeys WHERE userId = ? ORDER BY createdAt ASC`, [userId])
    : db.all(`SELECT * FROM apiKeys ORDER BY createdAt ASC`);
  return rows.map(rowToKey);
}

export async function getApiKeyById(id, userId) {
  const db = await getAdapter();
  const row = userId
    ? db.get(`SELECT * FROM apiKeys WHERE id = ? AND userId = ?`, [id, userId])
    : db.get(`SELECT * FROM apiKeys WHERE id = ?`, [id]);
  return rowToKey(row);
}

export async function getApiKeyByKey(key) {
  if (!key) return null;
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM apiKeys WHERE key = ?`, [key]);
  return rowToKey(row);
}

export async function createApiKey(arg1, arg2, arg3) {
  // Legacy positional: createApiKey(name, machineId)
  // New positional: createApiKey({ name, machineId, userId, allowedProviders, allowedConnectionIds })
  let name, machineId, userId, allowedProviders, allowedConnectionIds;
  if (typeof arg1 === "object" && arg1 !== null) {
    ({ name, machineId, userId, allowedProviders, allowedConnectionIds } = arg1);
  } else {
    name = arg1;
    machineId = arg2;
    userId = arg3;
  }
  if (!machineId) throw new Error("machineId is required");

  const db = await getAdapter();
  const { generateApiKeyWithMachine } = await import("@/shared/utils/apiKey");
  const result = generateApiKeyWithMachine(machineId);

  const apiKey = {
    id: uuidv4(),
    userId: userId || null,
    name,
    key: result.key,
    machineId,
    isActive: true,
    allowedProviders: Array.isArray(allowedProviders) && allowedProviders.length ? allowedProviders.slice() : null,
    allowedConnectionIds: Array.isArray(allowedConnectionIds) && allowedConnectionIds.length ? allowedConnectionIds.slice() : null,
    createdAt: new Date().toISOString(),
  };
  db.run(
    `INSERT INTO apiKeys(id, userId, key, name, machineId, isActive, allowedProviders, allowedConnectionIds, createdAt) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      apiKey.id, apiKey.userId, apiKey.key, apiKey.name, apiKey.machineId, 1,
      serializeList(apiKey.allowedProviders), serializeList(apiKey.allowedConnectionIds), apiKey.createdAt,
    ]
  );
  return apiKey;
}

export async function updateApiKey(id, data, userId) {
  const db = await getAdapter();
  let result = null;
  db.transaction(() => {
    const row = userId
      ? db.get(`SELECT * FROM apiKeys WHERE id = ? AND userId = ?`, [id, userId])
      : db.get(`SELECT * FROM apiKeys WHERE id = ?`, [id]);
    if (!row) return;
    const current = rowToKey(row);
    const merged = { ...current, ...data };
    // Normalize allowlist fields if provided in patch
    const allowedProviders = "allowedProviders" in data
      ? (Array.isArray(data.allowedProviders) && data.allowedProviders.length ? data.allowedProviders.slice() : null)
      : current.allowedProviders;
    const allowedConnectionIds = "allowedConnectionIds" in data
      ? (Array.isArray(data.allowedConnectionIds) && data.allowedConnectionIds.length ? data.allowedConnectionIds.slice() : null)
      : current.allowedConnectionIds;
    db.run(
      `UPDATE apiKeys SET key = ?, name = ?, machineId = ?, isActive = ?, allowedProviders = ?, allowedConnectionIds = ? WHERE id = ?`,
      [
        merged.key, merged.name, merged.machineId, merged.isActive ? 1 : 0,
        serializeList(allowedProviders), serializeList(allowedConnectionIds), id,
      ]
    );
    result = { ...merged, allowedProviders, allowedConnectionIds };
  });
  return result;
}

export async function deleteApiKey(id, userId) {
  const db = await getAdapter();
  const res = userId
    ? db.run(`DELETE FROM apiKeys WHERE id = ? AND userId = ?`, [id, userId])
    : db.run(`DELETE FROM apiKeys WHERE id = ?`, [id]);
  return (res?.changes ?? 0) > 0;
}

// Backward-compatible: returns boolean. For richer context use getApiKeyByKey().
export async function validateApiKey(key) {
  const db = await getAdapter();
  const row = db.get(`SELECT isActive FROM apiKeys WHERE key = ?`, [key]);
  if (!row) return false;
  return row.isActive === 1 || row.isActive === true;
}
