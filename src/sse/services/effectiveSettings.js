import { getSettings, getUserSettings } from "@/lib/localDb";
import { USER_SCOPED_SETTING_KEYS } from "@/lib/db/schema";
import { getApiKeyContextFromKey } from "./auth.js";

const USER_KEY_SET = new Set(USER_SCOPED_SETTING_KEYS);

// Resolve runtime settings for a given API key by overlaying the owning user's
// per-user preferences on top of global settings. Callers that do not yet have
// the apiKeyContext can pass `apiKey`; we resolve userId from it.
export async function getEffectiveSettings({ apiKey = null, apiKeyContext = null, userId = null } = {}) {
  const globalSettings = await getSettings();

  let resolvedUserId = userId || apiKeyContext?.userId || null;
  if (!resolvedUserId && apiKey) {
    const ctx = await getApiKeyContextFromKey(apiKey);
    resolvedUserId = ctx?.userId || null;
  }

  if (!resolvedUserId) return globalSettings;

  const userSettings = await getUserSettings(resolvedUserId);
  const merged = { ...globalSettings };
  for (const key of USER_SCOPED_SETTING_KEYS) {
    if (userSettings[key] !== undefined) merged[key] = userSettings[key];
  }
  merged._userId = resolvedUserId;
  return merged;
}

export { USER_KEY_SET };
