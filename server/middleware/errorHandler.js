'use strict';

function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Không tìm thấy endpoint.' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  if (status >= 500) {
    console.error('[LỖI SERVER]', err);
  }
  const payload = { error: err.message || 'Đã có lỗi xảy ra ở máy chủ.' };
  // Chỉ lộ thông tin chi tiết ngoài production để tiện debug, KHÔNG lộ stack trace ra client
  if (process.env.NODE_ENV !== 'production' && err.detail) {
    payload.detail = err.detail;
  }
  res.status(status).json(payload);
}

module.exports = { notFoundHandler, errorHandler };
