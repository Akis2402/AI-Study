'use strict';

require('dotenv').config();

const express = require('express');
const path = require('path');
const compression = require('compression');

const { corsOptions, helmetConfig, chatLimiter, generateLimiter, appKeyGate } = require('./middleware/security');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const chatRoutes = require('./routes/chat');
const generateRoutes = require('./routes/generate');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1); // cần thiết khi deploy sau reverse proxy / load balancer (Render, Vercel, Nginx...)

// ---------- Lớp bảo mật áp dụng toàn cục ----------
app.use(helmetConfig);
app.use(corsOptions);
app.use(compression());
app.use(express.json({ limit: '8mb' })); // đủ chứa ảnh base64 (validators.js giới hạn chặt hơn: 5MB)

// ---------- API ----------
// Đây là nơi để thêm các route API mới trong tương lai:
// const myFeatureRoutes = require('./routes/myFeature');
// app.use('/api/my-feature', myFeatureRoutes);
app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use('/api', appKeyGate); // cổng khóa dùng chung tùy chọn (đọc từ .env, mặc định tắt)
app.use('/api/chat', chatLimiter, chatRoutes);
app.use('/api/generate', generateLimiter, generateRoutes);

// ---------- Frontend tĩnh ----------
// Lưu ý: khi deploy trên Vercel, thư mục public/ được Vercel phục vụ trực tiếp
// (xem vercel.json - outputDirectory), request tĩnh sẽ KHÔNG đi qua function này.
// Đoạn dưới đây chủ yếu phục vụ khi chạy `npm run dev` / `npm start` ở local.
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir, { maxAge: '1h' }));
app.get('*', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));

// ---------- Xử lý lỗi ----------
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
