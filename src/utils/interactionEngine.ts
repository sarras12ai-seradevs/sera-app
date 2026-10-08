import { InteractionPair, InteractionSeverity, BatchSafetyAdvice, SaferAlternative, Medicine } from "../types";
import { allMedicines } from "../data/medicinesData";
import { getCachedDdiRecords, InteractionRecord } from "./ddiDatasetLoader";
import { classifyCsvInteractionSeverity } from "../components/SeverityBarChart";

export type NormalizedSeverity = "HIGH" | "MAJOR" | "MODERATE" | "MINOR" | "NONE";

export interface NormalizedDrugIngredient {
  rawInput: string;
  canonicalGeneric: string;
  clinicalKey: string;
  aliases: string[];
  category?: string;
}

export interface EvaluatedPairInteraction {
  drugAInput: string;
  drugBInput: string;
  genericA: string;
  genericB: string;
  combinedDrugNames: string;
  matchedInCsv: boolean;
  csvDescription: string;
  matchDirection: string;
  severity: "Severe" | "Moderate" | "Minor" | "None";
  ruleSeverity: NormalizedSeverity;
  title: string;
  plainEnglish: string;
  mechanism: string;
  safetyGuidance: string;
  isRedFlag: boolean;
  saferAlternatives?: Array<{
    drugId?: string;
    name: string;
    replacesDrugId?: string;
    replacesDrugName: string;
    reason: string;
  }>;
}

export interface EvaluatedBasketResult {
  severity: "Major" | "Moderate" | "Minor" | "None";
  overallSeverity: "Severe" | "Moderate" | "Minor" | "None";
  title: string;
  explanation: string;
  mechanism: string;
  recommendation: string;
  saferAlternatives: Array<{
    drugId?: string;
    name: string;
    replacesDrugId?: string;
    replacesDrugName: string;
    reason: string;
  }>;
  isAiEvaluated: boolean;
  mappedIngredients: Array<{
    inputName: string;
    genericIngredients: string[];
    displayMapping: string;
    category?: string;
  }>;
  hasRedFlag: boolean;
  pairResults: EvaluatedPairInteraction[];
}

/**
 * Standard clinical synonym dictionary mapping brand names, salt forms, and abbreviations
 * (e.g., Coumadin -> Warfarin, Disprin / Ecosprin / Acetylsalicylic acid / ASA -> Aspirin)
 */
interface BrandGenericRule {
  canonicalGenerics: string[];
  clinicalKeys: string[];
  category: string;
  terms: string[];
}

const BRAND_GENERIC_RULES: BrandGenericRule[] = [
  // Multi-ingredient combinations first
  {
    canonicalGenerics: ["Ibuprofen", "Paracetamol"],
    clinicalKeys: ["ibuprofen", "paracetamol"],
    category: "Analgesic & NSAID Combination",
    terms: ["combiflam", "flexon", "ibugesic plus", "ibuclin", "ibuprofen + paracetamol", "paracetamol + ibuprofen"],
  },
  {
    canonicalGenerics: ["Paracetamol", "Phenylephrine", "Chlorpheniramine"],
    clinicalKeys: ["paracetamol", "phenylephrine", "chlorpheniramine"],
    category: "Multi-Symptom Cold & Flu Formulation",
    terms: ["sinarest", "wikoryl", "cheston cold", "febrex plus", "sumol cold", "phenylephrine-paracetamol-cpm"],
  },
  {
    canonicalGenerics: ["Mefenamic acid", "Dicyclomine"],
    clinicalKeys: ["mefenamic acid", "dicyclomine"],
    category: "Antispasmodic & NSAID Combination",
    terms: ["meftal-spas", "meftal spas", "cyclopam", "colimex"],
  },
  {
    canonicalGenerics: ["Pantoprazole", "Domperidone"],
    clinicalKeys: ["pantoprazole", "domperidone"],
    category: "PPI + Prokinetic Combination",
    terms: ["pan-d", "pan d", "pantocid-d", "pantocid d", "pantop-d", "pantop d"],
  },
  {
    canonicalGenerics: ["Aluminium Hydroxide", "Magnesium Hydroxide", "Simethicone"],
    clinicalKeys: ["aluminium hydroxide", "magnesium hydroxide", "simethicone"],
    category: "Antacid Formulation",
    terms: ["gelusil", "digene", "mucaine", "mylanta", "gelusil-antacid-liquid"],
  },
  {
    canonicalGenerics: ["Amoxicillin", "Clavulanate"],
    clinicalKeys: ["amoxicillin", "clavulanate"],
    category: "Beta-Lactam Antibiotic Combination",
    terms: ["augmentin", "augmentin 625", "moxikind-cv", "moxikind cv"],
  },
  {
    canonicalGenerics: ["Calcium carbonate", "Cholecalciferol"],
    clinicalKeys: ["calcium carbonate", "cholecalciferol"],
    category: "Bone & Mineral Supplement",
    terms: ["shelcal", "shelcal 500", "shelcal-500", "cipcal", "gemcal"],
  },

  // Anticoagulants & Antiplatelets
  {
    canonicalGenerics: ["Warfarin"],
    clinicalKeys: ["warfarin"],
    category: "Oral Anticoagulant",
    terms: ["warfarin", "coumadin", "warf", "warf 5", "warfarin sodium", "acitrom", "acenocoumarol", "marevan"],
  },
  {
    canonicalGenerics: ["Aspirin (Acetylsalicylic acid)"],
    clinicalKeys: ["aspirin"],
    category: "Antiplatelet / Salicylate NSAID",
    terms: [
      "aspirin",
      "acetylsalicylic acid",
      "acetyl salicylic acid",
      "asa",
      "disprin",
      "disprin 325",
      "disprin-325",
      "ecosprin",
      "ecosprin 75",
      "ecosprin 150",
      "aspirin-75",
      "delisprin",
      "colsprin",
      "bayer aspirin",
      "soluble aspirin",
    ],
  },
  {
    canonicalGenerics: ["Clopidogrel"],
    clinicalKeys: ["clopidogrel"],
    category: "Antiplatelet Agent",
    terms: ["clopidogrel", "plavix", "clopilet", "deplatt", "clopivas", "clopidogrel bisulfate"],
  },
  {
    canonicalGenerics: ["Heparin"],
    clinicalKeys: ["heparin"],
    category: "Parenteral Anticoagulant",
    terms: ["heparin", "heparin sodium", "unfractionated heparin", "enoxaparin", "clexane", "lovenox", "dalteparin", "fondaparinux"],
  },
  {
    canonicalGenerics: ["Apixaban"],
    clinicalKeys: ["apixaban"],
    category: "Direct Oral Anticoagulant (DOAC)",
    terms: ["apixaban", "eliquis"],
  },
  {
    canonicalGenerics: ["Rivaroxaban"],
    clinicalKeys: ["rivaroxaban"],
    category: "Direct Oral Anticoagulant (DOAC)",
    terms: ["rivaroxaban", "xarelto"],
  },
  {
    canonicalGenerics: ["Dabigatran"],
    clinicalKeys: ["dabigatran"],
    category: "Direct Oral Anticoagulant (DOAC)",
    terms: ["dabigatran", "pradaxa"],
  },
  {
    canonicalGenerics: ["Edoxaban"],
    clinicalKeys: ["edoxaban"],
    category: "Direct Oral Anticoagulant (DOAC)",
    terms: ["edoxaban", "lixiana", "savaysa"],
  },
  {
    canonicalGenerics: ["Prasugrel"],
    clinicalKeys: ["prasugrel"],
    category: "Antiplatelet Agent",
    terms: ["prasugrel", "effient", "prasita"],
  },
  {
    canonicalGenerics: ["Ticagrelor"],
    clinicalKeys: ["ticagrelor"],
    category: "Antiplatelet Agent",
    terms: ["ticagrelor", "brilinta", "axcer"],
  },

  // Cardiac Glycosides & Diuretics
  {
    canonicalGenerics: ["Digoxin"],
    clinicalKeys: ["digoxin"],
    category: "Cardiac Glycoside",
    terms: ["digoxin", "lanoxin", "cardioxin", "digitoxin"],
  },
  {
    canonicalGenerics: ["Furosemide"],
    clinicalKeys: ["furosemide"],
    category: "Loop Diuretic",
    terms: ["furosemide", "lasix", "frusenex", "frusemide", "salinex"],
  },
  {
    canonicalGenerics: ["Torasemide"],
    clinicalKeys: ["torasemide"],
    category: "Loop Diuretic",
    terms: ["torasemide", "torsemide", "dytor", "tide"],
  },
  {
    canonicalGenerics: ["Bumetanide"],
    clinicalKeys: ["bumetanide"],
    category: "Loop Diuretic",
    terms: ["bumetanide", "bumex"],
  },

  // ACE Inhibitors & Potassium-Sparing Diuretics
  {
    canonicalGenerics: ["Enalapril"],
    clinicalKeys: ["enalapril"],
    category: "ACE Inhibitor",
    terms: ["enalapril", "envas", "vasotec", "enam", "enalapril maleate", "bql"],
  },
  {
    canonicalGenerics: ["Lisinopril"],
    clinicalKeys: ["lisinopril"],
    category: "ACE Inhibitor",
    terms: ["lisinopril", "zestril", "prinivil", "lipril", "cipril"],
  },
  {
    canonicalGenerics: ["Ramipril"],
    clinicalKeys: ["ramipril"],
    category: "ACE Inhibitor",
    terms: ["ramipril", "cardace", "altace", "ramistar", "ramipres"],
  },
  {
    canonicalGenerics: ["Captopril"],
    clinicalKeys: ["captopril"],
    category: "ACE Inhibitor",
    terms: ["captopril", "capoten", "aceten"],
  },
  {
    canonicalGenerics: ["Perindopril"],
    clinicalKeys: ["perindopril"],
    category: "ACE Inhibitor",
    terms: ["perindopril", "coversyl", "conversyl"],
  },
  {
    canonicalGenerics: ["Spironolactone"],
    clinicalKeys: ["spironolactone"],
    category: "Potassium-Sparing Diuretic",
    terms: ["spironolactone", "aldactone", "spiromide"],
  },
  {
    canonicalGenerics: ["Eplerenone"],
    clinicalKeys: ["eplerenone"],
    category: "Potassium-Sparing Diuretic",
    terms: ["eplerenone", "inspra", "eptus", "planep"],
  },
  {
    canonicalGenerics: ["Amiloride"],
    clinicalKeys: ["amiloride"],
    category: "Potassium-Sparing Diuretic",
    terms: ["amiloride", "midamor"],
  },
  {
    canonicalGenerics: ["Triamterene"],
    clinicalKeys: ["triamterene"],
    category: "Potassium-Sparing Diuretic",
    terms: ["triamterene", "dyrenium"],
  },

  // Analgesics & NSAIDs
  {
    canonicalGenerics: ["Paracetamol"],
    clinicalKeys: ["paracetamol"],
    category: "Analgesic & Antipyretic",
    terms: [
      "paracetamol",
      "paracetamol-500",
      "paracetamol-650",
      "acetaminophen",
      "apap",
      "dolo",
      "dolo 650",
      "dolo 500",
      "crocin",
      "crocin 650",
      "calpol",
      "calpol 500",
      "calpol 650",
      "tylenol",
      "pacimol",
      "metacin",
      "pyrigesic",
      "sumol",
      "p-650",
    ],
  },
  {
    canonicalGenerics: ["Ibuprofen"],
    clinicalKeys: ["ibuprofen"],
    category: "NSAID Analgesic",
    terms: ["ibuprofen", "ibuprofen-200", "brufen", "brufen 400", "brufen 200", "advil", "motrin", "ibugesic", "nurofen"],
  },
  {
    canonicalGenerics: ["Diclofenac"],
    clinicalKeys: ["diclofenac"],
    category: "NSAID Analgesic",
    terms: ["diclofenac", "voveran", "voltaren", "dynapar", "cataflam", "reactin"],
  },
  {
    canonicalGenerics: ["Naproxen"],
    clinicalKeys: ["naproxen"],
    category: "NSAID Analgesic",
    terms: ["naproxen", "naprosyn", "aleve", "xenobid"],
  },
  {
    canonicalGenerics: ["Mefenamic acid"],
    clinicalKeys: ["mefenamic acid"],
    category: "NSAID Analgesic",
    terms: ["mefenamic acid", "meftal", "meftal 500", "meftal-p", "ponstan"],
  },
  {
    canonicalGenerics: ["Aceclofenac"],
    clinicalKeys: ["aceclofenac"],
    category: "NSAID Analgesic",
    terms: ["aceclofenac", "zerodol", "hifenac", "aceclo"],
  },

  // Allergy, GI, Statins, SSRIs, Antifungals, Supplements
  {
    canonicalGenerics: ["Cetirizine"],
    clinicalKeys: ["cetirizine"],
    category: "Second-Generation Antihistamine",
    terms: ["cetirizine", "cetirizine-10", "cetzine", "okacet", "zyrtec", "alerid"],
  },
  {
    canonicalGenerics: ["Levocetirizine"],
    clinicalKeys: ["levocetirizine"],
    category: "Second-Generation Antihistamine",
    terms: ["levocetirizine", "levocet", "xyzal", "teczine"],
  },
  {
    canonicalGenerics: ["Fexofenadine"],
    clinicalKeys: ["fexofenadine"],
    category: "Non-Sedating Antihistamine",
    terms: ["fexofenadine", "fexofenadine-120", "allegra", "fexo", "telfast"],
  },
  {
    canonicalGenerics: ["Pheniramine"],
    clinicalKeys: ["pheniramine"],
    category: "First-Generation Antihistamine",
    terms: ["pheniramine", "avil", "avil 25", "avil-25", "pheniramine maleate"],
  },
  {
    canonicalGenerics: ["Diphenhydramine"],
    clinicalKeys: ["diphenhydramine"],
    category: "First-Generation Sedating Antihistamine",
    terms: ["diphenhydramine", "benadryl"],
  },
  {
    canonicalGenerics: ["Omeprazole"],
    clinicalKeys: ["omeprazole"],
    category: "Proton Pump Inhibitor (PPI)",
    terms: ["omeprazole", "omeprazole-20", "omez", "omez 20", "prilosec"],
  },
  {
    canonicalGenerics: ["Pantoprazole"],
    clinicalKeys: ["pantoprazole"],
    category: "Proton Pump Inhibitor (PPI)",
    terms: ["pantoprazole", "pan 40", "pantocid", "pantop", "protonix"],
  },
  {
    canonicalGenerics: ["Rabeprazole"],
    clinicalKeys: ["rabeprazole"],
    category: "Proton Pump Inhibitor (PPI)",
    terms: ["rabeprazole", "rabeloc", "cyra", "happi"],
  },
  {
    canonicalGenerics: ["Atorvastatin"],
    clinicalKeys: ["atorvastatin"],
    category: "Statin Lipid-Lowering Agent",
    terms: ["atorvastatin", "lipitor", "atorva", "storvas", "tonact"],
  },
  {
    canonicalGenerics: ["Sertraline"],
    clinicalKeys: ["sertraline"],
    category: "SSRI Antidepressant",
    terms: ["sertraline", "zoloft", "serta", "daxid", "serlift"],
  },
  {
    canonicalGenerics: ["Fluconazole"],
    clinicalKeys: ["fluconazole"],
    category: "Triazole Antifungal",
    terms: ["fluconazole", "forcan", "forcan 150", "zocon", "diflucan"],
  },
  {
    canonicalGenerics: ["Methotrexate"],
    clinicalKeys: ["methotrexate"],
    category: "Antimetabolite / DMARD",
    terms: ["methotrexate", "folitrax", "trexall", "rheumatrex", "mtx"],
  },
  {
    canonicalGenerics: ["Iron"],
    clinicalKeys: ["iron"],
    category: "Hematinic Iron Supplement",
    terms: ["dexorange", "dexorange-syrup", "ferrous ascorbate", "ferrous sulfate", "iron supplement", "livogen", "autrin"],
  },
];

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Maps any raw ingredient or synonym to a canonical clinical key
 * (e.g., "Acetylsalicylic acid", "ASA", "Disprin", "Ecosprin" -> "aspirin";
 *  "Coumadin", "Warfarin sodium" -> "warfarin";
 *  "Acetaminophen" -> "paracetamol")
 */
export function normalizeToClinicalKey(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(\d+(\.\d+)?\s*(mg|mcg|g|ml|iu|%)|tablet|tablets|capsule|capsules|syrup|liquid|soluble|low-dose|oral|effervescent)\b/gi, " ")
    .replace(/[^\w\s+-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return raw.toLowerCase().trim();

  // Direct synonym map to standard clinical keys
  const directSynonymToKey: Record<string, string> = {
    "acetylsalicylic acid": "aspirin",
    "acetyl salicylic acid": "aspirin",
    asa: "aspirin",
    "salicylic acid": "aspirin",
    aspirin: "aspirin",
    disprin: "aspirin",
    ecosprin: "aspirin",
    colsprin: "aspirin",
    delisprin: "aspirin",
    warfarin: "warfarin",
    "warfarin sodium": "warfarin",
    coumadin: "warfarin",
    warf: "warfarin",
    acitrom: "warfarin",
    acenocoumarol: "warfarin",
    acetaminophen: "paracetamol",
    paracetamol: "paracetamol",
    apap: "paracetamol",
    propacetamol: "paracetamol",
    dolo: "paracetamol",
    crocin: "paracetamol",
    calpol: "paracetamol",
    tylenol: "paracetamol",
    ibuprofen: "ibuprofen",
    brufen: "ibuprofen",
    advil: "ibuprofen",
    motrin: "ibuprofen",
    ibugesic: "ibuprofen",
    digoxin: "digoxin",
    lanoxin: "digoxin",
    digitoxin: "digoxin",
    furosemide: "furosemide",
    frusemide: "furosemide",
    lasix: "furosemide",
    frusenex: "furosemide",
    torasemide: "torasemide",
    torsemide: "torasemide",
    dytor: "torasemide",
    bumetanide: "bumetanide",
    enalapril: "enalapril",
    "enalapril maleate": "enalapril",
    envas: "enalapril",
    vasotec: "enalapril",
    enam: "enalapril",
    lisinopril: "lisinopril",
    zestril: "lisinopril",
    prinivil: "lisinopril",
    lipril: "lisinopril",
    cipril: "lisinopril",
    ramipril: "ramipril",
    cardace: "ramipril",
    altace: "ramipril",
    captopril: "captopril",
    capoten: "captopril",
    perindopril: "perindopril",
    coversyl: "perindopril",
    spironolactone: "spironolactone",
    aldactone: "spironolactone",
    eplerenone: "eplerenone",
    inspra: "eplerenone",
    eptus: "eplerenone",
    amiloride: "amiloride",
    triamterene: "triamterene",
    clopidogrel: "clopidogrel",
    "clopidogrel bisulfate": "clopidogrel",
    plavix: "clopidogrel",
    clopilet: "clopidogrel",
    deplatt: "clopidogrel",
    heparin: "heparin",
    "heparin sodium": "heparin",
    enoxaparin: "heparin",
    clexane: "heparin",
    lovenox: "heparin",
    dalteparin: "heparin",
    fondaparinux: "heparin",
    apixaban: "apixaban",
    eliquis: "apixaban",
    rivaroxaban: "rivaroxaban",
    xarelto: "rivaroxaban",
    dabigatran: "dabigatran",
    pradaxa: "dabigatran",
    edoxaban: "edoxaban",
    lixiana: "edoxaban",
    prasugrel: "prasugrel",
    ticagrelor: "ticagrelor",
    brilinta: "ticagrelor",
    "aluminum hydroxide": "aluminium hydroxide",
    "aluminium hydroxide": "aluminium hydroxide",
    "magnesium hydroxide": "magnesium hydroxide",
    "ferrous ascorbate": "iron",
    "ferrous sulfate": "iron",
    "ferrous fumarate": "iron",
    dexorange: "iron",
  };

  if (directSynonymToKey[cleaned]) {
    return directSynonymToKey[cleaned];
  }

  for (const rule of BRAND_GENERIC_RULES) {
    if (rule.clinicalKeys.length === 1) {
      for (const term of rule.terms) {
        const regex = new RegExp(`\\b${escapeRegExp(term)}\\b`, "i");
        if (cleaned === term || regex.test(cleaned)) {
          return rule.clinicalKeys[0];
        }
      }
    }
  }

  return cleaned;
}

/**
 * Canonical display name for a clinical key
 */
export function getCanonicalDisplayName(clinicalKey: string): string {
  const displayMap: Record<string, string> = {
    aspirin: "Aspirin (Acetylsalicylic acid)",
    warfarin: "Warfarin",
    paracetamol: "Paracetamol",
    ibuprofen: "Ibuprofen",
    digoxin: "Digoxin",
    furosemide: "Furosemide",
    torasemide: "Torasemide",
    bumetanide: "Bumetanide",
    enalapril: "Enalapril",
    lisinopril: "Lisinopril",
    ramipril: "Ramipril",
    captopril: "Captopril",
    perindopril: "Perindopril",
    spironolactone: "Spironolactone",
    eplerenone: "Eplerenone",
    amiloride: "Amiloride",
    triamterene: "Triamterene",
    clopidogrel: "Clopidogrel",
    heparin: "Heparin",
    apixaban: "Apixaban",
    rivaroxaban: "Rivaroxaban",
    dabigatran: "Dabigatran",
    edoxaban: "Edoxaban",
    prasugrel: "Prasugrel",
    ticagrelor: "Ticagrelor",
    diclofenac: "Diclofenac",
    naproxen: "Naproxen",
    "mefenamic acid": "Mefenamic acid",
    aceclofenac: "Aceclofenac",
    cetirizine: "Cetirizine",
    levocetirizine: "Levocetirizine",
    fexofenadine: "Fexofenadine",
    pheniramine: "Pheniramine",
    diphenhydramine: "Diphenhydramine",
    omeprazole: "Omeprazole",
    pantoprazole: "Pantoprazole",
    rabeprazole: "Rabeprazole",
    atorvastatin: "Atorvastatin",
    sertraline: "Sertraline",
    fluconazole: "Fluconazole",
    methotrexate: "Methotrexate",
    iron: "Iron (Ferrous Salt)",
    "calcium carbonate": "Calcium carbonate",
    "aluminium hydroxide": "Aluminium Hydroxide",
    "magnesium hydroxide": "Magnesium Hydroxide",
  };
  return displayMap[clinicalKey] || clinicalKey.charAt(0).toUpperCase() + clinicalKey.slice(1);
}

/**
 * Global NLP Cleaning Function:
 * Strips common conversational phrases ('can I take', 'is it safe', 'what about', 'my doctor',
 * 'please explain', 'options', etc.) before running trigram/entity search.
 */
export function cleanDrugInput(text: string): string {
  if (!text || typeof text !== "string") return "";

  // 1. Strip conversational follow-up sentences that do not contain drug names
  let cleaned = text
    .replace(
      /\b(please explain why this combination is unsafe[^.?!]*|what safer options[^.?!]*|how should i space or manage[^.?!]*|what general dosing tips[^.?!]*|what otc options or precautions should i know[^.?!]*)/gi,
      " "
    )
    // 2. Replace common conversational phrases with a segment separator
    .replace(
      /\b(can i take|is it safe to take|is it safe|what happens if i take|what about|with my doctor|discuss with my doctor|my doctor|my pharmacist|please explain|why this combination is unsafe|what safer options|safer options|options|how should i space or manage|these medicines safely|general dosing tips|keep in mind|i am checking|i am taking|i am experiencing|what otc options|interaction between|interactions between|tell me about|what is the interaction|side effects of|uses of|what is|along with|together with|at the same time|simultaneously|compare|mixing|combining|combine|mix)\b/gi,
      " | "
    );

  // 3. Remove leftover conversational stop words while preserving drug names and delimiters
  cleaned = cleaned
    .replace(/[?!.:;]/g, " | ")
    .replace(
      /\b(please|explain|why|this|combination|unsafe|what|safer|option|options|can|discuss|my|doctor|pharmacist|how|should|space|manage|these|medicines|medications|safely|general|dosing|tips|keep|mind|checking|taking|experiencing|safe|take|about|for|me|i|am|is|it|to|the|a|an|in|on|of|precautions|know)\b/gi,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();

  return cleaned;
}

/**
 * Character-level trigram Dice similarity for fuzzy matching drug names against Db_drug_interactions.csv
 */
export function computeTrigramSimilarity(a: string, b: string): number {
  const s1 = `  ${(a || "").toLowerCase().trim()}  `;
  const s2 = `  ${(b || "").toLowerCase().trim()}  `;
  if (s1 === s2) return 1;
  if (s1.length < 3 || s2.length < 3) return 0;

  const trigrams1 = new Map<string, number>();
  for (let i = 0; i <= s1.length - 3; i++) {
    const tg = s1.slice(i, i + 3);
    trigrams1.set(tg, (trigrams1.get(tg) || 0) + 1);
  }

  let intersection = 0;
  const total2 = s2.length - 2;
  for (let i = 0; i <= s2.length - 3; i++) {
    const tg = s2.slice(i, i + 3);
    const count = trigrams1.get(tg) || 0;
    if (count > 0) {
      intersection++;
      trigrams1.set(tg, count - 1);
    }
  }

  const total1 = s1.length - 2;
  return (2 * intersection) / (total1 + total2);
}

let cachedUniqueDdiDrugNames: string[] = [];
let cachedUniqueDdiSourceLen = 0;

function getUniqueDdiDrugNames(ddiRecords: InteractionRecord[]): string[] {
  if (!ddiRecords || ddiRecords.length === 0) return [];
  if (cachedUniqueDdiDrugNames.length > 0 && cachedUniqueDdiSourceLen === ddiRecords.length) {
    return cachedUniqueDdiDrugNames;
  }
  const set = new Set<string>();
  for (let i = 0; i < ddiRecords.length; i++) {
    const r = ddiRecords[i];
    const d1 = (r?.drug1 || r?.["Drug 1"] || "").trim();
    const d2 = (r?.drug2 || r?.["Drug 2"] || "").trim();
    if (d1) set.add(d1);
    if (d2) set.add(d2);
  }
  cachedUniqueDdiDrugNames = Array.from(set);
  cachedUniqueDdiSourceLen = ddiRecords.length;
  return cachedUniqueDdiDrugNames;
}

/**
 * Matches a cleaned drug candidate against the DDI CSV drug dictionary using exact, parenthetical, or trigram similarity
 */
export function matchDrugInDdiDictionary(
  candidate: string,
  ddiRecords: InteractionRecord[] = getCachedDdiRecords() || []
): string | null {
  const clean = (candidate || "")
    .replace(/\b(\d+(\.\d+)?\s*(mg|mcg|g|ml|iu|%)|tablet|tablets|capsule|capsules|syrup|liquid|soluble|low-dose|oral|effervescent)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean || clean.length < 2) return null;

  const uniqueDrugs = getUniqueDdiDrugNames(ddiRecords);
  if (uniqueDrugs.length === 0) return null;

  const lowerClean = clean.toLowerCase();
  const parenInner = clean.match(/\(([^)]+)\)/)?.[1]?.trim().toLowerCase() || "";
  const outsideParen = clean.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim().toLowerCase();

  // 1. Exact match on full, parenthetical, or outside-parenthesis token
  for (const d of uniqueDrugs) {
    const dLower = d.toLowerCase();
    if (dLower === lowerClean || (parenInner && dLower === parenInner) || (outsideParen && dLower === outsideParen)) {
      return d;
    }
  }

  // 2. Trigram similarity search
  const target = outsideParen.length >= 3 ? outsideParen : lowerClean;
  if (target.length < 3) return null;

  let bestDrug: string | null = null;
  let bestScore = 0.58; // threshold to avoid false positives on non-drug words

  for (const d of uniqueDrugs) {
    const score = computeTrigramSimilarity(target, d.toLowerCase());
    if (score > bestScore) {
      bestScore = score;
      bestDrug = d;
    }
  }

  return bestDrug;
}

/**
 * Extracts clean drug entities from either an explicit selectedDrugs array (UI state)
 * or a natural-language user prompt pre-processed with cleanDrugInput(text).
 */
export function extractCleanDrugEntities(
  text: string,
  explicitSelectedDrugs?: string[]
): string[] {
  if (Array.isArray(explicitSelectedDrugs) && explicitSelectedDrugs.length > 0) {
    const validSelected = explicitSelectedDrugs
      .map((d) => (typeof d === "string" ? d.trim() : ""))
      .filter((d) => d.length >= 2);
    if (validSelected.length > 0) {
      return validSelected;
    }
  }

  const cleanedText = cleanDrugInput(text);
  const rawSegments = cleanedText
    .split(/\s*(?:\+|,|\band\b|\bwith\b|\bvs\b|\bor\b|\||&)\s*/i)
    .map((s) => cleanDrugInput(s))
    .map((s) => s.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9)]+$/g, "").trim())
    .filter((s) => s.length >= 2);

  const deduplicated: string[] = [];
  for (const seg of rawSegments) {
    if (!deduplicated.some((existing) => existing.toLowerCase() === seg.toLowerCase())) {
      deduplicated.push(seg);
    }
  }

  return deduplicated;
}

/**
 * Extracts and normalizes active generic ingredients from any medicine name, ID, or BasketMedicine object
 */
export function extractActiveGenerics(
  inputNameOrId: string,
  providedActiveIngredients?: string[]
): {
  genericNames: string[];
  clinicalKeys: string[];
  category: string;
  displayMapping: string;
} {
  const raw = (inputNameOrId || "").trim();
  const cleanedRaw = cleanDrugInput(raw) || raw;
  const lowerRaw = cleanedRaw.toLowerCase();
  const stripped = lowerRaw
    .replace(/\b(\d+(\.\d+)?\s*(mg|mcg|g|ml|iu|%)|tablet|tablets|capsule|capsules|syrup|liquid|soluble|low-dose|oral|effervescent)\b/gi, " ")
    .replace(/[^\w\s+-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // 1. Check multi-ingredient or exact brand/synonym rules first
  for (const rule of BRAND_GENERIC_RULES) {
    for (const term of rule.terms) {
      const regex = new RegExp(`\\b${escapeRegExp(term)}\\b`, "i");
      if (lowerRaw === term || stripped === term || regex.test(lowerRaw) || regex.test(stripped)) {
        return {
          genericNames: rule.canonicalGenerics,
          clinicalKeys: rule.clinicalKeys,
          category: rule.category,
          displayMapping: `${raw} → ${rule.canonicalGenerics.join(" + ")}`,
        };
      }
    }
  }

  // 2. Check local OTC medicine directory (allMedicines)
  const localMed = allMedicines.find(
    (m) =>
      m.id.toLowerCase() === lowerRaw ||
      m.name.toLowerCase() === lowerRaw ||
      m.name.toLowerCase().includes(stripped) ||
      m.brandNames?.some((b) => b.toLowerCase() === lowerRaw || b.toLowerCase() === stripped)
  );
  if (localMed && localMed.activeIngredients && localMed.activeIngredients.length > 0) {
    const keys = localMed.activeIngredients.map((ing) => normalizeToClinicalKey(ing));
    const names = keys.map((k, idx) =>
      k === "aspirin" ? "Aspirin" : localMed.activeIngredients[idx] || getCanonicalDisplayName(k)
    );
    return {
      genericNames: names,
      clinicalKeys: Array.from(new Set(keys)),
      category: localMed.category,
      displayMapping: `${raw} → ${names.join(" + ")}`,
    };
  }

  // 3. If activeIngredients array was explicitly passed on the basket item, normalize each ingredient
  if (providedActiveIngredients && providedActiveIngredients.length > 0) {
    // Wait: if providedActiveIngredients just echoed the brand name (e.g. ["Coumadin"]), re-resolve each item
    const resolvedKeys: string[] = [];
    const resolvedNames: string[] = [];

    for (const ing of providedActiveIngredients) {
      const ingTrim = ing.trim();
      if (!ingTrim) continue;

      let matchedRule: BrandGenericRule | undefined;
      for (const rule of BRAND_GENERIC_RULES) {
        if (
          rule.terms.some((t) => new RegExp(`\\b${escapeRegExp(t)}\\b`, "i").test(ingTrim)) ||
          rule.canonicalGenerics.some((g) => g.toLowerCase() === ingTrim.toLowerCase())
        ) {
          matchedRule = rule;
          break;
        }
      }

      if (matchedRule) {
        for (let i = 0; i < matchedRule.clinicalKeys.length; i++) {
          const k = matchedRule.clinicalKeys[i];
          const n = matchedRule.canonicalGenerics[i];
          if (!resolvedKeys.includes(k)) {
            resolvedKeys.push(k);
            resolvedNames.push(n);
          }
        }
      } else {
        const key = normalizeToClinicalKey(ingTrim);
        if (!resolvedKeys.includes(key)) {
          resolvedKeys.push(key);
          resolvedNames.push(getCanonicalDisplayName(key));
        }
      }
    }

    if (resolvedKeys.length > 0) {
      return {
        genericNames: resolvedNames,
        clinicalKeys: resolvedKeys,
        category: "Active Generic Compound",
        displayMapping: `${raw} → ${resolvedNames.join(" + ")}`,
      };
    }
  }

  // 4. Fallback: check DDI dictionary (exact/parenthetical/trigram) then normalize
  const ddiMatchedDrug = matchDrugInDdiDictionary(cleanedRaw);
  if (ddiMatchedDrug) {
    const ddiKey = normalizeToClinicalKey(ddiMatchedDrug);
    const ddiDisplayName = getCanonicalDisplayName(ddiKey) || ddiMatchedDrug;
    return {
      genericNames: [ddiMatchedDrug],
      clinicalKeys: [ddiKey],
      category: "Active Generic Compound",
      displayMapping: `${raw} → ${ddiDisplayName}`,
    };
  }

  const fallbackKey = normalizeToClinicalKey(cleanedRaw);
  const fallbackName = getCanonicalDisplayName(fallbackKey);
  return {
    genericNames: [fallbackName],
    clinicalKeys: [fallbackKey],
    category: "Active Generic Compound",
    displayMapping: `${raw} → ${fallbackName}`,
  };
}

/**
 * Pharmacological drug classes for Fallback Safety Guards & Class-Level Rules
 */
const ANTICOAGULANT_AND_ANTIPLATELET_KEYS = new Set<string>([
  "warfarin",
  "aspirin",
  "heparin",
  "enoxaparin",
  "clopidogrel",
  "prasugrel",
  "ticagrelor",
  "apixaban",
  "rivaroxaban",
  "dabigatran",
  "edoxaban",
  "acenocoumarol",
  "dipyridamole",
  "fondaparinux",
]);

const NSAID_KEYS = new Set<string>([
  "ibuprofen",
  "naproxen",
  "diclofenac",
  "mefenamic acid",
  "aceclofenac",
  "ketorolac",
  "piroxicam",
  "meloxicam",
  "indomethacin",
  "etoricoxib",
  "celecoxib",
  "nimesulide",
]);

const ACE_INHIBITOR_KEYS = new Set<string>([
  "enalapril",
  "lisinopril",
  "ramipril",
  "captopril",
  "perindopril",
  "benazepril",
  "fosinopril",
  "quinapril",
  "trandolapril",
]);

const POTASSIUM_SPARING_DIURETIC_KEYS = new Set<string>([
  "spironolactone",
  "eplerenone",
  "amiloride",
  "triamterene",
]);

const LOOP_AND_THIAZIDE_DIURETIC_KEYS = new Set<string>([
  "furosemide",
  "torasemide",
  "bumetanide",
  "hydrochlorothiazide",
  "chlorthalidone",
  "indapamide",
]);

const SEDATING_CNS_KEYS = new Set<string>([
  "cetirizine",
  "levocetirizine",
  "pheniramine",
  "diphenhydramine",
  "chlorpheniramine",
  "sertraline",
  "alprazolam",
  "diazepam",
]);

const ANTACID_CATION_KEYS = new Set<string>([
  "aluminium hydroxide",
  "magnesium hydroxide",
  "calcium carbonate",
]);

interface ClinicalInteractionRule {
  id: string;
  matches: (keyA: string, keyB: string) => boolean;
  ruleSeverity: NormalizedSeverity;
  uiSeverity: "Severe" | "Moderate" | "Minor";
  title: string;
  explanation: (nameA: string, nameB: string) => string;
  mechanism: string;
  recommendation: (nameA: string, nameB: string) => string;
  saferAlternatives?: Array<{
    drugId?: string;
    name: string;
    replacesClinicalKey: string;
    reason: string;
  }>;
}

/**
 * High-Frequency Clinical Interaction Lookup Table (Bidirectional)
 */
const CLINICAL_INTERACTION_RULES: ClinicalInteractionRule[] = [
  // 1. Warfarin + Aspirin / Acetylsalicylic acid (MAJOR SEVERE BLEEDING RISK)
  {
    id: "warfarin-aspirin",
    matches: (a, b) => (a === "warfarin" && b === "aspirin") || (a === "aspirin" && b === "warfarin"),
    ruleSeverity: "MAJOR",
    uiSeverity: "Severe",
    title: "MAJOR SEVERE BLEEDING RISK: Warfarin + Aspirin (Hemorrhage Hazard)",
    explanation: () =>
      "Combining Warfarin (Coumadin) with Aspirin / Acetylsalicylic acid (Disprin / Ecosprin) blocks both vitamin K clotting factors and platelet aggregation while irritating the stomach lining. This creates a severe, life-threatening risk of internal gastrointestinal and systemic hemorrhage.",
    mechanism:
      "Synergistic anticoagulation (VKORC1 inhibition) + irreversible platelet COX-1 blockade and gastric mucosal erosion.",
    recommendation: () =>
      "DO NOT combine Warfarin and Aspirin unless explicitly prescribed and closely monitored (INR checks) by your cardiologist or hematologist. For pain or fever, discuss plain Paracetamol with your doctor. Seek emergency care immediately if unusual bruising, nosebleeds, bleeding gums, or black tarry stools occur.",
    saferAlternatives: [
      {
        drugId: "paracetamol-500",
        name: "Paracetamol 500mg (Single Agent)",
        replacesClinicalKey: "aspirin",
        reason: "Provides pain and fever relief without irritating gastric mucosa or inhibiting platelet aggregation.",
      },
    ],
  },

  // 2. Ibuprofen + Aspirin / Acetylsalicylic acid (Reduced Antiplatelet Effect / GI Ulcer Risk)
  {
    id: "ibuprofen-aspirin",
    matches: (a, b) => (a === "ibuprofen" && b === "aspirin") || (a === "aspirin" && b === "ibuprofen"),
    ruleSeverity: "MAJOR",
    uiSeverity: "Severe",
    title: "MAJOR INTERACTION: Reduced Antiplatelet Effect & Severe GI Ulcer / Bleeding Risk",
    explanation: () =>
      "Ibuprofen (Brufen) competes with Aspirin (Disprin / Ecosprin) at the COX-1 binding site on platelets, blocking low-dose Aspirin's cardio-protective blood-thinning action. Taking both NSAIDs together also severely damages the protective stomach lining and sharply increases gastrointestinal ulcer and bleeding risk.",
    mechanism:
      "Steric hindrance of irreversible platelet COX-1 acetylation + additive NSAID gastric prostaglandin depletion.",
    recommendation: () =>
      "Do NOT take Ibuprofen and Aspirin together. If you take low-dose Aspirin for heart protection, use Paracetamol for pain/fever relief instead, or take immediate-release Aspirin at least 30–60 minutes before Ibuprofen under physician guidance.",
    saferAlternatives: [
      {
        drugId: "paracetamol-500",
        name: "Paracetamol 500mg",
        replacesClinicalKey: "ibuprofen",
        reason: "Does not interfere with Aspirin's antiplatelet heart protection or compound stomach ulcer risk.",
      },
    ],
  },

  // 3. Digoxin + Furosemide / Loop Diuretics (Hypokalemia-induced Digoxin Toxicity Risk)
  {
    id: "digoxin-furosemide",
    matches: (a, b) =>
      (a === "digoxin" && LOOP_AND_THIAZIDE_DIURETIC_KEYS.has(b)) ||
      (b === "digoxin" && LOOP_AND_THIAZIDE_DIURETIC_KEYS.has(a)),
    ruleSeverity: "MODERATE",
    uiSeverity: "Moderate",
    title: "Moderate Interaction • Monitor Closely: Hypokalemia-Induced Digoxin Toxicity Risk",
    explanation: (nameA, nameB) =>
      `Combining ${nameA} and ${nameB} requires close electrolyte monitoring. Loop/thiazide diuretics like Furosemide (Lasix) increase urinary loss of potassium and magnesium. Low blood potassium (hypokalemia) sensitizes the heart muscle to Digoxin (Lanoxin), significantly increasing the risk of Digoxin toxicity and cardiac arrhythmias.`,
    mechanism:
      "Diuretic-induced hypokalemia and hypomagnesemia increasing myocardial Na+/K+-ATPase binding and automaticity of Digoxin.",
    recommendation: () =>
      "Monitor closely: Check serum potassium, magnesium, and kidney function regularly. Your physician may prescribe a potassium supplement or adjust your diuretic dose. Contact your doctor immediately if you experience nausea, loss of appetite, visual changes (yellow/green halos), or irregular heartbeat.",
  },

  // 4. ACE Inhibitors (Enalapril/Lisinopril/Ramipril) + Potassium-Sparing Diuretics (Spironolactone/Eplerenone) (Hyperkalemia Risk)
  {
    id: "acei-spironolactone",
    matches: (a, b) =>
      (ACE_INHIBITOR_KEYS.has(a) && POTASSIUM_SPARING_DIURETIC_KEYS.has(b)) ||
      (ACE_INHIBITOR_KEYS.has(b) && POTASSIUM_SPARING_DIURETIC_KEYS.has(a)),
    ruleSeverity: "MAJOR",
    uiSeverity: "Severe",
    title: "MAJOR INTERACTION: Severe Hyperkalemia Risk (ACE Inhibitor + Potassium-Sparing Diuretic)",
    explanation: (nameA, nameB) =>
      `Combining an ACE inhibitor (${nameA}) with a potassium-sparing diuretic (${nameB}) causes additive potassium retention in the bloodstream. This significantly increases the risk of severe, potentially life-threatening hyperkalemia (high blood potassium) and cardiac arrhythmias, especially in patients with kidney impairment or diabetes.`,
    mechanism:
      "ACE inhibitor suppression of aldosterone combined with direct mineralocorticoid receptor / ENaC blockade in the distal nephron, markedly reducing renal potassium excretion.",
    recommendation: () =>
      "Monitor serum potassium and kidney function (creatinine / eGFR) closely if co-prescribed. Strictly avoid over-the-counter potassium supplements or potassium-enriched salt substitutes. Seek immediate medical care if you develop muscle weakness, numbness/tingling, or palpitations.",
  },

  // 5. Fallback Safety Guard: Any Two Antiplatelet / Anticoagulant Drugs
  {
    id: "dual-anticoagulant-antiplatelet-guard",
    matches: (a, b) =>
      a !== b &&
      ANTICOAGULANT_AND_ANTIPLATELET_KEYS.has(a) &&
      ANTICOAGULANT_AND_ANTIPLATELET_KEYS.has(b),
    ruleSeverity: "MAJOR",
    uiSeverity: "Severe",
    title: "MAJOR INTERACTION ALERT: Increased Hemorrhage & Severe Bleeding Risk",
    explanation: (nameA, nameB) =>
      `Both ${nameA} and ${nameB} are potent blood-thinning (anticoagulant / antiplatelet) medications. Taking two blood thinners together compounds inhibition of normal hemostasis, drastically increasing the risk of major internal bleeding, gastrointestinal hemorrhage, and severe bruising.`,
    mechanism:
      "Additive / synergistic inhibition of platelet aggregation and coagulation cascade pathways.",
    recommendation: (nameA, nameB) =>
      `Do NOT combine ${nameA} and ${nameB} without specialist cardiology or hematology supervision. Watch closely for signs of bleeding (bleeding gums, dark tarry stools, blood in urine, persistent nosebleeds, or dizziness) and seek immediate emergency care if they occur.`,
  },

  // 6. Anticoagulant/Antiplatelet + NSAID (Hemorrhage Risk)
  {
    id: "anticoagulant-nsaid-guard",
    matches: (a, b) =>
      (ANTICOAGULANT_AND_ANTIPLATELET_KEYS.has(a) && NSAID_KEYS.has(b)) ||
      (ANTICOAGULANT_AND_ANTIPLATELET_KEYS.has(b) && NSAID_KEYS.has(a)),
    ruleSeverity: "MAJOR",
    uiSeverity: "Severe",
    title: "MAJOR INTERACTION ALERT: Severe Gastrointestinal & Systemic Bleeding Risk",
    explanation: (nameA, nameB) =>
      `Combining a blood thinner (${nameA}) with an NSAID anti-inflammatory painkiller (${nameB}) erodes the protective stomach lining while impairing blood clotting, multiplying the risk of severe gastrointestinal bleeding and hemorrhage.`,
    mechanism:
      "NSAID-induced COX-1 mucosal erosion and antiplatelet effect compounded by systemic anticoagulation/antiplatelet therapy.",
    recommendation: () =>
      "Avoid taking oral NSAIDs with blood thinners. Consult your doctor or pharmacist about using plain Paracetamol (Acetaminophen) or a localized topical gel for pain relief.",
    saferAlternatives: [
      {
        drugId: "paracetamol-500",
        name: "Paracetamol 500mg",
        replacesClinicalKey: "ibuprofen",
        reason: "Relieves fever and mild-to-moderate pain without causing NSAID gastric mucosal erosion.",
      },
    ],
  },

  // 7. Dual NSAIDs (Gastric Ulcer & Renal Strain Hazard)
  {
    id: "dual-nsaid-guard",
    matches: (a, b) => a !== b && NSAID_KEYS.has(a) && NSAID_KEYS.has(b),
    ruleSeverity: "MAJOR",
    uiSeverity: "Severe",
    title: "MAJOR INTERACTION: Duplicate NSAID Class (Severe Gastric Ulcer & Bleeding Risk)",
    explanation: (nameA, nameB) =>
      `Both ${nameA} and ${nameB} belong to the NSAID (non-steroidal anti-inflammatory) family. Taking two NSAIDs together offers no extra pain relief but sharply increases the risk of stomach ulcers, gastrointestinal bleeding, and acute kidney strain.`,
    mechanism:
      "Additive COX-1 and COX-2 inhibition depleting gastroprotective and renal vasodilatory prostaglandins.",
    recommendation: () =>
      "Never take two different oral NSAIDs at the same time. Choose a single medication and take it with food or milk.",
  },

  // 8. Methotrexate + NSAIDs / Aspirin
  {
    id: "methotrexate-nsaid",
    matches: (a, b) =>
      (a === "methotrexate" && (NSAID_KEYS.has(b) || b === "aspirin")) ||
      (b === "methotrexate" && (NSAID_KEYS.has(a) || a === "aspirin")),
    ruleSeverity: "MAJOR",
    uiSeverity: "Severe",
    title: "MAJOR INTERACTION: Methotrexate Toxicity Risk",
    explanation: (nameA, nameB) =>
      `NSAIDs and Salicylates reduce kidney clearance of Methotrexate, allowing Methotrexate to build up to toxic levels in the blood and risking severe bone marrow suppression and liver/mucosal toxicity.`,
    mechanism:
      "Reduced renal tubular secretion and glomerular filtration of Methotrexate.",
    recommendation: () =>
      "Do NOT take OTC NSAIDs or Aspirin while on Methotrexate without explicit approval from your rheumatologist or oncologist.",
  },

  // 9. Omeprazole + Clopidogrel (Reduced Clopidogrel Activation)
  {
    id: "omeprazole-clopidogrel",
    matches: (a, b) =>
      (a === "omeprazole" && b === "clopidogrel") || (a === "clopidogrel" && b === "omeprazole"),
    ruleSeverity: "MODERATE",
    uiSeverity: "Moderate",
    title: "Moderate Interaction • Monitor Closely: Reduced Clopidogrel Antiplatelet Efficacy",
    explanation: () =>
      "Omeprazole inhibits the liver enzyme CYP2C19, which is required to convert Clopidogrel (Plavix) into its active blood-thinning form. This can reduce Clopidogrel's cardiovascular protection.",
    mechanism: "Competitive inhibition of hepatic CYP2C19 bioactivation of Clopidogrel.",
    recommendation: () =>
      "Monitor closely: Discuss switching from Omeprazole to Pantoprazole (which has minimal CYP2C19 inhibition) with your doctor.",
  },

  // 10. Omeprazole + Fluconazole (CYP2C19 Inhibition)
  {
    id: "omeprazole-fluconazole",
    matches: (a, b) =>
      ((a === "omeprazole" || a === "pantoprazole") && b === "fluconazole") ||
      (a === "fluconazole" && (b === "omeprazole" || b === "pantoprazole")),
    ruleSeverity: "MODERATE",
    uiSeverity: "Moderate",
    title: "Moderate Interaction • Monitor Closely: Metabolic CYP2C19 / CYP3A4 Inhibition",
    explanation: (nameA, nameB) =>
      `Fluconazole slows down the liver enzymes that clear ${nameA === "Fluconazole" ? nameB : nameA}, increasing its concentration in the bloodstream and raising the likelihood of side effects.`,
    mechanism: "Inhibition of hepatic cytochrome P450 2C19 and 3A4 mediated metabolism.",
    recommendation: () =>
      "Monitor closely for increased side effects (headache, nausea, abdominal discomfort) and consult a pharmacist if prolonged antifungal therapy is required.",
  },

  // 11. Statins (Atorvastatin) + Antacids (Aluminium/Magnesium Hydroxide)
  {
    id: "atorvastatin-antacid",
    matches: (a, b) =>
      (a === "atorvastatin" && ANTACID_CATION_KEYS.has(b)) ||
      (b === "atorvastatin" && ANTACID_CATION_KEYS.has(a)),
    ruleSeverity: "MODERATE",
    uiSeverity: "Moderate",
    title: "Moderate Interaction • Monitor Closely: Reduced Statin Absorption",
    explanation: () =>
      "Liquid or chewable antacids containing Aluminium and Magnesium Hydroxide (Gelusil / Digene) can decrease the gastrointestinal absorption and plasma levels of Atorvastatin (Lipitor).",
    mechanism: "Gastrointestinal adsorption/chelation and altered intragastric pH reducing statin bioavailability.",
    recommendation: () =>
      "Monitor closely and space doses apart: Take Atorvastatin at least 2 hours before or 2 hours after taking antacids.",
  },

  // 12. Fexofenadine / PPIs / Antibiotics + Antacids
  {
    id: "absorption-antacid",
    matches: (a, b) =>
      ((a === "fexofenadine" || a === "omeprazole" || a === "ciprofloxacin" || a === "ofloxacin" || a === "iron") &&
        ANTACID_CATION_KEYS.has(b)) ||
      ((b === "fexofenadine" || b === "omeprazole" || b === "ciprofloxacin" || b === "ofloxacin" || b === "iron") &&
        ANTACID_CATION_KEYS.has(a)),
    ruleSeverity: "MODERATE",
    uiSeverity: "Moderate",
    title: "Moderate Interaction • Monitor Closely: Reduced Drug Absorption (Chelation / pH Shift)",
    explanation: (nameA, nameB) =>
      `Taking ${nameA} and ${nameB} at the same time physically binds the medication in the digestive tract or alters stomach pH, reducing absorption and effectiveness by up to 50%.`,
    mechanism: "Polyvalent cation chelation and gastric pH elevation.",
    recommendation: () =>
      "Monitor closely and separate doses by at least 2 hours so each medicine can be properly absorbed.",
  },

  // 13. Calcium + Iron Supplements
  {
    id: "calcium-iron",
    matches: (a, b) =>
      (a === "calcium carbonate" && b === "iron") || (a === "iron" && b === "calcium carbonate"),
    ruleSeverity: "MODERATE",
    uiSeverity: "Moderate",
    title: "Moderate Interaction • Monitor Closely: Reduced Iron Absorption",
    explanation: () =>
      "Calcium carbonate (Shelcal) competes with Iron supplements (Dexorange) for transport in the small intestine, significantly lowering iron absorption when taken together.",
    mechanism: "Competitive inhibition of divalent metal transporter 1 (DMT1) at intestinal enterocytes.",
    recommendation: () =>
      "Space Calcium and Iron supplements at least 2 to 4 hours apart (e.g., take Iron after lunch and Calcium after dinner).",
  },

  // 14. Additive CNS Sedation (Antihistamines / SSRIs / Benzodiazepines)
  {
    id: "cns-sedation",
    matches: (a, b) => a !== b && SEDATING_CNS_KEYS.has(a) && SEDATING_CNS_KEYS.has(b),
    ruleSeverity: "MODERATE",
    uiSeverity: "Moderate",
    title: "Moderate Interaction • Monitor Closely: Additive CNS Sedation & Drowsiness",
    explanation: (nameA, nameB) =>
      `Combining ${nameA} and ${nameB} produces additive central nervous system depression, increasing drowsiness, dizziness, brain fog, and slowed motor reflexes.`,
    mechanism: "Additive central H1 receptor antagonism / serotonergic or GABAergic CNS modulation.",
    recommendation: () =>
      "Monitor closely for excessive drowsiness. Avoid driving, operating machinery, or drinking alcohol, and consult a pharmacist before combining these medicines.",
    saferAlternatives: [
      {
        drugId: "fexofenadine-120",
        name: "Fexofenadine 120mg (Allegra)",
        replacesClinicalKey: "pheniramine",
        reason: "Non-sedating antihistamine that does not cross the blood-brain barrier.",
      },
    ],
  },
];

/**
 * Chemical synonym map for matching clinical keys against Db_drug_interactions.csv
 */
const CSV_CHEMICAL_ALIASES: Record<string, string[]> = {
  aspirin: ["acetylsalicylic acid", "aspirin", "salicylic acid", "magnesium salicylate"],
  paracetamol: ["acetaminophen", "paracetamol", "propacetamol"],
  warfarin: ["warfarin", "acenocoumarol", "dicoumarol"],
  furosemide: ["furosemide", "frusemide"],
  torasemide: ["torasemide", "torsemide"],
  digoxin: ["digoxin", "digitoxin"],
  chlorpheniramine: ["chlorpheniramine", "dexchlorpheniramine maleate"],
  pheniramine: ["pheniramine", "chlorpheniramine", "dexchlorpheniramine maleate"],
  "aluminium hydroxide": ["aluminum hydroxide", "aluminium hydroxide", "magnesium hydroxide"],
  "magnesium hydroxide": ["magnesium hydroxide", "aluminum hydroxide", "aluminium hydroxide"],
  omeprazole: ["omeprazole", "esomeprazole"],
  prednisolone: ["prednisolone", "prednisone"],
  heparin: ["heparin", "enoxaparin", "dalteparin", "fondaparinux"],
  iron: ["ferrous sulfate", "ferrous fumarate", "ferrous gluconate", "iron"],
};

const ddiPairIndexCache = new WeakMap<InteractionRecord[], Map<string, InteractionRecord>>();

function getDdiPairIndex(records: InteractionRecord[]): Map<string, InteractionRecord> {
  const cached = ddiPairIndexCache.get(records);
  if (cached) return cached;

  const map = new Map<string, InteractionRecord>();
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const d1 = (r.drug1 || r["Drug 1"] || "").toLowerCase().trim();
    const d2 = (r.drug2 || r["Drug 2"] || "").toLowerCase().trim();
    if (d1 && d2) {
      map.set(`${d1}||${d2}`, r);
    }
  }
  ddiPairIndexCache.set(records, map);
  return map;
}

export function getCsvSearchTermsForDrug(
  inputName: string,
  genericName: string,
  clinicalKey: string
): string[] {
  const terms = new Set<string>();
  const addClean = (val?: string) => {
    if (!val) return;
    const lower = val.toLowerCase().trim();
    if (lower) terms.add(lower);
    const noParens = lower.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
    if (noParens) terms.add(noParens);
    const parenMatches = lower.match(/\(([^)]+)\)/g);
    if (parenMatches) {
      for (const pm of parenMatches) {
        const inner = pm.slice(1, -1).trim();
        if (inner) {
          terms.add(inner);
          for (const part of inner.split(/[\/+,]/)) {
            const pTrim = part.trim();
            if (pTrim) terms.add(pTrim);
          }
        }
      }
    }
  };

  addClean(clinicalKey);
  addClean(genericName);
  addClean(inputName);

  const aliases = CSV_CHEMICAL_ALIASES[clinicalKey.toLowerCase().trim()];
  if (aliases) {
    for (const a of aliases) {
      terms.add(a.toLowerCase().trim());
    }
  }

  return Array.from(terms).filter(Boolean);
}

export function lookupPairInDdiRecords(
  termsA: string[],
  termsB: string[],
  ddiRecords: InteractionRecord[]
): {
  row: InteractionRecord;
  direction: string;
} | null {
  if (!ddiRecords || ddiRecords.length === 0) return null;

  const pairMap = getDdiPairIndex(ddiRecords);

  // 1. Exact bidirectional lookup in O(1) via indexed Map
  for (const a of termsA) {
    for (const b of termsB) {
      if (a === b) continue;
      const forward = pairMap.get(`${a}||${b}`);
      if (forward) {
        return {
          row: forward,
          direction: "Match 1 (Drug 1 == A, Drug 2 == B)",
        };
      }
      const reverse = pairMap.get(`${b}||${a}`);
      if (reverse) {
        return {
          row: reverse,
          direction: "Match 2 (Drug 1 == B, Drug 2 == A)",
        };
      }
    }
  }

  // 2. Fallback substring match across loaded CSV records
  for (let i = 0; i < ddiRecords.length; i++) {
    const r = ddiRecords[i];
    const d1 = (r.drug1 || r["Drug 1"] || "").toLowerCase().trim();
    const d2 = (r.drug2 || r["Drug 2"] || "").toLowerCase().trim();
    if (!d1 || !d2) continue;

    const forwardSub =
      termsA.some((a) => a.length >= 3 && d1.includes(a)) &&
      termsB.some((b) => b.length >= 3 && d2.includes(b));
    if (forwardSub) {
      return {
        row: r,
        direction: "Match 1 (Drug 1 == A, Drug 2 == B)",
      };
    }

    const reverseSub =
      termsB.some((b) => b.length >= 3 && d1.includes(b)) &&
      termsA.some((a) => a.length >= 3 && d2.includes(a));
    if (reverseSub) {
      return {
        row: r,
        direction: "Match 2 (Drug 1 == B, Drug 2 == A)",
      };
    }
  }

  return null;
}

/**
 * Shared helper that converts a raw Db_drug_interactions.csv row into
 * standardized severity, plain-English explanation, and safety guidance using
 * the exact same `classifyCsvInteractionSeverity` logic as the summary banner.
 */
export function interpretCsvRowForDisplay(
  drug1: string,
  drug2: string,
  description: string
): {
  severity: "Severe" | "Moderate" | "Minor";
  ruleSeverity: NormalizedSeverity;
  title: string;
  plainEnglish: string;
  safetyGuidance: string;
  isRedFlag: boolean;
} {
  const severity = classifyCsvInteractionSeverity(description);
  const lowerDesc = (description || "").toLowerCase();

  let plainEnglish = description;
  let safetyGuidance =
    "Consult your doctor or pharmacist before combining these medications, and monitor for any unusual symptoms.";

  if (severity === "Severe") {
    plainEnglish = `${description} Combining ${drug1} and ${drug2} carries a high clinical risk of serious adverse effects or organ toxicity.`;
    safetyGuidance = `Avoid combining ${drug1} and ${drug2} unless explicitly prescribed and closely monitored by your physician. Seek medical attention immediately if severe side effects occur.`;
  } else if (severity === "Moderate") {
    if (lowerDesc.includes("metabolism") || lowerDesc.includes("serum concentration") || lowerDesc.includes("excretion")) {
      plainEnglish = `${description} Taking ${drug1} alongside ${drug2} can alter how quickly the medication is cleared from your bloodstream, potentially increasing side effects or changing treatment effectiveness.`;
      safetyGuidance = `Monitor closely when combining ${drug1} and ${drug2}. Consult a doctor or pharmacist about whether a dose adjustment or spacing schedule is needed.`;
    } else {
      plainEnglish = `${description} Combining ${drug1} and ${drug2} requires clinical caution and monitoring to ensure safe therapeutic levels.`;
      safetyGuidance = `Use caution when taking ${drug1} and ${drug2} together. Space doses as advised by a pharmacist and watch for changes in how you feel.`;
    }
  } else {
    plainEnglish = `${description} This combination has a mild or manageable clinical interaction profile.`;
    safetyGuidance = `Follow standard package dosing instructions and inform your pharmacist if you take both ${drug1} and ${drug2} regularly.`;
  }

  const ruleSeverity: NormalizedSeverity =
    severity === "Severe" ? "MAJOR" : severity === "Moderate" ? "MODERATE" : "MINOR";

  const title =
    severity === "Severe"
      ? `MAJOR INTERACTION: ${drug1} + ${drug2}`
      : severity === "Moderate"
      ? `Moderate Interaction • Monitor Closely: ${drug1} + ${drug2}`
      : `Minor / Informational Interaction: ${drug1} + ${drug2}`;

  return {
    severity,
    ruleSeverity,
    title,
    plainEnglish,
    safetyGuidance,
    isRedFlag: severity === "Severe",
  };
}

/**
 * Bidirectional pairwise interaction lookup between two clinical generic keys
 * across both Clinical Interaction Rules and the loaded Db_drug_interactions.csv dataset array.
 */
export function checkGenericPairInteraction(
  drugAInput: string,
  genericA: string,
  keyA: string,
  drugBInput: string,
  genericB: string,
  keyB: string,
  ddiRecords: InteractionRecord[] = getCachedDdiRecords() || []
): EvaluatedPairInteraction {
  const labelA =
    drugAInput.toLowerCase() === genericA.toLowerCase() ? genericA : `${drugAInput} (${genericA})`;
  const labelB =
    drugBInput.toLowerCase() === genericB.toLowerCase() ? genericB : `${drugBInput} (${genericB})`;
  const combinedDrugNames = `${labelA} + ${labelB}`;

  // 1. Check Duplicate Active Ingredient first
  if (keyA === keyB) {
    const isParacetamol = keyA === "paracetamol";
    return {
      drugAInput,
      drugBInput,
      genericA,
      genericB,
      combinedDrugNames,
      matchedInCsv: true,
      csvDescription: `Duplicate Active Ingredient Hazard: Both ${drugAInput} and ${drugBInput} contain ${genericA}.`,
      matchDirection: "Duplicate Ingredient",
      severity: "Severe",
      ruleSeverity: "MAJOR",
      title: isParacetamol
        ? "MAJOR OVERDOSE HAZARD: Duplicate Paracetamol Intake"
        : `MAJOR OVERDOSE HAZARD: Duplicate ${genericA} Intake`,
      plainEnglish: isParacetamol
        ? `Both ${drugAInput} and ${drugBInput} contain active Paracetamol (Acetaminophen). Taking them together risks exceeding the 4,000mg maximum daily safe limit and causing severe acute liver damage.`
        : `Both ${drugAInput} and ${drugBInput} contain the exact same active ingredient (${genericA}). Taking them together causes accidental double-dosing and sharply increases toxicity risk without extra benefit.`,
      mechanism: isParacetamol
        ? "Hepatic CYP2E1 saturation leading to toxic NAPQI metabolite accumulation."
        : `Additive systemic accumulation of duplicate active ingredient (${genericA}).`,
      safetyGuidance: `DO NOT take ${drugAInput} and ${drugBInput} at the same time. Choose only one medicine containing ${genericA} and verify all multi-symptom labels.`,
      isRedFlag: true,
    };
  }

  // Look up the pair bidirectionally in the loaded CSV dataset array (Db_drug_interactions.csv)
  const termsA = getCsvSearchTermsForDrug(drugAInput, genericA, keyA);
  const termsB = getCsvSearchTermsForDrug(drugBInput, genericB, keyB);
  const csvMatch = lookupPairInDdiRecords(termsA, termsB, ddiRecords);

  // 2. Check all Clinical Interaction Rules bidirectionally: (keyA, keyB) AND (keyB, keyA)
  for (const rule of CLINICAL_INTERACTION_RULES) {
    const forwardMatch = rule.matches(keyA, keyB);
    const reverseMatch = rule.matches(keyB, keyA);
    if (forwardMatch || reverseMatch) {
      const direction =
        csvMatch?.direction ||
        (forwardMatch
          ? "Match 1 (Drug 1 == A, Drug 2 == B)"
          : "Match 2 (Drug 1 == B, Drug 2 == A)");
      const explanationText = rule.explanation(genericA, genericB);
      const recommendationText = rule.recommendation(genericA, genericB);

      const mappedAlts = (rule.saferAlternatives || []).map((alt) => ({
        drugId: alt.drugId,
        name: alt.name,
        replacesDrugName: alt.replacesClinicalKey === keyA ? drugAInput : drugBInput,
        reason: alt.reason,
      }));

      return {
        drugAInput,
        drugBInput,
        genericA,
        genericB,
        combinedDrugNames,
        matchedInCsv: true,
        csvDescription: csvMatch?.row?.description || `${rule.title} — ${rule.mechanism}`,
        matchDirection: direction,
        severity: rule.uiSeverity,
        ruleSeverity: rule.ruleSeverity,
        title: rule.title,
        plainEnglish: explanationText,
        mechanism: rule.mechanism,
        safetyGuidance: recommendationText,
        isRedFlag: rule.uiSeverity === "Severe",
        saferAlternatives: mappedAlts,
      };
    }
  }

  // 3. If matched directly in the loaded CSV dataset array (Db_drug_interactions.csv)
  if (csvMatch && csvMatch.row) {
    const rowD1 = csvMatch.row.drug1 || csvMatch.row["Drug 1"] || genericA;
    const rowD2 = csvMatch.row.drug2 || csvMatch.row["Drug 2"] || genericB;
    const rowDesc = csvMatch.row.description || csvMatch.row["Interaction Description"] || "";
    const interpreted = interpretCsvRowForDisplay(rowD1, rowD2, rowDesc);

    return {
      drugAInput,
      drugBInput,
      genericA: rowD1,
      genericB: rowD2,
      combinedDrugNames,
      matchedInCsv: true,
      csvDescription: rowDesc,
      matchDirection: csvMatch.direction,
      severity: interpreted.severity,
      ruleSeverity: interpreted.ruleSeverity,
      title: interpreted.title,
      plainEnglish: interpreted.plainEnglish,
      mechanism: rowDesc,
      safetyGuidance: interpreted.safetyGuidance,
      isRedFlag: interpreted.isRedFlag,
    };
  }

  // 4. No interaction matched
  return {
    drugAInput,
    drugBInput,
    genericA,
    genericB,
    combinedDrugNames,
    matchedInCsv: false,
    csvDescription: `No adverse interaction record found between ${genericA} and ${genericB} after bidirectional verification ([${genericA} + ${genericB}] and [${genericB} + ${genericA}]).`,
    matchDirection: "Verified Bidirectionally (No Clash)",
    severity: "None",
    ruleSeverity: "NONE",
    title: "No Major Known Direct Interaction",
    plainEnglish: `No adverse interaction between ${genericA} and ${genericB} was found in the Clinical Knowledge Base after checking both permutation directions ([${genericA} + ${genericB}] and [${genericB} + ${genericA}]).`,
    mechanism: "Distinct pharmacological pathways with no known clinically significant conflict at standard doses.",
    safetyGuidance:
      "Take both medicines as directed on their packaging with water. Maintain recommended dosing intervals and do not exceed daily maximum limits.",
    isRedFlag: false,
  };
}

/**
 * Evaluates a basket of 2+ medicines using active generic ingredient normalization,
 * bidirectional pairwise checking against the loaded Db_drug_interactions.csv dataset array,
 * fallback safety guards, and unified severity classification across all environments.
 */
export function evaluateBasketInteractions(
  basket: Array<{
    id?: string;
    name: string;
    activeIngredients?: string[];
    therapeuticClass?: string;
  }>,
  ddiRecords: InteractionRecord[] = getCachedDdiRecords() || []
): EvaluatedBasketResult {
  const mappedDrugs = basket.map((item) => {
    const extracted = extractActiveGenerics(item.name || item.id || "", item.activeIngredients);
    return {
      inputName: item.name,
      genericNames: extracted.genericNames,
      clinicalKeys: extracted.clinicalKeys,
      displayMapping: extracted.displayMapping,
      category: item.therapeuticClass || extracted.category,
    };
  });

  const allPairResults: EvaluatedPairInteraction[] = [];

  for (let i = 0; i < mappedDrugs.length; i++) {
    for (let j = i + 1; j < mappedDrugs.length; j++) {
      const drugA = mappedDrugs[i];
      const drugB = mappedDrugs[j];

      for (let idxA = 0; idxA < drugA.clinicalKeys.length; idxA++) {
        for (let idxB = 0; idxB < drugB.clinicalKeys.length; idxB++) {
          const keyA = drugA.clinicalKeys[idxA];
          const genA = drugA.genericNames[idxA] || getCanonicalDisplayName(keyA);
          const keyB = drugB.clinicalKeys[idxB];
          const genB = drugB.genericNames[idxB] || getCanonicalDisplayName(keyB);

          const pairEval = checkGenericPairInteraction(
            drugA.inputName,
            genA,
            keyA,
            drugB.inputName,
            genB,
            keyB,
            ddiRecords
          );
          allPairResults.push(pairEval);
        }
      }
    }
  }

  // Catch-all severity evaluation: check if ANY pair matched HIGH, MAJOR, MODERATE, or MINOR
  const clashingPairs = allPairResults.filter(
    (p) =>
      p.ruleSeverity === "HIGH" ||
      p.ruleSeverity === "MAJOR" ||
      p.ruleSeverity === "MODERATE" ||
      p.ruleSeverity === "MINOR" ||
      p.severity === "Severe" ||
      p.severity === "Moderate" ||
      p.severity === "Minor"
  );

  const hasMajor = clashingPairs.some(
    (p) => p.ruleSeverity === "HIGH" || p.ruleSeverity === "MAJOR" || p.severity === "Severe"
  );
  const hasModerate =
    !hasMajor &&
    clashingPairs.some((p) => p.ruleSeverity === "MODERATE" || p.severity === "Moderate");
  const hasMinor =
    !hasMajor &&
    !hasModerate &&
    clashingPairs.some((p) => p.ruleSeverity === "MINOR" || p.severity === "Minor");

  const severity: "Major" | "Moderate" | "Minor" | "None" = hasMajor
    ? "Major"
    : hasModerate
    ? "Moderate"
    : hasMinor
    ? "Minor"
    : "None";

  const overallSeverity: "Severe" | "Moderate" | "Minor" | "None" = hasMajor
    ? "Severe"
    : hasModerate
    ? "Moderate"
    : hasMinor
    ? "Minor"
    : "None";

  const saferAlternatives: EvaluatedBasketResult["saferAlternatives"] = [];
  for (const p of clashingPairs) {
    for (const alt of p.saferAlternatives || []) {
      if (!saferAlternatives.some((existing) => existing.name === alt.name)) {
        saferAlternatives.push(alt);
      }
    }
  }

  const title =
    clashingPairs.length > 0
      ? clashingPairs[0].title
      : "No Adverse Interaction Record in Clinical Database";

  const explanation =
    clashingPairs.length > 0
      ? clashingPairs.map((p) => p.plainEnglish).join(" ")
      : allPairResults.map((p) => p.plainEnglish).join(" ");

  const mechanism =
    clashingPairs.length > 0
      ? clashingPairs.map((p) => `${p.genericA} ↔ ${p.genericB}: ${p.mechanism}`).join(" | ")
      : "Verified bidirectionally ([DrugA + DrugB] and [DrugB + DrugA]) with no clashing pathways.";

  const recommendation =
    clashingPairs.length > 0
      ? clashingPairs.map((p) => p.safetyGuidance).join(" ")
      : allPairResults[0]?.safetyGuidance ||
        "Follow standard dosage instructions on packaging and consult a pharmacist if needed.";

  return {
    severity,
    overallSeverity,
    title,
    explanation,
    mechanism,
    recommendation,
    saferAlternatives,
    isAiEvaluated: true,
    mappedIngredients: mappedDrugs.map((m) => ({
      inputName: m.inputName,
      genericIngredients: m.genericNames,
      displayMapping: m.displayMapping,
      category: m.category,
    })),
    hasRedFlag: hasMajor || clashingPairs.some((p) => p.isRedFlag),
    pairResults: allPairResults,
  };
}

export interface ClinicalDrugCatalogEntry {
  id: string;
  name: string;
  activeIngredients: string[];
  therapeuticClass: string;
  keywords: string[];
}

export const CLINICAL_DRUG_SUGGESTIONS: ClinicalDrugCatalogEntry[] = [
  {
    id: "coumadin-warfarin",
    name: "Coumadin (Warfarin)",
    activeIngredients: ["Warfarin"],
    therapeuticClass: "Oral Anticoagulant",
    keywords: ["coumadin", "warfarin", "warf", "acitrom", "marevan"],
  },
  {
    id: "warfarin",
    name: "Warfarin 5mg",
    activeIngredients: ["Warfarin"],
    therapeuticClass: "Oral Anticoagulant",
    keywords: ["warfarin", "coumadin", "warf"],
  },
  {
    id: "disprin-325",
    name: "Disprin (Aspirin / Acetylsalicylic acid)",
    activeIngredients: ["Aspirin (Acetylsalicylic acid)"],
    therapeuticClass: "Salicylate / Antiplatelet NSAID",
    keywords: ["disprin", "aspirin", "acetylsalicylic acid", "asa", "soluble aspirin"],
  },
  {
    id: "aspirin-75",
    name: "Ecosprin 75 (Aspirin / Acetylsalicylic acid)",
    activeIngredients: ["Aspirin (Acetylsalicylic acid)"],
    therapeuticClass: "Antiplatelet / Salicylate",
    keywords: ["ecosprin", "aspirin", "acetylsalicylic acid", "asa", "delisprin"],
  },
  {
    id: "digoxin",
    name: "Lanoxin (Digoxin)",
    activeIngredients: ["Digoxin"],
    therapeuticClass: "Cardiac Glycoside",
    keywords: ["digoxin", "lanoxin", "cardioxin"],
  },
  {
    id: "furosemide",
    name: "Lasix (Furosemide)",
    activeIngredients: ["Furosemide"],
    therapeuticClass: "Loop Diuretic",
    keywords: ["furosemide", "lasix", "frusenex", "frusemide"],
  },
  {
    id: "ibuprofen-200",
    name: "Brufen 400 (Ibuprofen)",
    activeIngredients: ["Ibuprofen"],
    therapeuticClass: "NSAID Analgesic",
    keywords: ["ibuprofen", "brufen", "advil", "motrin", "ibugesic"],
  },
  {
    id: "enalapril",
    name: "Envas (Enalapril)",
    activeIngredients: ["Enalapril"],
    therapeuticClass: "ACE Inhibitor",
    keywords: ["enalapril", "envas", "vasotec", "enam"],
  },
  {
    id: "lisinopril",
    name: "Zestril (Lisinopril)",
    activeIngredients: ["Lisinopril"],
    therapeuticClass: "ACE Inhibitor",
    keywords: ["lisinopril", "zestril", "prinivil", "lipril", "cipril"],
  },
  {
    id: "spironolactone",
    name: "Aldactone (Spironolactone)",
    activeIngredients: ["Spironolactone"],
    therapeuticClass: "Potassium-Sparing Diuretic",
    keywords: ["spironolactone", "aldactone", "spiromide"],
  },
  {
    id: "clopidogrel",
    name: "Plavix (Clopidogrel)",
    activeIngredients: ["Clopidogrel"],
    therapeuticClass: "Antiplatelet Agent",
    keywords: ["clopidogrel", "plavix", "clopilet", "deplatt"],
  },
  {
    id: "heparin",
    name: "Heparin / Clexane (Enoxaparin)",
    activeIngredients: ["Heparin"],
    therapeuticClass: "Parenteral Anticoagulant",
    keywords: ["heparin", "clexane", "enoxaparin", "lovenox"],
  },
];

