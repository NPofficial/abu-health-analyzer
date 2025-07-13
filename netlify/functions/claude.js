// netlify/functions/claude.js
const fetch = require('node-fetch');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': 'https://bright-paprenjak-c4b434.netlify.app/',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Only POST allowed' }) };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  if (typeof body.model !== 'string' || !Array.isArray(body.messages)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Need "model" string and "messages" array' }),
    };
  }

  // Приводим любые msg.content к строке
  const anthMessages = body.messages.map(m => {
    const content = typeof m.content === 'string'
      ? m.content
      : JSON.stringify(m.content);
    if (m.role === 'user')      return { user: content };
    if (m.role === 'assistant') return { assistant: content };
    throw new Error('Unknown role ' + m.role);
  });

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) {
    console.error('API key not set');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server misconfiguration' }) };
  }

  // Таймаут до 60 сек
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  let resp;
  try {
    resp = await fetch('https://api.anthropic.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-11-08',
      },
      body: JSON.stringify({ model: body.model, messages: anthMessages }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    console.error('Fetch timeout or error:', err);
    return { statusCode: 504, headers, body: JSON.stringify({ error: 'Upstream timeout' }) };
  } finally {
    clearTimeout(timeout);
  }

  let data;
  try { data = await resp.json(); }
  catch {
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'Invalid JSON from Claude' }) };
  }

  if (!resp.ok) {
    console.error('Claude API error:', data);
    return { statusCode: resp.status || 502, headers, body: JSON.stringify({ error: data.error || data }) };
  }

  // Два возможных поля в ответе
  const text = typeof data.completion === 'string'
    ? data.completion
    : data.choices?.[0]?.message?.content;

  if (!text) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Invalid response format', details: data }),
    };
  }

  return { statusCode: 200, headers, body: JSON.stringify({ completion: text.trim() }) };
};