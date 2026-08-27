'use strict';

const express = require('express');
const router = express.Router();
const { callClaude } = require('../utils/anthropicClient');
const { buildPPTSystemPrompt, buildFlashcardSystemPrompt } = require('../utils/promptBuilder');
const { validateGenerateBody } = require('../utils/validators');

function parseJSONSafe(raw) {
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/```\s*$/, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const err = new Error('AI trả về dữ liệu không hợp lệ, vui lòng thử lại.');
    err.status = 502;
    throw err;
  }
}

router.post('/ppt-outline', async (req, res, next) => {
  try {
    const { content } = validateGenerateBody(req.body);
    const system = buildPPTSystemPrompt();
    const text = await callClaude({
      system,
      messages: [{ role: 'user', content: 'Nội dung cần chuyển thành slide:\n\n' + content }],
      maxTokens: 1400
    });
    res.json(parseJSONSafe(text));
  } catch (err) {
    next(err);
  }
});

router.post('/flashcards', async (req, res, next) => {
  try {
    const { content } = validateGenerateBody(req.body);
    const system = buildFlashcardSystemPrompt();
    const text = await callClaude({
      system,
      messages: [{ role: 'user', content: 'Nội dung cần tạo flashcard:\n\n' + content }],
      maxTokens: 1200
    });
    res.json(parseJSONSafe(text));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
