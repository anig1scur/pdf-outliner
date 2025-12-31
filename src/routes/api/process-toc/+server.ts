import {env} from '$env/dynamic/private';
import {GoogleGenerativeAI} from '@google/generative-ai';
import {error, json} from '@sveltejs/kit';
import {jsonrepair} from 'jsonrepair';
import OpenAI from 'openai';

const LIMIT_CONFIG = {
  MAX_REQUESTS_PER_DAY: 5,
  MAX_IMAGES: 10,
  MAX_TEXT_SIZE_KB: 128
};

const rateLimitStore = new Map<string, {count: number, date: string}>();

const SYSTEM_PROMPT_VISION = `
You are an expert PDF Table of Contents (ToC) parser.
Your task is to analyze one or more images of a ToC and convert it into a single, structured JSON array.

Follow these rules strictly:
1.  **VISUAL LITERALISM**: Look at the page number EXACTLY as printed in the image.
2.  **ROMAN NUMERAL BAN**:
    - If the page number in the image is a Roman numeral (e.g., i, ii, v, vii, ix, x), **DISCARD THE ENTIRE LINE**.
    - **DO NOT CONVERT** Roman numerals to Arabic numbers (e.g., never change 'vii' to 7).
    - If you see 'vii', the output for that line should be NOTHING (skip it).
3.  **ARABIC NUMERALS ONLY**: Only extract lines where the printed page number is a digit (0-9).
4.  Mentally stitch images together if multiple are provided.
5.  Analyze text and indentation to infer hierarchy (level 1, 2, etc.).
6.  The output MUST be a valid JSON array ONLY, no markdown.
    Format: [{"title": "String", "level": Number, "page": Number}]
7.  If unusable, return [].
`;

const SYSTEM_PROMPT_TEXT = `
You are an expert Table of Contents text parser.
Your task is to convert raw, unstructured ToC text (copied from websites like Amazon, Douban, etc.) into a structured JSON array.

Rules:
1.  **Extract Structure**: Identify the title, hierarchy level, and page number from each line.
2.  **Hierarchy**: Infer the 'level' (1, 2, 3) based on numbering (e.g., "1.", "1.1", "1.1.1") or indentation/symbols in the text.
3.  **Page Numbers**: Extract the page number at the end of the line.
4.  **ROMAN NUMERAL BAN**: If the page number is a Roman numeral (i, v, x), **DISCARD THE LINE**. Do not output it.
5.  **Clean Up**: Remove dots (.....) or dashes (----) typically found in ToCs.
6.  **JSON ONLY**: Return strictly a JSON array. No markdown.
    Format: [{"title": "String", "level": Number, "page": Number}]
`;

function getClientIp(request: Request): string {
  const headers = request.headers;
  const xForwardedFor = headers.get('x-forwarded-for');
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }

  return headers.get('x-real-ip') || headers.get('cf-connecting-ip') ||
      headers.get('x-vercel-forwarded-for') || 'unknown';
}

function determineProvider(request: Request, userProvider?: string): string {
  if (userProvider && userProvider !== 'auto') {
    return userProvider;
  }

  const country = request.headers.get('x-vercel-ip-country') ||
      request.headers.get('cf-ipcountry') ||
      request.headers.get('x-country-code');

  if (country === 'CN') {
    return 'qwen';
  }

  return (env.AI_PROVIDER || 'gemini').toLowerCase();
}

export async function POST({request}) {
  const origin = request.headers.get('origin');
  const allowedOrigins = [
    'https://tocify.aeriszhu.com', 'https://tocify.vercel.app',
    'http://localhost:5173', 'http://127.0.0.1:5173'
  ];

  if (origin && !allowedOrigins.includes(origin)) {
    return new Response('Forbidden: Invalid Origin', {status: 403});
  }

  const clientIp = getClientIp(request);

  if (clientIp !== 'unknown') {
    const today = new Date().toISOString().split('T')[0];
    const userRecord = rateLimitStore.get(clientIp);

    if (userRecord) {
      if (userRecord.date !== today) {
        rateLimitStore.set(clientIp, {count: 1, date: today});
      } else {
        if (userRecord.count >= LIMIT_CONFIG.MAX_REQUESTS_PER_DAY) {
          return new Response(
              JSON.stringify({
                error: 'Rate limit exceeded',
                message: `You have reached the daily limit of ${
                    LIMIT_CONFIG.MAX_REQUESTS_PER_DAY} requests.`
              }),
              {status: 429, headers: {'Content-Type': 'application/json'}});
        }
        userRecord.count++;
        rateLimitStore.set(clientIp, userRecord);
      }
    } else {
      rateLimitStore.set(clientIp, {count: 1, date: today});
    }

    if (rateLimitStore.size > 5000) {
      rateLimitStore.clear();
    }
  }

  try {
    const {images, text, apiKey, provider} = await request.json();

    if ((!images || !Array.isArray(images) || images.length === 0) &&
        (!text || typeof text !== 'string' || !text.trim())) {
      throw error(
          400,
          'Invalid request. Must provide either "images" array or "text" string.');
    }

    if (images && Array.isArray(images)) {
      if (images.length > LIMIT_CONFIG.MAX_IMAGES) {
        throw error(
            400,
            `Too many pages. Maximum allowed is ${LIMIT_CONFIG.MAX_IMAGES}.`);
      }
    }

    if (text && typeof text === 'string') {
      const byteLength = new TextEncoder().encode(text).length;
      const maxBytes = LIMIT_CONFIG.MAX_TEXT_SIZE_KB * 1024;

      if (byteLength > maxBytes) {
        throw error(
            400,
            `Text too large. Maximum allowed is ${
                LIMIT_CONFIG.MAX_TEXT_SIZE_KB}KB.`);
      }
    }

    const currentProvider = determineProvider(request, provider);
    // const currentProvider = `qwen`;
    const isTextMode = !!(text && text.trim());

    console.log(`[ToC Parser] Provider: ${currentProvider} | Mode: ${
        isTextMode ? 'TEXT' : 'VISION'} | IP: ${clientIp}`);

    let jsonText = '';

    if (currentProvider === 'qwen') {
      jsonText =
          await processWithQwen(isTextMode ? text : images, apiKey, isTextMode);
    } else {
      jsonText = await processWithGemini(
          isTextMode ? text : images, apiKey, isTextMode);
    }

    let rawString = jsonText.replace(/```json\n?|```/g, '').trim();

    const firstBracket = rawString.indexOf('[');
    if (firstBracket !== -1) {
      rawString = rawString.substring(firstBracket);
    }

    let tocData;
    try {
      tocData = JSON.parse(rawString);
    } catch (e) {
      console.warn(
          `[${currentProvider}] JSON strict parse failed, trying repair...`);
      try {
        const repaired = jsonrepair(rawString);
        tocData = JSON.parse(repaired);
      } catch (repairError) {
        console.error(`[${currentProvider}] JSON Repair failed:`, rawString);
        throw error(
            500,
            'AI returned invalid JSON structure that could not be repaired.');
      }
    }

    return json(tocData);

  } catch (err: any) {
    console.error('API Error:', err);
    throw error(
        err.status || 500,
        err.message || err.body.message ||
            'Failed to process ToC, please contact support.');
  }
}

async function processWithGemini(
    input: string[]|string, userKey?: string,
    isTextMode: boolean = false): Promise<string> {
  const apiKey = userKey || env.GOOGLE_API_KEY;

  if (!apiKey) {
    throw new Error('[Gemini] API Key is missing.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: isTextMode ? SYSTEM_PROMPT_TEXT : SYSTEM_PROMPT_VISION,
  });

  if (isTextMode) {
    const result = await model.generateContent([input as string]);
    return result.response.text();
  } else {
    const images = input as string[];
    const imageParts = images.map((img) => {
      const base64Data = img.includes('base64,') ? img.split(',')[1] : img;
      const mimeType = img.match(/data:(.*?);/)?.[1] || 'image/png';
      return {inlineData: {data: base64Data, mimeType: mimeType}};
    });

    const prompt =
        'Analyze these Table of Contents images and return the single structured JSON.';
    const result = await model.generateContent([prompt, ...imageParts]);
    return result.response.text();
  }
}

async function processWithQwen(
    input: string[]|string, userKey?: string,
    isTextMode: boolean = false): Promise<string> {
  const apiKey = userKey || env.DASHSCOPE_API_KEY;

  if (!apiKey) {
    throw new Error('[Qwen] API Key is missing.');
  }

  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  });

  if (isTextMode) {
    const response = await client.chat.completions.create({
      model: 'qwen-plus',
      messages: [
        {role: 'system', content: SYSTEM_PROMPT_TEXT},
        {role: 'user', content: input as string}
      ]
    });
    return response.choices[0].message.content || '[]';

  } else {
    const images = input as string[];
    const contentParts: any[] = [{
      type: 'text',
      text:
          'Analyze these Table of Contents images and return the single structured JSON.'
    }];

    images.forEach((img) => {
      let imageUrl = img;
      if (!img.startsWith('data:image/')) {
        imageUrl = `data:image/png;base64,${img}`;
      }
      contentParts.push({type: 'image_url', image_url: {url: imageUrl}});
    });

    const response = await client.chat.completions.create({
      model: 'qwen-vl-plus',
      messages: [
        {role: 'system', content: SYSTEM_PROMPT_VISION},
        {role: 'user', content: contentParts}
      ]
    });

    return response.choices[0].message.content || '[]';
  }
}
