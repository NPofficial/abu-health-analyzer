// netlify/functions/claude.js
const fetch = require('node-fetch');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*', // или поставь свой домен
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

  // Парсим тело
  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid JSON' }),
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

  // Конвертируем messages из {role,content} в {user,assistant}
  let anthMessages;
  try {
    anthMessages = body.messages.map((msg) => {
      if (msg.role === 'user') {
        if (typeof msg.content !== 'string') throw new Error('User message must be a string');
        return { user: msg.content };
      }
      if (msg.role === 'assistant') {
        if (typeof msg.content !== 'string') throw new Error('Assistant message must be a string');
        return { assistant: msg.content };
      }
      throw new Error(`Unknown role: ${msg.role}`);
    });
  } catch (err) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }

  // Берём ключ из окружения
  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) {
    console.error('API key not set');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server misconfiguration' }),
    };
  }

  // Таймаут 60 секунд
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  // Вызываем Claude API
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
        messages: anthMessages,
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

  // Читаем JSON-ответ
  let data;
  try {
    data = await resp.json();
  } catch (err) {
    console.error('Invalid JSON from Claude:', err);
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: 'Invalid JSON from Claude API' }),
    };
  }

  // Если Claude вернул ошибку
  if (!resp.ok) {
    console.error('Claude API error:', data);
    return {
      statusCode: resp.status || 502,
      headers,
      body: JSON.stringify({ error: data.error || data }),
    };
  }

  // Извлекаем текст ответа
  let text;
  if (typeof data.completion === 'string') {
    text = data.completion;
  } else if (data.choices?.[0]?.message?.content) {
    text = data.choices[0].message.content;
  } else {
    console.error('Unexpected Claude response format:', data);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Invalid response from Claude API', details: data }),
    };
  }

  // Возвращаем клиенту
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ completion: text.trim() }),
  };
};