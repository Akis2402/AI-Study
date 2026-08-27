'use strict';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

if (!API_KEY) {
  // Không throw ngay khi khởi động để dev vẫn xem được giao diện,
  // nhưng mọi request tới AI sẽ báo lỗi rõ ràng cho tới khi cấu hình .env
  console.warn(
    '[CẢNH BÁO BẢO MẬT/CẤU HÌNH] Chưa thấy ANTHROPIC_API_KEY trong biến môi trường. ' +
    'Tạo file .env từ .env.example rồi điền khóa API thật trước khi dùng thật.'
  );
}

/**
 * Gọi Anthropic Messages API bằng khóa API phía server (không bao giờ lộ ra client).
 * @param {{system:string, messages:Array, maxTokens?:number}} opts
 * @returns {Promise<string>} nội dung text trả lời
 */
async function callClaude({ system, messages, maxTokens = 1000 }) {
  if (!API_KEY) {
    const err = new Error('Máy chủ chưa được cấu hình ANTHROPIC_API_KEY. Vui lòng liên hệ quản trị viên.');
    err.status = 500;
    throw err;
  }

  let res;
  try {
    res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        system,
        messages
      })
    });
  } catch (networkErr) {
    const err = new Error('Không thể kết nối tới Anthropic API. Vui lòng thử lại sau.');
    err.status = 503;
    throw err;
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    const err = new Error('Anthropic API trả về lỗi (HTTP ' + res.status + ').');
    err.status = res.status === 429 ? 429 : 502;
    err.detail = detail.slice(0, 500);
    throw err;
  }

  const data = await res.json();
  const text = (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

  return text;
}

module.exports = { callClaude };
