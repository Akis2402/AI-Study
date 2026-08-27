'use strict';

const express = require('express');
const router = express.Router();
const { callClaude } = require('../utils/anthropicClient');
const { buildChatSystemPrompt } = require('../utils/promptBuilder');
const { validateChatBody } = require('../utils/validators');

router.post('/', async (req, res, next) => {
  try {
    const input = validateChatBody(req.body);

    // System prompt LUÔN được server tự dựng lại từ dữ liệu đã kiểm duyệt —
    // client không có cách nào tự ý thay đổi vai trò/hành vi của AI (chống prompt injection ở tầng hệ thống).
    const system = buildChatSystemPrompt(input);

    const userContent = [];
    if (input.image) {
      userContent.push({
        type: 'image',
        source: { type: 'base64', media_type: input.image.mediaType, data: input.image.base64 }
      });
    }
    userContent.push({
      type: 'text',
      text: input.query || 'Hãy đọc kỹ và giải chi tiết bài tập có trong hình ảnh này.'
    });

    const messages = [
      ...input.history.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: userContent }
    ];

    const text = await callClaude({
      system,
      messages,
      maxTokens: input.deep ? 2000 : 1000
    });

    res.json({ text });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
