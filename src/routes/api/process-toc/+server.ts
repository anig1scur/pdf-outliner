import {env} from '$env/dynamic/private';
import {GoogleGenerativeAI} from '@google/generative-ai';
import {error, json} from '@sveltejs/kit';
import OpenAI from 'openai';

const SYSTEM_PROMPT = `
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

function determineProvider(request: Request): string {
  const country = request.headers.get('x-vercel-ip-country') ||
      request.headers.get('cf-ipcountry') ||
      request.headers.get('x-country-code');

  if (country === 'CN') {
    return 'qwen';
  }

  return (env.AI_PROVIDER || 'gemini').toLowerCase();
}

export async function POST({request}) {
  try {
    const {images} = await request.json();

    if (!images || !Array.isArray(images) || images.length === 0) {
      throw error(
          400,
          'Invalid request. Must be a JSON object with a non-empty "images" array.');
    }

    const currentProvider = determineProvider(request);

    console.log(`[ToC Parser] User Country Header detected: ${
        request.headers.get('x-vercel-ip-country') || 'Unknown'}`);
    console.log(`[ToC Parser] Using provider: ${currentProvider}`);

    let jsonText = '';

    if (currentProvider === 'qwen') {
      jsonText = await processWithQwen(images);
    } else {
      jsonText = await processWithGemini(images);
    }

    const cleanedJsonText = jsonText.replace(/```json\n?|```/g, '').trim();
    let tocData;

    try {
      tocData = JSON.parse(cleanedJsonText);
    } catch (e) {
      console.error(`[${currentProvider}] JSON Parse Error:`, cleanedJsonText);
      const match = cleanedJsonText.match(/\[.*\]/s);
      if (match) {
        tocData = JSON.parse(match[0]);
      } else {
        throw error(500, 'AI returned invalid JSON structure.');
      }
    }

    return json(tocData);

  } catch (err: any) {
    console.error('API Error:', err);
    throw error(err.status || 500, err.message || 'Failed to process ToC');
  }
}

async function processWithGemini(images: string[]): Promise<string> {
  if (!env.GOOGLE_API_KEY) {
    throw new Error('GOOGLE_API_KEY is not set.');
  }

  const genAI = new GoogleGenerativeAI(env.GOOGLE_API_KEY);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: SYSTEM_PROMPT,
  });

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

async function processWithQwen(images: string[]): Promise<string> {
  if (!env.DASHSCOPE_API_KEY) {
    throw new Error('DASHSCOPE_API_KEY is not set.');
  }

  const client = new OpenAI({
    apiKey: env.DASHSCOPE_API_KEY,
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  });

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
      {role: 'system', content: SYSTEM_PROMPT},
      {role: 'user', content: contentParts}
    ]
  });

  return response.choices[0].message.content || '[]';
}
