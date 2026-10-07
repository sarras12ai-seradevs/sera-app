import { GoogleGenAI } from "@google/genai";

/**
 * Initializes and retrieves the Gemini API client using the configured environment variables.
 * Fallback logic checks VITE_GEMINI_API_KEY first, followed by GEMINI_API_KEY.
 */
export function getGeminiApiKey(): string | undefined {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
  return apiKey;
}

export function createGeminiClient(): GoogleGenAI | null {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

export const SERA_CLINICAL_SYSTEM_INSTRUCTION = `You are SERA (Safety, Education & Risk Awareness) — an expert clinical pharmacological guidance assistant for students and young adults.
Your duty:
1. Always emphasize safety, active generic ingredients, therapeutic classification, and dosage limits.
2. If multiple medicines are asked about, check for adverse interactions, QTc prolongation, duplicate ingredient stacking (e.g. Paracetamol toxicity), and bleeding risks.
3. Be clear, empathetic, and objective.
4. Always conclude with: "SERA provides educational safety guidance grounded in verified medical databases. Always consult a certified doctor or pharmacist for personalized medical advice."`;

/**
 * Direct client-side Gemini generation for static hosting deployments (e.g., Netlify).
 */
export async function queryGeminiDirect(prompt: string, contextSnippet?: string): Promise<string> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key is not configured. Please set VITE_GEMINI_API_KEY in your environment.");
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  const fullPrompt = contextSnippet
    ? `Context from SERA Medical Knowledge Base:\n${contextSnippet}\n\nUser Question: ${prompt}`
    : prompt;

  const response = await ai.models.generateContent({
    model: "gemini-3.8-flash",
    contents: fullPrompt,
    config: {
      systemInstruction: SERA_CLINICAL_SYSTEM_INSTRUCTION,
      temperature: 0.2,
    },
  });

  return (
    response.text ||
    "SERA was unable to generate a response. Please consult a qualified healthcare provider."
  );
}
