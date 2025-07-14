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

  // Define the detailed prompt for Claude AI
  const detailedPrompt = `Ты — эксперт по велнес-анализу и традиционным методикам диагностики (например, ТКМ, Аюрведа), но НЕ медицинский диагност. Твоя задача — проанализировать изображение языка, предоставленное пользователем, и предоставить детальный велнес-анализ. \n\n**Важные аспекты для анализа:**\n*   **Цвет языка:** Опиши основной цвет языка (например, бледно-розовый, красный, пурпурный, бледный). Укажи на любые отклонения или необычные оттенки.\n*   **Налет:** Опиши цвет, толщину, влажность и распределение налета (например, тонкий белый, толстый желтый, жирный, сухой). Укажи, если налет отсутствует или неоднороден.\n*   **Форма и размер:** Опиши общую форму языка (например, нормальная, опухший, тонкий, заостренный). Укажи на отпечатки зубов по краям, трещины, язвы или другие аномалии.\n*   **Влажность:** Оцени, насколько язык влажный или сухой.\n*   **Подвижность:** (Если возможно по изображению) Отметь, выглядит ли язык расслабленным или напряженным.\n\n**Структура ответа (строго в формате JSON):**\n\
{\n  \"detailed_analysis\": \"[Твой детальный анализ на основе вышеуказанных аспектов. Описывай, что видишь, избегая медицинских терминов и диагнозов. Фокусируйся на велнес-интерпретации.]\",\n  \"zone_analysis\": {\n    \"Кончик языка (Сердце/Легкие)\": \"[Описание состояния этой зоны и возможные велнес-интерпретации]\",\n    \"Середина языка (Селезенка/Желудок)\": \"[Описание состояния этой зоны и возможные велнес-интерпретации]\",\n    \"Корень языка (Почки/Кишечник)\": \"[Описание состояния этой зоны и возможные велнес-интерпретации]\",\n    \"Боковые стороны языка (Печень/Желчный пузырь)\": \"[Описание состояния этой зоны и возможные велнес-интерпретации]\"\n  },\n  \"health_interpretation\": \"[Общая велнес-интерпретация состояния языка, основанная на традиционных методиках. Например, \\\\\\\'Язык выглядит сбалансированным, что может указывать на хорошее пищеварение.\\\\\\\']\",\n  \"wellness_recommendations\": [\n    {\n      \"product\": \"[Пример продукта/категории БАДа, например, \\\\\\\'Пробиотики\\\\\\']\",\n      \"reason\": \"[Краткое обоснование, почему этот продукт может быть полезен с велнес-точки зрения, например, \\\\\\\'для поддержания здоровой микрофлоры кишечника, что может быть связано с состоянием налета.\\\\\\\']\"\n    }\n  ],\n  \"monitoring\": \"[Рекомендации по дальнейшему мониторингу состояния языка и как часто следует делать новые снимки для отслеживания динамики.]\"\n}\n\
\n**Важные указания:**\n*   Всегда возвращай ответ в формате JSON, соответствующем указанной структуре.\n*   Избегай медицинских диагнозов и советов. Фокусируйся исключительно на велнес-анализе и рекомендациях, основанных на традиционных подходах.\n*   Если какая-то информация не видна на фото, укажи это (например, \\\\\\\'Налет не виден на данном изображении\\\\\\']).\n*   Будь максимально подробным в описании того, что видишь на изображении, используя термины, понятные для велнес-контекста.`;

  // Prepare messages for Claude API, handling image input
  const claudeMessages = body.messages.map(m => {
    if (m.role === "user" && m.content.startsWith("data:image")) {
      const [mimeType, base64Data] = m.content.split(";base64,");
      console.log("Received base64 data length:", base64Data.length); // Log the length of base64 data
      console.log("Received mime type:", mimeType); // Log the mime type
      // Optionally, log a snippet of the base64 data for inspection
      // console.log("Base64 data snippet:", base64Data.substring(0, 100)); 

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
            text: detailedPrompt,
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
        model: "claude-3-opus-20240229", // Using the general model name
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
