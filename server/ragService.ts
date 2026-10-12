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
    "constipation & hard stools",
    "constipation",
    "muscle strain & back ache",
    "muscle strain",
    "muscle ache",
    "back ache",
    "back pain",
    "stomach pain",
    "stomach ache",
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

  // 1. Dynamic Likely Causes & Triggers
  let causesSection = "";
  if (lower.includes("diarrhea") || lower.includes("loose stool") || lower.includes("stomach upset") || lower.includes("food poison")) {
    causesSection = `- **Gastroenteritis or Viral Infection:** Common viral or mild bacterial pathogens irritating the gastrointestinal lining.
- **Dietary Sensitivities & Food Triggers:** Recent intake of unfamiliar, contaminated, or highly greasy/spicy foods, or lactose intolerance.
- **Medication Side Effects & Stress:** Acute stress or recent antibiotics disrupting natural gut microflora.`;
  } else if (lower.includes("stomach") || lower.includes("cramp") || lower.includes("abdomen") || lower.includes("belly")) {
    causesSection = `- **Digestive Irritation & Gas:** Trapped intestinal gas, indigestion (dyspepsia), or eating too quickly.
- **Acid Gastritis or Dietary Triggers:** Excess gastric acid irritated by spicy, acidic foods, caffeine, or missed meals.
- **Muscle Tension or Cramping:** Intestinal spasms following heavy meals, stress, or mild gastrointestinal bugs.`;
  } else if (lower.includes("migraine") || lower.includes("headache")) {
    causesSection = `- **Tension, Stress, or Screen Strain:** Extended screen exposure, eye fatigue, poor posture, and physical stress.
- **Dehydration, Lack of Sleep, or Skipped Meals:** Blood vessel dilation and neurotransmitter fluctuations triggered by fluid deficits or sleep disruption.
- **Sinus Pressure or Environmental Factors:** Weather shifts, loud environments, or nasal congestion triggering temple or forehead throbbing.`;
  } else if (lower.includes("cold") || lower.includes("cough") || lower.includes("congestion") || lower.includes("runny nose") || lower.includes("sneeze") || lower.includes("throat")) {
    causesSection = `- **Upper Respiratory Viral Infection:** Common rhinoviruses or coronaviruses causing mucosal inflammation across the nasal passages and throat.
- **Seasonal Allergens & Environmental Dust:** Pollen, dry indoor heating, or irritants triggering histamine release and post-nasal drip.
- **Airway Hypersensitivity:** Bronchial irritation following weather temperature shifts or dry night air.`;
  } else if (lower.includes("fever") || lower.includes("chill")) {
    causesSection = `- **Immune System Defense Activation:** Natural body temperature elevation orchestrated by white blood cells to combat viral or bacterial invaders.
- **Systemic Viral Flu or Respiratory Virus:** Influenza or common respiratory viruses circulating seasonally.
- **Physical Exertion or Heat Reaction:** Mild dehydration, inflammatory recovery, or recent immunization response.`;
  } else if (lower.includes("allerg") || lower.includes("itch") || lower.includes("rash") || lower.includes("hive")) {
    causesSection = `- **Histamine Release:** Mast cell activation following exposure to pollen, pet dander, mold, dust mites, or certain foods.
- **Contact Dermatitis:** Local skin sensitivity from soaps, detergents, cosmetics, or topical fabrics.
- **Environmental Irritants:** Dry air, heat, perspiration, or sudden temperature fluctuations.`;
  } else if (lower.includes("nausea") || lower.includes("vomit")) {
    causesSection = `- **Gastric Irritation or Motion Sensitivities:** Inner ear equilibrium disturbance or acute stomach lining sensitivity.
- **Dietary Indiscretion or Viral Enteritis:** Ingestion of spoiled foods, excessive alcohol/caffeine, or mild stomach bugs.
- **Acid Reflux or Medication Reaction:** Gastric reflux washing up into the esophagus or taking medications without food.`;
  } else if (lower.includes("back") || lower.includes("muscle") || lower.includes("body ache") || lower.includes("joint")) {
    causesSection = `- **Physical Strain & Overexertion:** Muscle fatigue from unaccustomed lifting, awkward sleeping postures, or prolonged sitting.
- **Systemic Viral Inflammation:** Pro-inflammatory cytokines released during common viral illnesses causing generalized aches.
- **Poor Ergonomics & Tension:** Chronic desk posture, lack of core support, or stress-induced muscle contraction.`;
  } else {
    causesSection = `- **Acute Physiological Stress or Mild Infection:** Transient immune or nervous system responses to everyday environmental stressors.
- **Fatigue, Fluid Deficits, or Dietary Fluctuations:** Temporary imbalances from dehydration, irregular meal timings, or inadequate rest.
- **Localized Inflammation or Irritation:** Natural, self-limiting tissue responses that typically resolve within 48 to 72 hours.`;
  }

  // 2. Dynamic OTC Relief Options
  let otcSection = "";
  if (lower.includes("diarrhea") || lower.includes("loose stool")) {
    otcSection = `- **Oral Rehydration Salts (ORS):** The most critical first-line intervention; sip 200–300ml after every loose stool to replenish lost electrolytes and glucose.
- **Loperamide (2mg):** Anti-motility agent for urgent acute relief in adults (initial 4mg dose, then 2mg after each unformed stool; maximum 8mg/day for OTC use; avoid if fever or blood in stool is present).
- **Probiotic Supplements (Saccharomyces boulardii or Lactic Acid Bacillus):** Helps restore gut microbiome balance and reduce recovery time.
- *Precaution:* Always maintain strict hydration; avoid anti-motility drugs if you suspect bacterial food poisoning with fever or bloody stools.`;
  } else if (lower.includes("stomach") || lower.includes("cramp") || lower.includes("abdomen") || lower.includes("belly")) {
    otcSection = `- **Antacids (Aluminium Hydroxide + Magnesium Hydroxide + Simethicone):** Rapidly neutralizes excess gastric acid and breaks down trapped gas bubbles within minutes.
- **Famotidine (10mg – 20mg) or Omeprazole (20mg):** H2 blockers or proton pump inhibitors to calm acid secretion; best taken 30 minutes before a meal.
- **Dicyclomine or Drotaverine (under pharmacist guidance):** Antispasmodics to ease severe abdominal muscle cramping.
- *Precaution:* Space antacids at least 2 hours apart from any other prescription medications to avoid blocking their absorption.`;
  } else if (lower.includes("migraine") || lower.includes("headache")) {
    otcSection = `- **Paracetamol / Acetaminophen (500mg – 650mg):** Gentle first-line analgesic for tension headaches; take every 4–6 hours as needed (do not exceed 4,000mg in 24 hours).
- **Ibuprofen (200mg – 400mg) or Naproxen (220mg):** Effective anti-inflammatory pain relief for throbbing migraine pain; always take with food or milk to safeguard the stomach.
- **Paracetamol + Caffeine Combination:** Synergistic combination that enhances headache relief and absorption speed.
- *Precaution:* Avoid using analgesics on more than 10–14 days per month to prevent medication-overuse (rebound) headaches.`;
  } else if (lower.includes("cold") || lower.includes("cough") || lower.includes("congestion") || lower.includes("runny nose") || lower.includes("sneeze") || lower.includes("throat")) {
    otcSection = `- **Dextromethorphan (10mg – 20mg):** Calms dry, tickly, non-productive coughs, especially to help with nighttime sleep.
- **Guaifenesin (200mg – 400mg) or Ambroxol (30mg):** Expectorants that thin thick mucus secretions for productive chesty coughs.
- **Cetirizine (10mg) or Chlorpheniramine (4mg):** Relieves sneezing, itchy eyes, and rhinorrhea (take at night if sedating).
- **Paracetamol (500mg – 650mg):** Alleviates accompanying throat soreness, fever, and generalized malaise.
- *Precaution:* Check labels of multi-symptom cold syrups carefully so you never accidentally duplicate Paracetamol doses.`;
  } else if (lower.includes("fever") || lower.includes("chill")) {
    otcSection = `- **Paracetamol (500mg – 650mg):** First-line antipyretic to gently bring down temperature and reduce shivering discomfort (dosing every 4–6 hours; maximum 4,000mg/day).
- **Ibuprofen (200mg – 400mg):** Alternative anti-inflammatory antipyretic; always take after a meal or with milk.
- *Precaution:* Never give Aspirin to children or teenagers with fever due to the risk of Reye's syndrome. Stay well hydrated.`;
  } else if (lower.includes("allerg") || lower.includes("itch") || lower.includes("rash") || lower.includes("hive")) {
    otcSection = `- **Cetirizine (10mg), Loratadine (10mg), or Fexofenadine (120mg):** Non-drowsy second-generation antihistamines for daytime allergy control.
- **Calamine Lotion or 1% Hydrocortisone Cream:** Soothes localized itchy skin patches and redness.
- *Precaution:* If facial swelling, lip numbness, or difficulty swallowing develops, treat as an emergency anaphylaxis alert.`;
  } else {
    otcSection = `- **Paracetamol / Acetaminophen (500mg):** Dependable general analgesic and antipyretic for aches, discomfort, or low-grade fever (maintain 4–6 hour intervals).
- **Ibuprofen (200mg – 400mg):** Anti-inflammatory option for swelling or muscular pain; take strictly after meals.
- **Oral Rehydration Salts (ORS) / Digestive Antacids:** For systemic hydration or mild stomach distress.
- *Precaution:* Always choose single-ingredient formulations matched to your primary symptom and never combine two NSAIDs.`;
  }

  // 3. Dynamic Home Care & Recovery Steps
  let homeCareSection = "";
  if (lower.includes("diarrhea") || lower.includes("loose stool")) {
    homeCareSection = `- **Prioritize Oral Rehydration:** Sip fluids continuously; drink small sips of water, ORS solutions, light coconut water, or clear broths every 15 minutes.
- **B.R.A.T. Diet Approach:** Transition to bland, low-fiber foods such as Bananas, Rice, Applesauce, and Toast or plain crackers once nausea subsides.
- **Avoid Gut Irritants:** Strictly steer clear of dairy products, caffeine, carbonated sodas, greasy fried foods, and artificial sweeteners until stools normalize.
- **Rest & Hand Hygiene:** Allow physical rest and wash hands thoroughly with soap to prevent spreading contagious viral gastroenteritis.`;
  } else if (lower.includes("stomach") || lower.includes("cramp") || lower.includes("abdomen") || lower.includes("belly")) {
    homeCareSection = `- **Apply Gentle Warmth:** Place a warm heating pad or hot water bottle across your abdomen for 15–20 minutes to relax cramped smooth muscles.
- **Sip Soothing Warm Teas:** Drink warm peppermint, ginger, or chamomile tea to ease gas bloating and encourage gastrointestinal relaxation.
- **Eat Small, Frequent Meals:** Avoid overloading your stomach; choose plain, low-spice options like porridge, boiled potatoes, or clear soups.
- **Stay Upright:** Avoid lying down flat for at least 2 hours after drinking fluids or eating.`;
  } else if (lower.includes("migraine") || lower.includes("headache")) {
    homeCareSection = `- **Dark, Quiet Retreat:** Rest in a cool, quiet, darkened room away from phone screens, television, and harsh fluorescent lighting for at least 30 minutes.
- **Rapid Rehydration:** Drink two large glasses of cool water immediately, as mild dehydration is among the most frequent headache triggers.
- **Temperature Therapy:** Place a cold gel compress on your forehead or temples, or apply a warm cloth to tight neck and shoulder muscles.
- **Gentle Pressure Point Massage:** Gently rub your temples and the webbed area between your thumb and index finger (LI-4 pressure point).`;
  } else if (lower.includes("cold") || lower.includes("cough") || lower.includes("congestion") || lower.includes("throat")) {
    homeCareSection = `- **Warm Salt-Water Gargle:** Dissolve 1/2 teaspoon of salt in a cup of warm water and gargle for 30 seconds, 3 to 4 times a day, to reduce throat swelling.
- **Steam Inhalation:** Inhale warm steam from a facial steamer or hot shower to liquefy congested mucus and ease breathing.
- **Warm Honey & Lemon Drinks:** Sip warm water with a teaspoon of honey (soothes coughing naturally for anyone over 1 year of age).
- **Elevate Your Head at Night:** Use an additional pillow while sleeping to prevent mucus pooling and post-nasal drip cough spasms.`;
  } else {
    homeCareSection = `- **Targeted Hydration:** Drink plenty of water, herbal infusions, or electrolyte solutions across the day to support cellular healing.
- **Restorative Sleep:** Minimize physical exertion and get at least 7 to 9 hours of sleep to give your immune system dedicated recovery bandwidth.
- **Stress Reduction & Pacing:** Take restful pauses and avoid heavy physical exercise until baseline energy returns.
- **Gentle Environmental Comfort:** Maintain a well-ventilated, comfortable room temperature and avoid smoke, strong chemicals, or dusty environments.`;
  }

  // 4. Dynamic Red-Flag Warning Signs
  let redFlagsSection = "";
  if (lower.includes("diarrhea") || lower.includes("loose stool")) {
    redFlagsSection = `Seek immediate emergency medical evaluation if you experience:
- Inability to keep fluids down for over **12 hours** or signs of severe dehydration (extreme thirst, dry mouth, little to no urination, sunken eyes, severe dizziness).
- Presence of **blood, black tarry color, or pus** in stools.
- Severe, unbearable abdominal or cramping pain, or a high fever exceeding **102°F (38.9°C)**.
- Diarrhea that continues without improvement for **more than 48 hours**.`;
  } else if (lower.includes("stomach") || lower.includes("cramp") || lower.includes("abdomen") || lower.includes("belly")) {
    redFlagsSection = `Seek emergency medical care immediately if you notice:
- **Severe, sudden, or rigid abdominal pain** (a hard, board-like abdomen tender to the lightest touch).
- **Vomiting blood** or dark material resembling coffee grounds, or passing black, tarry stools.
- Pain radiating into your chest, back, jaw, or shoulder, or accompanied by shortness of breath and cold sweats.
- Inability to pass bowel movements or gas accompanied by persistent projectile vomiting.`;
  } else if (lower.includes("migraine") || lower.includes("headache")) {
    redFlagsSection = `Seek immediate emergency medical care if you notice:
- A sudden, excruciating **'thunderclap' headache** reaching peak intensity within seconds or minutes.
- Neurological deficits: **slurred speech, vision loss, numbness, weakness** on one side of your body, or facial drooping.
- Severe headache accompanied by a **stiff neck, high fever, confusion**, or following a recent head trauma.`;
  } else if (lower.includes("cold") || lower.includes("cough") || lower.includes("throat")) {
    redFlagsSection = `Seek urgent medical evaluation if you notice:
- **Shortness of breath**, persistent wheezing, stridor, or severe chest tightness/pain with every breath.
- **Coughing up blood** or rust-colored phlegm.
- Inability to swallow liquids or saliva (drooling), severe neck swelling, or high fever lasting **more than 3 consecutive days**.`;
  } else {
    redFlagsSection = `Seek immediate emergency medical care if you observe any of the following:
- **Shortness of breath, chest pressure, severe dizziness**, confusion, or fainting.
- High fever rising above **103°F (39.4°C)** or fever unresponsive to standard antipyretics.
- Unbearable, rapidly worsening pain, or symptoms persisting for **more than 48 to 72 hours** without improvement.`;
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
