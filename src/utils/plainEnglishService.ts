import { GoogleGenAI } from "@google/genai";

/**
 * Service to simplify complex medical terminology into clear, accessible plain English
 * using Google Gemini when an API key is available.
 */
export async function translateToPlainEnglish(clinicalText: string): Promise<string> {
  const safeClinicalText = typeof clinicalText === "string" ? clinicalText : String(clinicalText || "");
  const apiKey =
    import.meta.env.VITE_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY;
  if (!apiKey || !safeClinicalText.trim()) {
    return safeClinicalText;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const models = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.5-flash"];

    for (const model of models) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: `Translate the following clinical medication guidance into simple, conversational plain English for everyday patients. Keep the safety warnings intact:

"${safeClinicalText}"`,
          config: {
            temperature: 0.1,
          },
        });

        if (typeof response?.text === "string" && response.text.trim().length > 0) {
          return response.text.trim();
        }
      } catch (modelErr) {
        console.warn(`Plain English translation model '${model}' fallback:`, modelErr);
      }
    }

    return safeClinicalText;
  } catch (err) {
    console.warn("Plain English translation fallback:", err);
    return safeClinicalText;
  }
}
