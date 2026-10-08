import { GoogleGenAI } from "@google/genai";

/**
 * Service to simplify complex medical terminology into clear, accessible plain English
 * using Google Gemini when an API key is available.
 */
export async function translateToPlainEnglish(clinicalText: string): Promise<string> {
  const apiKey =
    import.meta.env.VITE_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY;
  if (!apiKey || !clinicalText.trim()) {
    return clinicalText;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Translate the following clinical medication guidance into simple, conversational plain English for everyday patients. Keep the safety warnings intact:

"${clinicalText}"`,
      config: {
        temperature: 0.1,
      },
    });

    return response.text || clinicalText;
  } catch (err) {
    console.warn("Plain English translation fallback:", err);
    return clinicalText;
  }
}
