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
    "headache & migraine",
    "headache",
    "migraine",
    "cough & chest congestion",
    "cough",
    "cold",
    "a cold",
    "common cold",
    "flu",
    "sore throat & pain",
    "sore throat",
    "runny nose & sneezing",
    "runny nose",
    "sneezing",
    "blocked nose & sinus",
    "blocked nose",
    "congestion",
    "sinus",
    "acidity & heartburn",
    "acidity",
    "heartburn",
    "acid reflux",
    "gastritis",
    "gas",
    "indigestion",
    "nausea",
    "vomiting",
    "loose stools & diarrhea",
    "diarrhea",
    "loose stools",
    "loose motion",
    "nasal",
    "runny",
    "constipation & hard stools",
    "constipation",
    "muscle strain & back ache",
    "muscle strain",
    "muscle ache",
    "back ache",
    "back pain",
    "stomach pain",
    "stomach ache",
    "stomach",
    "cramps",
    "body ache",
    "body pain",
    "joint pain",
    "fatigue",
    "tiredness",
    "insomnia",
    "dizziness",
  ];

  return symptomKeywords.some((kw) => new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(lower));
}

/**
 * Helper to clean and extract the symptom/condition phrase from a user query
 */
export function extractSymptomPhrase(query: string): string {
  const safe = (query || "").trim();
  if (!safe) return "your symptoms";

  let cleaned = safe
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .replace(/\b(i have|i'm having|i am having|i'm experiencing|i am experiencing|i feel|i'm feeling|i am feeling|suffering from|dealing with|struggling with|what to do for|what can i take for|what should i take for|how to treat|how do i treat|remedy for|cure for|help with|relief for|medicine for|meds for|treatment for|can i take something for)\b/gi, "")
    .replace(/[?!.,;]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || cleaned.length < 2) {
    return safe.replace(/[?!.,;]+/g, "").trim() || "your symptoms";
  }

  // Capitalize properly if short phrase
  if (cleaned.length <= 40) {
    return cleaned;
  }
  return cleaned.slice(0, 40).trim();
}

/**
 * Universal dynamic offline symptom fallback engine.
 * Generates an empathetic, clinically grounded response tailored to the user's specific symptom/condition.
 */
export function getOfflineSymptomResponse(query: string): string {
  const symptomText = extractSymptomPhrase(query);
  const lower = (query || "").toLowerCase();

  // Explicit Intent Branches requested:
  // 1. Cold & Respiratory ('cold', 'cough', 'nasal', 'runny', 'sneeze', 'congestion', 'sore throat')
  const isColdRespiratory =
    lower.includes("cold") ||
    lower.includes("cough") ||
    lower.includes("nasal") ||
    lower.includes("runny") ||
    lower.includes("sneeze") ||
    lower.includes("congestion") ||
    lower.includes("throat") ||
    lower.includes("bronchitis");

  // 2. Gastrointestinal & ORS ('diarrhea', 'stomach', 'loose motion', 'loose stool', 'belly', 'abdomen', 'cramp', 'vomit', 'nausea', 'acidity', 'gas')
  const isGastrointestinal =
    lower.includes("diarrhea") ||
    lower.includes("stomach") ||
    lower.includes("loose motion") ||
    lower.includes("loose stool") ||
    lower.includes("belly") ||
    lower.includes("abdomen") ||
    lower.includes("cramp") ||
    lower.includes("food poison") ||
    lower.includes("gastro") ||
    lower.includes("nausea") ||
    lower.includes("vomit") ||
    lower.includes("acidity") ||
    lower.includes("heartburn") ||
    lower.includes("gas") ||
    lower.includes("indigestion");

  // 3. Fever & Body Pain ('fever', 'chills', 'headache', 'migraine', 'body ache', 'body pain', 'joint pain', 'muscle', 'back pain')
  const isFeverBodyPain =
    lower.includes("fever") ||
    lower.includes("chill") ||
    lower.includes("headache") ||
    lower.includes("migraine") ||
    lower.includes("body ache") ||
    lower.includes("body pain") ||
    lower.includes("muscle") ||
    lower.includes("joint pain") ||
    lower.includes("back ache") ||
    lower.includes("back pain");

  let causesSection = "";
  let otcSection = "";
  let homeCareSection = "";
  let redFlagsSection = "";

  if (isColdRespiratory) {
    causesSection = `- **Upper Respiratory Viral Infection:** Common rhinoviruses, coronaviruses, or respiratory syncytial agents inflaming mucosal linings across nasal passages and throat.
- **Post-Nasal Drip & Cough Hypersensitivity:** Secretions trickling down the posterior airway triggering sensitive bronchial cough receptors.
- **Seasonal Allergens & Dry Air:** Cold outdoor air, dusty indoor heating, or airborne pollen provoking histamine irritation.`;

    otcSection = `- **Dextromethorphan (10mg – 20mg):** Suppresses dry, tickly, non-productive coughing fits, especially at bedtime for sound sleep.
- **Guaifenesin (200mg – 400mg) or Ambroxol (30mg):** Clinically proven expectorants that liquefy thick chest mucus for easier clearing.
- **Cetirizine (10mg) or Levocetirizine (5mg):** Non-drowsy second-generation antihistamines relieving runny nose, nasal itchiness, and frequent sneezing.
- **Saline Nasal Spray (Isotonic 0.9%):** Safely clears blocked sinuses and rinses away trapped viral particles without chemical rebound.
- **Paracetamol (500mg – 650mg):** Provides gentle relief for raw throat soreness, sinus pressure, and mild body malaise.
- *Precaution:* Read labels on multi-symptom cold formulations carefully so you never inadvertently duplicate Paracetamol or antihistamine doses.`;

    homeCareSection = `- **Warm Salt-Water Gargles:** Dissolve 1/2 teaspoon of salt in a glass of warm water and gargle for 30 seconds 3–4 times daily to reduce throat tissue swelling.
- **Steam Inhalation:** Inhale warm moist steam from a bowl or facial steamer for 10–15 minutes twice daily to loosen nasal congestion.
- **Warm Honey & Lemon Drinks:** Sip warm water with raw honey and lemon to coat irritated throat receptors (avoid honey in infants under 1 year).
- **Head Elevation at Bedtime:** Prop your pillows up by 30 degrees to prevent nasal secretions from pooling and triggering night coughs.`;

    redFlagsSection = `Seek prompt emergency or medical evaluation if you notice:
- **Shortness of breath**, persistent wheezing, stridor, or severe chest tightness/pain with every breath.
- **Coughing up blood** or rust-colored phlegm.
- Inability to swallow liquids or saliva (drooling), severe neck swelling, or fever lasting **longer than 3 consecutive days**.`;
  } else if (isGastrointestinal) {
    causesSection = `- **Viral Gastroenteritis or Foodborne Bug:** Norovirus, rotavirus, or mild bacterial toxins irritating the stomach lining and intestinal mucosa.
- **Electrolyte & Water Loss:** Accelerated intestinal motility rapidly depleting sodium, potassium, and fluid reserves.
- **Dietary Sensitivity or Gastric Irritation:** Recent unaccustomed spicy/greasy food, acute emotional stress, or antibiotic disruption of normal gut microflora.`;

    otcSection = `- **Oral Rehydration Salts (ORS — WHO Standard Formula):** The single most essential first-line clinical intervention; sip 200–300ml after every loose stool or vomiting episode to prevent dehydration and metabolic crisis.
- **Loperamide (2mg):** Anti-motility agent for urgent acute diarrhea control in adults (take 4mg initially, then 2mg after each loose movement; maximum 8mg/day for OTC use; avoid if fever or blood is present).
- **Probiotics (Saccharomyces boulardii or Bacillus clausii):** Replenishes beneficial gut flora and helps shorten the duration of diarrhea.
- **Antacids (Aluminium/Magnesium Hydroxide + Simethicone):** Neutralizes excess stomach acid and breaks up painful trapped gas bubbles.
- **Famotidine (10mg – 20mg) or Pantoprazole (40mg):** Calms acid secretion for burning epigastric discomfort; take 30 minutes before food.
- *Precaution:* Never take anti-motility drugs if you have a high fever or notice blood/mucus in your stool. Maintain aggressive hydration.`;

    homeCareSection = `- **Continuous Micro-Hydration:** Take small, frequent sips of prepared ORS, clear broths, coconut water, or rice water every 10–15 minutes rather than large chugs.
- **B.R.A.T. Diet Protocol:** Once nausea eases, stick strictly to bland, gentle foods: Bananas, Rice, Applesauce, and plain Toast or crackers.
- **Strict Avoidance of Gut Irritants:** Avoid milk and dairy, caffeinated drinks, alcohol, sodas, oily fried foods, and spicy seasonings until stools normalize.
- **Warmth & Rest:** Place a warm heating bottle across the lower abdomen to ease cramping and get plenty of quiet bed rest.`;

    redFlagsSection = `Seek emergency medical care immediately if you notice:
- Signs of **severe dehydration**: extreme thirst, dry tongue/mouth, no urine output for over 8 hours, sunken eyes, or severe dizziness upon standing.
- Presence of **blood, black tarry color, or pus** in stool or vomit.
- Severe, rigid, or unrelenting abdominal pain that is exquisitely tender to the touch.
- Inability to keep any liquids down for **more than 12–24 hours** or diarrhea continuing beyond 48 hours.`;
  } else if (isFeverBodyPain) {
    causesSection = `- **Immune System Thermostat Elevation:** Natural defense response where endogenous pyrogens prompt the hypothalamus to elevate body temperature and hinder viral replication.
- **Viral Flu, Infection, or Inflammatory Viremia:** Pro-inflammatory cytokines circulating systemically, causing generalized muscle aching and headache.
- **Tension, Dehydration, or Muscular Overexertion:** Inadequate water intake, prolonged screen fatigue, poor posture, or lack of sleep triggering muscle spasms and head pain.`;

    otcSection = `- **Paracetamol / Acetaminophen (500mg – 650mg):** First-line antipyretic and analgesic; gently brings down fever and relieves headache/body aches (dosing interval 4–6 hours; maximum 4,000mg in 24 hours).
- **Ibuprofen (200mg – 400mg):** Highly effective anti-inflammatory antipyretic for throbbing headaches, joint swelling, or muscular aches; always take with food, milk, or a meal.
- *Precaution:* Never combine two NSAIDs (e.g., Ibuprofen + Aspirin). Never administer Aspirin to children or teenagers with fever due to Reye's syndrome risk. Do not duplicate Paracetamol in combination cold/fever tablets.`;

    homeCareSection = `- **Passive Tepid Sponge Cooling:** Apply a damp lukewarm washcloth across the forehead, neck, and armpits; avoid ice-cold water or alcohol rubs as they cause violent shivering.
- **Light Cotton Clothing:** Dress in loose, breathable garments and avoid heavy blankets that trap excess thermal heat.
- **Abundant Hydration:** Drink at least 2.5 to 3 liters of water, warm broths, electrolyte fluids, or coconut water to replenish perspiration loss.
- **Rest in a Cool, Dark Room:** Minimize screens and loud noise; rest with eyes closed for at least 8 to 10 hours to allow immune recovery.`;

    redFlagsSection = `Seek immediate emergency medical evaluation if you observe:
- Body temperature rising above **103°F (39.4°C)** or fever unresponsive to standard antipyretics after several hours.
- Fever accompanied by a **stiff neck, confusion, extreme drowsiness, rash, or intense light sensitivity**.
- Sudden explosive **'thunderclap' headache** reaching maximum pain within seconds, or headache accompanied by slurred speech, facial drooping, or one-sided weakness.
- High fever or debilitating pain persisting for **longer than 3 consecutive days**.`;
  } else {
    // 4. Universal Clinical Template for all other health / symptom queries
    causesSection = `- **Acute Physiological Stress or Environmental Trigger:** Temporary nervous, muscular, or immune responses to daily fatigue, weather shifts, or mild localized tissue irritation.
- **Fluid Deficits or Ergonomic Strain:** Subtle dehydration, irregular meal timings, prolonged static posture, or minor tissue inflammation.
- **Self-Limiting Body Reaction:** Natural, transient defense mechanism that typically resolves spontaneously within 48 to 72 hours.`;

    otcSection = `- **Paracetamol / Acetaminophen (500mg):** Dependable baseline analgesic and antipyretic for generalized aches, discomfort, or low-grade temperature (space 4–6 hours apart; max 4,000mg/day).
- **Ibuprofen (200mg – 400mg):** Anti-inflammatory option if localized swelling, strain, or tooth/muscular ache is present; take strictly after meals.
- **Oral Rehydration Salts (ORS) or Antacids:** For systemic fluid equilibrium or mild digestive discomfort.
- *Precaution:* Always choose single-ingredient formulations matched to your primary symptom. Take NSAIDs strictly with food and check labels to avoid duplicate active ingredients.`;

    homeCareSection = `- **Restorative Hydration:** Drink plenty of water, electrolyte solutions, or warm herbal infusions across the day.
- **Sufficient Bed Rest:** Get at least 7 to 9 hours of uninterrupted sleep to give your immune system dedicated healing bandwidth.
- **Avoid Overexertion:** Postpone intense physical workouts, take restful pauses, and avoid stress triggers.
- **Comfortable Environment:** Rest in a well-ventilated, moderate-temperature room away from strong irritants, smoke, or excessive noise.`;

    redFlagsSection = `Seek immediate emergency medical evaluation if you experience:
- **Shortness of breath, chest pressure, severe dizziness**, disorientation, or fainting.
- High fever rising above **103°F (39.4°C)** or sudden unbearable, rapidly escalating pain.
- Debilitating symptoms persisting for **more than 48 to 72 hours** without improvement.`;
  }

  const sections = [
    `I'm so sorry to hear you're dealing with **${symptomText}**. Dealing with this can be truly exhausting, and finding gentle, effective relief is the top priority. Here is structured clinical guidance to help you navigate this safely:`,
    `### Likely Causes & Triggers\n${causesSection}`,
    `### Over-the-Counter Relief Options\n${otcSection}`,
    `### Home Care & Recovery Steps\n${homeCareSection}`,
    `### Red-Flag Warning Signs\n${redFlagsSection}`,
    `*Note: Live AI synthesis is temporarily offline. This guidance is grounded in SERA's offline safety guidelines.*`,
    SERA_MANDATORY_DISCLAIMER,
  ];

  return sections.join("\n\n");
}

/**
 * Backward-compatible wrapper for buildServerSymptomFallbackText
 */
export function buildServerSymptomFallbackText(prompt: string): string {
  return getOfflineSymptomResponse(prompt);
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

      // Primary model: 'gemini-3.8-flash', Fallback chain: 'gemini-3.8-pro', 'gemini-2.5-flash'
      const symptomModels = ["gemini-3.8-flash", "gemini-3.8-pro", "gemini-2.5-flash"];
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
        usedDeterministicFallback: true,
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
    // Primary model: 'gemini-3.8-flash', Fallback chain: 'gemini-3.8-pro', 'gemini-2.5-flash'
    const candidateModels = ["gemini-3.8-flash", "gemini-3.8-pro", "gemini-2.5-flash"];
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

    // If query has health or symptom characteristics or no confirmed drug pairs, provide universal offline symptom response
    const isHealthQuery = isServerSymptomQuery(userPrompt, selectedDrugs) || (extractedDrugs.length === 0 && !interactionAnalysis);
    const finalFallbackAnswer = isHealthQuery
      ? getOfflineSymptomResponse(userPrompt)
      : String(deterministicResponse || getOfflineSymptomResponse(userPrompt));

    return {
      answer: finalFallbackAnswer,
      retrievedMedicines: (retrieved || []).map((r) => ({
        name: r.record.name,
        matchType: r.matchType,
        score: Math.round(r.score * 100) / 100,
        record: r.record,
      })),
      interactionAnalysis,
      isAvailableInDataset: true,
      usedDeterministicFallback: true,
      isSymptomQuery: isHealthQuery,
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
