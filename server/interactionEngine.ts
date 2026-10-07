import fs from "fs";
import path from "path";
import readline from "readline";
import { medicineEngine } from "./medicineEngine.ts";

export interface CsvInteractionRow {
  drug1: string;
  drug2: string;
  description: string;
}

export interface MappedDrugInfo {
  inputName: string;
  genericIngredients: string[];
  displayMapping: string;
  category?: string;
}

export interface PairMatchResult {
  drugAInput?: string;
  drugBInput?: string;
  genericA: string;
  genericB: string;
  combinedDrugNames?: string;
  matchedInCsv: boolean;
  csvRow?: CsvInteractionRow;
  csvDescription?: string;
  matchDirection?: "Match 1 (Drug 1 == A, Drug 2 == B)" | "Match 2 (Drug 1 == B, Drug 2 == A)" | "Duplicate Ingredient";
  severity: "Severe" | "Moderate" | "Minor" | "None";
  ruleSeverity?: "HIGH" | "MAJOR" | "MODERATE" | "MINOR" | "NONE";
  title?: string;
  mechanism?: string;
  plainEnglish: string;
  safetyGuidance: string;
  isRedFlag: boolean;
}

export interface SeraInteractionLookupResult {
  drugsInput: string[];
  mappedDrugs: MappedDrugInfo[];
  pairResults: PairMatchResult[];
  overallSeverity: "Severe" | "Moderate" | "Minor" | "None";
  hasRedFlag: boolean;
  formattedResponse: string;
}

/**
 * COMPREHENSIVE SYNONYM & BRAND NAME MAPPING DICTIONARY
 * Maps brand names, colloquial terms, and multi-ingredient combinations to standard active generic compounds.
 */
interface DictionaryEntry {
  canonicalDisplay: string;
  generics: string[]; // Primary generic compounds
  csvSearchAliases: Record<string, string[]>; // Additional chemical synonyms in db_drug_interactions.csv
  category: string;
  synonyms: string[];
}

const SYNONYM_DICTIONARY: DictionaryEntry[] = [
  // --- A. PAIN, FEVER & INFLAMMATION (Analgesics / Antipyretics / NSAIDs) ---
  {
    canonicalDisplay: "Paracetamol + Ibuprofen",
    generics: ["Paracetamol", "Ibuprofen"],
    csvSearchAliases: {
      Paracetamol: ["acetaminophen", "paracetamol", "propacetamol"],
      Ibuprofen: ["ibuprofen"],
    },
    category: "Analgesic & NSAID Combination",
    synonyms: ["combiflam", "flexon", "ibugesic plus", "paracetamol + ibuprofen", "ibuprofen + paracetamol"],
  },
  {
    canonicalDisplay: "Mefenamic Acid + Dicyclomine",
    generics: ["Mefenamic acid", "Dicyclomine"],
    csvSearchAliases: {
      "Mefenamic acid": ["mefenamic acid"],
      Dicyclomine: ["dicyclomine"],
    },
    category: "Antispasmodic & NSAID Combination",
    synonyms: ["meftal-spas", "meftal spas", "cyclopam", "colimex", "mefenamic acid + dicyclomine"],
  },
  {
    canonicalDisplay: "Paracetamol (Acetaminophen)",
    generics: ["Paracetamol"],
    csvSearchAliases: {
      Paracetamol: ["acetaminophen", "paracetamol", "propacetamol"],
    },
    category: "Analgesic & Antipyretic",
    synonyms: [
      "paracetamol", "acetaminophen", "crocin", "dolo", "dolo 650", "dolo-650", "calpol",
      "metacin", "pacimol", "febrex", "pyrigesic", "tylenol", "apap", "acetaminofen", "paracetmol",
    ],
  },
  {
    canonicalDisplay: "Ibuprofen",
    generics: ["Ibuprofen"],
    csvSearchAliases: {
      Ibuprofen: ["ibuprofen"],
    },
    category: "NSAID",
    synonyms: ["ibuprofen", "brufen", "ibugesic", "advil", "motrin", "nurofen", "ibuprofin"],
  },
  {
    canonicalDisplay: "Mefenamic Acid",
    generics: ["Mefenamic acid"],
    csvSearchAliases: {
      "Mefenamic acid": ["mefenamic acid"],
    },
    category: "NSAID",
    synonyms: ["mefenamic acid", "meftal", "ponstan", "mefgesic", "meftal 500", "meftal-p"],
  },
  {
    canonicalDisplay: "Aspirin (Acetylsalicylic Acid)",
    generics: ["Acetylsalicylic acid"],
    csvSearchAliases: {
      "Acetylsalicylic acid": ["acetylsalicylic acid", "aspirin", "salicylic acid"],
    },
    category: "Salicylate / Antiplatelet NSAID",
    synonyms: ["aspirin", "acetylsalicylic acid", "disprin", "ecosprin", "ecosprin 75", "asa", "bayer", "aspirina"],
  },
  {
    canonicalDisplay: "Diclofenac",
    generics: ["Diclofenac"],
    csvSearchAliases: {
      Diclofenac: ["diclofenac"],
    },
    category: "NSAID",
    synonyms: ["diclofenac", "voveran", "dynapar", "reactin", "cataflam", "voltaren"],
  },
  {
    canonicalDisplay: "Aceclofenac",
    generics: ["Aceclofenac"],
    csvSearchAliases: {
      Aceclofenac: ["aceclofenac"],
    },
    category: "NSAID",
    synonyms: ["aceclofenac", "zerodol", "hifenac", "aceclo"],
  },
  {
    canonicalDisplay: "Naproxen",
    generics: ["Naproxen"],
    csvSearchAliases: {
      Naproxen: ["naproxen"],
    },
    category: "NSAID",
    synonyms: ["naproxen", "naprosyn", "aleve", "xenobid"],
  },

  // --- B. ALLERGIES, COLD & COUGH (Antihistamines & Decongestants) ---
  {
    canonicalDisplay: "Paracetamol + Phenylephrine + Chlorpheniramine",
    generics: ["Paracetamol", "Phenylephrine", "Chlorpheniramine"],
    csvSearchAliases: {
      Paracetamol: ["acetaminophen", "paracetamol", "propacetamol"],
      Phenylephrine: ["phenylephrine", "pseudoephedrine"],
      Chlorpheniramine: ["chlorpheniramine", "dexchlorpheniramine maleate"],
    },
    category: "Multi-Ingredient Cold & Flu Formulation",
    synonyms: ["sinarest", "cheston cold", "sumol cold", "wikoryl", "febrex plus"],
  },
  {
    canonicalDisplay: "Cetirizine",
    generics: ["Cetirizine"],
    csvSearchAliases: {
      Cetirizine: ["cetirizine"],
    },
    category: "Second-Generation Antihistamine",
    synonyms: ["cetirizine", "cetzine", "okacet", "cetriz", "zyrtec", "alerid"],
  },
  {
    canonicalDisplay: "Levocetirizine",
    generics: ["Levocetirizine"],
    csvSearchAliases: {
      Levocetirizine: ["levocetirizine"],
    },
    category: "Second-Generation Antihistamine",
    synonyms: ["levocetirizine", "levocet", "l-hist", "xyzal", "teczine"],
  },
  {
    canonicalDisplay: "Fexofenadine",
    generics: ["Fexofenadine"],
    csvSearchAliases: {
      Fexofenadine: ["fexofenadine"],
    },
    category: "Non-Sedating Antihistamine",
    synonyms: ["fexofenadine", "allegra", "fexo", "telfast"],
  },
  {
    canonicalDisplay: "Pheniramine",
    generics: ["Pheniramine"],
    csvSearchAliases: {
      Pheniramine: ["pheniramine", "chlorpheniramine", "dexchlorpheniramine maleate"],
    },
    category: "First-Generation Antihistamine",
    synonyms: ["pheniramine", "avil", "avil 25", "pheniramine maleate"],
  },
  {
    canonicalDisplay: "Diphenhydramine",
    generics: ["Diphenhydramine"],
    csvSearchAliases: {
      Diphenhydramine: ["diphenhydramine"],
    },
    category: "First-Generation Sedating Antihistamine",
    synonyms: ["diphenhydramine", "benadryl"],
  },
  {
    canonicalDisplay: "Chlorpheniramine Maleate (CPM)",
    generics: ["Chlorpheniramine"],
    csvSearchAliases: {
      Chlorpheniramine: ["chlorpheniramine", "dexchlorpheniramine maleate"],
    },
    category: "First-Generation Antihistamine",
    synonyms: ["chlorpheniramine", "chlorpheniramine maleate", "cpm", "cadistin", "dexchlorpheniramine maleate"],
  },
  {
    canonicalDisplay: "Phenylephrine / Pseudoephedrine",
    generics: ["Phenylephrine"],
    csvSearchAliases: {
      Phenylephrine: ["phenylephrine", "pseudoephedrine"],
    },
    category: "Nasal Decongestant",
    synonyms: ["phenylephrine", "pseudoephedrine", "sudafed", "nasivion", "actifed"],
  },

  // --- C. ACIDITY, STOMACH & DIGESTION (Antacids, H2 Blockers, PPIs) ---
  {
    canonicalDisplay: "Pantoprazole + Domperidone",
    generics: ["Pantoprazole", "Domperidone"],
    csvSearchAliases: {
      Pantoprazole: ["pantoprazole"],
      Domperidone: ["domperidone"],
    },
    category: "PPI + Prokinetic Combination",
    synonyms: ["pan-d", "pan d", "pantocid-d", "pantocid d", "pantop-d", "pantop d", "pantoprazole + domperidone"],
  },
  {
    canonicalDisplay: "Aluminium Hydroxide + Magnesium Hydroxide + Simethicone",
    generics: ["Aluminium Hydroxide", "Magnesium Hydroxide", "Simethicone"],
    csvSearchAliases: {
      "Aluminium Hydroxide": ["aluminium hydroxide", "aluminum hydroxide", "magnesium hydroxide"],
      "Magnesium Hydroxide": ["magnesium hydroxide", "magnesium salicylate"],
      Simethicone: ["simethicone"],
    },
    category: "Antacid Multi-Ingredient",
    synonyms: ["digene", "gelusil", "mucaine", "mylanta", "antacid"],
  },
  {
    canonicalDisplay: "Pantoprazole",
    generics: ["Pantoprazole"],
    csvSearchAliases: {
      Pantoprazole: ["pantoprazole"],
    },
    category: "Proton Pump Inhibitor (PPI)",
    synonyms: ["pantoprazole", "pan", "pan 40", "pantocid", "pantop", "protonix"],
  },
  {
    canonicalDisplay: "Omeprazole",
    generics: ["Omeprazole"],
    csvSearchAliases: {
      Omeprazole: ["omeprazole", "esomeprazole"],
    },
    category: "Proton Pump Inhibitor (PPI)",
    synonyms: ["omeprazole", "omez", "omez 20", "prilosec"],
  },
  {
    canonicalDisplay: "Rabeprazole",
    generics: ["Rabeprazole"],
    csvSearchAliases: {
      Rabeprazole: ["rabeprazole", "pantoprazole", "omeprazole"],
    },
    category: "Proton Pump Inhibitor (PPI)",
    synonyms: ["rabeprazole", "rabeloc", "cyra", "happi"],
  },
  {
    canonicalDisplay: "Ranitidine / Famotidine",
    generics: ["Ranitidine"],
    csvSearchAliases: {
      Ranitidine: ["ranitidine", "famotidine", "cimetidine"],
    },
    category: "H2 Receptor Blocker",
    synonyms: ["ranitidine", "famotidine", "rantac", "zinetac", "pepcid"],
  },

  // --- D. DERMATOLOGY & PHOTOSENSITIZING DRUGS ---
  {
    canonicalDisplay: "Trioxsalen / Methoxsalen",
    generics: ["Trioxsalen"],
    csvSearchAliases: {
      Trioxsalen: ["trioxsalen", "methoxsalen", "psoralen"],
    },
    category: "Photosensitizing Psoralen",
    synonyms: ["trioxsalen", "methoxsalen", "trisoralen", "oxsoralen", "psoralen"],
  },
  {
    canonicalDisplay: "Verteporfin",
    generics: ["Verteporfin"],
    csvSearchAliases: {
      Verteporfin: ["verteporfin"],
    },
    category: "Photosensitizing Agent",
    synonyms: ["verteporfin", "visudyne"],
  },

  // --- E. COMMON ANTIBIOTICS ---
  {
    canonicalDisplay: "Azithromycin",
    generics: ["Azithromycin"],
    csvSearchAliases: {
      Azithromycin: ["azithromycin"],
    },
    category: "Macrolide Antibiotic",
    synonyms: ["azithromycin", "azithral", "azithral 500", "azee", "azee 500", "zithromax"],
  },
  {
    canonicalDisplay: "Amoxicillin + Clavulanate",
    generics: ["Amoxicillin", "Clavulanate"],
    csvSearchAliases: {
      Amoxicillin: ["amoxicillin"],
      Clavulanate: ["clavulanate", "clavulanic acid"],
    },
    category: "Beta-Lactam Antibiotic Combination",
    synonyms: ["moxikind-cv", "moxikind cv", "augmentin", "augmentin 625", "amoxicillin + clavulanate"],
  },
  {
    canonicalDisplay: "Amoxicillin",
    generics: ["Amoxicillin"],
    csvSearchAliases: {
      Amoxicillin: ["amoxicillin"],
    },
    category: "Penicillin Antibiotic",
    synonyms: ["amoxicillin", "mox", "mox 500", "novamox"],
  },
  {
    canonicalDisplay: "Ciprofloxacin",
    generics: ["Ciprofloxacin"],
    csvSearchAliases: {
      Ciprofloxacin: ["ciprofloxacin"],
    },
    category: "Fluoroquinolone Antibiotic",
    synonyms: ["ciprofloxacin", "ciplox", "ciplox 500", "ciprofloxacn"],
  },
  {
    canonicalDisplay: "Ofloxacin",
    generics: ["Ofloxacin"],
    csvSearchAliases: {
      Ofloxacin: ["ofloxacin", "ciprofloxacin", "levofloxacin"],
    },
    category: "Fluoroquinolone Antibiotic",
    synonyms: ["ofloxacin", "zanocin", "oflo", "oflo 200"],
  },

  // --- F. CARDIOVASCULAR, ANTICOAGULANTS, DIABETES, ANTIFUNGALS & NEUROLOGY ---
  {
    canonicalDisplay: "Atorvastatin",
    generics: ["Atorvastatin"],
    csvSearchAliases: {
      Atorvastatin: ["atorvastatin"],
    },
    category: "Statin Lipid-Lowering Agent",
    synonyms: ["atorvastatin", "lipitor", "atorva", "atorva 10", "atorva 20", "storvas", "tonact"],
  },
  {
    canonicalDisplay: "Warfarin",
    generics: ["Warfarin"],
    csvSearchAliases: {
      Warfarin: ["warfarin", "acenocoumarol"],
    },
    category: "Oral Anticoagulant",
    synonyms: ["warfarin", "coumadin", "warf", "warf 5", "warfarin sodium", "acitrom", "acenocoumarol", "marevan"],
  },
  {
    canonicalDisplay: "Heparin",
    generics: ["Heparin"],
    csvSearchAliases: {
      Heparin: ["heparin", "enoxaparin", "dalteparin", "fondaparinux"],
    },
    category: "Parenteral Anticoagulant",
    synonyms: ["heparin", "heparin sodium", "enoxaparin", "clexane", "lovenox", "dalteparin", "fondaparinux"],
  },
  {
    canonicalDisplay: "Apixaban",
    generics: ["Apixaban"],
    csvSearchAliases: {
      Apixaban: ["apixaban"],
    },
    category: "Direct Oral Anticoagulant (DOAC)",
    synonyms: ["apixaban", "eliquis"],
  },
  {
    canonicalDisplay: "Rivaroxaban",
    generics: ["Rivaroxaban"],
    csvSearchAliases: {
      Rivaroxaban: ["rivaroxaban"],
    },
    category: "Direct Oral Anticoagulant (DOAC)",
    synonyms: ["rivaroxaban", "xarelto"],
  },
  {
    canonicalDisplay: "Dabigatran",
    generics: ["Dabigatran"],
    csvSearchAliases: {
      Dabigatran: ["dabigatran", "dabigatran etexilate"],
    },
    category: "Direct Oral Anticoagulant (DOAC)",
    synonyms: ["dabigatran", "pradaxa"],
  },
  {
    canonicalDisplay: "Digoxin",
    generics: ["Digoxin"],
    csvSearchAliases: {
      Digoxin: ["digoxin", "digitoxin"],
    },
    category: "Cardiac Glycoside",
    synonyms: ["digoxin", "lanoxin", "cardioxin", "digitoxin"],
  },
  {
    canonicalDisplay: "Furosemide",
    generics: ["Furosemide"],
    csvSearchAliases: {
      Furosemide: ["furosemide", "torasemide", "bumetanide"],
    },
    category: "Loop Diuretic",
    synonyms: ["furosemide", "lasix", "frusenex", "frusemide", "salinex"],
  },
  {
    canonicalDisplay: "Torasemide",
    generics: ["Torasemide"],
    csvSearchAliases: {
      Torasemide: ["torasemide", "furosemide"],
    },
    category: "Loop Diuretic",
    synonyms: ["torasemide", "torsemide", "dytor", "tide"],
  },
  {
    canonicalDisplay: "Enalapril",
    generics: ["Enalapril"],
    csvSearchAliases: {
      Enalapril: ["enalapril", "enalaprilat"],
    },
    category: "ACE Inhibitor",
    synonyms: ["enalapril", "envas", "vasotec", "enam", "enalapril maleate"],
  },
  {
    canonicalDisplay: "Lisinopril",
    generics: ["Lisinopril"],
    csvSearchAliases: {
      Lisinopril: ["lisinopril"],
    },
    category: "ACE Inhibitor",
    synonyms: ["lisinopril", "zestril", "prinivil", "cipril", "lipril"],
  },
  {
    canonicalDisplay: "Ramipril",
    generics: ["Ramipril"],
    csvSearchAliases: {
      Ramipril: ["ramipril"],
    },
    category: "ACE Inhibitor",
    synonyms: ["ramipril", "cardace", "altace", "ramistar", "ramipres"],
  },
  {
    canonicalDisplay: "Captopril",
    generics: ["Captopril"],
    csvSearchAliases: {
      Captopril: ["captopril"],
    },
    category: "ACE Inhibitor",
    synonyms: ["captopril", "capoten", "aceten"],
  },
  {
    canonicalDisplay: "Perindopril",
    generics: ["Perindopril"],
    csvSearchAliases: {
      Perindopril: ["perindopril"],
    },
    category: "ACE Inhibitor",
    synonyms: ["perindopril", "coversyl", "conversyl"],
  },
  {
    canonicalDisplay: "Spironolactone",
    generics: ["Spironolactone"],
    csvSearchAliases: {
      Spironolactone: ["spironolactone"],
    },
    category: "Potassium-Sparing Diuretic",
    synonyms: ["spironolactone", "aldactone", "spiromide"],
  },
  {
    canonicalDisplay: "Eplerenone",
    generics: ["Eplerenone"],
    csvSearchAliases: {
      Eplerenone: ["eplerenone"],
    },
    category: "Potassium-Sparing Diuretic",
    synonyms: ["eplerenone", "inspra", "eptus", "planep"],
  },
  {
    canonicalDisplay: "Amiloride",
    generics: ["Amiloride"],
    csvSearchAliases: {
      Amiloride: ["amiloride"],
    },
    category: "Potassium-Sparing Diuretic",
    synonyms: ["amiloride", "midamor"],
  },
  {
    canonicalDisplay: "Triamterene",
    generics: ["Triamterene"],
    csvSearchAliases: {
      Triamterene: ["triamterene"],
    },
    category: "Potassium-Sparing Diuretic",
    synonyms: ["triamterene", "dyrenium"],
  },
  {
    canonicalDisplay: "Amlodipine",
    generics: ["Amlodipine"],
    csvSearchAliases: {
      Amlodipine: ["amlodipine"],
    },
    category: "Calcium Channel Blocker",
    synonyms: ["amlodipine", "amlong", "amlong 5", "stamlo", "norvasc", "amlokind"],
  },
  {
    canonicalDisplay: "Metoprolol",
    generics: ["Metoprolol"],
    csvSearchAliases: {
      Metoprolol: ["metoprolol"],
    },
    category: "Beta-Blocker",
    synonyms: ["metoprolol", "betaloc", "metolar", "lopressor", "prolomet"],
  },
  {
    canonicalDisplay: "Atenolol",
    generics: ["Atenolol"],
    csvSearchAliases: {
      Atenolol: ["atenolol"],
    },
    category: "Beta-Blocker",
    synonyms: ["atenolol", "tenormin", "aten", "aten 50", "betacard"],
  },
  {
    canonicalDisplay: "Clopidogrel",
    generics: ["Clopidogrel"],
    csvSearchAliases: {
      Clopidogrel: ["clopidogrel"],
    },
    category: "Antiplatelet Agent",
    synonyms: ["clopidogrel", "plavix", "clopilet", "deplatt", "clopivas"],
  },
  {
    canonicalDisplay: "Metformin",
    generics: ["Metformin"],
    csvSearchAliases: {
      Metformin: ["metformin"],
    },
    category: "Biguanide Antidiabetic",
    synonyms: ["metformin", "glycomet", "glycomet 500", "glucophage", "obimet", "metsmall"],
  },
  {
    canonicalDisplay: "Tolbutamide",
    generics: ["Tolbutamide"],
    csvSearchAliases: {
      Tolbutamide: ["tolbutamide"],
    },
    category: "Sulfonylurea Antidiabetic",
    synonyms: ["tolbutamide", "rastinon", "orinase"],
  },
  {
    canonicalDisplay: "Sertraline",
    generics: ["Sertraline"],
    csvSearchAliases: {
      Sertraline: ["sertraline"],
    },
    category: "SSRI Antidepressant",
    synonyms: ["sertraline", "zoloft", "serta", "daxid", "serlift"],
  },
  {
    canonicalDisplay: "Fluconazole",
    generics: ["Fluconazole"],
    csvSearchAliases: {
      Fluconazole: ["fluconazole"],
    },
    category: "Triazole Antifungal",
    synonyms: ["fluconazole", "forcan", "forcan 150", "zocon", "diflucan", "fluka"],
  },
  {
    canonicalDisplay: "Sildenafil",
    generics: ["Sildenafil"],
    csvSearchAliases: {
      Sildenafil: ["sildenafil"],
    },
    category: "PDE5 Inhibitor",
    synonyms: ["sildenafil", "viagra", "caverta", "manforce", "penegra", "revatio"],
  },
  {
    canonicalDisplay: "Methotrexate",
    generics: ["Methotrexate"],
    csvSearchAliases: {
      Methotrexate: ["methotrexate"],
    },
    category: "Antimetabolite / DMARD",
    synonyms: ["methotrexate", "folitrax", "trexall", "rheumatrex", "mtx"],
  },
  {
    canonicalDisplay: "Prednisolone",
    generics: ["Prednisolone"],
    csvSearchAliases: {
      Prednisolone: ["prednisolone", "prednisone"],
    },
    category: "Corticosteroid",
    synonyms: ["prednisolone", "wysolone", "omnacortil", "prednisone", "deltasone"],
  },
  {
    canonicalDisplay: "Alprazolam",
    generics: ["Alprazolam"],
    csvSearchAliases: {
      Alprazolam: ["alprazolam"],
    },
    category: "Benzodiazepine",
    synonyms: ["alprazolam", "xanax", "alprax", "restyl", "trika"],
  },
  {
    canonicalDisplay: "Diazepam",
    generics: ["Diazepam"],
    csvSearchAliases: {
      Diazepam: ["diazepam"],
    },
    category: "Benzodiazepine",
    synonyms: ["diazepam", "valium", "calmpose", "placidox"],
  },
  {
    canonicalDisplay: "Calcium Carbonate + Vitamin D3",
    generics: ["Calcium carbonate", "Cholecalciferol"],
    csvSearchAliases: {
      "Calcium carbonate": ["calcium carbonate"],
      Cholecalciferol: ["cholecalciferol"],
    },
    category: "Bone & Mineral Supplement",
    synonyms: ["shelcal", "shelcal 500", "calcium carbonate", "cipcal", "gemcal"],
  },
];

function cleanDrugToken(str: string): string {
  return str
    .toLowerCase()
    .replace(/\b(\d+\s*(mg|mcg|g|ml|iu)|tablet|tablets|capsule|capsules|syrup|oral|liquid|duo|plus)\b/gi, (m) => {
      // keep "plus" or "650" if part of brand like dolo 650 or ibugesic plus
      return m;
    })
    .replace(/[^\w\s+-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalize any user-supplied drug name into its active generic ingredients
 * using:
 * 1. The Comprehensive Synonym & Brand Name Mapping Dictionary
 * 2. The 248k+ Medicine Knowledge Base (medicineEngine) brand-to-generic resolver
 * 3. Direct active compound matching in db_drug_interactions.csv
 */
export function mapDrugToGenerics(rawInput: string): MappedDrugInfo & { aliasMap: Record<string, string[]> } {
  const trimmed = rawInput.trim();
  const lower = cleanDrugToken(trimmed);
  const strippedDosage = lower
    .replace(/\b(\d+\s*(mg|mcg|g|ml|iu)|tablet|tablets|capsule|capsules|syrup|suspension|low-dose|liquid)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  // Pass 1: Check exact synonym match first
  for (const entry of SYNONYM_DICTIONARY) {
    for (const syn of entry.synonyms) {
      if (lower === syn || strippedDosage === syn) {
        const isExactGeneric =
          entry.generics.length === 1 &&
          entry.generics[0].toLowerCase() === strippedDosage;
        const displayMapping = isExactGeneric
          ? `${trimmed} is ${entry.canonicalDisplay}`
          : `${trimmed} contains ${entry.generics.join(" + ")}`;

        return {
          inputName: trimmed,
          genericIngredients: entry.generics,
          displayMapping,
          category: entry.category,
          aliasMap: entry.csvSearchAliases,
        };
      }
    }
  }

  // Pass 2: Check word-boundary synonym match
  for (const entry of SYNONYM_DICTIONARY) {
    for (const syn of entry.synonyms) {
      const escapedSyn = syn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b${escapedSyn}\\b`, "i");
      if (regex.test(lower) || regex.test(strippedDosage)) {
        const isExactGeneric =
          entry.generics.length === 1 &&
          entry.generics[0].toLowerCase() === strippedDosage;
        const displayMapping = isExactGeneric
          ? `${trimmed} is ${entry.canonicalDisplay}`
          : `${trimmed} contains ${entry.generics.join(" + ")}`;

        return {
          inputName: trimmed,
          genericIngredients: entry.generics,
          displayMapping,
          category: entry.category,
          aliasMap: entry.csvSearchAliases,
        };
      }
    }
  }

  // Pass 3: Resolve through the 248k+ Medicine Knowledge Base (medicineEngine)
  try {
    const knownSet = drugInteractionEngine ? drugInteractionEngine.getUniqueDrugLowerSet() : undefined;
    const medResolved = medicineEngine.resolveBrandFromIndex(trimmed, knownSet);
    if (medResolved && medResolved.genericIngredients.length > 0) {
      // Map each resolved generic through SYNONYM_DICTIONARY aliases if applicable
      const aliasMap: Record<string, string[]> = {};
      for (const gen of medResolved.genericIngredients) {
        const genLower = gen.toLowerCase();
        const dictMatch = SYNONYM_DICTIONARY.find(
          (e) =>
            e.generics.some((g) => g.toLowerCase() === genLower) ||
            e.synonyms.includes(genLower)
        );
        if (dictMatch) {
          const primaryGen = dictMatch.generics[0];
          aliasMap[gen] = dictMatch.csvSearchAliases[primaryGen] || [genLower];
        } else {
          aliasMap[gen] = [genLower];
        }
      }

      return {
        inputName: trimmed,
        genericIngredients: medResolved.genericIngredients,
        displayMapping:
          medResolved.displayMapping ||
          `${trimmed} contains ${medResolved.genericIngredients.join(" + ")}`,
        category: medResolved.matchedRecord?.therapeuticClass || "Resolved Brand / Active Generic",
        aliasMap,
      };
    }
  } catch {}

  // Fallback: treat the input as its own active generic name
  const cleanGeneric = strippedDosage
    ? strippedDosage.charAt(0).toUpperCase() + strippedDosage.slice(1)
    : trimmed;

  return {
    inputName: trimmed,
    genericIngredients: [cleanGeneric],
    displayMapping: `${trimmed} (Active generic compound: ${cleanGeneric})`,
    category: "Active Generic Compound",
    aliasMap: {
      [cleanGeneric]: [cleanGeneric.toLowerCase(), trimmed.toLowerCase()],
    },
  };
}

/**
 * Parse RFC-4180 CSV line
 */
function parseCsvRow(line: string): string[] {
  const res: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      res.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  res.push(cur.trim());
  return res;
}

export interface DatasetDrugSummary {
  name: string;
  interactionCount: number;
  samplePartners: string[];
  brandExamples: string[];
  category?: string;
}

export class DrugInteractionEngine {
  // Key: "drug1_lower||drug2_lower" -> CsvInteractionRow
  private exactPairMap = new Map<string, CsvInteractionRow>();
  private allRows: CsvInteractionRow[] = [];
  private uniqueDrugsMap = new Map<string, { name: string; count: number; samplePartners: string[] }>();
  private uniqueDrugLowerSet = new Set<string>();
  private totalRowsLoaded = 0;
  private loadedFilePaths: string[] = [];

  constructor() {
    setImmediate(() => {
      try {
        this.autoLoadCsvFiles();
      } catch (e) {
        console.warn("Deferred CSV load warning:", e);
      }
    });
  }

  public getStats() {
    return {
      totalInteractionPairs: this.exactPairMap.size,
      uniqueDrugsCount: this.uniqueDrugsMap.size,
      totalRowsLoaded: this.totalRowsLoaded,
      loadedFiles: this.loadedFilePaths,
    };
  }

  public getUniqueDrugLowerSet(): Set<string> {
    return this.uniqueDrugLowerSet;
  }

  public addInteractionRow(drug1: string, drug2: string, description: string): void {
    const d1 = drug1.trim();
    const d2 = drug2.trim();
    const desc = description.trim();
    if (!d1 || !d2 || !desc) return;

    const k1 = d1.toLowerCase();
    const k2 = d2.toLowerCase();
    const key1 = `${k1}||${k2}`;
    const key2 = `${k2}||${k1}`;

    if (!this.exactPairMap.has(key1) && !this.exactPairMap.has(key2)) {
      const rowObj: CsvInteractionRow = { drug1: d1, drug2: d2, description: desc };
      this.exactPairMap.set(key1, rowObj);
      this.allRows.push(rowObj);
      this.totalRowsLoaded++;

      this.uniqueDrugLowerSet.add(k1);
      this.uniqueDrugLowerSet.add(k2);

      const u1 = this.uniqueDrugsMap.get(k1) || { name: d1, count: 0, samplePartners: [] };
      u1.count++;
      if (u1.samplePartners.length < 5 && !u1.samplePartners.includes(d2)) {
        u1.samplePartners.push(d2);
      }
      this.uniqueDrugsMap.set(k1, u1);

      const u2 = this.uniqueDrugsMap.get(k2) || { name: d2, count: 0, samplePartners: [] };
      u2.count++;
      if (u2.samplePartners.length < 5 && !u2.samplePartners.includes(d1)) {
        u2.samplePartners.push(d1);
      }
      this.uniqueDrugsMap.set(k2, u2);
    }
  }

  public loadCsvFromFileSync(filePath: string): { count: number } {
    if (!fs.existsSync(filePath)) return { count: 0 };
    let count = 0;
    const rawContent = fs.readFileSync(filePath, "utf8");
    const lines = rawContent.split(/\r?\n/);
    let isHeader = true;

    for (const line of lines) {
      if (!line.trim()) continue;
      const cols = parseCsvRow(line);
      if (isHeader) {
        isHeader = false;
        if (cols[0]?.toLowerCase().includes("drug")) continue;
      }
      if (cols.length >= 3) {
        this.addInteractionRow(cols[0], cols[1], cols.slice(2).join(", "));
        count++;
      }
    }

    const base = path.basename(filePath);
    if (!this.loadedFilePaths.includes(base)) {
      this.loadedFilePaths.push(base);
    }
    return { count };
  }

  public async loadCsvFromFile(filePath: string): Promise<{ count: number }> {
    return this.loadCsvFromFileSync(filePath);
  }

  private autoLoadCsvFiles(): void {
    const candidates = [
      path.resolve(process.cwd(), "public", "Db_drug_interactions.csv"),
      path.resolve(process.cwd(), "public", "db_drug_interactions.csv"),
      path.resolve(process.cwd(), "db_drug_interactions.csv"),
      path.resolve(process.cwd(), "data", "db_drug_interactions.csv"),
      path.resolve(process.cwd(), "src", "data", "db_drug_interactions.csv"),
      "/tmp/db_drug_interactions.csv",
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        try {
          this.loadCsvFromFileSync(p);
        } catch (e) {
          console.error("Failed loading db_drug_interactions.csv:", e);
        }
      }
    }
  }

  /**
   * Search across all 1,166 unique drugs in db_drug_interactions.csv + mapped brand names
   */
  public searchDatasetDrugs(query: string = "", limit: number = 30): DatasetDrugSummary[] {
    const q = query.trim().toLowerCase();
    const results: DatasetDrugSummary[] = [];

    // Build brand lookup helper
    const getBrandsForGeneric = (genName: string): { brands: string[]; category?: string } => {
      const lowerGen = genName.toLowerCase();
      for (const entry of SYNONYM_DICTIONARY) {
        const aliases = Object.values(entry.csvSearchAliases).flat();
        if (
          entry.generics.some((g) => g.toLowerCase() === lowerGen) ||
          aliases.includes(lowerGen)
        ) {
          const brands = entry.synonyms
            .filter((s) => s !== lowerGen && !s.includes("+"))
            .slice(0, 4)
            .map((b) => b.charAt(0).toUpperCase() + b.slice(1));
          return { brands, category: entry.category };
        }
      }
      return { brands: [] };
    };

    const allEntries = Array.from(this.uniqueDrugsMap.values()).sort((a, b) => b.count - a.count);

    for (const item of allEntries) {
      const { brands, category } = getBrandsForGeneric(item.name);
      if (!q) {
        results.push({
          name: item.name,
          interactionCount: item.count,
          samplePartners: item.samplePartners,
          brandExamples: brands,
          category,
        });
      } else {
        const nameLower = item.name.toLowerCase();
        const brandMatch = brands.some((b) => b.toLowerCase().includes(q));
        const partnerMatch = item.samplePartners.some((p) => p.toLowerCase().includes(q));
        if (nameLower.includes(q) || brandMatch || partnerMatch) {
          results.push({
            name: item.name,
            interactionCount: item.count,
            samplePartners: item.samplePartners,
            brandExamples: brands,
            category,
          });
        }
      }
      if (results.length >= limit) break;
    }

    return results;
  }

  /**
   * Browse & filter interaction rows directly from db_drug_interactions.csv
   */
  public browseInteractions(options: { query?: string; drug?: string; limit?: number; offset?: number } = {}) {
    const q = (options.query || "").trim().toLowerCase();
    const drugFilter = (options.drug || "").trim();
    const limit = Math.min(options.limit || 24, 100);
    const offset = options.offset || 0;

    // If a brand name is searched in the dataset browser, also resolve its generic aliases
    let resolvedTerms: string[] = [];
    if (q) {
      resolvedTerms.push(q);
      const mapped = mapDrugToGenerics(q);
      for (const g of mapped.genericIngredients) {
        resolvedTerms.push(g.toLowerCase());
        const aliases = mapped.aliasMap[g] || [];
        for (const a of aliases) resolvedTerms.push(a.toLowerCase());
      }
      resolvedTerms = Array.from(new Set(resolvedTerms));
    }

    let drugFilterTerms: string[] = [];
    if (drugFilter) {
      drugFilterTerms.push(drugFilter.toLowerCase());
      const mapped = mapDrugToGenerics(drugFilter);
      for (const g of mapped.genericIngredients) {
        drugFilterTerms.push(g.toLowerCase());
        const aliases = mapped.aliasMap[g] || [];
        for (const a of aliases) drugFilterTerms.push(a.toLowerCase());
      }
      drugFilterTerms = Array.from(new Set(drugFilterTerms));
    }

    const matchedRows: Array<{
      drug1: string;
      drug2: string;
      description: string;
      severity: "Severe" | "Moderate" | "Minor" | "None";
      plainEnglish: string;
      safetyGuidance: string;
    }> = [];

    let totalMatching = 0;

    for (const row of this.allRows) {
      const d1Lower = row.drug1.toLowerCase();
      const d2Lower = row.drug2.toLowerCase();
      const descLower = row.description.toLowerCase();

      if (drugFilterTerms.length > 0) {
        const matchesDrug = drugFilterTerms.some((t) => d1Lower === t || d2Lower === t);
        if (!matchesDrug) continue;
      }

      if (resolvedTerms.length > 0) {
        const matchesQuery = resolvedTerms.some(
          (t) => d1Lower.includes(t) || d2Lower.includes(t) || descLower.includes(t)
        );
        if (!matchesQuery) continue;
      }

      totalMatching++;
      if (totalMatching > offset && matchedRows.length < limit) {
        const interpreted = interpretCsvInteraction(row.drug1, row.drug2, row.description);
        matchedRows.push({
          drug1: row.drug1,
          drug2: row.drug2,
          description: row.description,
          severity: interpreted.severity,
          plainEnglish: interpreted.plainEnglish,
          safetyGuidance: interpreted.safetyGuidance,
        });
      }
    }

    return {
      totalMatching,
      totalDatasetPairs: this.exactPairMap.size,
      uniqueDrugsCount: this.uniqueDrugsMap.size,
      rows: matchedRows,
    };
  }

  /**
   * BIDIRECTIONAL (PERMUTATION-PROOF) SEARCH ALGORITHM
   * Checks:
   * - Row Match 1: [Drug 1 == Generic Drug A] AND [Drug 2 == Generic Drug B]
   * - Row Match 2: [Drug 1 == Generic Drug B] AND [Drug 2 == Generic Drug A]
   * Treats Match 1 and Match 2 as 100% EQUIVALENT.
   */
  public searchBidirectional(
    genericA: string,
    aliasesA: string[],
    genericB: string,
    aliasesB: string[]
  ): {
    matched: boolean;
    row?: CsvInteractionRow;
    direction?: "Match 1 (Drug 1 == A, Drug 2 == B)" | "Match 2 (Drug 1 == B, Drug 2 == A)" | "Duplicate Ingredient";
  } {
    const normA = genericA.toLowerCase().trim();
    const normB = genericB.toLowerCase().trim();

    const setA = Array.from(new Set([normA, ...(aliasesA || []).map((a) => a.toLowerCase().trim())]));
    const setB = Array.from(new Set([normB, ...(aliasesB || []).map((b) => b.toLowerCase().trim())]));

    // Check if both map to the exact same active ingredient (Duplicate Ingredient overdose risk)
    if (normA === normB || setA.some((a) => setB.includes(a))) {
      return {
        matched: true,
        direction: "Duplicate Ingredient",
        row: {
          drug1: genericA,
          drug2: genericB,
          description: `Duplicate Active Ingredient Warning: Both medicines contain ${genericA}. Taking them together doubles the dose and significantly increases the risk of acute toxicity and overdose.`,
        },
      };
    }

    // 1. Search db_drug_interactions.csv for Row Match 1: [Drug 1 == Generic Drug A] AND [Drug 2 == Generic Drug B]
    for (const a of setA) {
      for (const b of setB) {
        const key1 = `${a}||${b}`;
        const match1 = this.exactPairMap.get(key1);
        if (match1) {
          return {
            matched: true,
            row: match1,
            direction: "Match 1 (Drug 1 == A, Drug 2 == B)",
          };
        }
      }
    }

    // 2. Search db_drug_interactions.csv for Row Match 2: [Drug 1 == Generic Drug B] AND [Drug 2 == Generic Drug A]
    for (const b of setB) {
      for (const a of setA) {
        const key2 = `${b}||${a}`;
        const match2 = this.exactPairMap.get(key2);
        if (match2) {
          return {
            matched: true,
            row: match2,
            direction: "Match 2 (Drug 1 == B, Drug 2 == A)",
          };
        }
      }
    }

    return { matched: false };
  }

  /**
   * Evaluate a list of 2 or more drugs (breaking down multi-ingredient combinations)
   */
  public evaluateDrugs(drugInputs: string[], userQueryText: string = ""): SeraInteractionLookupResult {
    const mappedInfos = drugInputs.map((d) => mapDrugToGenerics(d));
    const pairResults: PairMatchResult[] = [];

    // Check for red-flag emergency symptoms in user query text
    const lowerQuery = userQueryText.toLowerCase();
    const symptomRedFlags = [
      "shortness of breath",
      "difficulty breathing",
      "can't breathe",
      "severe stomach pain",
      "gastrointestinal bleeding",
      "vomiting blood",
      "black tarry stools",
      "blood in stool",
      "collapse",
      "fainted",
      "unconscious",
      "chest pain",
      "anaphylaxis",
      "swelling of face",
      "overdose",
    ];
    const hasSymptomRedFlag = symptomRedFlags.some((flag) => lowerQuery.includes(flag));

    // Evaluate every pair of input drugs, and for each pair, evaluate all active generic ingredient combinations
    for (let i = 0; i < mappedInfos.length; i++) {
      for (let j = i + 1; j < mappedInfos.length; j++) {
        const drugA = mappedInfos[i];
        const drugB = mappedInfos[j];

        for (const genA of drugA.genericIngredients) {
          for (const genB of drugB.genericIngredients) {
            const aliasesA = drugA.aliasMap[genA] || [genA.toLowerCase()];
            const aliasesB = drugB.aliasMap[genB] || [genB.toLowerCase()];

            const searchRes = this.searchBidirectional(genA, aliasesA, genB, aliasesB);
            const clinicalRuleRes = evaluateClinicalPairRule(genA, genB);

            const labelA =
              drugA.inputName.toLowerCase() === genA.toLowerCase()
                ? genA
                : `${drugA.inputName} (${genA})`;
            const labelB =
              drugB.inputName.toLowerCase() === genB.toLowerCase()
                ? genB
                : `${drugB.inputName} (${genB})`;
            const combinedDrugNames = `${labelA} + ${labelB}`;

            if (clinicalRuleRes) {
              const csvRowObj = searchRes.row || {
                drug1: genA,
                drug2: genB,
                description: `${clinicalRuleRes.title} — ${clinicalRuleRes.mechanism}`,
              };
              pairResults.push({
                drugAInput: drugA.inputName,
                drugBInput: drugB.inputName,
                genericA: genA,
                genericB: genB,
                combinedDrugNames,
                matchedInCsv: true,
                csvRow: csvRowObj,
                csvDescription: searchRes.row?.description || `${clinicalRuleRes.title} — ${clinicalRuleRes.mechanism}`,
                matchDirection: searchRes.direction || clinicalRuleRes.direction,
                severity: clinicalRuleRes.severity,
                ruleSeverity: clinicalRuleRes.ruleSeverity,
                title: clinicalRuleRes.title,
                mechanism: clinicalRuleRes.mechanism,
                plainEnglish: clinicalRuleRes.plainEnglish,
                safetyGuidance: clinicalRuleRes.safetyGuidance,
                isRedFlag: clinicalRuleRes.isRedFlag || hasSymptomRedFlag,
              });
            } else if (searchRes.matched && searchRes.row) {
              const interpreted = interpretCsvInteraction(genA, genB, searchRes.row.description, searchRes.direction);
              pairResults.push({
                drugAInput: drugA.inputName,
                drugBInput: drugB.inputName,
                genericA: genA,
                genericB: genB,
                combinedDrugNames,
                matchedInCsv: true,
                csvRow: searchRes.row,
                csvDescription: searchRes.row.description,
                matchDirection: searchRes.direction,
                severity: interpreted.severity,
                ruleSeverity: interpreted.severity === "Severe" ? "MAJOR" : "MODERATE",
                title: interpreted.severity === "Severe"
                  ? `MAJOR INTERACTION: ${genA} + ${genB}`
                  : `Moderate Interaction • Monitor closely: ${genA} + ${genB}`,
                mechanism: searchRes.row.description,
                plainEnglish: interpreted.plainEnglish,
                safetyGuidance: interpreted.safetyGuidance,
                isRedFlag: interpreted.isRedFlag || hasSymptomRedFlag,
              });
            } else {
              const noMatchDesc = `No adverse interaction record found between ${genA} and ${genB} in the Clinical Database (verified bidirectionally: [${genA} + ${genB}] and [${genB} + ${genA}]).`;
              pairResults.push({
                drugAInput: drugA.inputName,
                drugBInput: drugB.inputName,
                genericA: genA,
                genericB: genB,
                combinedDrugNames,
                matchedInCsv: false,
                csvDescription: noMatchDesc,
                severity: "None",
                plainEnglish: `No adverse interaction between ${genA} and ${genB} was found in the Clinical Knowledge Base after checking both permutation directions ([${genA} + ${genB}] and [${genB} + ${genA}]). These compounds act via distinct pathways and do not dangerously conflict at standard OTC doses.`,
                safetyGuidance: `Take both medicines as directed on their packaging with a full glass of water. Maintain standard dosing intervals and do not exceed daily maximum limits.`,
                isRedFlag: hasSymptomRedFlag,
              });
            }
          }
        }
      }
    }

    let overallSeverity: "Severe" | "Moderate" | "Minor" | "None" = "None";
    if (pairResults.some((p) => p.severity === "Severe")) {
      overallSeverity = "Severe";
    } else if (pairResults.some((p) => p.severity === "Moderate")) {
      overallSeverity = "Moderate";
    } else if (pairResults.some((p) => p.severity === "Minor")) {
      overallSeverity = "Minor";
    }

    const hasRedFlag = hasSymptomRedFlag || overallSeverity === "Severe" || pairResults.some((p) => p.isRedFlag);

    const formattedResponse = formatSeraStructuredResponse(
      mappedInfos,
      pairResults,
      overallSeverity,
      hasRedFlag,
      hasSymptomRedFlag
    );

    return {
      drugsInput: drugInputs,
      mappedDrugs: mappedInfos.map(({ aliasMap, ...rest }) => rest),
      pairResults,
      overallSeverity,
      hasRedFlag,
      formattedResponse,
    };
  }
}

/**
 * Translate technical CSV interaction descriptions into student-friendly Plain English,
 * Safety Guidance, and Triage Severity
 */
function interpretCsvInteraction(
  genA: string,
  genB: string,
  csvDesc: string,
  direction?: string
): {
  severity: "Severe" | "Moderate" | "Minor" | "None";
  plainEnglish: string;
  safetyGuidance: string;
  isRedFlag: boolean;
} {
  const lowerDesc = csvDesc.toLowerCase();
  const pairLower = `${genA.toLowerCase()} + ${genB.toLowerCase()}`;

  // 1. Duplicate Ingredient
  if (direction === "Duplicate Ingredient") {
    return {
      severity: "Severe",
      plainEnglish: `Both medicines contain the exact same active ingredient (${genA}). Taking them together causes "double-dosing," which can overload your liver or irritate your stomach lining without giving extra symptom relief.`,
      safetyGuidance: `Do NOT take these two medicines at the same time. Choose only one medicine containing ${genA}, and always check multi-symptom cold or pain labels so you stay within safe daily limits.`,
      isRedFlag: true,
    };
  }

  // 2. Dual NSAIDs or NSAID + Aspirin (Ibuprofen, Naproxen, Diclofenac, Mefenamic acid, Aceclofenac, Acetylsalicylic acid)
  const nsaidList = ["ibuprofen", "naproxen", "diclofenac", "mefenamic acid", "aceclofenac", "acetylsalicylic acid", "aspirin", "ketorolac", "piroxicam", "meloxicam", "etoricoxib", "nimesulide"];
  const isANsaid = nsaidList.includes(genA.toLowerCase());
  const isBNsaid = nsaidList.includes(genB.toLowerCase());

  if (isANsaid && isBNsaid) {
    return {
      severity: "Severe",
      plainEnglish: `${csvDesc} In simple terms, both ${genA} and ${genB} belong to the NSAID (anti-inflammatory painkiller) family. Taking two NSAIDs together blocks the natural protective mucus in your stomach and interferes with blood clotting, sharply raising the risk of severe stomach ulcers, internal bleeding, and kidney strain.`,
      safetyGuidance: `Do NOT combine ${genA} and ${genB}. Use only one pain reliever at a time, take it with food or milk to protect your stomach, or ask a pharmacist if Paracetamol is a safer option for your symptoms.`,
      isRedFlag: true,
    };
  }

  // 3. QTc Prolongation or Arrhythmogenic or Anticoagulant / Bleeding or Neuroexcitatory
  if (
    lowerDesc.includes("qtc-prolonging") ||
    lowerDesc.includes("arrhythmogenic") ||
    lowerDesc.includes("anticoagulant") ||
    lowerDesc.includes("bleeding") ||
    lowerDesc.includes("neuroexcitatory") ||
    lowerDesc.includes("nephrotoxic")
  ) {
    return {
      severity: "Severe",
      plainEnglish: `${csvDesc} In plain English, combining ${genA} and ${genB} can over-stress vital organs (such as altering your heart's electrical rhythm, increasing bleeding tendency, or over-stimulating the nervous system).`,
      safetyGuidance: `Avoid taking ${genA} and ${genB} together unless specifically prescribed and monitored by a doctor. Contact a healthcare provider for a non-interacting alternative.`,
      isRedFlag: true,
    };
  }

  // 4. CNS Depression / Sedation
  if (
    lowerDesc.includes("central nervous system depressant") ||
    lowerDesc.includes("cns depressant") ||
    lowerDesc.includes("sedative") ||
    lowerDesc.includes("drowsiness")
  ) {
    return {
      severity: "Moderate",
      plainEnglish: `${csvDesc} Both medicines slow down signals in your central nervous system. Taking them together compounds drowsiness, dizziness, brain fog, and slowed reaction times—which is risky during classes, exams, or driving.`,
      safetyGuidance: `Avoid combining these sedating medicines. If you need allergy relief during the day, opt for a single non-drowsy antihistamine (like Fexofenadine) and completely avoid alcohol.`,
      isRedFlag: false,
    };
  }

  // 5. Absorption / Chelation (Antacids, PPIs, Minerals)
  if (lowerDesc.includes("absorption") || lowerDesc.includes("chelat") || lowerDesc.includes("enteric") || lowerDesc.includes("efficacy")) {
    return {
      severity: "Moderate",
      plainEnglish: `${csvDesc} When taken at the same time, one medicine changes stomach acid levels or physically binds to the other in your digestive tract, preventing your body from absorbing the full dose properly.`,
      safetyGuidance: `Space these medicines at least 2 hours apart (for example, take your PPI 30 minutes before breakfast, or separate antacids/minerals from antibiotics and allergy tablets by 2–3 hours).`,
      isRedFlag: false,
    };
  }

  // 6. Metabolism / Serum Concentration changes
  if (lowerDesc.includes("metabolism") || lowerDesc.includes("serum concentration") || lowerDesc.includes("excretion")) {
    return {
      severity: "Moderate",
      plainEnglish: `${csvDesc} Your liver uses shared enzyme pathways to break down these medicines. Taking ${genA} alongside ${genB} slows down how fast one is cleared from the body, which can cause higher drug levels in your bloodstream and stronger side effects.`,
      safetyGuidance: `Use caution when combining ${genA} and ${genB}. Stick strictly to the lowest effective dose, space your doses apart if advised by a pharmacist, and watch for unusual drowsiness or stomach upset.`,
      isRedFlag: false,
    };
  }

  // Default Moderate interaction from CSV
  return {
    severity: "Moderate",
    plainEnglish: `${csvDesc} Combining ${genA} and ${genB} can increase the likelihood of side effects or alter how effectively each medication works in your body.`,
    safetyGuidance: `Avoid taking both at the exact same time without consulting a doctor or campus pharmacist. Space doses appropriately and monitor how you feel.`,
    isRedFlag: false,
  };
}

/**
 * Formats the lookup result strictly following SERA's required structure:
 * 🔍 Mapped Ingredients:
 * ⚠️ Interaction Status:
 * 📖 Plain English Explanation:
 * ✅ Safety Guidance:
 * 🚨 Red-Flag Emergency Warning (If Severe):
 * MANDATORY DISCLAIMER
 */
export function formatSeraStructuredResponse(
  mappedInfos: MappedDrugInfo[],
  pairResults: PairMatchResult[],
  overallSeverity: "Severe" | "Moderate" | "Minor" | "None",
  hasRedFlag: boolean,
  hasSymptomRedFlag: boolean
): string {
  const mappingSummary = mappedInfos.map((m) => `• ${m.displayMapping}`).join("\n");

  const matchedPairs = pairResults.filter((p) => p.matchedInCsv);

  let interactionStatusLines: string[] = [];
  if (matchedPairs.length > 0) {
    interactionStatusLines = matchedPairs.map((p) => {
      if (p.matchDirection === "Duplicate Ingredient") {
        return `• DUPLICATE INGREDIENT HAZARD DETECTED (${p.genericA}): Both medicines contain ${p.genericA} [${p.severity} Risk].`;
      }
      return `• INTERACTION RETRIEVED from db_drug_interactions.csv [${p.severity} Risk]: ${p.genericA} ↔ ${p.genericB} (${p.matchDirection})\n  CSV Record: "${p.csvRow?.description}"`;
    });
  } else {
    interactionStatusLines = [
      `• No adverse interaction record found in db_drug_interactions.csv after bidirectional verification (checked both [Drug 1 == A, Drug 2 == B] and [Drug 1 == B, Drug 2 == A] for all active compounds).`,
    ];
  }

  const plainEnglishLines =
    matchedPairs.length > 0
      ? matchedPairs.map((p) => `• ${p.genericA} + ${p.genericB}: ${p.plainEnglish}`).join("\n\n")
      : pairResults.map((p) => `• ${p.plainEnglish}`).join("\n\n");

  const safetyGuidanceLines =
    matchedPairs.length > 0
      ? matchedPairs.map((p) => `• ${p.genericA} + ${p.genericB}: ${p.safetyGuidance}`).join("\n")
      : pairResults.map((p) => `• ${p.safetyGuidance}`).join("\n");

  let sections = [
    `🔍 Mapped Ingredients:\n${mappingSummary}`,
    `⚠️ Interaction Status:\n${interactionStatusLines.join("\n")}`,
    `📖 Plain English Explanation:\n${plainEnglishLines}`,
    `✅ Safety Guidance:\n${safetyGuidanceLines}`,
  ];

  if (hasRedFlag) {
    const emergencyReason = hasSymptomRedFlag
      ? "Critical red-flag symptoms (such as shortness of breath, severe stomach pain, gastrointestinal bleeding, or collapse) were detected in your query."
      : "This drug combination carries a SEVERE interaction or acute toxicity risk (such as internal stomach bleeding, liver overload, or heart rhythm disturbance).";

    sections.push(
      `🚨 Red-Flag Emergency Warning (If Severe):\nHIGH-PRIORITY MEDICAL ALERT: ${emergencyReason}\nIf anyone experiences shortness of breath, severe stomach pain, black tarry stools, vomiting blood, dizziness, or collapse, STOP taking the medication immediately and call Emergency Services:\n• India Emergency / Ambulance: 112 or 108 (AIIMS Poison Control: 1800-116-117)\n• US / Canada Emergency: 911 (Poison Control: 1-800-222-1222)\n• UK / EU Emergency: 999 / 112`
    );
  }

  sections.push(
    `SERA provides educational safety guidance grounded in verified medical databases. Always consult a certified doctor or pharmacist for personalized medical advice.`
  );

  return sections.join("\n\n");
}

/**
 * Clinical generic key normalizer for backend interaction engine
 */
function normalizeToClinicalGenericKey(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(\d+(\.\d+)?\s*(mg|mcg|g|ml|iu|%)|tablet|tablets|capsule|capsules|syrup|liquid|soluble|low-dose|oral|effervescent)\b/gi, " ")
    .replace(/[^\w\s+-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return raw.toLowerCase().trim();

  const directSynonyms: Record<string, string> = {
    "acetylsalicylic acid": "aspirin",
    "acetyl salicylic acid": "aspirin",
    asa: "aspirin",
    aspirin: "aspirin",
    disprin: "aspirin",
    ecosprin: "aspirin",
    delisprin: "aspirin",
    colsprin: "aspirin",
    warfarin: "warfarin",
    "warfarin sodium": "warfarin",
    coumadin: "warfarin",
    warf: "warfarin",
    acitrom: "warfarin",
    acenocoumarol: "warfarin",
    digoxin: "digoxin",
    lanoxin: "digoxin",
    digitoxin: "digoxin",
    furosemide: "furosemide",
    frusemide: "furosemide",
    lasix: "furosemide",
    frusenex: "furosemide",
    torasemide: "torasemide",
    torsemide: "torasemide",
    bumetanide: "bumetanide",
    enalapril: "enalapril",
    "enalapril maleate": "enalapril",
    envas: "enalapril",
    vasotec: "enalapril",
    enam: "enalapril",
    lisinopril: "lisinopril",
    zestril: "lisinopril",
    prinivil: "lisinopril",
    cipril: "lisinopril",
    lipril: "lisinopril",
    ramipril: "ramipril",
    cardace: "ramipril",
    altace: "ramipril",
    captopril: "captopril",
    perindopril: "perindopril",
    spironolactone: "spironolactone",
    aldactone: "spironolactone",
    eplerenone: "eplerenone",
    amiloride: "amiloride",
    triamterene: "triamterene",
    heparin: "heparin",
    enoxaparin: "heparin",
    clexane: "heparin",
    lovenox: "heparin",
    dalteparin: "heparin",
    fondaparinux: "heparin",
    clopidogrel: "clopidogrel",
    plavix: "clopidogrel",
    clopilet: "clopidogrel",
    deplatt: "clopidogrel",
    apixaban: "apixaban",
    eliquis: "apixaban",
    rivaroxaban: "rivaroxaban",
    xarelto: "rivaroxaban",
    dabigatran: "dabigatran",
    pradaxa: "dabigatran",
    ibuprofen: "ibuprofen",
    brufen: "ibuprofen",
    advil: "ibuprofen",
    motrin: "ibuprofen",
    paracetamol: "paracetamol",
    acetaminophen: "paracetamol",
    dolo: "paracetamol",
    crocin: "paracetamol",
    calpol: "paracetamol",
  };

  return directSynonyms[cleaned] || cleaned;
}

const SERVER_ANTICOAGULANT_KEYS = new Set<string>([
  "warfarin",
  "aspirin",
  "heparin",
  "clopidogrel",
  "apixaban",
  "rivaroxaban",
  "dabigatran",
  "edoxaban",
  "prasugrel",
  "ticagrelor",
  "acenocoumarol",
  "dipyridamole",
]);

const SERVER_NSAID_KEYS = new Set<string>([
  "ibuprofen",
  "naproxen",
  "diclofenac",
  "mefenamic acid",
  "aceclofenac",
  "ketorolac",
  "piroxicam",
  "meloxicam",
  "etoricoxib",
  "indomethacin",
]);

const SERVER_ACEI_KEYS = new Set<string>([
  "enalapril",
  "lisinopril",
  "ramipril",
  "captopril",
  "perindopril",
  "benazepril",
]);

const SERVER_POTASSIUM_SPARING_KEYS = new Set<string>([
  "spironolactone",
  "eplerenone",
  "amiloride",
  "triamterene",
]);

const SERVER_LOOP_DIURETIC_KEYS = new Set<string>([
  "furosemide",
  "torasemide",
  "bumetanide",
  "hydrochlorothiazide",
  "chlorthalidone",
  "indapamide",
]);

export interface ClinicalRuleEvaluationResult {
  ruleId: string;
  severity: "Severe" | "Moderate" | "Minor";
  ruleSeverity: "HIGH" | "MAJOR" | "MODERATE" | "MINOR";
  direction: "Match 1 (Drug 1 == A, Drug 2 == B)" | "Match 2 (Drug 1 == B, Drug 2 == A)";
  title: string;
  mechanism: string;
  plainEnglish: string;
  safetyGuidance: string;
  isRedFlag: boolean;
}

export function evaluateClinicalPairRule(genA: string, genB: string): ClinicalRuleEvaluationResult | null {
  const keyA = normalizeToClinicalGenericKey(genA);
  const keyB = normalizeToClinicalGenericKey(genB);

  // 1. Warfarin + Aspirin / Acetylsalicylic acid (MAJOR SEVERE BLEEDING RISK)
  if ((keyA === "warfarin" && keyB === "aspirin") || (keyA === "aspirin" && keyB === "warfarin")) {
    const isForward = keyA === "warfarin";
    return {
      ruleId: "warfarin-aspirin",
      severity: "Severe",
      ruleSeverity: "MAJOR",
      direction: isForward ? "Match 1 (Drug 1 == A, Drug 2 == B)" : "Match 2 (Drug 1 == B, Drug 2 == A)",
      title: "MAJOR SEVERE BLEEDING RISK: Warfarin + Aspirin (Hemorrhage Hazard)",
      mechanism: "Synergistic anticoagulation (VKORC1 inhibition) + irreversible platelet COX-1 blockade and gastric mucosal erosion.",
      plainEnglish: "Combining Warfarin (Coumadin) with Aspirin / Acetylsalicylic acid (Disprin / Ecosprin) blocks both vitamin K clotting factors and platelet aggregation while irritating the stomach lining. This creates a severe, life-threatening risk of internal gastrointestinal and systemic hemorrhage.",
      safetyGuidance: "DO NOT combine Warfarin and Aspirin unless explicitly prescribed and closely monitored (INR checks) by your cardiologist or hematologist. For pain or fever, discuss plain Paracetamol with your doctor. Seek emergency care immediately if unusual bruising, nosebleeds, bleeding gums, or black tarry stools occur.",
      isRedFlag: true,
    };
  }

  // 2. Ibuprofen + Aspirin / Acetylsalicylic acid (Reduced Antiplatelet Effect / GI Ulcer Risk)
  if ((keyA === "ibuprofen" && keyB === "aspirin") || (keyA === "aspirin" && keyB === "ibuprofen")) {
    const isForward = keyA === "ibuprofen";
    return {
      ruleId: "ibuprofen-aspirin",
      severity: "Severe",
      ruleSeverity: "MAJOR",
      direction: isForward ? "Match 1 (Drug 1 == A, Drug 2 == B)" : "Match 2 (Drug 1 == B, Drug 2 == A)",
      title: "MAJOR INTERACTION: Reduced Antiplatelet Effect & Severe GI Ulcer / Bleeding Risk",
      mechanism: "Steric hindrance of irreversible platelet COX-1 acetylation + additive NSAID gastric prostaglandin depletion.",
      plainEnglish: "Ibuprofen (Brufen) competes with Aspirin (Disprin / Ecosprin) at the COX-1 binding site on platelets, blocking low-dose Aspirin's cardio-protective blood-thinning action. Taking both NSAIDs together also severely damages the protective stomach lining and sharply increases gastrointestinal ulcer and bleeding risk.",
      safetyGuidance: "Do NOT take Ibuprofen and Aspirin together. If you take low-dose Aspirin for heart protection, use Paracetamol for pain/fever relief instead, or take immediate-release Aspirin at least 30–60 minutes before Ibuprofen under physician guidance.",
      isRedFlag: true,
    };
  }

  // 3. Digoxin + Furosemide / Loop Diuretics (Hypokalemia-induced Digoxin Toxicity Risk)
  if (
    (keyA === "digoxin" && SERVER_LOOP_DIURETIC_KEYS.has(keyB)) ||
    (keyB === "digoxin" && SERVER_LOOP_DIURETIC_KEYS.has(keyA))
  ) {
    const isForward = keyA === "digoxin";
    return {
      ruleId: "digoxin-furosemide",
      severity: "Moderate",
      ruleSeverity: "MODERATE",
      direction: isForward ? "Match 1 (Drug 1 == A, Drug 2 == B)" : "Match 2 (Drug 1 == B, Drug 2 == A)",
      title: "Moderate Interaction • Monitor closely: Hypokalemia-Induced Digoxin Toxicity Risk",
      mechanism: "Diuretic-induced hypokalemia and hypomagnesemia increasing myocardial Na+/K+-ATPase binding and automaticity of Digoxin.",
      plainEnglish: `Combining ${genA} and ${genB} requires close electrolyte monitoring. Loop/thiazide diuretics like Furosemide (Lasix) increase urinary loss of potassium and magnesium. Low blood potassium (hypokalemia) sensitizes the heart muscle to Digoxin (Lanoxin), significantly increasing the risk of Digoxin toxicity and cardiac arrhythmias.`,
      safetyGuidance: "Monitor closely: Check serum potassium, magnesium, and kidney function regularly. Your physician may prescribe a potassium supplement or adjust your diuretic dose. Contact your doctor immediately if you experience nausea, loss of appetite, visual changes (yellow/green halos), or irregular heartbeat.",
      isRedFlag: false,
    };
  }

  // 4. ACE Inhibitors (Enalapril/Lisinopril) + Potassium-Sparing Diuretics (Spironolactone) (Hyperkalemia Risk)
  if (
    (SERVER_ACEI_KEYS.has(keyA) && SERVER_POTASSIUM_SPARING_KEYS.has(keyB)) ||
    (SERVER_ACEI_KEYS.has(keyB) && SERVER_POTASSIUM_SPARING_KEYS.has(keyA))
  ) {
    const isForward = SERVER_ACEI_KEYS.has(keyA);
    return {
      ruleId: "acei-spironolactone",
      severity: "Severe",
      ruleSeverity: "MAJOR",
      direction: isForward ? "Match 1 (Drug 1 == A, Drug 2 == B)" : "Match 2 (Drug 1 == B, Drug 2 == A)",
      title: "MAJOR INTERACTION: Severe Hyperkalemia Risk (ACE Inhibitor + Potassium-Sparing Diuretic)",
      mechanism: "Dual suppression of aldosterone and ENaC-mediated renal potassium excretion, markedly reducing urinary potassium clearance.",
      plainEnglish: `Combining an ACE inhibitor (${genA}) with a potassium-sparing diuretic (${genB}) causes additive potassium retention in the bloodstream. This significantly increases the risk of severe, potentially life-threatening hyperkalemia (high blood potassium) and cardiac arrhythmias.`,
      safetyGuidance: "Monitor serum potassium and kidney function (creatinine / eGFR) closely if co-prescribed. Strictly avoid over-the-counter potassium supplements or potassium-enriched salt substitutes. Seek immediate medical care if you develop muscle weakness, numbness/tingling, or palpitations.",
      isRedFlag: true,
    };
  }

  // 5. Fallback Safety Guard: Any Two Known Antiplatelet / Anticoagulant Drugs
  if (keyA !== keyB && SERVER_ANTICOAGULANT_KEYS.has(keyA) && SERVER_ANTICOAGULANT_KEYS.has(keyB)) {
    return {
      ruleId: "dual-anticoagulant-guard",
      severity: "Severe",
      ruleSeverity: "MAJOR",
      direction: "Match 1 (Drug 1 == A, Drug 2 == B)",
      title: "MAJOR INTERACTION ALERT: Increased Hemorrhage & Severe Bleeding Risk",
      mechanism: "Additive / synergistic inhibition of platelet aggregation and coagulation cascade pathways.",
      plainEnglish: `Both ${genA} and ${genB} are potent blood-thinning (anticoagulant / antiplatelet) medications. Taking two blood thinners together compounds inhibition of normal hemostasis, drastically increasing the risk of major internal bleeding, gastrointestinal hemorrhage, and severe bruising.`,
      safetyGuidance: `Do NOT combine ${genA} and ${genB} without specialist cardiology or hematology supervision. Watch closely for signs of bleeding (bleeding gums, dark tarry stools, blood in urine, persistent nosebleeds, or dizziness) and seek immediate emergency care if they occur.`,
      isRedFlag: true,
    };
  }

  // 6. Anticoagulant/Antiplatelet + NSAID (Hemorrhage Risk)
  if (
    (SERVER_ANTICOAGULANT_KEYS.has(keyA) && SERVER_NSAID_KEYS.has(keyB)) ||
    (SERVER_ANTICOAGULANT_KEYS.has(keyB) && SERVER_NSAID_KEYS.has(keyA))
  ) {
    return {
      ruleId: "anticoagulant-nsaid-guard",
      severity: "Severe",
      ruleSeverity: "MAJOR",
      direction: "Match 1 (Drug 1 == A, Drug 2 == B)",
      title: "MAJOR INTERACTION ALERT: Severe Gastrointestinal & Systemic Bleeding Risk",
      mechanism: "NSAID-induced mucosal erosion combined with anticoagulant/antiplatelet inhibition of clotting.",
      plainEnglish: `Combining a blood thinner (${genA}) with an NSAID painkiller (${genB}) erodes the protective stomach lining while impairing blood clotting, multiplying the risk of severe gastrointestinal bleeding and hemorrhage.`,
      safetyGuidance: "Avoid taking oral NSAIDs with blood thinners. Consult your doctor or pharmacist about using plain Paracetamol (Acetaminophen) for pain relief.",
      isRedFlag: true,
    };
  }

  // 7. Dual NSAIDs
  if (keyA !== keyB && SERVER_NSAID_KEYS.has(keyA) && SERVER_NSAID_KEYS.has(keyB)) {
    return {
      ruleId: "dual-nsaid-guard",
      severity: "Severe",
      ruleSeverity: "MAJOR",
      direction: "Match 1 (Drug 1 == A, Drug 2 == B)",
      title: "MAJOR INTERACTION: Duplicate NSAID Class (Severe Gastric Ulcer & Bleeding Risk)",
      mechanism: "Additive COX-1 and COX-2 inhibition depleting gastroprotective and renal prostaglandins.",
      plainEnglish: `Both ${genA} and ${genB} belong to the NSAID family. Taking two NSAIDs together offers no extra pain relief but sharply increases the risk of stomach ulcers, gastrointestinal bleeding, and acute kidney strain.`,
      safetyGuidance: "Never take two different oral NSAIDs at the same time. Choose a single medication and take it with food or milk.",
      isRedFlag: true,
    };
  }

  return null;
}

export const drugInteractionEngine = new DrugInteractionEngine();

