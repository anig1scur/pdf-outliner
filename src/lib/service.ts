import {GoogleGenerativeAI} from '@google/generative-ai';
import {jsonrepair} from 'jsonrepair';
import OpenAI from 'openai';

const LIMIT_CONFIG = {
  MAX_IMAGES: 10,
  MAX_TEXT_SIZE_KB: 128
};

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

export async function processToc(
    payload:
        {images?: string[]; text?: string; apiKey: string; provider: string;}) {
  const {images, text, apiKey, provider} = payload;

  if (!apiKey) {
    throw new Error('Please enter your API Key in Settings first.');
  }

  if ((!images || images.length === 0) && (!text || !text.trim())) {
    throw new Error('Invalid request. Must provide either images or text.');
  }

  if (images && images.length > LIMIT_CONFIG.MAX_IMAGES) {
    throw new Error(
        `Too many pages. Maximum allowed is ${LIMIT_CONFIG.MAX_IMAGES}.`);
  }

  const isTextMode = !!(text && text.trim());
  console.log(`[ToC Service] Provider: ${provider} | Mode: ${
      isTextMode ? 'TEXT' : 'VISION'}`);

  let jsonText = '';

  const currentProvider = provider === 'auto' || !provider ? 'qwen' : provider;

  if (currentProvider === 'qwen') {
    jsonText =
        await processWithQwen(isTextMode ? text! : images!, apiKey, isTextMode);
  } else if (currentProvider === 'zhipu') {
    jsonText = await processWithZhipu(
        isTextMode ? text! : images!, apiKey, isTextMode);
  } else {
    jsonText = await processWithGemini(
        isTextMode ? text! : images!, apiKey, isTextMode);
  }

  let rawString = jsonText.replace(/```json\n?|```/g, '').trim();
  const firstBracket = rawString.indexOf('[');
  if (firstBracket !== -1) {
    rawString = rawString.substring(firstBracket);
  }

  try {
    return JSON.parse(rawString);
  } catch (e) {
    console.warn(
        `[${currentProvider}] JSON strict parse failed, trying repair...`);
    try {
      const repaired = jsonrepair(rawString);
      return JSON.parse(repaired);
    } catch (repairError) {
      console.error(`[${currentProvider}] JSON Repair failed:`, rawString);
      throw new Error(
          'AI returned invalid JSON structure that could not be repaired.');
    }
  }
}

async function processWithGemini(
    input: string[]|string, apiKey: string,
    isTextMode: boolean): Promise<string> {
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
    input: string[]|string, apiKey: string,
    isTextMode: boolean): Promise<string> {
  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    dangerouslyAllowBrowser: true
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

async function processWithZhipu(
    input: string[]|string, userKey?: string,
    isTextMode: boolean = false): Promise<string> {
  const apiKey = userKey || env.ZHIPU_API_KEY;

  if (!apiKey) {
    throw new Error('[Zhipu] API Key is missing.');
  }

  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: 'https://open.bigmodel.cn/api/paas/v4/',
    dangerouslyAllowBrowser: true
  });

  const VISION_MODEL = 'glm-4v-flash';

  if (isTextMode) {
    const response = await client.chat.completions.create({
      model: 'glm-4-flash',
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

    try {
      const response = await client.chat.completions.create({
        model: VISION_MODEL,
        temperature: 0.1,
        messages: [
          {role: 'system', content: SYSTEM_PROMPT_VISION},
          {role: 'user', content: contentParts}
        ]
      });

      return response.choices[0].message.content || '[]';
    } catch (err: any) {
      console.error('[Zhipu Vision Error]', err);
      if (err.message && err.message.includes('context_length_exceeded')) {
        throw new Error(
            '图片总大小超出了智谱 Flash 模型的限制，请尝试减少图片数量或切换到付费模型 glm-4v');
      }
      throw err;
    }
  }
}