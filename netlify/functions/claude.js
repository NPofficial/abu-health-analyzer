// netlify/functions/claude.js
const fetch = require('node-fetch');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': 'https://YOUR_DOMAIN.netlify.app', // ← замени на свой
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  // Разрешаем только POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Only POST allowed' }),
    };
  }

  // Парсим тело запроса
  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid JSON in request body' }),
    };
  }

  // Проверяем обязательные поля
  if (typeof body.model !== 'string' || !Array.isArray(body.messages)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: 'Request must include "model" (string) and "messages" (array)',
      }),
    };
  }

  // Берём ключ из окружения
  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) {
    console.error('Anthropic API key is not set');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server misconfiguration' }),
    };
  }

  // Таймаут 60 секунд
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
      body: JSON.stringify({
        model: body.model,
        messages: body.messages,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    console.error('Fetch error or timeout:', err);
    return {
      statusCode: 504,
      headers,
      body: JSON.stringify({ error: 'Upstream request timed out' }),
    };
  } finally {
    clearTimeout(timeout);
  }

  const data = await resp.json();

  // Обрабатываем оба формата ответа от Claude
  let text;
  if (typeof data.completion === 'string') {
    // старый /v1/messages endpoint
    text = data.completion;
  } else if (data.choices && data.choices[0]?.message?.content) {
    // новый /v1/chat/completions
    text = data.choices[0].message.content;
  } else {
    console.error('Unexpected Claude API response format:', data);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Invalid response from Claude API',
        details: data,
      }),
    };
  }

  // Возвращаем результат
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ completion: text.trim() }),
  };
};