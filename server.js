import express from 'express';
import dotenv from 'dotenv';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);
const groqApiKey = process.env.GROQ_API_KEY;
const visionModel = process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';
const chatModel = process.env.GROQ_CHAT_MODEL || 'llama-3.3-70b-versatile';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, 'dist');
const indexPath = path.join(distDir, 'index.html');

app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
});

const callGroq = async ({ model, messages, response_format }) => {
  if (!groqApiKey) {
    throw new Error('GROQ_API_KEY is not set.');
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${groqApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      max_completion_tokens: 1024,
      top_p: 1,
      response_format,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error (${response.status}): ${errorText}`);
  }

  return response.json();
};

const createFallbackChatReply = (messages) => {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user')?.content ?? '';
  const text = latestUserMessage.toLowerCase();

  if (/(toxic|hazard|battery|chemical|medicine|paint|oil)/.test(text)) {
    return 'Keep it separate from regular trash, do not mix it with recyclables, and take it to a hazardous-waste drop-off or local collection point if available.';
  }

  if (/(plastic|bottle|container|packaging)/.test(text)) {
    return 'Rinse it first, check the recycling symbol, and place it in the plastic recycling stream only if your local area accepts that type of plastic.';
  }

  if (/(glass|jar|bottle)/.test(text)) {
    return 'Glass is usually recyclable if it is clean and empty. Remove any caps or lids and place it in the glass recycling bin if your city accepts glass separately.';
  }

  if (/(paper|cardboard|box|newspaper|tissue)/.test(text)) {
    return 'Clean paper and cardboard usually go into recycling. Keep them dry, flatten boxes, and avoid greasy or food-soiled pieces.';
  }

  if (/(food|organic|fruit|vegetable|compost)/.test(text)) {
    return 'Food scraps and other organic waste should go to compost if available. Keep plastics and other contaminants out of the compost bin.';
  }

  if (/(metal|can|aluminum|tin)/.test(text)) {
    return 'Metal cans and aluminum items are usually recyclable after rinsing. Empty them fully and follow your local metal recycling rules.';
  }

  return 'I can help sort waste, explain recyclability, and suggest safe disposal steps. Share the item type or upload another image for a more specific answer.';
};

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', provider: 'groq' });
});

app.post('/api/analyze', async (req, res) => {
  try {
    const { image } = req.body ?? {};

    if (typeof image !== 'string' || !image.startsWith('data:image/')) {
      res.status(400).json({ error: 'A base64 image data URL is required.' });
      return;
    }

    const completion = await callGroq({
      model: visionModel,
      messages: [
        {
          role: 'system',
          content: 'You are a waste-segregation expert. Return only valid JSON with the keys detected_class, description, toxicity, and disposal.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analyze this item for waste sorting. Use short, practical language and classify it by the most likely material.',
            },
            {
              type: 'image_url',
              image_url: { url: image },
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
    });

    const rawContent = completion?.choices?.[0]?.message?.content ?? '{}';
    const parsedContent = JSON.parse(rawContent.replace(/^```json\s*/i, '').replace(/```$/g, '').trim());

    res.json({
      detected_class: parsedContent.detected_class ?? 'Unknown',
      description: parsedContent.description ?? 'No description returned by the model.',
      toxicity: parsedContent.toxicity ?? 'Unknown',
      disposal: parsedContent.disposal ?? 'No disposal guidance returned by the model.',
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to analyze the image.',
    });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];

    if (messages.length === 0) {
      res.status(400).json({ error: 'messages is required.' });
      return;
    }

    const normalizedMessages = messages
      .filter((message) => message && typeof message.content === 'string' && (message.role === 'user' || message.role === 'assistant'))
      .map((message) => ({ role: message.role, content: message.content }));

    const completion = await callGroq({
      model: chatModel,
      messages: [
        {
          role: 'system',
          content: 'You are EcoBot, a concise assistant for waste segregation, recycling, composting, and safe disposal advice.',
        },
        ...normalizedMessages,
      ],
    });

    res.json({
      reply: completion?.choices?.[0]?.message?.content ?? 'I could not generate a reply.',
    });
  } catch (error) {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];

    res.json({
      reply: createFallbackChatReply(messages),
      warning: error instanceof Error ? error.message : 'Failed to generate a chat response.',
    });
  }
});

if (existsSync(indexPath)) {
  app.use(express.static(distDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      next();
      return;
    }

    res.sendFile(indexPath);
  });
}

app.listen(port, () => {
  console.log(`EcoVision API server running on http://127.0.0.1:${port}`);
});