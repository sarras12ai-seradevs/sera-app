import { GoogleGenAI } from "@google/genai";
import { fetchAndParseDdiDataset, getCachedDdiRecords, InteractionRecord } from "./ddiDatasetLoader";
import {
  evaluateBasketInteractions,
  extractActiveGenerics,
  cleanDrugInput,
  extractCleanDrugEntities,
} from "./interactionEngine";
import { allMedicines } from "../data/medicinesData";
import { symptomsData } from "../data/symptomsData";
import type { ParsedClientMedicineRecord } from "../context/DatasetContext";

export { cleanDrugInput, extractCleanDrugEntities };

export const GEMINI_PRIMARY_MODEL = "gemini-1.5-flash";
export const GEMINI_FALLBACK_MODEL = "gemini-1.5-pro";
export const GEMINI_SYMPTOM_MODEL = "gemini-2.5-flash";
export const GEMINI_CLIENT_MODEL = GEMINI_PRIMARY_MODEL;

export const SERA_STRICT_SYSTEM_PROMPT =
  "You are SERA Clinical Guide. You MUST ONLY use the provided Local Database Results below to answer. If an ingredient or interaction is not listed in the provided data, state 'No verified data found in SERA database'. Do NOT use outside medical knowledge or make assumptions.";

export const SERA_SYMPTOM_SYSTEM_PROMPT = `You are SERA Clinical Guide. The user is asking about symptoms. Answer in warm, empathetic conversational prose using standard Markdown headers and bullet points:
- Summarize the likely causes of the symptom.
- List standard over-the-counter active ingredients (e.g., Paracetamol, Ibuprofen) with basic dosage/precaution context.
- Outline clear home care steps.
- Highlight crucial 'Red-Flag' warning signs requiring emergency care.
Do NOT perform drug interaction checks or output raw database mappings.`;

export const SERA_CLINICAL_SYSTEM_INSTRUCTION = SERA_STRICT_SYSTEM_PROMPT;

export interface SymptomOverviewFallback {
  symptomName: string;
  category: string;
  overview: string;
  otcOptions: string[];
  homeCarePrecautions: string[];
  redFlagWarnings: string[];
}

export interface LocalRagFallbackData {
  query: string;
  hasVerifiedData: boolean;
  isFallback: boolean;
  isSymptomQuery?: boolean;
  symptomOverview?: SymptomOverviewFallback;
  ingredients: string[];
  hazards: string[];
  precautions: string[];
  mappedIngredients: string[];
  interactionHazardStatus: string[];
  precautionAction: string[];
  rawDatabaseObject: {
    mappedIngredients: Array<{
      inputDrug: string;
      activeIngredients: string[];
      displayMapping: string;
      category: string;
      verifiedInLocalDb: boolean;
    }>;
    medicineDatabase248kMatches: Array<{
      id: string;
      name: string;
      uses: string;
      sideEffects: string;
      substitutes: string;
      therapeuticClass: string;
      chemicalClass: string;
      habitForming: string;
      source: string;
    }>;
    ddiInteractionMatches: Array<{
      pair: string;
      matchedInCsv: boolean;
      severity: string;
      direction: string;
      csvDescription: string;
      duplicateHazard: boolean;
      precaution: string;
    }>;
  };
  formattedText: string;
  contextString: string;
}

/**
 * Detects whether the user query is a Symptom question rather than a Medicine Interaction question.
 */
export function isSymptomQuery(prompt: string, selectedDrugs?: string[]): boolean {
  if (Array.isArray(selectedDrugs) && selectedDrugs.length > 0) {
    return false;
  }
  const q = (typeof prompt === "string" ? prompt : "").trim();
  if (!q) return false;
  const lower = q.toLowerCase();

  // Explicit symptom intent phrases from the Symptom Explorer or natural language
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

  // If the user explicitly asks to compare/mix two drugs with '+', 'vs', 'interaction between', or 'i am checking', route to medicine interaction
  if (
    /\+|interaction between|interactions between|\bvs\b|\bi am checking\b|\bi am taking\b|\bcan i take\b.*\b(and|with)\b/i.test(
      lower
    )
  ) {
    return false;
  }

  // Check symptom keywords
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

/**
 * Builds a structured 'Symptom Overview & Precaution' fallback object from symptomsData and allMedicines.
 */
export function buildSymptomFallbackData(prompt: string): LocalRagFallbackData {
  const safePrompt = typeof prompt === "string" ? prompt : String(prompt || "");
  const lower = safePrompt.toLowerCase();

  const matchedSymptom =
    symptomsData.find(
      (s) =>
        lower.includes(s.name.toLowerCase()) ||
        lower.includes(s.id.toLowerCase()) ||
        s.name
          .toLowerCase()
          .split(/\s*&\s*|\s+/)
          .some((word) => word.length >= 4 && lower.includes(word))
    ) || symptomsData[0];

  const otcMeds = allMedicines.filter((m) => (matchedSymptom.otcMedicineIds || []).includes(m.id));
  const otcOptions =
    otcMeds.length > 0
      ? otcMeds.map((m) => {
          const usesList = Array.isArray(m.symptomsRelieved) && m.symptomsRelieved.length > 0
            ? m.symptomsRelieved.slice(0, 3).join(", ")
            : m.usage || "Symptom relief";
          return `${m.name} (${(m.activeIngredients || []).join(" + ") || "OTC"}) — ${usesList}`;
        })
      : ["Paracetamol 500mg (Standard OTC relief — follow package instructions)"];

  const homeCarePrecautions = [
    ...(matchedSymptom.homeRemedies || []),
    matchedSymptom.hydrationAdvice ? `Hydration: ${matchedSymptom.hydrationAdvice}` : "",
    matchedSymptom.restRecommendations ? `Rest: ${matchedSymptom.restRecommendations}` : "",
  ].filter(Boolean);

  const redFlagWarnings =
    Array.isArray(matchedSymptom.redFlags) && matchedSymptom.redFlags.length > 0
      ? matchedSymptom.redFlags
      : ["Seek immediate medical evaluation if symptoms worsen rapidly or persist beyond 3 days."];

  const symptomOverview: SymptomOverviewFallback = {
    symptomName: matchedSymptom.name,
    category: matchedSymptom.category,
    overview: `${matchedSymptom.description} Common triggers include ${(matchedSymptom.commonCauses || []).join(", ")}.`,
    otcOptions,
    homeCarePrecautions,
    redFlagWarnings,
  };

  const formattedText = [
    `I'm sorry to hear you're dealing with **${matchedSymptom.name}**. Here is some educational guidance to help you feel better safely:`,
    `### Likely Causes\n${matchedSymptom.description} It is most commonly triggered by:\n${(matchedSymptom.commonCauses || []).map((c) => `- ${c}`).join("\n")}`,
    `### Standard Over-the-Counter (OTC) Active Ingredients\n${(otcOptions || []).map((o) => `- ${o}`).join("\n")}\n- *Precaution:* Always check package labels for adult dosing intervals, take NSAIDs (like Ibuprofen or Aspirin) with food, and avoid combining multiple products containing Paracetamol.`,
    `### Clear Home Care Steps\n${(homeCarePrecautions || []).map((h) => `- ${h}`).join("\n")}`,
    `### Crucial 'Red-Flag' Warning Signs\nPlease seek immediate medical evaluation if you notice any of the following:\n${(redFlagWarnings || []).map((r) => `- ${r}`).join("\n")}`,
  ].join("\n\n");

  return {
    query: safePrompt,
    hasVerifiedData: true,
    isFallback: false,
    isSymptomQuery: true,
    symptomOverview,
    ingredients: otcOptions,
    hazards: redFlagWarnings,
    precautions: homeCarePrecautions,
    mappedIngredients: otcOptions,
    interactionHazardStatus: redFlagWarnings,
    precautionAction: homeCarePrecautions,
    rawDatabaseObject: {
      mappedIngredients: [],
      medicineDatabase248kMatches: [],
      ddiInteractionMatches: [],
    },
    formattedText,
    contextString: JSON.stringify(symptomOverview, null, 2),
  };
}

/**
 * Defensive array join helper that prevents TypeError when fields are undefined or non-arrays.
 */
function safeJoin(arr: unknown, separator: string = ", ", fallback: string = "None listed"): string {
  if (!Array.isArray(arr) || arr.length === 0) {
    return fallback;
  }
  const joined = arr
    .filter((item) => item !== undefined && item !== null && String(item).trim().length > 0)
    .map((item) => String(item).trim())
    .join(separator);
  return joined || fallback;
}

/**
 * Initializes and retrieves the Gemini API key using import.meta.env.VITE_GEMINI_API_KEY
 * with fallbacks across all potential environment variable formats.
 */
export function getGeminiApiKey(): string | undefined {
  const apiKey =
    import.meta.env.VITE_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY;
  return apiKey;
}

export function createGeminiClient(): GoogleGenAI | null {
  const apiKey =
    import.meta.env.VITE_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    return new GoogleGenAI({ apiKey });
  } catch (err) {
    console.warn("GoogleGenAI initialization failed, falling back to local database analysis:", err);
    return null;
  }
}

/**
 * Searches the 248k browser dataset (window.seraDataset) and curated local medicinesData
 */
function searchLocal248kMedicines(
  terms: string[],
  limit = 4
): LocalRagFallbackData["rawDatabaseObject"]["medicineDatabase248kMatches"] {
  const results: LocalRagFallbackData["rawDatabaseObject"]["medicineDatabase248kMatches"] = [];
  const seenNames = new Set<string>();

  const safeTerms = Array.isArray(terms) ? terms : [];
  const cleanTerms = safeTerms
    .filter((t) => typeof t === "string")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length >= 2);

  if (cleanTerms.length === 0) return results;

  // 1. Check curated allMedicines catalogue
  const safeAllMedicines = Array.isArray(allMedicines) ? allMedicines : [];
  for (const med of safeAllMedicines) {
    if (!med || typeof med.name !== "string") continue;
    const medNameLower = med.name.toLowerCase();
    const brandList = Array.isArray(med.brandNames) ? med.brandNames : [];
    const ingredientList = Array.isArray(med.activeIngredients) ? med.activeIngredients : [];

    const matched = cleanTerms.some(
      (term) =>
        medNameLower.includes(term) ||
        term.includes(medNameLower) ||
        brandList.some((b) => typeof b === "string" && (b.toLowerCase().includes(term) || term.includes(b.toLowerCase()))) ||
        ingredientList.some((a) => typeof a === "string" && a.toLowerCase().includes(term))
    );
    if (matched && !seenNames.has(medNameLower)) {
      seenNames.add(medNameLower);
      const usesStr =
        Array.isArray(med.symptomsRelieved) && med.symptomsRelieved.length > 0
          ? med.symptomsRelieved.join(", ")
          : med.usage || "None listed";
      const sideEffectsStr =
        Array.isArray(med.sideEffects?.common) && med.sideEffects.common.length > 0
          ? med.sideEffects.common.join(", ")
          : "None listed";
      results.push({
        id: med.id || med.name,
        name: med.name,
        uses: usesStr,
        sideEffects: sideEffectsStr,
        substitutes: (med.brandNames || []).join(", ") || "None listed",
        therapeuticClass: med.category || "Pharmaceutical",
        chemicalClass: (med.activeIngredients || []).join(" + ") || "None listed",
        habitForming: "No",
        source: "SERA Curated Medicine DB",
      });
      if (results.length >= limit) return results;
    }
  }

  // 2. Check 248k dataset in window.seraDataset
  const browserDataset: ParsedClientMedicineRecord[] =
    typeof window !== "undefined" && Array.isArray(window.seraDataset) ? window.seraDataset : [];

  if (browserDataset.length > 0) {
    for (let i = 0; i < browserDataset.length; i++) {
      const rec = browserDataset[i];
      if (!rec || typeof rec.name !== "string") continue;
      const nameLower = rec.name.toLowerCase();
      if (!nameLower || seenNames.has(nameLower)) continue;

      const isMatch = cleanTerms.some(
        (term) =>
          nameLower === term ||
          nameLower.startsWith(term + " ") ||
          nameLower.includes(term)
      );

      if (isMatch) {
        seenNames.add(nameLower);
        results.push({
          id: rec.id || String(i),
          name: rec.name,
          uses: rec.uses || "Not specified in local record",
          sideEffects: rec.side_effects || "Not specified in local record",
          substitutes: rec.substitutes || "None listed",
          therapeuticClass: rec.therapeutic_class || "Not specified",
          chemicalClass: rec.chemical_class || rec.action_class || "Not specified",
          habitForming: rec.habit_forming || "No",
          source: "SERA 248k Medicine Database",
        });
        if (results.length >= limit) break;
      }
    }
  }

  return results;
}

/**
 * Retrieves deterministic local database records from the 248k medicine dataset and DDI CSV dataset.
 * Never calls any external AI and guarantees zero hallucination and safe string formatting.
 */
export async function retrieveLocalDatabaseData(
  prompt: string,
  selectedDrugs?: string[]
): Promise<LocalRagFallbackData> {
  const safePrompt = typeof prompt === "string" ? prompt : String(prompt || "");

  // Route Symptom Queries to the Symptom Overview & Precaution builder (never treat symptom sentences as drugs)
  if (isSymptomQuery(safePrompt, selectedDrugs)) {
    return buildSymptomFallbackData(safePrompt);
  }

  try {
    let ddiRecords: InteractionRecord[] | null = getCachedDdiRecords();
    if (!ddiRecords || ddiRecords.length === 0) {
      ddiRecords = await fetchAndParseDdiDataset().catch(() => []);
    }
    const safeDdiRecords = Array.isArray(ddiRecords) ? ddiRecords : [];

    const ddiDrugSet = new Set<string>();
    for (let i = 0; i < safeDdiRecords.length; i++) {
      const r = safeDdiRecords[i];
      if (r?.drug1) ddiDrugSet.add(String(r.drug1).toLowerCase());
      if (r?.drug2) ddiDrugSet.add(String(r.drug2).toLowerCase());
    }

    // Use selectedDrugs (from Interaction Analyzer UI state) or cleanDrugInput entity extraction
    const candidateSegments = extractCleanDrugEntities(safePrompt, selectedDrugs).slice(0, 6);
    const effectiveSegments =
      candidateSegments.length > 0
        ? candidateSegments
        : [cleanDrugInput(safePrompt) || safePrompt.trim()].filter(Boolean);

    const basketItems = effectiveSegments.map((seg) => {
      const extracted = extractActiveGenerics(seg);
      const genericNames = Array.isArray(extracted?.genericNames) ? extracted.genericNames : [];
      const clinicalKeys = Array.isArray(extracted?.clinicalKeys) ? extracted.clinicalKeys : [];
      return {
        name: seg,
        activeIngredients: genericNames,
        therapeuticClass: extracted?.category || "Pharmaceutical",
        displayMapping:
          extracted?.displayMapping ||
          `${seg} → ${(genericNames || []).join(", ") || "None listed"}`,
        clinicalKeys,
      };
    });

    const allSearchTerms = [
      ...effectiveSegments,
      ...basketItems.flatMap((b) => (Array.isArray(b.activeIngredients) ? b.activeIngredients : [])),
    ];

    const medicineMatches = searchLocal248kMedicines(allSearchTerms, 4);

    // Verify which mapped ingredients exist in our local medicine DB or DDI CSV index
    const rawMappedIngredients = basketItems.map((item) => {
      const segLower = (item.name || "").toLowerCase();
      const itemIngredients = Array.isArray(item.activeIngredients) ? item.activeIngredients : [];
      const mappedToDifferentGeneric = itemIngredients.some(
        (g) => typeof g === "string" && g.toLowerCase() !== segLower
      );
      const inDdiIndex =
        itemIngredients.some((g) => typeof g === "string" && ddiDrugSet.has(g.toLowerCase())) ||
        ddiDrugSet.has(segLower);
      const inMedDb = medicineMatches.some(
        (m) =>
          (m.name || "").toLowerCase().includes(segLower) ||
          itemIngredients.some(
            (g) =>
              typeof g === "string" &&
              ((m.name || "").toLowerCase().includes(g.toLowerCase()) ||
                (m.chemicalClass || "").toLowerCase().includes(g.toLowerCase()))
          )
      );

      const verifiedInLocalDb = mappedToDifferentGeneric || inDdiIndex || inMedDb;

      return {
        inputDrug: item.name,
        activeIngredients: verifiedInLocalDb ? itemIngredients : [],
        displayMapping: verifiedInLocalDb
          ? item.displayMapping
          : `${item.name} → No verified data found in SERA database`,
        category: verifiedInLocalDb ? item.therapeuticClass : "Unverified",
        verifiedInLocalDb,
      };
    });

    const ddiInteractionMatches: LocalRagFallbackData["rawDatabaseObject"]["ddiInteractionMatches"] = [];
    const mappedIngredientsLines: string[] = [];
    const interactionStatusLines: string[] = [];
    const precautionActionLines: string[] = [];

    for (const m of rawMappedIngredients) {
      if (m.verifiedInLocalDb) {
        const ingText = (m.activeIngredients || []).join(", ") || "None listed";
        mappedIngredientsLines.push(`${m.inputDrug} → ${ingText} (${m.category || "Pharmaceutical"})`);
      } else {
        mappedIngredientsLines.push(`${m.inputDrug}: No verified data found in SERA database`);
      }
    }

    for (const med of medicineMatches) {
      const medLine = `${med.name} [${med.source}] — Class: ${med.therapeuticClass || med.chemicalClass || "None listed"}; Uses: ${med.uses || "None listed"}`;
      if (!mappedIngredientsLines.includes(medLine)) {
        mappedIngredientsLines.push(medLine);
      }
    }

    // Build the cleaned array of active generic compounds for the bidirectional matrix check (A+B, B+A)
    const cleanedActiveCompoundItems =
      basketItems.length >= 2
        ? basketItems.map((b) => ({
            name: b.name,
            activeIngredients: Array.isArray(b.activeIngredients) ? b.activeIngredients : [],
            therapeuticClass: b.therapeuticClass,
          }))
        : (Array.isArray(basketItems[0]?.activeIngredients) ? basketItems[0].activeIngredients : []).map(
            (ing) => ({
              name: ing,
              activeIngredients: [ing],
            })
          );

    if (cleanedActiveCompoundItems.length >= 2) {
      const evalRes = evaluateBasketInteractions(cleanedActiveCompoundItems, safeDdiRecords);
      const pairResults = Array.isArray(evalRes?.pairResults) ? evalRes.pairResults : [];

      for (const pair of pairResults) {
        if (!pair) continue;
        const genA = String(pair.genericA || "");
        const genB = String(pair.genericB || "");
        const isDuplicate = genA.toLowerCase() === genB.toLowerCase() && genA.length > 0;
        const pairName = pair.combinedDrugNames || `${genA} + ${genB}`;

        ddiInteractionMatches.push({
          pair: pairName,
          matchedInCsv: Boolean(pair.matchedInCsv),
          severity: pair.severity || "None",
          direction: pair.matchDirection || "Checked bidirectionally",
          csvDescription: pair.csvDescription || "No verified data found in SERA database",
          duplicateHazard: isDuplicate,
          precaution: pair.safetyGuidance || "Consult a qualified healthcare professional.",
        });

        if (pair.matchedInCsv) {
          interactionStatusLines.push(
            `${pairName} [${pair.severity || "Moderate"}]: ${pair.csvDescription || "Interaction detected"} (${pair.matchDirection || "Bidirectional match"})`
          );
          precautionActionLines.push(
            `${pairName}: ${pair.safetyGuidance || "Consult a pharmacist or physician before combining."}`
          );
        } else {
          interactionStatusLines.push(
            `${pairName}: No duplicate hazards detected / No verified interaction record in Db_drug_interactions.csv.`
          );
        }
      }
    } else {
      // Single medicine query
      if (medicineMatches.length > 0) {
        interactionStatusLines.push(
          `Single medicine lookup (${medicineMatches[0].name}). Habit Forming: ${medicineMatches[0].habitForming || "No"}. No duplicate hazards detected.`
        );
        for (const med of medicineMatches) {
          precautionActionLines.push(
            `${med.name}: Primary Uses: ${med.uses || "None listed"}. Common Side Effects: ${med.sideEffects || "None listed"}. Substitutes: ${med.substitutes || "None listed"}.`
          );
        }
      } else if (rawMappedIngredients[0]?.verifiedInLocalDb) {
        const first = rawMappedIngredients[0];
        const firstIngredientsJoined = (first.activeIngredients || []).join(", ") || "None listed";
        interactionStatusLines.push(
          `Single active ingredient mapped (${firstIngredientsJoined}). No duplicate hazards detected.`
        );
        precautionActionLines.push(
          `Avoid combining ${first.inputDrug} with other products containing ${firstIngredientsJoined} to prevent duplicate dosing.`
        );
      } else {
        interactionStatusLines.push("No verified data found in SERA database.");
        precautionActionLines.push(
          "No verified data found in SERA database. Consult a qualified doctor or pharmacist before taking this medication."
        );
      }
    }

    if (mappedIngredientsLines.length === 0) {
      mappedIngredientsLines.push("None listed");
    }
    if (interactionStatusLines.length === 0) {
      interactionStatusLines.push("No duplicate hazards detected");
    }
    if (precautionActionLines.length === 0) {
      precautionActionLines.push(
        "No verified data found in SERA database. Please consult a pharmacist or physician."
      );
    }

    const hasVerifiedData =
      rawMappedIngredients.some((m) => m.verifiedInLocalDb) ||
      medicineMatches.length > 0 ||
      ddiInteractionMatches.some((d) => d.matchedInCsv);

    const rawDatabaseObject: LocalRagFallbackData["rawDatabaseObject"] = {
      mappedIngredients: rawMappedIngredients,
      medicineDatabase248kMatches: medicineMatches,
      ddiInteractionMatches,
    };

    const ingredientsText = (mappedIngredientsLines || []).join("\n• ") || "None listed";
    const hazardsText = (interactionStatusLines || []).join("\n• ") || "No duplicate hazards detected";
    const precautionsText =
      (precautionActionLines || []).join("\n• ") ||
      "Consult a certified doctor or pharmacist for personalized medical advice.";

    const formattedText = [
      `Mapped Ingredients (from local DB):\n• ${ingredientsText}`,
      `Interaction / Duplicate Hazard Status (from local DB):\n• ${hazardsText}`,
      `Precaution / Action (from local DB):\n• ${precautionsText}`,
    ].join("\n\n");

    const contextString = JSON.stringify(rawDatabaseObject, null, 2);

    return {
      query: safePrompt,
      hasVerifiedData,
      isFallback: false,
      isSymptomQuery: false,
      ingredients: mappedIngredientsLines,
      hazards: interactionStatusLines,
      precautions: precautionActionLines,
      mappedIngredients: mappedIngredientsLines,
      interactionHazardStatus: interactionStatusLines,
      precautionAction: precautionActionLines,
      rawDatabaseObject,
      formattedText,
      contextString,
    };
  } catch (err) {
    console.error("Error in retrieveLocalDatabaseData, returning safe default fallback:", err);
    const defaultFormatted = [
      "Mapped Ingredients (from local DB):\n• None listed",
      "Interaction / Duplicate Hazard Status (from local DB):\n• No duplicate hazards detected",
      "Precaution / Action (from local DB):\n• No verified data found in SERA database. Always consult a certified doctor or pharmacist.",
    ].join("\n\n");

    return {
      query: safePrompt,
      hasVerifiedData: false,
      isFallback: true,
      isSymptomQuery: false,
      ingredients: ["None listed"],
      hazards: ["No duplicate hazards detected"],
      precautions: ["No verified data found in SERA database."],
      mappedIngredients: ["None listed"],
      interactionHazardStatus: ["No duplicate hazards detected"],
      precautionAction: ["No verified data found in SERA database."],
      rawDatabaseObject: {
        mappedIngredients: [],
        medicineDatabase248kMatches: [],
        ddiInteractionMatches: [],
      },
      formattedText: defaultFormatted,
      contextString: "{}",
    };
  }
}

/**
 * Full client-side RAG execution with Intent Routing (Symptom vs Medicine):
 * - For Symptom Queries: Bypasses DDI dataset lookup, calls Gemini ('gemini-2.5-flash') with SERA_SYMPTOM_SYSTEM_PROMPT,
 *   and falls back to the structured 'Symptom Overview & Precaution' card if Gemini fails.
 * - For Medicine Queries: Runs clean entity extraction on drug names ONLY, queries Db_drug_interactions.csv
 *   for bidirectional hazards, synthesizes with Gemini, and preserves the Verified Local Database Analysis fallback.
 */
export async function queryGeminiWithLocalRag(
  prompt: string,
  contextSnippet?: string,
  selectedDrugs?: string[]
): Promise<{
  answer: string;
  localData: LocalRagFallbackData;
  usedDeterministicFallback: boolean;
}> {
  const apiKey =
    import.meta.env.VITE_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY;

  // 1. INTENT ROUTING: Check if this is a Symptom Query
  if (isSymptomQuery(prompt, selectedDrugs)) {
    const symptomFallback = buildSymptomFallbackData(prompt);

    try {
      if (!apiKey) {
        throw new Error("Missing VITE_GEMINI_API_KEY on client; delegating or using conversational symptom prose.");
      }

      const ai = new GoogleGenAI({ apiKey });
      const symptomModels = ["gemini-2.5-flash", "gemini-3.8-flash", "gemini-flash-latest"];

      for (const modelName of symptomModels) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              systemInstruction: SERA_SYMPTOM_SYSTEM_PROMPT,
              temperature: 0.3,
            },
          });

          const text = typeof response?.text === "string" ? response.text.trim() : "";
          if (text.length > 0) {
            symptomFallback.isFallback = false;
            return {
              answer: text,
              localData: symptomFallback,
              usedDeterministicFallback: false,
            };
          }
        } catch (symptomModelErr) {
          console.warn(`Symptom query model '${modelName}' failed:`, symptomModelErr);
        }
      }

      throw new Error("All client Gemini models failed for symptom query");
    } catch (err) {
      console.warn("Client symptom generation fallback:", err);
      symptomFallback.isFallback = false;
      return {
        answer: symptomFallback.formattedText,
        localData: symptomFallback,
        usedDeterministicFallback: false,
      };
    }
  }

  // 2. MEDICINE INTERACTION QUERY: Run clean entity extraction and bidirectional DDI lookup
  const localData = await retrieveLocalDatabaseData(prompt, selectedDrugs);
  const guaranteedFallbackString: string =
    typeof localData?.formattedText === "string" && localData.formattedText.trim().length > 0
      ? localData.formattedText
      : [
          `Mapped Ingredients (from local DB):\n• ${(localData?.ingredients || []).join(", ") || "None listed"}`,
          `Interaction / Duplicate Hazard Status (from local DB):\n• ${(localData?.hazards || []).join("\n") || "No duplicate hazards detected"}`,
          `Precaution / Action (from local DB):\n• ${safeJoin(localData?.precautions, "\n", "Consult a healthcare professional.")}`,
        ].join("\n\n");

  const resolvedContext =
    typeof contextSnippet === "string" && contextSnippet.trim().length > 0
      ? contextSnippet
      : [
          `Mapped Ingredients & Pharmacological Class:\n${(localData?.ingredients || []).join("\n") || "None listed"}`,
          `Interaction & Duplicate Hazard Status:\n${(localData?.hazards || []).join("\n") || "No duplicate hazards detected"}`,
          `Precautions & Clinical Actions:\n${(localData?.precautions || []).join("\n") || "None listed"}`,
          `Raw Local Database Records (248k Medicine DB & DDI CSV):\n${localData.contextString || "{}"}`,
        ].join("\n\n");

  const systemInstructionWithContext = `${SERA_STRICT_SYSTEM_PROMPT}\n\nSynthesize a natural, helpful clinical response strictly using the following Local Database Results:\n${resolvedContext}`;

  const groundedUserMessage = `${SERA_STRICT_SYSTEM_PROMPT}\n\nLocal Database Results:\n${resolvedContext}\n\nUser Question: ${prompt}\n\nSynthesize a natural clinical response using ONLY the Local Database Results above (covering Mapped Ingredients, Pharmacological Class, Interaction/Duplicate Hazards, and Precautions).`;

  try {
    if (!apiKey) {
      throw new Error("VITE_GEMINI_API_KEY is missing; falling back to local database analysis.");
    }

    const ai = new GoogleGenAI({ apiKey });

    // Primary model call: 'gemini-1.5-flash'
    try {
      const primaryResponse = await ai.models.generateContent({
        model: GEMINI_PRIMARY_MODEL, // 'gemini-1.5-flash'
        contents: groundedUserMessage,
        config: {
          systemInstruction: systemInstructionWithContext,
          temperature: 0.1,
        },
      });

      const primaryText =
        typeof primaryResponse?.text === "string" ? primaryResponse.text.trim() : "";
      if (primaryText.length > 0) {
        return {
          answer: primaryText,
          localData,
          usedDeterministicFallback: false,
        };
      }
      throw new Error("Empty response from primary model gemini-1.5-flash");
    } catch (primaryErr: any) {
      console.warn(
        `Primary Gemini model '${GEMINI_PRIMARY_MODEL}' failed (retrying with fallback '${GEMINI_FALLBACK_MODEL}'):`,
        primaryErr?.status || primaryErr?.message || primaryErr
      );

      // Automatic retry fallback to 'gemini-1.5-pro' on 503, 404, or primary error
      try {
        const fallbackResponse = await ai.models.generateContent({
          model: GEMINI_FALLBACK_MODEL, // 'gemini-1.5-pro'
          contents: groundedUserMessage,
          config: {
            systemInstruction: systemInstructionWithContext,
            temperature: 0.1,
          },
        });

        const fallbackText =
          typeof fallbackResponse?.text === "string" ? fallbackResponse.text.trim() : "";
        if (fallbackText.length > 0) {
          return {
            answer: fallbackText,
            localData,
            usedDeterministicFallback: false,
          };
        }
        throw new Error("Empty response from fallback model gemini-1.5-pro");
      } catch (secondaryErr: any) {
        console.warn(
          `Fallback Gemini model '${GEMINI_FALLBACK_MODEL}' failed (trying 'gemini-2.5-flash'):`,
          secondaryErr?.status || secondaryErr?.message || secondaryErr
        );

        const tertiaryResponse = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: groundedUserMessage,
          config: {
            systemInstruction: systemInstructionWithContext,
            temperature: 0.1,
          },
        });

        const tertiaryText =
          typeof tertiaryResponse?.text === "string" ? tertiaryResponse.text.trim() : "";
        if (tertiaryText.length > 0) {
          return {
            answer: tertiaryText,
            localData,
            usedDeterministicFallback: false,
          };
        }
        throw secondaryErr;
      }
    }
  } catch (err) {
    // PRESERVE WORKING LOCAL FALLBACK:
    console.warn("Using Verified Local Database Analysis fallback:", err);
    localData.isFallback = true;
    return {
      answer: guaranteedFallbackString,
      localData,
      usedDeterministicFallback: true,
    };
  }
}

/**
 * Direct client-side Gemini generation with grounded RAG context and deterministic local fallback.
 * Guaranteed to return a non-empty valid string.
 */
export async function queryGeminiDirect(
  prompt: string,
  contextSnippet?: string,
  selectedDrugs?: string[]
): Promise<string> {
  const result = await queryGeminiWithLocalRag(prompt, contextSnippet, selectedDrugs);
  return typeof result?.answer === "string" && result.answer.trim().length > 0
    ? result.answer
    : "No verified data found in SERA database.";
}


