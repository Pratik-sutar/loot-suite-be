// src/utils/parseGmailMessage.js
const parseMessage = require("gmail-api-parse-message");

function normalizeHeaders(hdrs = {}) {
  // Ensure lower-cased header keys like your current extractHeaders() does
  const out = {};
  for (const [k, v] of Object.entries(hdrs)) {
    out[String(k || "").toLowerCase()] = v;
  }
  // Keep convenience props too
  out.from = out.from || hdrs.from;
  out.to = out.to || hdrs.to;
  out.subject = out.subject || hdrs.subject;
  out.date = out.date || hdrs.date;
  return out;
}

/**
 * Convert Gmail API "full" message -> shape your app already uses.
 * Input: the full `message` object returned by users.messages.get({format:'full'})
 * Output: { id, threadId, headers:{from,subject,date,...}, body:{html,text}, attachments:[] }
 */
function parseGmailApiMessage(message) {
  const parsed = parseMessage(message);

  const headers = normalizeHeaders(parsed.headers || {});
  const body = {
    html: parsed.textHtml || "",
    text: parsed.textPlain || "",
  };

  // Keep the exact fields your consumers use
  return {
    id: message.id,
    threadId: message.threadId,
    labelIds: message.labelIds,
    snippet: message.snippet,
    internalDate: message.internalDate,
    sizeEstimate: message.sizeEstimate,
    headers,
    body,
    attachments: parsed.attachments || [],
    messageId: headers["message-id"] || null,
  };
}

module.exports = { parseGmailApiMessage };
