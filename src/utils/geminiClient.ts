import { GoogleGenAI } from "@google/genai";
import { fetchAndParseDdiDataset, getCachedDdiRecords, InteractionRecord } from "./ddiDatasetLoader";
import { evaluateBasketInteractions, extractActiveGenerics } from "./interactionEngine";
import { allMedicines } from "../data/medicinesData";
import type { ParsedClientMedicineRecord } from "../context/DatasetContext";

export const GEMINI_CLIENT_MODEL = "gemini-2.5-flash";

export const SERA_STRICT_SYSTEM_PROMPT =
  "You are SERA Clinical Guide. You MUST ONLY use the provided Local Database Results below to answer. If an ingredient or interaction is not listed in the provided data, state 'No verified data found in SERA database'. Do NOT use outside medical knowledge or make assumptions.";

export const SERA_CLINICAL_SYSTEM_INSTRUCTION = SERA_STRICT_SYSTEM_PROMPT;

export interface LocalRagFallbackData {
  query: string;
  hasVerifiedData: boolean;
  isFallback: boolean;
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
 * Initializes and retrieves the Gemini API key across all potential environment formats.
 */
export function getGeminiApiKey(): string | undefined {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  return apiKey;
}

export function createGeminiClient(): GoogleGenAI | null {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
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
function searchLocal248kMedicines(terms: string[], limit = 4): LocalRagFallbackData["rawDatabaseObject"]["medicineDatabase248kMatches"] {
  const results: LocalRagFallbackData["rawDatabaseObject"]["medicineDatabase248kMatches"] = [];
  const seenNames = new Set<string>();

  const cleanTerms = terms
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length >= 2);

  if (cleanTerms.length === 0) return results;

  // 1. Check curated allMedicines catalogue
  for (const med of allMedicines) {
    const medNameLower = med.name.toLowerCase();
    const matched = cleanTerms.some(
      (term) =>
        medNameLower.includes(term) ||
        term.includes(medNameLower) ||
        med.brandNames.some((b) => b.toLowerCase().includes(term) || term.includes(b.toLowerCase())) ||
        med.activeIngredients.some((a) => a.toLowerCase().includes(term))
    );
    if (matched && !seenNames.has(medNameLower)) {
      seenNames.add(medNameLower);
      results.push({
        id: med.id,
        name: med.name,
        uses: med.primaryUses.join(", "),
        sideEffects: med.commonSideEffects.join(", "),
        substitutes: med.brandNames.join(", "),
        therapeuticClass: med.category,
        chemicalClass: med.activeIngredients.join(" + "),
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
      const nameLower = rec.name?.toLowerCase() || "";
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
          id: rec.id,
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
 * Never calls any external AI and guarantees zero hallucination.
 */
export async function retrieveLocalDatabaseData(prompt: string): Promise<LocalRagFallbackData> {
  let ddiRecords: InteractionRecord[] | null = getCachedDdiRecords();
  if (!ddiRecords || ddiRecords.length === 0) {
    ddiRecords = await fetchAndParseDdiDataset().catch(() => []);
  }
  const safeDdiRecords = ddiRecords || [];

  const ddiDrugSet = new Set<string>();
  for (let i = 0; i < safeDdiRecords.length; i++) {
    const r = safeDdiRecords[i];
    if (r.drug1) ddiDrugSet.add(r.drug1.toLowerCase());
    if (r.drug2) ddiDrugSet.add(r.drug2.toLowerCase());
  }

  const cleaned = prompt
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

  const candidateSegments = (segments.length > 0 ? segments : [cleaned]).slice(0, 5);

  const basketItems = candidateSegments.map((seg) => {
    const extracted = extractActiveGenerics(seg);
    return {
      name: seg,
      activeIngredients: extracted.genericNames,
      therapeuticClass: extracted.category,
      displayMapping: extracted.displayMapping,
      clinicalKeys: extracted.clinicalKeys,
    };
  });

  const allSearchTerms = [
    ...candidateSegments,
    ...basketItems.flatMap((b) => b.activeIngredients),
  ];

  const medicineMatches = searchLocal248kMedicines(allSearchTerms, 4);

  // Verify which mapped ingredients exist in our local medicine DB or DDI CSV index
  const rawMappedIngredients = basketItems.map((item) => {
    const segLower = item.name.toLowerCase();
    const mappedToDifferentGeneric = item.activeIngredients.some(
      (g) => g.toLowerCase() !== segLower
    );
    const inDdiIndex = item.activeIngredients.some((g) => ddiDrugSet.has(g.toLowerCase())) || ddiDrugSet.has(segLower);
    const inMedDb = medicineMatches.some(
      (m) =>
        m.name.toLowerCase().includes(segLower) ||
        item.activeIngredients.some((g) => m.name.toLowerCase().includes(g.toLowerCase()) || m.chemicalClass.toLowerCase().includes(g.toLowerCase()))
    );

    const verifiedInLocalDb = mappedToDifferentGeneric || inDdiIndex || inMedDb;

    return {
      inputDrug: item.name,
      activeIngredients: verifiedInLocalDb ? item.activeIngredients : [],
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
      mappedIngredientsLines.push(`${m.displayMapping} (${m.category})`);
    } else {
      mappedIngredientsLines.push(`${m.inputDrug}: No verified data found in SERA database`);
    }
  }

  for (const med of medicineMatches) {
    const medLine = `${med.name} [${med.source}] — Class: ${med.therapeuticClass || med.chemicalClass}; Uses: ${med.uses}`;
    if (!mappedIngredientsLines.includes(medLine)) {
      mappedIngredientsLines.push(medLine);
    }
  }

  const hasMultipleInputs =
    basketItems.length >= 2 || (basketItems[0]?.activeIngredients?.length || 0) >= 2;

  if (hasMultipleInputs) {
    const evalInput =
      basketItems.length >= 2
        ? basketItems.map((b) => ({
            name: b.name,
            activeIngredients: b.activeIngredients,
            therapeuticClass: b.therapeuticClass,
          }))
        : (basketItems[0].activeIngredients || []).map((ing) => ({
            name: ing,
            activeIngredients: [ing],
          }));

    const evalRes = evaluateBasketInteractions(evalInput, safeDdiRecords);

    if (evalRes.hasDuplicateIngredients && evalRes.duplicateWarnings.length > 0) {
      for (const dup of evalRes.duplicateWarnings) {
        interactionStatusLines.push(
          `DUPLICATE ACTIVE INGREDIENT HAZARD: ${dup.genericName} is present in multiple selected medicines (${dup.SourceDrugs.join(" + ")}).`
        );
        precautionActionLines.push(dup.warningText);
      }
    }

    for (const pair of evalRes.pairResults) {
      const isDuplicate = pair.genericA.toLowerCase() === pair.genericB.toLowerCase();
      ddiInteractionMatches.push({
        pair: pair.combinedDrugNames,
        matchedInCsv: pair.matchedInCsv,
        severity: pair.severity,
        direction: pair.matchDirection,
        csvDescription: pair.csvDescription || "No verified data found in SERA database",
        duplicateHazard: isDuplicate,
        precaution: pair.safetyGuidance,
      });

      if (pair.matchedInCsv) {
        interactionStatusLines.push(
          `${pair.combinedDrugNames} [${pair.severity}]: ${pair.csvDescription} (${pair.matchDirection})`
        );
        precautionActionLines.push(`${pair.combinedDrugNames}: ${pair.safetyGuidance}`);
      } else {
        interactionStatusLines.push(
          `${pair.combinedDrugNames}: No verified interaction data found in SERA database (Checked both directions in Db_drug_interactions.csv).`
        );
      }
    }
  } else {
    // Single medicine query
    if (medicineMatches.length > 0) {
      interactionStatusLines.push(
        `Single medicine lookup (${medicineMatches[0].name}). Habit Forming: ${medicineMatches[0].habitForming}. Add a second medicine to check pairwise interactions in Db_drug_interactions.csv.`
      );
      for (const med of medicineMatches) {
        precautionActionLines.push(
          `${med.name}: Primary Uses: ${med.uses}. Common Side Effects: ${med.sideEffects}. Substitutes: ${med.substitutes}.`
        );
      }
    } else if (rawMappedIngredients[0]?.verifiedInLocalDb) {
      const first = rawMappedIngredients[0];
      interactionStatusLines.push(
        `Single active ingredient mapped (${first.activeIngredients.join(" + ")}). Enter a second medicine to evaluate interactions in Db_drug_interactions.csv.`
      );
      precautionActionLines.push(
        `Avoid combining ${first.inputDrug} with other products containing ${first.activeIngredients.join(" or ")} to prevent duplicate dosing.`
      );
    } else {
      interactionStatusLines.push("No verified data found in SERA database.");
      precautionActionLines.push(
        "No verified data found in SERA database. Consult a qualified doctor or pharmacist before taking this medication."
      );
    }
  }

  if (mappedIngredientsLines.length === 0) {
    mappedIngredientsLines.push("No verified data found in SERA database.");
  }
  if (interactionStatusLines.length === 0) {
    interactionStatusLines.push("No verified data found in SERA database.");
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

  const formattedText = [
    `Mapped Ingredients (from local DB):\n${mappedIngredientsLines.map((l) => `• ${l}`).join("\n")}`,
    `Interaction / Duplicate Hazard Status (from local DB):\n${interactionStatusLines.map((l) => `• ${l}`).join("\n")}`,
    `Precaution / Action (from local DB):\n${precautionActionLines.map((l) => `• ${l}`).join("\n")}`,
  ].join("\n\n");

  const contextString = JSON.stringify(rawDatabaseObject, null, 2);

  return {
    query: prompt,
    hasVerifiedData,
    isFallback: false,
    mappedIngredients: mappedIngredientsLines,
    interactionHazardStatus: interactionStatusLines,
    precautionAction: precautionActionLines,
    rawDatabaseObject,
    formattedText,
    contextString,
  };
}

/**
 * Full client-side RAG execution with strict grounding and deterministic local fallback on 503, 404, or network errors.
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

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    localData.isFallback = true;
    return {
      answer: localData.formattedText,
      localData,
      usedDeterministicFallback: true,
    };
  }

  const resolvedContext =
    contextSnippet !== undefined && contextSnippet.trim().length > 0
      ? contextSnippet
      : `${localData.formattedText}\n\nRaw Local Database JSON:\n${localData.contextString}`;

  const groundedPrompt = `${SERA_STRICT_SYSTEM_PROMPT}\n\nLocal Database Results:\n${resolvedContext}\n\nUser Question: ${prompt}`;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: GEMINI_CLIENT_MODEL,
      contents: groundedPrompt,
      config: {
        systemInstruction: SERA_STRICT_SYSTEM_PROMPT,
        temperature: 0.1,
      },
    });

    const text = (response.text || "").trim();
    if (!text) {
      localData.isFallback = true;
      return {
        answer: localData.formattedText,
        localData,
        usedDeterministicFallback: true,
      };
    }

    return {
      answer: text,
      localData,
      usedDeterministicFallback: false,
    };
  } catch (err) {
    // DETERMINISTIC LOCAL FALLBACK (Zero Hallucination) on 503, 404, quota, or network error:
    // Never call any secondary ungrounded AI. Render local DB results directly.
    console.error("Gemini API error (using deterministic local DB fallback):", err);
    localData.isFallback = true;
    return {
      answer: localData.formattedText,
      localData,
      usedDeterministicFallback: true,
    };
  }
}

/**
 * Direct client-side Gemini generation with grounded RAG context and deterministic local fallback.
 */
export async function queryGeminiDirect(prompt: string, contextSnippet?: string): Promise<string> {
  const result = await queryGeminiWithLocalRag(prompt, contextSnippet);
  return result.answer;
}

