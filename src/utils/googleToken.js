// utils/googleToken.js
const { google } = require("googleapis");

async function ensureFreshGoogleToken(user) {
  // No refresh token → can’t refresh
  if (!user.refresh_token) return { ok: false, reason: "NO_REFRESH_TOKEN" };

  // If token not expiring soon (e.g., >60s left), skip refresh
  const expiresAt = user.token_expires_at
    ? new Date(user.token_expires_at).getTime()
    : 0;
  const msLeft = expiresAt - Date.now();
  if (msLeft > 60_000) return { ok: true, refreshed: false };

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  try {
    const { tokens } = await oauth2Client.refreshToken(user.refresh_token);
    if (!tokens?.access_token) {
      return { ok: false, reason: "NO_ACCESS_FROM_REFRESH" };
    }

    // Persist the new access token and expiry
    user.access_token = tokens.access_token;

    // expiry_date (ms) or fallback to expires_in (s)
    const expiryMs = tokens.expiry_date
      ? tokens.expiry_date
      : tokens.expires_in
      ? Date.now() + tokens.expires_in * 1000
      : Date.now() + 3600 * 1000;

    user.token_expires_at = new Date(expiryMs);

    // Google occasionally rotates the refresh_token – store it if present
    if (tokens.refresh_token) {
      user.refresh_token = tokens.refresh_token;
    }

    await user.save();
    return { ok: true, refreshed: true };
  } catch (err) {
    const isInvalidGrant =
      err?.response?.data?.error === "invalid_grant" ||
      /invalid_grant/i.test(err?.message || "");
    return {
      ok: false,
      reason: isInvalidGrant ? "INVALID_GRANT" : "REFRESH_FAILED",
      error: err,
    };
  }
}

module.exports = { ensureFreshGoogleToken };
