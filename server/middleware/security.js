'use strict';

const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

// ---------- CORS: cho phép cùng-origin tự động + các origin khai báo thêm trong .env ----------
// Lưu ý quan trọng: dự án này phục vụ frontend và API trên CÙNG một domain (kể cả trên Vercel,
// nhờ "rewrites" trong vercel.json). Trình duyệt vẫn gửi header Origin cho các request POST dù
// là cùng-origin, nên nếu chỉ dùng whitelist tĩnh (vd. mặc định "http://localhost:3000") thì khi
// deploy lên domain thật (vd. https://ten-du-an.vercel.app), request sẽ bị chặn nhầm vì domain đó
// không có trong danh sách — đây chính là lỗi "Origin không được phép bởi chính sách CORS."
// Cách xử lý: tự động cho phép nếu Origin trùng với chính host đang xử lý request (self origin),
// đồng thời vẫn cho phép khai báo thêm các domain khác (vd. domain phụ, custom domain) qua .env.
const extraAllowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function isSameOriginAsRequest(origin, req) {
  try {
    const originHost = new URL(origin).host;
    // req.headers.host là domain thật của request hiện tại (Vercel tự set đúng giá trị này)
    return originHost === req.headers.host;
  } catch {
    return false;
  }
}

const corsOptions = (req, res, next) => {
  cors({
    origin(origin, callback) {
      // Cho phép request không có Origin (Postman, curl, server-to-server, v.v.)
      if (!origin) return callback(null, true);
      // Cho phép nếu cùng domain với request hiện tại (trường hợp mặc định của dự án này)
      if (isSameOriginAsRequest(origin, req)) return callback(null, true);
      // Cho phép nếu nằm trong danh sách domain khai báo thêm qua ALLOWED_ORIGINS
      if (extraAllowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error('Origin không được phép bởi chính sách CORS.'));
    },
    methods: ['GET', 'POST'],
    credentials: false
  })(req, res, next);
};

// ---------- Helmet: thiết lập các HTTP header bảo mật + Content-Security-Policy ----------
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://cdnjs.cloudflare.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      workerSrc: ["'self'", 'blob:', 'https://cdnjs.cloudflare.com'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
});

// ---------- Rate limit: chống spam & giới hạn chi phí gọi Anthropic API ----------
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_CHAT || 40),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Bạn đã gửi quá nhiều câu hỏi. Vui lòng thử lại sau ít phút.' }
});

const generateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_GENERATE || 15),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Bạn đã tạo quá nhiều slide/flashcard. Vui lòng thử lại sau ít phút.' }
});

// ---------- Khóa dùng chung tùy chọn (basic gate, không thay thế cho auth thật) ----------
function appKeyGate(req, res, next) {
  const required = process.env.APP_SHARED_KEY;
  if (!required) return next(); // không bật nếu chưa cấu hình trong .env
  const provided = req.header('x-app-key');
  if (provided !== required) {
    return res.status(401).json({ error: 'Thiếu hoặc sai khóa truy cập ứng dụng.' });
  }
  next();
}

module.exports = { corsOptions, helmetConfig, chatLimiter, generateLimiter, appKeyGate };
