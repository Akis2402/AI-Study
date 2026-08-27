'use strict';

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

const MAX_QUERY = 4000;
const MAX_RULE_LEN = 300;
const MAX_RULES = 20;
const MAX_CONTEXTS = 8;
const MAX_CONTEXT_LEN = 1200;
const MAX_DOC_NAME = 120;
const MAX_HISTORY = 20;
const MAX_HISTORY_ITEM = 4000;
const MAX_GENERATE_CONTENT = 6000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB sau khi giải mã base64

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const ALLOWED_LANGS = ['Tiếng Việt', 'English', 'tự động theo câu hỏi'];
const ALLOWED_DETAIL = ['ngắn gọn', 'tiêu chuẩn', 'rất chi tiết'];

function clip(str, max) {
  if (typeof str !== 'string') return '';
  // loại bỏ ký tự điều khiển nguy hiểm, giữ nguyên xuống dòng thường
  const cleaned = str.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
  return cleaned.slice(0, max);
}

/**
 * Validate + sanitize body của POST /api/chat.
 * QUAN TRỌNG: client KHÔNG được phép tự gửi "system prompt" — server luôn tự dựng lại
 * system prompt từ các trường đã được kiểm duyệt bên dưới (xem promptBuilder.js).
 */
function validateChatBody(body) {
  if (!body || typeof body !== 'object') throw new ValidationError('Yêu cầu không hợp lệ.');

  const query = clip(String(body.query || '').trim(), MAX_QUERY);
  const deep = body.deep === true;

  let image = null;
  if (body.image) {
    const mediaType = body.image.mediaType;
    const base64 = body.image.base64;
    if (!ALLOWED_IMAGE_TYPES.includes(mediaType)) {
      throw new ValidationError('Định dạng ảnh không được hỗ trợ (chỉ nhận PNG/JPEG/WEBP/GIF).');
    }
    if (typeof base64 !== 'string' || base64.length === 0) {
      throw new ValidationError('Dữ liệu ảnh không hợp lệ.');
    }
    // ước lượng dung lượng gốc từ độ dài chuỗi base64
    const approxBytes = Math.floor(base64.length * 0.75);
    if (approxBytes > MAX_IMAGE_BYTES) {
      throw new ValidationError('Ảnh vượt quá dung lượng cho phép (tối đa 5MB).');
    }
    image = { mediaType, base64 };
  }

  if (!query && !image) {
    throw new ValidationError('Vui lòng nhập câu hỏi hoặc đính kèm ảnh.');
  }

  const rules = Array.isArray(body.rules)
    ? body.rules.slice(0, MAX_RULES).map((r) => clip(String(r), MAX_RULE_LEN)).filter(Boolean)
    : [];

  const contexts = Array.isArray(body.contexts)
    ? body.contexts.slice(0, MAX_CONTEXTS).map((c) => ({
        doc: clip(String((c && c.doc) || ''), MAX_DOC_NAME),
        id: Number.isFinite(Number(c && c.id)) ? Number(c.id) : 1,
        text: clip(String((c && c.text) || ''), MAX_CONTEXT_LEN)
      })).filter((c) => c.text)
    : [];

  const bodySettings = body.settings || {};
  const settings = {
    lang: ALLOWED_LANGS.includes(bodySettings.lang) ? bodySettings.lang : 'Tiếng Việt',
    detail: ALLOWED_DETAIL.includes(bodySettings.detail) ? bodySettings.detail : 'tiêu chuẩn'
  };

  const history = Array.isArray(body.history)
    ? body.history.slice(-MAX_HISTORY).map((h) => ({
        role: h && h.role === 'assistant' ? 'assistant' : 'user',
        content: clip(String((h && h.content) || ''), MAX_HISTORY_ITEM)
      })).filter((h) => h.content)
    : [];

  return { query, deep, image, rules, contexts, settings, history };
}

/** Validate body của các endpoint /api/generate/* */
function validateGenerateBody(body) {
  if (!body || typeof body !== 'object') throw new ValidationError('Yêu cầu không hợp lệ.');
  const content = clip(String(body.content || '').trim(), MAX_GENERATE_CONTENT);
  if (!content) throw new ValidationError('Thiếu nội dung để tạo slide/flashcard.');
  return { content };
}

module.exports = {
  ValidationError,
  validateChatBody,
  validateGenerateBody,
  LIMITS: {
    MAX_QUERY, MAX_RULE_LEN, MAX_RULES, MAX_CONTEXTS, MAX_CONTEXT_LEN,
    MAX_HISTORY, MAX_IMAGE_BYTES, MAX_GENERATE_CONTENT
  }
};
