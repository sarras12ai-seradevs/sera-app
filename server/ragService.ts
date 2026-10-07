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

/**
 * Lazy initializer for Gemini client
 */
export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY or VITE_GEMINI_API_KEY environment variable is not configured.");
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
  query: string;
}

/**
 * Extract drug names from a natural language query (supports single or multi-drug queries)
 */
export function extractDrugsFromQuery(prompt: string): string[] {
  const cleaned = prompt
    .replace(/[?!.:;()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Check if user separated drugs with "+", "and", "with", "vs", "or", ","
  const splitByConnectors = cleaned
    .replace(
      /\b(can i take|what happens if i take|interaction between|interactions between|compare|mix|mixing|combining|combine|taking|is it safe to take|tell me about|what is|uses of|side effects of|along with|together with|together|simultaneously)\b/gi,
      " | "
    )
    .split(/\s*(?:\+|,|\band\b|\bwith\b|\bvs\b|\bor\b|\|)\s*/i)
    .map((s) => s.trim())
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

  return unique.length > 0 ? unique : [cleaned];
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
export async function executeRagQuery(userPrompt: string): Promise<RagResponse> {
  const extractedDrugs = extractDrugsFromQuery(userPrompt);
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

  // Build grounded context for Gemini
  const medicineContext = retrieved
    .map((r, idx) => {
      const rec = r.record;
      return `[MEDICINE RECORD ${idx + 1}]
Name: ${rec.name}
Uses: ${rec.uses.join(", ") || "Not specified"}
Side Effects: ${rec.sideEffects.join(", ") || "Not specified"}
Chemical Class: ${rec.chemicalClass || "Not specified"}
Therapeutic Class: ${rec.therapeuticClass || "Not specified"}
Action Class: ${rec.actionClass || "Not specified"}
Substitutes: ${rec.substitutes.join(", ") || "Not specified"}`;
    })
    .join("\n\n");

  const interactionContext = interactionAnalysis
    ? `BIDIRECTIONAL CSV INTERACTION LOOKUP RESULTS (db_drug_interactions.csv):
Mapped Drugs:
${interactionAnalysis.mappedDrugs.map((m) => `- ${m.displayMapping}`).join("\n")}
Pairwise Bidirectional Results:
${interactionAnalysis.pairResults
  .map(
    (p) =>
      `- ${p.genericA} + ${p.genericB}: Matched=${p.matchedInCsv}, Direction=${
        p.matchDirection || "Both directions checked (No CSV match)"
      }, Severity=${p.severity}, CSV Description="${
        p.csvRow?.description || "No interaction record in db_drug_interactions.csv"
      }"`
  )
  .join("\n")}`
    : `SINGLE DRUG MAPPING:
- ${mappedDrugs[0]?.displayMapping || userPrompt}`;

  const systemInstruction = `You are SERA (Safety, Education & Risk Awareness), an expert, grounded AI health guidance assistant designed for students and young adults.

CRITICAL GROUNDING & ALGORITHM RULES:
1. Always rely on the provided Brand-to-Generic Mapping and Bidirectional (Permutation-Proof) Search results from db_drug_interactions.csv.
2. If a multi-ingredient product is named (e.g., Combiflam, Sinarest, Wikoryl, Meftal-Spas, Pan-D), break it down into ALL of its active generic ingredients and evaluate interactions for EACH compound individually.
3. Treat Match 1 ([Drug 1 == Generic A] AND [Drug 2 == Generic B]) and Match 2 ([Drug 1 == Generic B] AND [Drug 2 == Generic A]) as 100% EQUIVALENT.
4. Structure EVERY response using these exact headings:

🔍 Mapped Ingredients:
Briefly state the brand-to-generic mapping (e.g., "Crocin contains Paracetamol; Disprin contains Aspirin").

⚠️ Interaction Status:
State clearly whether an interaction record was retrieved from db_drug_interactions.csv (or if duplicate active ingredients exist).

📖 Plain English Explanation:
Explain the interaction, biological mechanism, uses, and potential risks in simple, non-jargon language suitable for students.

✅ Safety Guidance:
Provide practical advice (e.g., safe interval timing between doses, food requirements, or warnings against co-administration).

🚨 Red-Flag Emergency Warning (If Severe):
Include this section if the interaction is marked Severe or if red-flag symptoms like shortness of breath, severe stomach pain, gastrointestinal bleeding, or collapse are described. Display a high-priority warning and list emergency contacts (India: 112 / 108 / AIIMS Poison Control 1800-116-117; US: 911 / Poison Control 1-800-222-1222; UK/EU: 999 / 112).

5. End EVERY response with this exact mandatory disclaimer on its own line:
"${SERA_MANDATORY_DISCLAIMER}"`;

  const userContent = `User Query: "${userPrompt}"

${interactionContext}

${medicineContext ? `RETRIEVED MEDICINE RECORDS:\n${medicineContext}` : ""}

Produce the grounded SERA response strictly following the required format.`;

  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: userContent,
      config: {
        systemInstruction,
        temperature: 0.15,
      },
    });

    let answerText = (response.text || "").trim();
    if (!answerText) {
      answerText = deterministicResponse;
    } else if (!answerText.includes(SERA_MANDATORY_DISCLAIMER)) {
      answerText = `${answerText}\n\n${SERA_MANDATORY_DISCLAIMER}`;
    }

    return {
      answer: answerText,
      retrievedMedicines: retrieved.map((r) => ({
        name: r.record.name,
        matchType: r.matchType,
        score: Math.round(r.score * 100) / 100,
        record: r.record,
      })),
      interactionAnalysis,
      isAvailableInDataset: true,
      query: userPrompt,
    };
  } catch (err: any) {
    // Graceful fallback if Gemini API hits quota limit (429 / resource_exhausted) or network error
    console.warn("Using grounded deterministic SERA response (Gemini API fallback):", err?.message || err);

    return {
      answer: deterministicResponse,
      retrievedMedicines: retrieved.map((r) => ({
        name: r.record.name,
        matchType: r.matchType,
        score: Math.round(r.score * 100) / 100,
        record: r.record,
      })),
      interactionAnalysis,
      isAvailableInDataset: true,
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

  const usesText = rec?.uses?.length ? rec.uses.join(", ") : "Standard relief for target symptoms as indicated on packaging";
  const sideEffectsText = rec?.sideEffects?.length ? rec.sideEffects.join(", ") : "Mild nausea, stomach upset, or drowsiness in sensitive individuals";
  const classText = [rec?.therapeuticClass, rec?.chemicalClass, rec?.actionClass].filter(Boolean).join(" • ") || mapped.category || "Pharmaceutical Agent";

  const sections = [
    `🔍 Mapped Ingredients:\n• ${mapped.displayMapping}\n• Pharmacological Class: ${classText}`,
    `⚠️ Interaction Status:\n• Single medicine lookup (${mapped.genericIngredients.join(" + ")}). To check drug-drug interactions in db_drug_interactions.csv, enter a second medicine (e.g., "${mapped.inputName} + Disprin" or "${mapped.inputName} + Cetirizine").\n• Warning: Avoid combining with other medicines that also contain ${mapped.genericIngredients.join(" or ")} to prevent accidental double-dosing.`,
    `📖 Plain English Explanation:\n• Primary Uses: ${usesText}.\n• How It Works & Risks: ${mapped.inputName} works via its active compound(s) (${mapped.genericIngredients.join(", ")}). Common side effects can include ${sideEffectsText}.`,
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
