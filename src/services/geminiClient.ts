// Ensure it checks the VITE prefix properly:
export const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.warn("Gemini API key missing in environment! Falling back to local database mode.");
}

export * from "../utils/geminiClient";
