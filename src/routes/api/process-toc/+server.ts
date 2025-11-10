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
Your task is to analyze one or more images of a ToC and convert it into a single, structured JSON array.

Follow these rules strictly:
1.  You will receive one or more images. These images represent a *continuous* Table of Contents, in sequential order.
2.  Your job is to *mentally stitch them together* before parsing.
3.  Analyze the text, indentation, and page numbers.
4.  Infer the hierarchy (level 1, level 2, etc.) based on indentation and text style.
5.  The 'page' value MUST be an integer.

6.  **CRITICAL RULE:** Many books use Roman numerals (e.g., "ix", "xv") for front matter (like Forewords) and then *restart* numbering at "1" for the main content.
7.  This restart creates conflicting page numbers. Your job is to parse ONLY the main content that uses standard Arabic numerals (1, 2, 3, etc.).
8.  Therefore, you MUST IGNORE and SKIP all lines where the page number is a Roman numeral.

9.  The output MUST be a valid JSON array matching this format:
    [
      {"title": "Chapter Title", "level": 1, "page": 10},
      {"title": "Section Title", "level": 2, "page": 12}
    ]
10. If the ToC is unusable or blank, return an empty array [].
`;
// --- END MODIFICATION ---

export async function POST({ request }) {
    try {
        const { images } = await request.json();

        if (!images || !Array.isArray(images) || images.length === 0) {
            throw error(400, 'Invalid request. Must be a JSON object with a non-empty "images" array.');
        }

        const model = genAI.getGenerativeModel({
            model: "gemini-flash-latest",
            systemInstruction: SYSTEM_PROMPT,
        });

        const imageParts = images.map((img: string) => {
            if (!img.startsWith('data:image/')) {
                throw error(400, 'Invalid image data. Must be a base64 encoded image string.');
            }
            const base64Data = img.split(",")[1];
            const mimeType = img.match(/data:(.*?);/)?.[1] || 'image/png';

            return {
                inlineData: {
                    data: base64Data,
                    mimeType: mimeType
                }
            };
        });

        const prompt = "Analyze these Table of Contents images and return the single structured JSON.";

        const result = await model.generateContent([prompt, ...imageParts]);
        const response = result.response;
        const aiText = response.text();

        // Clean up potential markdown formatting
        const jsonText = aiText.replace(/```json\n|```/g, "").trim();

        let tocData;
        try {
            tocData = JSON.parse(jsonText);
        } catch (e) {
            console.error("Failed to parse JSON from AI:", aiText);
            throw error(500, 'AI returned invalid JSON structure.');
        }

        return json(tocData);

    } catch (err) {
        console.error(err);
        // @ts-expect-error - err might be an HttpError
        throw error(err.status || 500, err.message || 'Failed to process ToC');
    }
}