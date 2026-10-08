import { GoogleGenAI } from "@google/genai";
import { fetchAndParseDdiDataset, getCachedDdiRecords, InteractionRecord } from "./ddiDatasetLoader";
import { evaluateBasketInteractions, extractActiveGenerics } from "./interactionEngine";
import { allMedicines } from "../data/medicinesData";
import type { ParsedClientMedicineRecord } from "../context/DatasetContext";

export const GEMINI_PRIMARY_MODEL = "gemini-2.5-flash";
export const GEMINI_FALLBACK_MODEL = "gemini-1.5-flash";
export const GEMINI_CLIENT_MODEL = GEMINI_PRIMARY_MODEL;

export const SERA_STRICT_SYSTEM_PROMPT =
  "You are SERA Clinical Guide. You MUST ONLY use the provided Local Database Results below to answer. If an ingredient or interaction is not listed in the provided data, state 'No verified data found in SERA database'. Do NOT use outside medical knowledge or make assumptions.";

export const SERA_CLINICAL_SYSTEM_INSTRUCTION = SERA_STRICT_SYSTEM_PROMPT;

export interface LocalRagFallbackData {
  query: string;
  hasVerifiedData: boolean;
  isFallback: boolean;
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
      results.push({
        id: med.id || med.name,
        name: med.name,
        uses: (med.primaryUses || []).join(", ") || "None listed",
        sideEffects: (med.commonSideEffects || []).join(", ") || "None listed",
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
export async function retrieveLocalDatabaseData(prompt: string): Promise<LocalRagFallbackData> {
  const safePrompt = typeof prompt === "string" ? prompt : String(prompt || "");

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

    const cleaned = safePrompt
      .replace(/[?!.:;()]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const segments = cleaned
      .replace(
        /\b(can i take|what happens if i take|interaction between|interactions between|compare|mix|mixing|combining|combine|taking|is it safe to take|tell me about|what is|uses of|side effects of|along with|together with|together|simultaneously)\b/gi,
        " | "
      )
      .split(/\s*(?:\+|,|\band\b|\bwith\b|\bvs\b|\bor\b|\|)\s*/i)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2);

    const candidateSegments = (segments.length > 0 ? segments : [cleaned]).filter(Boolean).slice(0, 5);

    const basketItems = candidateSegments.map((seg) => {
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
      ...candidateSegments,
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

    const firstItemIngredients = Array.isArray(basketItems[0]?.activeIngredients)
      ? basketItems[0].activeIngredients
      : [];
    const hasMultipleInputs = basketItems.length >= 2 || firstItemIngredients.length >= 2;

    if (hasMultipleInputs) {
      const evalInput =
        basketItems.length >= 2
          ? basketItems.map((b) => ({
              name: b.name,
              activeIngredients: Array.isArray(b.activeIngredients) ? b.activeIngredients : [],
              therapeuticClass: b.therapeuticClass,
            }))
          : firstItemIngredients.map((ing) => ({
              name: ing,
              activeIngredients: [ing],
            }));

      const evalRes = evaluateBasketInteractions(evalInput, safeDdiRecords);
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
 * Full client-side RAG execution with strict grounding, Primary ('gemini-2.5-flash') + Fallback ('gemini-1.5-flash')
 * model initialization, and deterministic local fallback on 503, 404, or network errors.
 * Guaranteed to return a valid string in `answer`.
 */
export async function queryGeminiWithLocalRag(
  prompt: string,
  contextSnippet?: string
): Promise<{
  answer: string;
  localData: LocalRagFallbackData;
  usedDeterministicFallback: boolean;
}> {
  const localData = await retrieveLocalDatabaseData(prompt);
  const guaranteedFallbackString: string =
    typeof localData?.formattedText === "string" && localData.formattedText.trim().length > 0
      ? localData.formattedText
      : [
          `Mapped Ingredients (from local DB):\n• ${(localData?.ingredients || []).join(", ") || "None listed"}`,
          `Interaction / Duplicate Hazard Status (from local DB):\n• ${(localData?.hazards || []).join("\n") || "No duplicate hazards detected"}`,
          `Precaution / Action (from local DB):\n• ${safeJoin(localData?.precautions, "\n", "Consult a healthcare professional.")}`,
        ].join("\n\n");

  const apiKey =
    import.meta.env.VITE_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    localData.isFallback = true;
    return {
      answer: guaranteedFallbackString,
      localData,
      usedDeterministicFallback: true,
    };
  }

  const resolvedContext =
    typeof contextSnippet === "string" && contextSnippet.trim().length > 0
      ? contextSnippet
      : `${guaranteedFallbackString}\n\nRaw Local Database JSON:\n${localData.contextString || "{}"}`;

  const groundedPrompt = `${SERA_STRICT_SYSTEM_PROMPT}\n\nLocal Database Results:\n${resolvedContext}\n\nUser Question: ${prompt}`;

  const ai = createGeminiClient();
  if (!ai) {
    localData.isFallback = true;
    return {
      answer: guaranteedFallbackString,
      localData,
      usedDeterministicFallback: true,
    };
  }

  // Try Primary model ('gemini-2.5-flash'), then Fallback model ('gemini-1.5-flash')
  const candidateModels = [GEMINI_PRIMARY_MODEL, GEMINI_FALLBACK_MODEL];

  for (const modelName of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: groundedPrompt,
        config: {
          systemInstruction: SERA_STRICT_SYSTEM_PROMPT,
          temperature: 0.1,
        },
      });

      const text = typeof response?.text === "string" ? response.text.trim() : "";
      if (text.length > 0) {
        return {
          answer: text,
          localData,
          usedDeterministicFallback: false,
        };
      }
    } catch (modelErr) {
      console.warn(`Gemini model '${modelName}' call failed:`, modelErr);
    }
  }

  // DETERMINISTIC LOCAL FALLBACK (Zero Hallucination) if both models fail or return empty:
  localData.isFallback = true;
  return {
    answer: guaranteedFallbackString,
    localData,
    usedDeterministicFallback: true,
  };
}

/**
 * Direct client-side Gemini generation with grounded RAG context and deterministic local fallback.
 * Guaranteed to return a non-empty valid string.
 */
export async function queryGeminiDirect(prompt: string, contextSnippet?: string): Promise<string> {
  const result = await queryGeminiWithLocalRag(prompt, contextSnippet);
  return typeof result?.answer === "string" && result.answer.trim().length > 0
    ? result.answer
    : "No verified data found in SERA database.";
}


