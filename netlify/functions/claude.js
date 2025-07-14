// netlify/functions/claude.js
const fetch = require("node-fetch");

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }
  // Только POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Only POST allowed" }),
    };
  }

  // Парсим JSON
  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid JSON" }),
    };
  }

  // Проверяем поля
  if (typeof body.model !== "string" || !Array.isArray(body.messages)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Need \"model\":string and \"messages\":array" }),
    };
  }

  // Ключ из ENV
  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) {
    console.error("API key not set");
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Server misconfiguration" }),
    };
  }

  // Таймаут 60 секунд
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  // Prepare messages for Claude API, handling image input
  const claudeMessages = body.messages.map(m => {
    if (m.role === "user" && m.content.startsWith("data:image")) {
      const [mimeType, base64Data] = m.content.split(";base64,");
      return {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType.replace("data:", ""),
              data: base64Data,
            },
          },
          {
            type: "text",
            text: "Analyze the tongue in this image for coating, color, cracks, and swelling. Provide personalized health recommendations and suggest relevant ABU supplements based on the findings. Format the response as a JSON object with fields: detailed_analysis, zone_analysis (object), health_interpretation, wellness_recommendations (array of objects with product and reason), and monitoring.",
          },
        ],
      };
    } else {
      return m;
    }
  });

  // Отправляем запрос в Claude
  let resp;
  try {
    resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01", // Confirmed API version
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet", // Using the general model name
        max_tokens: 4000, // Set a reasonable max_tokens
        messages: claudeMessages,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    console.error("Fetch timeout or error:", err);
    return {
      statusCode: 504,
      headers,
      body: JSON.stringify({ error: "Upstream timeout" }),
    };
  } finally {
    clearTimeout(timeout);
  }

  // Читаем ответ
  let data;
  try {
    data = await resp.json();
  } catch {
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: "Invalid JSON from Claude" }),
    };
  }

  // Ошибка от Claude
  if (!resp.ok) {
    console.error("Claude API error:", data);
    return {
      statusCode: resp.status || 502,
      headers,
      body: JSON.stringify({ error: data.error || data }),
    };
  }

  // Извлекаем текст
  let text;
  if (data.content && data.content.length > 0 && data.content[0].type === "text") {
    text = data.content[0].text;
  } else {
    console.error("Unexpected response format:", data);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Invalid response format", details: data }),
    };
  }

  // Успешный ответ
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ completion: text.trim() }),
  };
};
