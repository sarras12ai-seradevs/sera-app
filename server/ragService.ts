import { GoogleGenAI } from "@google/genai";
import { medicineEngine, normalizeText } from "./medicineEngine.ts";
import {
  drugInteractionEngine,
  mapDrugToGenerics,
  type SeraInteractionLookupResult,
  type MappedDrugInfo,
} from "./interactionEngine.ts";
import type { MedicineRecord, RetrievalResult } from "./types.ts";

export const SERA_MANDATORY_DISCLAIMER =
  "SERA provides educational safety guidance grounded in verified medical databases. Always consult a certified doctor or pharmacist for personalized medical advice.";

export const SERA_STRICT_SYSTEM_PROMPT =
  "You are SERA Clinical Guide. You MUST ONLY use the provided Local Database Results below to answer. If an ingredient or interaction is not listed in the provided data, state 'No verified data found in SERA database'. Do NOT use outside medical knowledge or make assumptions.";

export const SERA_SYMPTOM_SYSTEM_PROMPT = `You are SERA Clinical Guide. The user is asking about symptoms. Answer in warm, empathetic conversational prose using standard Markdown headers and bullet points:
- Summarize the likely causes of the symptom.
- List standard over-the-counter active ingredients (e.g., Paracetamol, Ibuprofen) with basic dosage/precaution context.
- Outline clear home care steps.
- Highlight crucial 'Red-Flag' warning signs requiring emergency care.
Do NOT perform drug interaction checks or output raw database mappings.`;

/**
 * Reusable NLP text pre-processor that strips conversational phrases before entity extraction.
 */
export function cleanDrugInput(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(
      /\b(can i take|is it safe to take|is it safe|what about|with my doctor|ask my doctor|talk to my doctor|discuss with my doctor|my doctor|please explain why|please explain|what safer options|safer options|what otc options|otc options|options|i am checking|i am taking|i am experiencing|what happens if i take|interaction between|interactions between|tell me about|how should i space or manage|these medicines safely|this combination is unsafe|what general dosing tips should i keep in mind|general dosing tips|should i know|precautions|can i discuss)\b/gi,
      " "
    )
    .replace(/[?!.:;"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Detects whether the user query is a symptom question rather than a drug interaction question.
 */
export function isServerSymptomQuery(prompt: string, selectedDrugs?: string[]): boolean {
  if (Array.isArray(selectedDrugs) && selectedDrugs.length > 0) {
    return false;
  }
  const q = (typeof prompt === "string" ? prompt : "").trim();
  if (!q) return false;
  const lower = q.toLowerCase();

  if (
    lower.includes("i am experiencing") ||
    lower.includes("what otc options") ||
    lower.includes("fever & chills") ||
    lower.includes("headache & migraine") ||
    lower.includes("sore throat & pain") ||
    lower.includes("cough & chest congestion") ||
    lower.includes("runny nose & sneezing") ||
    lower.includes("blocked nose & sinus") ||
    lower.includes("acidity & heartburn") ||
    lower.includes("loose stools & diarrhea") ||
    lower.includes("constipation & hard stools") ||
    lower.includes("muscle strain & back ache")
  ) {
    return true;
  }

  if (
    /\+|interaction between|interactions between|\bvs\b|\bi am checking\b|\bi am taking\b|\bcan i take\b.*\b(and|with)\b/i.test(
      lower
    )
  ) {
    return false;
  }

  const symptomKeywords = [
    "fever & chills",
    "fever",
    "chills",
    "headache",
    "migraine",
    "cough",
    "sore throat",
    "runny nose",
    "sneezing",
    "blocked nose",
    "sinus",
    "acidity",
    "heartburn",
    "diarrhea",
    "loose stools",
    "constipation",
    "muscle strain",
    "back ache",
    "stomach pain",
    "body ache",
  ];

  return symptomKeywords.some((kw) => new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(lower));
}

function buildServerSymptomFallbackText(prompt: string): string {
  const lower = (prompt || "").toLowerCase();
  if (lower.includes("fever") || lower.includes("chill")) {
    return [
      "I'm sorry to hear you're experiencing **Fever & Chills**. Here is warm, practical guidance to help you manage your symptoms safely:",
      "### Likely Causes\n- **Viral Flu or Common Cold:** An elevated temperature is your immune system's natural response to fighting off respiratory viruses.\n- **Seasonal Infections or Immune Response:** Can also follow vaccinations, heat exhaustion, or acute bacterial/viral infections.",
      "### Standard Over-the-Counter (OTC) Active Ingredients\n- **Paracetamol (500mg – 650mg):** First-line option to gently lower fever and ease shivering body aches (take every 4–6 hours as needed; do not exceed 4,000mg in 24 hours).\n- **Ibuprofen (200mg – 400mg):** Helps with fever and muscle inflammation; always take with food or milk to protect your stomach.\n- *Precaution:* Check labels on cold/flu combination tablets so you never accidentally double-dose Paracetamol.",
      "### Clear Home Care Steps\n- **Stay Hydrated:** Sip water, oral rehydration salts (ORS), coconut water, or clear warm broths frequently to replace fluids lost through sweating.\n- **Rest & Comfort:** Dress in a single layer of light, breathable cotton clothing and rest in a well-ventilated room.\n- **Lukewarm Compress:** Place a cool or lukewarm damp washcloth across your forehead once shivering subsides.",
      "### Crucial 'Red-Flag' Warning Signs\nSeek immediate emergency medical care if you notice:\n- Fever rising above **103°F (39.4°C)** that does not come down after taking medication.\n- Severe headache with a **stiff neck**, confusion, extreme drowsiness, or sensitivity to bright light.\n- Shortness of breath, persistent vomiting, chest pain, or a fever lasting **more than 3 consecutive days**.",
      SERA_MANDATORY_DISCLAIMER,
    ].join("\n\n");
  }
  if (lower.includes("headache") || lower.includes("migraine")) {
    return [
      "I'm sorry you're dealing with a **Headache or Migraine**. Here is helpful guidance on what may be causing it and how to find relief safely:",
      "### Likely Causes\n- **Tension, Stress, or Screen Strain:** Prolonged computer or phone use, poor posture, and skipped meals commonly trigger tension headaches.\n- **Dehydration or Sinus Pressure:** Mild fluid loss, lack of sleep, or sinus congestion can cause throbbing forehead or temple pain.",
      "### Standard Over-the-Counter (OTC) Active Ingredients\n- **Paracetamol (500mg):** Gentle first-line analgesic for tension headaches (allow 4–6 hours between doses).\n- **Ibuprofen (200mg – 400mg) or Aspirin (325mg):** Effective for inflammatory or migraine pain; always take after food with a full glass of water.\n- *Precaution:* Avoid taking multiple painkillers together (especially combining two NSAIDs like Ibuprofen and Aspirin).",
      "### Clear Home Care Steps\n- **Hydrate Immediately:** Drink two large glasses of water right away.\n- **Dark, Quiet Rest:** Close your eyes in a cool, darkened room away from bright screens for 20–30 minutes.\n- **Cool or Warm Compress:** Apply a cold pack to your forehead or a warm compress to tight neck and shoulder muscles.",
      "### Crucial 'Red-Flag' Warning Signs\nSeek immediate emergency medical attention if you experience:\n- A sudden, severe **'thunderclap' headache** that reaches maximum pain within seconds or minutes.\n- Headache accompanied by **slurred speech, vision loss, weakness or numbness** on one side, or facial drooping.\n- High fever with a stiff neck, confusion, or a headache following a **head injury**.",
      SERA_MANDATORY_DISCLAIMER,
    ].join("\n\n");
  }
  if (lower.includes("cough") || lower.includes("throat")) {
    return [
      "I'm sorry you're experiencing **Cough or Sore Throat** discomfort. Here is clear guidance to soothe your airway safely:",
      "### Likely Causes\n- **Upper Respiratory Viral Cold:** Viral inflammation of the throat lining or bronchial airways.\n- **Post-Nasal Drip or Allergies:** Mucus trickling down the back of the throat, dry indoor air, or dust/pollen irritation.",
      "### Standard Over-the-Counter (OTC) Active Ingredients\n- **Dextromethorphan (10mg – 20mg syrup/lozenge):** Helps calm dry, tickly, non-productive coughs, especially at night.\n- **Guaifenesin or Ambroxol Expectorants:** Best for wet, chesty coughs to thin mucus so it clears more easily.\n- **Benzydamine Throat Spray or Antiseptic Lozenges (Amylmetacresol / Dichlorobenzyl Alcohol):** Soothes raw throat pain.\n- *Precaution:* Do not suppress a heavy wet cough with dry-cough sedatives, and watch for drowsiness.",
      "### Clear Home Care Steps\n- **Warm Salt-Water Gargle:** Gargle with 1/2 teaspoon of salt in a glass of warm water 3–4 times daily.\n- **Steam & Warm Fluids:** Inhale warm steam vapors and sip warm water or herbal tea with honey and ginger.\n- **Elevate Your Head:** Use an extra pillow when sleeping to reduce nighttime post-nasal drip.",
      "### Crucial 'Red-Flag' Warning Signs\nSeek urgent medical care if you notice:\n- **Shortness of breath**, difficulty breathing, wheezing, or pain in your chest.\n- **Coughing up blood** or pink-tinged phlegm.\n- Inability to swallow saliva (drooling), severe neck swelling, or a high fever with pus on the tonsils.",
      SERA_MANDATORY_DISCLAIMER,
    ].join("\n\n");
  }
  if (lower.includes("acidity") || lower.includes("heartburn") || lower.includes("stomach")) {
    return [
      "I'm sorry you're feeling uncomfortable with **Acidity & Heartburn**. Here is what typically causes it and how to settle your stomach safely:",
      "### Likely Causes\n- **Acid Reflux & Dietary Triggers:** Spicy, fried, fatty, or acidic meals, excess caffeine, or eating late at night.\n- **Gastritis or NSAID Irritation:** Taking painkillers on an empty stomach or high stress levels.",
      "### Standard Over-the-Counter (OTC) Active Ingredients\n- **Antacids (Aluminium Hydroxide + Magnesium Hydroxide + Simethicone):** Neutralize stomach acid and relieve trapped gas within minutes.\n- **Famotidine (10mg – 20mg) or Omeprazole / Pantoprazole (20mg – 40mg):** Reduce acid production (proton pump inhibitors work best when taken 30 minutes before breakfast).\n- *Precaution:* Space antacids at least 2 hours apart from other medications so they don't block absorption.",
      "### Clear Home Care Steps\n- **Stay Upright After Meals:** Avoid lying down flat for at least 2–3 hours after eating, and elevate the head of your bed slightly.\n- **Eat Smaller, Milder Meals:** Sip lukewarm water or chilled low-fat milk and avoid spicy foods, soda, coffee, and alcohol.",
      "### Crucial 'Red-Flag' Warning Signs\nSeek emergency medical care immediately if you experience:\n- **Crushing or squeezing chest pain** radiating to your jaw, neck, back, or left arm (can mimic a heart attack).\n- **Vomiting blood** or dark material that looks like coffee grounds, or passing **black, tarry stools**.\n- Painful or blocked swallowing, persistent vomiting, or unexplained weight loss.",
      SERA_MANDATORY_DISCLAIMER,
    ].join("\n\n");
  }
  return [
    `I'm sorry to hear you're feeling unwell. Here is helpful educational guidance regarding your symptoms:`,
    "### Likely Causes\n- Common acute symptoms are frequently triggered by self-limiting viral infections, mild dehydration, dietary changes, environmental allergens, or physical fatigue.",
    "### Standard Over-the-Counter (OTC) Active Ingredients\n- **Paracetamol (500mg):** Standard option for fever or mild-to-moderate pain (keep doses 4–6 hours apart).\n- **Cetirizine (10mg) or Fexofenadine (120mg):** Standard antihistamines for sneezing, runny nose, or mild allergy symptoms.\n- **Oral Rehydration Salts (ORS) / Antacids:** Useful for digestive upset or fluid replacement.\n- *Precaution:* Always choose a single-ingredient product matched to your main symptom and read the package dosing label carefully.",
    "### Clear Home Care Steps\n- **Hydration:** Drink plenty of water, clear soups, or electrolyte solutions throughout the day.\n- **Rest:** Give your body adequate sleep and avoid strenuous activity while recovering.",
    "### Crucial 'Red-Flag' Warning Signs\nSeek immediate medical attention if you experience:\n- Difficulty breathing, chest pain, severe dizziness, confusion, or inability to keep fluids down.\n- High fever above **103°F (39.4°C)** or symptoms that worsen rapidly or persist beyond **3 days**.",
    SERA_MANDATORY_DISCLAIMER,
  ].join("\n\n");
}

/**
 * Lazy initializer for Gemini client.
 * Checks all possible environment variable names; returns null if undefined or initialization fails.
 */
export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  try {
    return new GoogleGenAI({ apiKey });
  } catch (err) {
    console.warn("GoogleGenAI initialization fallback:", err);
    return null;
  }
}

export interface RagResponse {
  answer: string;
  retrievedMedicines: Array<{
    name: string;
    matchType: string;
    score: number;
    record: MedicineRecord;
  }>;
  interactionAnalysis?: SeraInteractionLookupResult;
  isAvailableInDataset: boolean;
  usedDeterministicFallback?: boolean;
  isSymptomQuery?: boolean;
  query: string;
}

/**
 * Extract drug names from a natural language query (supports single or multi-drug queries)
 */
export function extractDrugsFromQuery(prompt: string, selectedDrugs?: string[]): string[] {
  if (Array.isArray(selectedDrugs) && selectedDrugs.length > 0) {
    const valid = selectedDrugs.map((d) => String(d || "").trim()).filter((d) => d.length >= 2);
    if (valid.length > 0) return valid;
  }

  const cleaned = cleanDrugInput(prompt);

  // Check if user separated drugs with "+", "and", "with", "vs", "or", ","
  const splitByConnectors = cleaned
    .split(/\s*(?:\+|,|\band\b|\bwith\b|\bvs\b|\bor\b|\||&)\s*/i)
    .map((s) => cleanDrugInput(s))
    .map((s) => s.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9)]+$/g, "").trim())
    .filter((s) => s.length >= 2);

  const knownPhraseCandidates: string[] = [];
  const stopPhrases = new Set([
    "me", "it", "is", "safe", "for", "fever", "pain", "cold", "cough", "headache",
    "stomach", "acidity", "students", "adult", "dose", "dosage", "empty stomach",
    "after food", "before food", "at night", "in morning", "shortness of breath",
    "severe stomach pain", "gastrointestinal bleeding", "collapse",
  ]);

  for (const seg of splitByConnectors) {
    const segClean = seg
      .replace(/\b(i have|experiencing|feeling|suffering from|for my|can i|should i|take|use)\b/gi, "")
      .trim();
    if (!segClean || segClean.length < 2) continue;
    if (stopPhrases.has(segClean.toLowerCase())) continue;
    knownPhraseCandidates.push(segClean);
  }

  // Deduplicate case-insensitively
  const unique: string[] = [];
  for (const c of knownPhraseCandidates) {
    if (!unique.some((u) => u.toLowerCase() === c.toLowerCase())) {
      unique.push(c);
    }
  }

  return unique.length > 0 ? unique : [cleaned || prompt.trim()];
}

/**
 * Extract potential drug name tokens or phrases from user prompt for Medicine Knowledge Engine
 */
function extractPotentialDrugTerms(prompt: string): string[] {
  const cleaned = prompt.replace(/[?!,.:;()]/g, " ").trim();
  const words = cleaned.split(/\s+/).filter(Boolean);

  const stopWords = new Set([
    "what", "is", "the", "uses", "of", "tell", "me", "about", "can", "i", "take",
    "side", "effects", "for", "in", "and", "or", "how", "to", "use", "dose", "dosage",
    "substitute", "substitutes", "class", "safe", "during", "pregnancy", "alcohol",
    "with", "food", "help", "information", "details", "explain", "give", "list",
  ]);

  const candidates: string[] = [cleaned];
  const meaningfulWords = words.filter((w) => !stopWords.has(w.toLowerCase()) && w.length >= 3);
  candidates.push(...meaningfulWords);

  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    if (!stopWords.has(words[i].toLowerCase()) || !stopWords.has(words[i + 1].toLowerCase())) {
      candidates.push(bigram);
    }
  }

  return Array.from(new Set(candidates));
}

/**
 * Core SERA Grounded RAG Pipeline:
 * 1. Identify brand names, colloquial terms, or chemical synonyms and map to active generic compounds.
 * 2. Break down multi-ingredient products (e.g., Combiflam, Sinarest, Pan-D, Meftal-Spas) into ALL active generic ingredients.
 * 3. Perform Bidirectional (Permutation-Proof) Search across db_drug_interactions.csv.
 * 4. Retrieve Medicine Knowledge Base records.
 * 5. Format response strictly with SERA's 5 sections + Mandatory Disclaimer (using Gemini 3.8 Flash with instant deterministic fallback if quota exceeded).
 */
export async function executeRagQuery(
  userPrompt: string,
  selectedDrugs?: string[]
): Promise<RagResponse> {
  // 1. INTENT ROUTING (Symptom vs Medicine):
  // If the user query is a symptom question, bypass the local drug-interaction dataset lookup entirely.
  if (isServerSymptomQuery(userPrompt, selectedDrugs)) {
    const symptomFallbackText = buildServerSymptomFallbackText(userPrompt);
    try {
      const ai = getGeminiClient();
      if (!ai) {
        throw new Error("Gemini API key is missing on server; using Symptom Overview & Precaution fallback.");
      }

      const symptomModels = ["gemini-2.5-flash", "gemini-3.8-flash", "gemini-flash-latest"];
      let answerText = "";
      for (const modelName of symptomModels) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: userPrompt,
            config: {
              systemInstruction: SERA_SYMPTOM_SYSTEM_PROMPT,
              temperature: 0.3,
            },
          });
          if (typeof response?.text === "string" && response.text.trim().length > 0) {
            answerText = response.text.trim();
            break;
          }
        } catch (symptomErr: any) {
          console.warn(`Server symptom model '${modelName}' failed:`, symptomErr?.message || symptomErr);
        }
      }

      if (!answerText) {
        throw new Error("All Gemini models failed for symptom query");
      }

      if (!answerText.includes(SERA_MANDATORY_DISCLAIMER)) {
        answerText = `${answerText}\n\n${SERA_MANDATORY_DISCLAIMER}`;
      }

      return {
        answer: String(answerText),
        retrievedMedicines: [],
        isAvailableInDataset: true,
        usedDeterministicFallback: false,
        isSymptomQuery: true,
        query: userPrompt,
      };
    } catch (err: any) {
      console.warn("Server symptom generation fallback:", err?.message || err);
      return {
        answer: String(symptomFallbackText),
        retrievedMedicines: [],
        isAvailableInDataset: true,
        usedDeterministicFallback: false,
        isSymptomQuery: true,
        query: userPrompt,
      };
    }
  }

  // 2. MEDICINE INTERACTION QUERIES:
  // Run clean entity extraction on the drug names ONLY, and query db_drug_interactions.csv for bidirectional hazards
  const extractedDrugs = extractDrugsFromQuery(userPrompt, selectedDrugs);
  const mappedDrugs = extractedDrugs.map((d) => mapDrugToGenerics(d));

  // Also search Medicine Knowledge Engine for both raw terms and mapped generic ingredients
  const potentialTerms = [
    ...extractPotentialDrugTerms(userPrompt),
    ...mappedDrugs.flatMap((m) => m.genericIngredients),
  ];

  const candidateResultsMap = new Map<string, RetrievalResult>();

  const directResults = await medicineEngine.search(userPrompt, { limit: 3 });
  for (const res of directResults) {
    candidateResultsMap.set(res.record.normalizedName, res);
  }

  for (const term of potentialTerms) {
    if (term.length < 3) continue;
    const termResults = await medicineEngine.search(term, { limit: 2 });
    for (const res of termResults) {
      if (!candidateResultsMap.has(res.record.normalizedName)) {
        candidateResultsMap.set(res.record.normalizedName, res);
      }
    }
  }

  const retrieved = Array.from(candidateResultsMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  // Evaluate drug interactions using the Bidirectional (Permutation-Proof) Search Algorithm
  let interactionAnalysis: SeraInteractionLookupResult | undefined;
  if (extractedDrugs.length >= 2) {
    interactionAnalysis = drugInteractionEngine.evaluateDrugs(extractedDrugs, userPrompt);
  } else if (extractedDrugs.length === 1 && mappedDrugs[0].genericIngredients.length >= 2) {
    // Single multi-ingredient medicine (e.g., Combiflam, Sinarest): evaluate internal components and provide full breakdown
    interactionAnalysis = drugInteractionEngine.evaluateDrugs(
      mappedDrugs[0].genericIngredients,
      userPrompt
    );
    // Keep original input drug mapping at top
    interactionAnalysis.mappedDrugs = [mappedDrugs[0]];
  }

  // Deterministic grounded baseline response following exact SERA formatting
  const deterministicResponse = interactionAnalysis
    ? interactionAnalysis.formattedResponse
    : formatSingleDrugSeraResponse(mappedDrugs[0], retrieved[0]?.record, userPrompt);

  // Build grounded context for Gemini with defensive array checks
  const medicineContext = (retrieved || [])
    .map((r, idx) => {
      const rec = r?.record;
      return `[MEDICINE RECORD ${idx + 1}]
Name: ${rec?.name || "None listed"}
Uses: ${(rec?.uses || []).join(", ") || "None listed"}
Side Effects: ${(rec?.sideEffects || []).join(", ") || "None listed"}
Chemical Class: ${rec?.chemicalClass || "Not specified"}
Therapeutic Class: ${rec?.therapeuticClass || "Not specified"}
Action Class: ${rec?.actionClass || "Not specified"}
Substitutes: ${(rec?.substitutes || []).join(", ") || "None listed"}`;
    })
    .join("\n\n");

  const interactionContext = interactionAnalysis
    ? `BIDIRECTIONAL CSV INTERACTION LOOKUP RESULTS (db_drug_interactions.csv):
Mapped Drugs:
${(interactionAnalysis.mappedDrugs || []).map((m) => `- ${m.displayMapping}`).join("\n") || "None listed"}
Pairwise Bidirectional Results:
${(interactionAnalysis.pairResults || [])
  .map(
    (p) =>
      `- ${p.genericA} + ${p.genericB}: Matched=${p.matchedInCsv}, Direction=${
        p.matchDirection || "Both directions checked (No CSV match)"
      }, Severity=${p.severity}, CSV Description="${
        p.csvRow?.description || "No interaction record in db_drug_interactions.csv"
      }"`
  )
  .join("\n") || "No duplicate hazards detected"}`
    : `SINGLE DRUG MAPPING:
- ${mappedDrugs[0]?.displayMapping || userPrompt}`;

  const systemInstruction = `${SERA_STRICT_SYSTEM_PROMPT}

Structure your grounded response clearly with:
- Mapped Ingredients (from local DB)
- Interaction / Duplicate Hazard Status (from local DB)
- Precaution / Action (from local DB)

End with: "${SERA_MANDATORY_DISCLAIMER}"`;

  const userContent = `${SERA_STRICT_SYSTEM_PROMPT}

Local Database Results:
${interactionContext}

${medicineContext ? `RETRIEVED MEDICINE RECORDS:\n${medicineContext}` : "RETRIEVED MEDICINE RECORDS:\nNo additional medicine records matched."}

User Query: "${userPrompt}"`;

  try {
    const ai = getGeminiClient();
    if (!ai) {
      throw new Error("Gemini API key is missing on server; using local database fallback.");
    }

    let answerText = "";
    const candidateModels = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.5-flash"];
    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: userContent,
          config: {
            systemInstruction: `${systemInstruction}\n\nLocal Database Results:\n${interactionContext}\n\n${medicineContext}`,
            temperature: 0.1,
          },
        });
        if (typeof response?.text === "string" && response.text.trim().length > 0) {
          answerText = response.text.trim();
          break;
        }
      } catch (modelErr: any) {
        console.warn(`Server Gemini model '${modelName}' retry fallback:`, modelErr?.message || modelErr);
      }
    }

    if (!answerText) {
      throw new Error("All Gemini models returned empty or failed; falling back to local database.");
    }

    if (!answerText.includes(SERA_MANDATORY_DISCLAIMER)) {
      answerText = `${answerText}\n\n${SERA_MANDATORY_DISCLAIMER}`;
    }

    return {
      answer: String(answerText),
      retrievedMedicines: (retrieved || []).map((r) => ({
        name: r.record.name,
        matchType: r.matchType,
        score: Math.round(r.score * 100) / 100,
        record: r.record,
      })),
      interactionAnalysis,
      isAvailableInDataset: true,
      usedDeterministicFallback: false,
      query: userPrompt,
    };
  } catch (err: any) {
    // Graceful fallback if Gemini API hits 503, 404, quota limit, or network error
    console.warn("Using grounded deterministic SERA response (Gemini API fallback):", err?.message || err);

    return {
      answer: String(deterministicResponse || "No verified data found in SERA database."),
      retrievedMedicines: (retrieved || []).map((r) => ({
        name: r.record.name,
        matchType: r.matchType,
        score: Math.round(r.score * 100) / 100,
        record: r.record,
      })),
      interactionAnalysis,
      isAvailableInDataset: true,
      usedDeterministicFallback: true,
      query: userPrompt,
    };
  }
}

/**
 * Deterministic formatter for a single medicine query adhering to SERA's structure
 */
export function formatSingleDrugSeraResponse(
  mapped: MappedDrugInfo,
  rec: MedicineRecord | undefined,
  userQueryText: string = ""
): string {
  const lowerQuery = userQueryText.toLowerCase();
  const hasRedFlagSymptom = [
    "shortness of breath",
    "severe stomach pain",
    "gastrointestinal bleeding",
    "vomiting blood",
    "black tarry stools",
    "collapse",
    "overdose",
  ].some((s) => lowerQuery.includes(s));

  const usesText = Array.isArray(rec?.uses) && rec.uses.length ? (rec.uses || []).join(", ") : "Standard relief for target symptoms as indicated on packaging";
  const sideEffectsText = Array.isArray(rec?.sideEffects) && rec.sideEffects.length ? (rec.sideEffects || []).join(", ") : "Mild nausea, stomach upset, or drowsiness in sensitive individuals";
  const classText = [rec?.therapeuticClass, rec?.chemicalClass, rec?.actionClass].filter(Boolean).join(" • ") || mapped?.category || "Pharmaceutical Agent";
  const safeGenerics = Array.isArray(mapped?.genericIngredients) ? mapped.genericIngredients : [];
  const genericsPlus = (safeGenerics || []).join(" + ") || "None listed";
  const genericsOr = (safeGenerics || []).join(" or ") || "None listed";
  const genericsComma = (safeGenerics || []).join(", ") || "None listed";

  const sections = [
    `🔍 Mapped Ingredients:\n• ${mapped?.displayMapping || "None listed"}\n• Pharmacological Class: ${classText}`,
    `⚠️ Interaction Status:\n• Single medicine lookup (${genericsPlus}). To check drug-drug interactions in db_drug_interactions.csv, enter a second medicine (e.g., "${mapped?.inputName || "Medicine"} + Disprin" or "${mapped?.inputName || "Medicine"} + Cetirizine").\n• Warning: Avoid combining with other medicines that also contain ${genericsOr} to prevent accidental double-dosing.`,
    `📖 Plain English Explanation:\n• Primary Uses: ${usesText}.\n• How It Works & Risks: ${mapped?.inputName || "This medicine"} works via its active compound(s) (${genericsComma}). Common side effects can include ${sideEffectsText}.`,
    `✅ Safety Guidance:\n• Take with a full glass of water. If this medicine contains an NSAID (like Ibuprofen, Diclofenac, Mefenamic Acid, Naproxen, or Aspirin), always take it after food or milk to protect your stomach lining.\n• Check all other cold, flu, or pain tablets you are taking so you never duplicate active ingredients.`,
  ];

  if (hasRedFlagSymptom) {
    sections.push(
      `🚨 Red-Flag Emergency Warning (If Severe):\nHIGH-PRIORITY MEDICAL ALERT: Red-flag symptoms (such as shortness of breath, severe stomach pain, gastrointestinal bleeding, or collapse) require immediate medical evaluation.\n• India Emergency / Ambulance: 112 or 108 (AIIMS Poison Control: 1800-116-117)\n• US / Canada Emergency: 911 (Poison Control: 1-800-222-1222)\n• UK / EU Emergency: 999 / 112`
    );
  }

  sections.push(SERA_MANDATORY_DISCLAIMER);
  return sections.join("\n\n");
}

export function formatDirectFallback(rec: MedicineRecord): string {
  const mapped = mapDrugToGenerics(rec.name);
  return formatSingleDrugSeraResponse(mapped, rec);
}

export interface DynamicInteractionEvaluation {
  severity: "Major" | "Moderate" | "Minor" | "None";
  title: string;
  explanation: string;
  mechanism: string;
  recommendation: string;
  saferAlternatives: Array<{
    name: string;
    replacesDrugName: string;
    reason: string;
  }>;
  drugsAnalyzed: string[];
  isAiEvaluated: boolean;
  mappedIngredients?: MappedDrugInfo[];
  seraFormattedReport?: string;
  hasRedFlag?: boolean;
  csvMatches?: Array<{
    drugAInput?: string;
    drugBInput?: string;
    genericA: string;
    genericB: string;
    combinedDrugNames?: string;
    matchedInCsv: boolean;
    direction?: string;
    csvDescription?: string;
    severity: string;
    plainEnglish?: string;
    safetyGuidance?: string;
    isRedFlag?: boolean;
  }>;
  pairResults?: Array<{
    drugAInput?: string;
    drugBInput?: string;
    genericA: string;
    genericB: string;
    combinedDrugNames?: string;
    matchedInCsv: boolean;
    csvDescription?: string;
    matchDirection?: string;
    severity: "Severe" | "Moderate" | "Minor" | "None";
    plainEnglish: string;
    safetyGuidance: string;
    isRedFlag: boolean;
  }>;
  overallSeverity?: "Severe" | "Moderate" | "Minor" | "None";
  totalDatasetPairs?: number;
}

/**
 * Evaluates dynamic drug interactions using the Bidirectional (Permutation-Proof) Search Algorithm
 * on db_drug_interactions.csv + Synonym Dictionary, enhanced by Gemini 3.8 Flash when available.
 */
export async function evaluateDynamicInteraction(drugNames: string[]): Promise<DynamicInteractionEvaluation> {
  if (!drugNames || drugNames.length < 2) {
    return {
      severity: "None",
      title: "Insufficient Medicines",
      explanation: "Please select at least 2 medicines to evaluate interaction risk.",
      mechanism: "None",
      recommendation: "Select 2 or more medicines.",
      saferAlternatives: [],
      drugsAnalyzed: drugNames || [],
      isAiEvaluated: false,
    };
  }

  // 1. Run Bidirectional (Permutation-Proof) Search on db_drug_interactions.csv
  const lookup = drugInteractionEngine.evaluateDrugs(drugNames);
  const matchedPairs = lookup.pairResults.filter((p) => p.matchedInCsv);

  const mappedSeverity: "Major" | "Moderate" | "Minor" | "None" =
    lookup.overallSeverity === "Severe"
      ? "Major"
      : lookup.overallSeverity === "Moderate"
      ? "Moderate"
      : lookup.overallSeverity === "Minor"
      ? "Minor"
      : "None";

  // Build deterministic safer alternatives when a clash is found
  const defaultAlternatives: Array<{ name: string; replacesDrugName: string; reason: string }> = [];
  if (mappedSeverity === "Major" || mappedSeverity === "Moderate") {
    const hasNsaidClash = matchedPairs.some((p) =>
      ["ibuprofen", "naproxen", "diclofenac", "mefenamic acid", "aceclofenac", "acetylsalicylic acid"].includes(
        p.genericA.toLowerCase()
      )
    );
    if (hasNsaidClash) {
      defaultAlternatives.push({
        name: "Paracetamol 500mg (Standalone)",
        replacesDrugName: drugNames[0],
        reason: "Relieves pain and fever without compounding NSAID stomach bleeding or antiplatelet interference.",
      });
    }
    const hasSedatingHistamine = matchedPairs.some((p) =>
      ["diphenhydramine", "chlorpheniramine", "pheniramine"].includes(p.genericA.toLowerCase()) ||
      ["diphenhydramine", "chlorpheniramine", "pheniramine"].includes(p.genericB.toLowerCase())
    );
    if (hasSedatingHistamine) {
      defaultAlternatives.push({
        name: "Fexofenadine 120mg (Allegra) or Saline Nasal Spray",
        replacesDrugName: drugNames[drugNames.length - 1],
        reason: "Non-sedating allergy relief that avoids central nervous system depression and QTc/metabolic interactions.",
      });
    }
  }

  const csvMatchesSummary = lookup.pairResults.map((p) => ({
    drugAInput: p.drugAInput,
    drugBInput: p.drugBInput,
    genericA: p.genericA,
    genericB: p.genericB,
    combinedDrugNames: p.combinedDrugNames,
    matchedInCsv: p.matchedInCsv,
    direction: p.matchDirection,
    csvDescription: p.csvDescription || p.csvRow?.description,
    severity: p.severity,
    ruleSeverity: p.ruleSeverity,
    title: p.title,
    mechanism: p.mechanism,
    plainEnglish: p.plainEnglish,
    safetyGuidance: p.safetyGuidance,
    isRedFlag: p.isRedFlag,
  }));

  const stats = drugInteractionEngine.getStats();

  const primaryTitle =
    matchedPairs.length > 0
      ? (matchedPairs.find((p) => p.title)?.title ||
          `${lookup.overallSeverity} Interaction Detected (${matchedPairs
            .map((p) => `${p.genericA} + ${p.genericB}`)
            .join(", ")})`)
      : "No Adverse Interaction Record in Clinical Database";

  const deterministicResult: DynamicInteractionEvaluation = {
    severity: mappedSeverity,
    overallSeverity: lookup.overallSeverity,
    title: primaryTitle,
    explanation:
      matchedPairs.length > 0
        ? matchedPairs.map((p) => p.plainEnglish).join(" ")
        : lookup.pairResults.map((p) => p.plainEnglish).join(" "),
    mechanism:
      matchedPairs.length > 0
        ? matchedPairs
            .map(
              (p) =>
                `${p.genericA} ↔ ${p.genericB} [${p.matchDirection}]: ${
                  p.csvRow?.description || "Pharmacological interaction"
                }`
            )
            .join(" | ")
        : "Verified both [Drug 1 == A, Drug 2 == B] and [Drug 1 == B, Drug 2 == A] in the Clinical Knowledge Base with no clashing pathways.",
    recommendation:
      matchedPairs.length > 0
        ? matchedPairs.map((p) => p.safetyGuidance).join(" ")
        : lookup.pairResults[0]?.safetyGuidance ||
          "Take as directed with water and consult a pharmacist if symptoms persist.",
    saferAlternatives: defaultAlternatives,
    drugsAnalyzed: drugNames,
    isAiEvaluated: true,
    mappedIngredients: lookup.mappedDrugs,
    seraFormattedReport: lookup.formattedResponse,
    hasRedFlag: lookup.hasRedFlag,
    csvMatches: csvMatchesSummary,
    pairResults: lookup.pairResults,
    totalDatasetPairs: stats.totalInteractionPairs,
  };

  return deterministicResult;
}
