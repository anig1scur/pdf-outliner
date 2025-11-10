import { GoogleGenerativeAI } from "@google/generative-ai";
import { json, error } from '@sveltejs/kit';

import { GOOGLE_API_KEY } from '$env/static/private';

const API_KEY = GOOGLE_API_KEY;

if (!API_KEY) {
    throw new Error("GOOGLE_API_KEY is not set in .env or Vercel environment");
}

const genAI = new GoogleGenerativeAI(API_KEY);

const SYSTEM_PROMPT = `
You are an expert PDF Table of Contents (ToC) parser.
Your task is to analyze an image of a ToC page and convert it into a structured JSON array.

Follow these rules strictly:
1.  Analyze the text, indentation, and page numbers.
2.  Infer the hierarchy (level 1, level 2, etc.) based on indentation and text style.
3.  The page number MUST be an integer.
4.  The output MUST be a valid JSON array matching this format:
    [
      {"title": "Chapter Title", "level": 1, "page": 10},
      {"title": "Section Title", "level": 2, "page": 12}
    ]
5.  If the ToC is unusable or blank, return an empty array [].
`;


export async function POST({request}) {
  try {
    const {image} = await request.json();

    if (!image || !image.startsWith('data:image/')) {
      throw error(
          400, 'Invalid image data. Must be a base64 encoded image string.');
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-flash-latest",
      systemInstruction: SYSTEM_PROMPT,
    });

    const imagePart = {
      inlineData: {
        data: image.split(',')[1],
        mimeType: image.match(/data:(.*?);/)?.[1] || 'image/png'
      }
    };

    const prompt =
        'Analyze this Table of Contents image and return the structured JSON.';

    const result = await model.generateContent([prompt, imagePart]);
    const response = result.response;
    const aiText = response.text();

    const jsonText = aiText.replace(/```json\n|```/g, '').trim();

    let tocData;
    try {
      tocData = JSON.parse(jsonText);
    } catch (e) {
      console.error('Failed to parse JSON from AI:', aiText);
      throw error(500, 'AI returned invalid JSON structure.');
    }

    return json(tocData);

  } catch (err) {
    console.error(err);
    // @ts-expect-error - err might be an HttpError
    throw error(err.status || 500, err.message || 'Failed to process ToC');
  }
}