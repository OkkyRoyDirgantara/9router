import { getAdapter } from "../driver.js";
import { parseJson, stringifyJson } from "../helpers/jsonCol.js";

const DEFAULT_USER_SETTINGS = {
  stickyRoundRobinLimit: 3,
  providerStrategies: {},
  comboStrategy: "fallback",
  comboStickyRoundRobinLimit: 1,
  comboStrategies: {},
  outboundProxyEnabled: false,
  outboundProxyUrl: "",
  outboundNoProxy: "",
  rtkEnabled: true,
  cavemanEnabled: false,
  cavemanLevel: "full",
};

function mergeWithDefaults(raw) {
  const merged = { ...DEFAULT_USER_SETTINGS, ...(raw || {}) };
  for (const [key, defVal] of Object.entries(DEFAULT_USER_SETTINGS)) {
    if (merged[key] === undefined) {
      if (
        key === "outboundProxyEnabled" &&
        typeof merged.outboundProxyUrl === "string" &&
        merged.outboundProxyUrl.trim()
      ) {
        merged[key] = true;
      } else {
        merged[key] = defVal;
      }
    }
  }
  return merged;
}

async function readRaw(userId) {
  if (!userId) return {};
  const db = await getAdapter();
  const row = db.get(`SELECT data FROM userSettings WHERE userId = ?`, [userId]);
  return row ? parseJson(row.data, {}) : {};
}

export async function getUserSettings(userId) {
  const raw = await readRaw(userId);
  return mergeWithDefaults(raw);
}

export async function updateUserSettings(userId, updates) {
  if (!userId) throw new Error("userId is required");
  const db = await getAdapter();
  let next;
  db.transaction(() => {
    const row = db.get(`SELECT data FROM userSettings WHERE userId = ?`, [userId]);
    const current = row ? parseJson(row.data, {}) : {};
    next = { ...current, ...updates };
    db.run(
      `INSERT INTO userSettings(userId, data) VALUES(?, ?) ON CONFLICT(userId) DO UPDATE SET data = excluded.data`,
      [userId, stringifyJson(next)]
    );
  });
  return mergeWithDefaults(next);
}

export async function exportUserSettings(userId) {
  return await readRaw(userId);
}

export { DEFAULT_USER_SETTINGS };
