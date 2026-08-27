# Trợ Giải — AI học tập (Full-stack)

Ứng dụng giải bài tập bằng AI, có trích nguồn từ tài liệu (PDF/Word/TXT), đọc ảnh đề bài, vẽ đồ thị/hình học, và xuất slide PPT / flashcard ôn tập.

Kiến trúc **tách frontend – backend** đúng chuẩn web thực tế:

```
tro-giai-ai/
├── api/
│   └── index.js          ← Entry point RIÊNG cho Vercel (serverless function).
│                            Chỉ export lại server/app.js, Vercel tự nhận diện
│                            thư mục /api và gọi file này cho mọi request /api/*.
├── server/                ← Backend Node.js/Express (giữ API key, xử lý bảo mật)
│   ├── app.js             ← TOÀN BỘ cấu hình Express: middleware + routes
│   │                          (không gọi app.listen — dùng chung cho cả local lẫn Vercel)
│   ├── index.js            ← chỉ dùng khi chạy LOCAL (npm start/dev), gọi app.listen()
│   ├── middleware/
│   │   ├── security.js    ← helmet, CORS, rate-limit, khóa dùng chung
│   │   └── errorHandler.js
│   ├── routes/
│   │   ├── chat.js        ← POST /api/chat  (giải bài)
│   │   └── generate.js    ← POST /api/generate/ppt-outline, /api/generate/flashcards
│   └── utils/
│       ├── anthropicClient.js  ← gọi Anthropic API bằng khóa server-side
│       ├── promptBuilder.js    ← server tự dựng system prompt (chống prompt injection)
│       └── validators.js       ← validate & sanitize mọi input từ client
├── public/                 ← Frontend tĩnh (HTML/CSS/JS thuần, không cần build)
│   │                          Trên Vercel, thư mục này được phục vụ trực tiếp làm site tĩnh
│   │                          (xem "outputDirectory" trong vercel.json).
│   ├── index.html
│   ├── css/styles.css
│   └── js/
│       ├── config.js       ← cấu hình công khai phía client
│       └── app.js          ← toàn bộ logic giao diện, gọi backend qua fetch
├── vercel.json             ← cấu hình deploy cho Vercel (routing + thời gian chạy function)
├── package.json
├── .env.example
└── .gitignore
```

## 1. Cài đặt

Yêu cầu **Node.js ≥ 18** (dùng `fetch` có sẵn, không cần cài thêm thư viện HTTP).

```bash
cd tro-giai-ai
npm install
cp .env.example .env
```

Mở file `.env` vừa tạo, điền khóa API Anthropic thật của bạn:

```
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxx
```

## 2. Chạy

```bash
npm start        # chạy production
# hoặc
npm run dev       # tự khởi động lại khi sửa code (Node --watch)
```

Mở trình duyệt tại **http://localhost:3000**.

## 3. Vì sao tách backend thay vì gọi thẳng Anthropic API từ trình duyệt?

Nếu gọi thẳng từ frontend, khóa API bắt buộc phải nhúng vào mã JavaScript công khai — bất kỳ ai mở DevTools cũng lấy được và có thể dùng khóa đó tiêu tiền của bạn. Vì vậy dự án này dùng mô hình chuẩn:

```
Trình duyệt  →  Backend (giữ khóa API)  →  Anthropic API
```

Khóa `ANTHROPIC_API_KEY` **chỉ tồn tại trên server**, không bao giờ được gửi xuống client.

## 4. Các lớp bảo mật đã áp dụng

| Lớp | Vị trí | Mục đích |
|---|---|---|
| **Helmet** (CSP, HSTS, các security header) | `server/middleware/security.js` | Chặn XSS, clickjacking, MIME sniffing; khai báo rõ domain CDN được phép tải script/font |
| **CORS** | `server/middleware/security.js` | Tự động cho phép domain đang phục vụ chính app (localhost lúc dev, domain thật lúc deploy) gọi API; muốn thêm domain khác thì khai báo qua `ALLOWED_ORIGINS` |
| **Rate limiting** | `server/middleware/security.js` | Giới hạn số request/15 phút theo IP — chống spam và giới hạn chi phí gọi Anthropic API (`RATE_LIMIT_CHAT`, `RATE_LIMIT_GENERATE`) |
| **Input validation & sanitize** | `server/utils/validators.js` | Giới hạn độ dài câu hỏi, số lượng/độ dài quy tắc, số đoạn trích nguồn, dung lượng ảnh (≤5MB), whitelist định dạng ảnh, loại bỏ ký tự điều khiển |
| **System prompt do server tự dựng** | `server/utils/promptBuilder.js` | Client **không thể** gửi thẳng "system prompt" xuống — mọi hành vi của AI luôn do server quyết định dựa trên dữ liệu đã kiểm duyệt, chống prompt injection ở tầng hệ thống |
| **Giới hạn kích thước request** | `express.json({limit:'8mb'})` trong `server/index.js` | Chặn request quá lớn gây tốn tài nguyên |
| **Ẩn chi tiết lỗi khi production** | `server/middleware/errorHandler.js` | Không lộ stack trace / thông tin nội bộ ra client khi `NODE_ENV=production` |
| **Khóa dùng chung tùy chọn** (`APP_SHARED_KEY`) | `server/middleware/security.js` + `public/js/config.js` | Lớp chặn cơ bản bổ sung khi deploy công khai — không thay thế xác thực người dùng thật |
| **`app.disable('x-powered-by')`** | `server/index.js` | Ẩn thông tin framework đang dùng |

**Lưu ý khi triển khai thật:**
- Luôn chạy sau HTTPS (Nginx/Caddy reverse proxy, hoặc nền tảng PaaS có sẵn TLS như Render/Railway/Fly.io).
- Đặt `NODE_ENV=production`. Không cần cấu hình `ALLOWED_ORIGINS` cho domain chính của app — server tự nhận diện; chỉ cần điền nếu muốn cho phép thêm domain khác gọi API.
- Nếu cần nhiều người dùng riêng biệt (tài khoản, lịch sử theo user), cần bổ sung lớp xác thực thật (JWT/session + database) — hiện tại quy tắc/lịch sử chỉ lưu cục bộ trên trình duyệt người dùng (`localStorage`), phù hợp cho dùng cá nhân/nhóm nhỏ.

## 5. Các cơ chế học tập

- **Trích nguồn từ tài liệu** (kiểu NotebookLM): nạp PDF/DOCX/TXT, AI chỉ dùng nguồn đang bật, trích dẫn `[1] [2]...` kèm đoạn văn bản gốc.
- **Đọc ảnh đề bài**: chụp/đính kèm ảnh (chữ viết tay hoặc đề in), AI đọc và giải trực tiếp.
- **Chế độ suy nghĩ sâu**: AI tự kiểm tra nhiều hướng, hiển thị khối "suy luận" có thể mở ra xem.
- **Vẽ đồ thị hàm số & hình học phẳng**: AI tự chèn minh họa khi cần (khảo sát hàm số, tam giác, đường tròn...).
- **Xuất slide PPT**: chuyển lời giải/bài học thành file `.pptx` có thiết kế nhất quán (dùng PptxGenJS, tạo hoàn toàn phía trình duyệt).
- **Flashcard ôn tập**: tạo bộ thẻ hỏi–đáp ngắn gọn, lật xem trực tiếp trong giao diện.
- **Quy tắc tự học**: người dùng tự đặt quy tắc riêng (VD: "luôn trình bày theo bước có đánh số"), AI ghi nhớ lâu dài (lưu trong `localStorage`).

## 6. API nội bộ (dùng bởi frontend)

| Endpoint | Method | Mô tả |
|---|---|---|
| `/api/health` | GET | Kiểm tra server còn sống |
| `/api/chat` | POST | Giải bài — nhận `query`, `deep`, `image`, `rules`, `contexts`, `settings`, `history` |
| `/api/generate/ppt-outline` | POST | Nhận `content` (văn bản lời giải), trả JSON dàn ý slide |
| `/api/generate/flashcards` | POST | Nhận `content`, trả JSON bộ flashcard |

Toàn bộ đều yêu cầu header `Content-Type: application/json`; nếu bật `APP_SHARED_KEY` thì cần thêm header `x-app-key`.

## 7. Deploy lên Vercel

Vercel là nền tảng **serverless** — nó không chạy `app.listen()` như server thường mà chỉ gọi các file trong thư mục `/api` khi có request tới. Dự án đã được cấu trúc sẵn cho việc này (`api/index.js` + `vercel.json`), bạn chỉ cần:

1. **Đẩy code lên GitHub** (hoặc GitLab/Bitbucket).
2. Vào [vercel.com](https://vercel.com) → **Add New → Project** → chọn repo này.
3. Vercel sẽ tự nhận diện (không cần chọn Framework Preset, để **"Other"** là được — không cần Build Command).
4. **Rất quan trọng — khai báo Environment Variables** trong phần cài đặt project (Settings → Environment Variables), điền y hệt các biến trong `.env.example`:
   - `ANTHROPIC_API_KEY` — **bắt buộc**, khóa API thật của bạn.
   - `ALLOWED_ORIGINS` — **không bắt buộc**. Server tự động cho phép domain Vercel đang phục vụ chính nó (kể cả domain preview đổi mỗi lần deploy), nên để trống là chạy được ngay. Chỉ điền vào đây nếu bạn muốn thêm một domain khác (vd. custom domain phụ) được phép gọi thẳng API.
   - `NODE_ENV=production`
   - Các biến còn lại (`RATE_LIMIT_CHAT`, `RATE_LIMIT_GENERATE`, `APP_SHARED_KEY`...) tùy chọn.
5. Nhấn **Deploy**. Sau khi xong, mở domain Vercel cấp và thử chat — request `/api/chat` giờ sẽ được `vercel.json` chuyển đúng vào `api/index.js`.

**Vì sao trước đây bị lỗi 404:** dự án gốc chỉ có `server/index.js` gọi `app.listen(PORT)` — cách chạy này chỉ hoạt động trên máy chủ "sống mãi" (VPS, Render, Railway...). Trên Vercel, vì không có thư mục `/api` và không có `vercel.json`, nền tảng không biết chạy code Express ở đâu, nên mọi request đều rơi vào trang lỗi 404 mặc định của chính Vercel.

**Về thời gian chờ:** các câu hỏi "chế độ suy nghĩ sâu" hoặc tạo slide/flashcard có thể mất hơn vài giây. `vercel.json` đã đặt `maxDuration: 60` (giây) cho function — đủ dùng cho cả gói Hobby (miễn phí) lẫn Pro. Nếu vẫn timeout với các yêu cầu rất phức tạp, cân nhắc giảm `maxTokens` trong `routes/chat.js`/`routes/generate.js` hoặc nâng gói Vercel.

## 8. Thêm tính năng mới trong tương lai

Nhờ tách `server/app.js` riêng khỏi phần khởi động server, việc thêm tính năng mới **không đòi hỏi động vào cấu hình Vercel** — chỉ cần code theo đúng khuôn Express bình thường:

**Thêm một API endpoint mới** (ví dụ: chấm điểm bài làm)
1. Tạo `server/routes/grade.js` theo khuôn của `chat.js`/`generate.js` (dùng `express.Router()`).
2. Trong `server/app.js`, thêm:
   ```js
   const gradeRoutes = require('./routes/grade');
   app.use('/api/grade', chatLimiter, gradeRoutes); // dùng lại rate-limiter có sẵn, hoặc tạo limiter riêng trong security.js
   ```
3. Deploy lại (`git push`) — Vercel tự build lại, route mới hoạt động ngay tại `/api/grade` mà **không cần sửa `vercel.json`** (vì rewrite `/api/:path*` đã bắt mọi đường dẫn con của `/api`).

**Thêm giao diện/chức năng phía frontend:** chỉ cần sửa `public/index.html`, `public/js/app.js`, `public/css/styles.css` như một trang tĩnh thông thường — không ảnh hưởng gì đến backend.

**Muốn có tài khoản người dùng / lưu lịch sử nhiều thiết bị:** cần thêm một database (Vercel Postgres, MongoDB Atlas, Supabase...) vì bản thân serverless function không lưu trạng thái giữa các lần gọi — đây là điểm khác biệt lớn nhất so với chạy server truyền thống, nên tránh dùng biến toàn cục trong `server/app.js` để lưu dữ liệu người dùng.

**Test trước khi deploy:** chạy `npm run dev` ở local để thử nhanh; muốn test đúng môi trường serverless như trên Vercel thật, cài `vercel` CLI (`npm i -g vercel`) rồi chạy `vercel dev` trong thư mục project.
