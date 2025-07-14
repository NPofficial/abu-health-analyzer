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

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (err) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid JSON" }),
    };
  }

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) {
    console.error("Anthropic API key not set");
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Server misconfiguration" }),
    };
  }

  // модель берём из ENV или из тела запроса, или дефолт
  const MODEL = process.env.CLAUDE_MODEL || body.model || "claude-3-opus";

  if (!Array.isArray(body.messages)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Need "messages": array' }),
    };
  }

  // Текст-подсказка для Claude
  const detailedPrompt = `Ты — эксперт по велнес-анализу и традиционной медицине, специализирующийся на оценке состояния здоровья по фото языка. 
Выполни следующие шаги:
1. 🔍 Детальный анализ: опиши цвет, текстуру, налет, форму, трещины и другие особенности языка.
2. 🗺️ Зональная диагностика: раздели язык на переднюю, среднюю, заднюю и боковые зоны, дай комментарий по каждой.
3. 🎯 Интерпретация: свяжи выявленные признаки с возможными состояниями организма, используя понятные термины и избегая окончательных диагнозов.
4. 💊 Рекомендации: предложи общие советы по питанию, образу жизни или БАДам.
5. 📈 Мониторинг: порекомендуй, когда и каким образом повторить снимок для отслеживания динамики.

**Структура ответа (строго в формате JSON):**
\`\`\`json
{
  "detailed_analysis": "текст",
  "zone_analysis": {
    "anterior": "текст",
    "middle": "текст",
    "posterior": "текст",
    "lateral": "текст"
  },
  "health_interpretation": "текст",
  "wellness_recommendations": [
    { "product": "название", "reason": "обоснование" }
  ],
  "monitoring": "текст"
}
\`\`\`

⚠️ Результаты не заменяют консультацию врача.`;

  // Готовим сообщения для Claude
  const claudeMessages = body.messages.map((m) => {
    if (m.role === "user" && typeof m.content === "string" && m.content.startsWith("data:image")) {
      // изображение в Base64
      const [prefix, base64Data] = m.content.split(";base64,");
      const mediaType = prefix.replace("data:", "");
      return {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: base64Data,
            },
          },
          {
            type: "text",
            text: detailedPrompt,
          },
        ],
      };
    }
    // обычное текстовое сообщение
    return m;
  });

  // Отправляем запрос в Claude
  let resp;
  try {
    resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,
        messages: claudeMessages,
      }),
    });
  } catch (err) {
    console.error("Claude API request error:", err);
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }

  const data = await resp.json();
  if (!resp.ok) {
    console.error("Claude API error:", data);
    return {
      statusCode: resp.status,
      headers,
      body: JSON.stringify(data),
    };
  }

  // В ответе ожидаем поле `completion`
  const completion = data.completion || (data.choices && data.choices[0]?.message?.content);
  if (!completion) {
    console.error("Invalid response format", data);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Invalid response format", details: data }),
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ completion: completion.trim() }),
  };
};
