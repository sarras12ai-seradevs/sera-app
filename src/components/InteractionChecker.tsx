import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  Pill,
  Sparkles,
  ArrowRight,
  Sparkle,
  Search,
  Zap,
  Loader2,
  Database,
  Check,
  RefreshCw,
  FileText,
  X,
} from "lucide-react";
import { allMedicines } from "../data/medicinesData";
import { knownInteractionPairs, analyzeBatchSafety } from "../data/interactionsData";
import { InteractionPair } from "../types";
import { useDataset } from "../context/DatasetContext";
import {
  evaluateBasketInteractions,
  extractActiveGenerics,
  interpretCsvRowForDisplay,
  getCsvSearchTermsForDrug,
  normalizeToClinicalKey,
  CLINICAL_DRUG_SUGGESTIONS,
} from "../utils/interactionEngine";
import {
  fetchAndParseDdiDataset,
  getCachedDdiRecords,
  InteractionRecord,
} from "../utils/ddiDatasetLoader";
import {
  SeverityBarChart,
  aggregateSeverityCounts,
  classifyCsvInteractionSeverity,
} from "./SeverityBarChart";

export interface InteractionCheckerProps {
  onOpenAiAssistant?: (initialPrompt?: string, selectedDrugs?: string[]) => void;
  initialDdiRecords?: InteractionRecord[];
  useDdiOnly?: boolean;
}

export interface BasketMedicine {
  id: string;
  name: string;
  activeIngredients: string[];
  therapeuticClass?: string;
  chemicalClass?: string;
  source?: "local" | "dataset" | "ddi";
}

interface DemoPair {
  name: string;
  badge: string;
  severity: "Severe" | "Moderate" | "Minor";
  drugs: BasketMedicine[];
}

/**
 * Client-side brand-to-generic helper to complement the 248k backend medicineEngine
 * and SYNONYM_DICTIONARY before querying db_drug_interactions.csv
 */
const CLIENT_BRAND_TO_GENERIC_MAP: Record<string, string[]> = {
  combiflam: ["Paracetamol", "Ibuprofen"],
  "dolo 650": ["Paracetamol"],
  dolo: ["Paracetamol"],
  crocin: ["Paracetamol"],
  calpol: ["Paracetamol"],
  tylenol: ["Paracetamol"],
  brufen: ["Ibuprofen"],
  "brufen 400": ["Ibuprofen"],
  advil: ["Ibuprofen"],
  motrin: ["Ibuprofen"],
  ecosprin: ["Acetylsalicylic acid"],
  "ecosprin 75": ["Acetylsalicylic acid"],
  disprin: ["Acetylsalicylic acid"],
  aspirin: ["Acetylsalicylic acid"],
  voveran: ["Diclofenac"],
  voltaren: ["Diclofenac"],
  meftal: ["Mefenamic acid"],
  "meftal-spas": ["Mefenamic acid", "Dicyclomine"],
  "meftal spas": ["Mefenamic acid", "Dicyclomine"],
  zerodol: ["Aceclofenac"],
  naprosyn: ["Naproxen"],
  aleve: ["Naproxen"],
  sinarest: ["Paracetamol", "Phenylephrine", "Chlorpheniramine"],
  wikoryl: ["Paracetamol", "Phenylephrine", "Chlorpheniramine"],
  cetzine: ["Cetirizine"],
  okacet: ["Cetirizine"],
  zyrtec: ["Cetirizine"],
  alerid: ["Cetirizine"],
  levocet: ["Levocetirizine"],
  xyzal: ["Levocetirizine"],
  allegra: ["Fexofenadine"],
  avil: ["Pheniramine"],
  benadryl: ["Diphenhydramine"],
  "pan-d": ["Pantoprazole", "Domperidone"],
  "pan d": ["Pantoprazole", "Domperidone"],
  "pan 40": ["Pantoprazole"],
  pantocid: ["Pantoprazole"],
  omez: ["Omeprazole"],
  "omez 20": ["Omeprazole"],
  prilosec: ["Omeprazole"],
  rabeloc: ["Rabeprazole"],
  rantac: ["Ranitidine"],
  zinetac: ["Ranitidine"],
  gelusil: ["Aluminium Hydroxide", "Magnesium Hydroxide", "Simethicone"],
  digene: ["Aluminium Hydroxide", "Magnesium Hydroxide", "Simethicone"],
  azithral: ["Azithromycin"],
  azee: ["Azithromycin"],
  augmentin: ["Amoxicillin", "Clavulanate"],
  "moxikind-cv": ["Amoxicillin", "Clavulanate"],
  mox: ["Amoxicillin"],
  novamox: ["Amoxicillin"],
  ciplox: ["Ciprofloxacin"],
  zanocin: ["Ofloxacin"],
  lipitor: ["Atorvastatin"],
  atorva: ["Atorvastatin"],
  storvas: ["Atorvastatin"],
  coumadin: ["Warfarin"],
  warf: ["Warfarin"],
  lanoxin: ["Digoxin"],
  lasix: ["Furosemide"],
  frusenex: ["Furosemide"],
  zestril: ["Lisinopril"],
  prinivil: ["Lisinopril"],
  amlong: ["Amlodipine"],
  stamlo: ["Amlodipine"],
  norvasc: ["Amlodipine"],
  betaloc: ["Metoprolol"],
  metolar: ["Metoprolol"],
  tenormin: ["Atenolol"],
  plavix: ["Clopidogrel"],
  clopilet: ["Clopidogrel"],
  glycomet: ["Metformin"],
  glucophage: ["Metformin"],
  zoloft: ["Sertraline"],
  serta: ["Sertraline"],
  forcan: ["Fluconazole"],
  zocon: ["Fluconazole"],
  diflucan: ["Fluconazole"],
  viagra: ["Sildenafil"],
  caverta: ["Sildenafil"],
  folitrax: ["Methotrexate"],
  wysolone: ["Prednisolone"],
  omnacortil: ["Prednisolone"],
  xanax: ["Alprazolam"],
  alprax: ["Alprazolam"],
  valium: ["Diazepam"],
  calmpose: ["Diazepam"],
  shelcal: ["Calcium carbonate", "Cholecalciferol"],
};

export function resolveClientBrandToGenerics(inputName: string): string[] {
  const extracted = extractActiveGenerics(inputName);
  if (extracted && extracted.genericNames.length > 0) {
    return extracted.genericNames;
  }

  const clean = inputName.trim();
  const lower = clean
    .toLowerCase()
    .replace(/\b(\d+\s*(mg|mcg|g|ml|iu)|tablet|tablets|capsule|capsules|syrup|liquid)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (CLIENT_BRAND_TO_GENERIC_MAP[lower]) {
    return CLIENT_BRAND_TO_GENERIC_MAP[lower];
  }

  for (const [brandKey, generics] of Object.entries(CLIENT_BRAND_TO_GENERIC_MAP)) {
    if (lower.includes(brandKey)) {
      return generics;
    }
  }

  const localMatch = allMedicines.find(
    (m) =>
      m.name.toLowerCase().includes(lower) ||
      m.brandNames?.some((b) => b.toLowerCase() === lower || lower.includes(b.toLowerCase()))
  );
  if (localMatch && localMatch.activeIngredients.length > 0) {
    return localMatch.activeIngredients;
  }

  return [clean];
}

const DEMO_PAIRS: DemoPair[] = [
  {
    name: "Coumadin (Warfarin) + Disprin (Aspirin)",
    badge: "Severe - Bleeding Risk",
    severity: "Severe",
    drugs: [
      {
        id: "coumadin",
        name: "Coumadin (Warfarin)",
        activeIngredients: ["Warfarin"],
        therapeuticClass: "Oral Anticoagulant",
      },
      {
        id: "disprin",
        name: "Disprin (Aspirin / Acetylsalicylic acid)",
        activeIngredients: ["Aspirin (Acetylsalicylic acid)"],
        therapeuticClass: "Antiplatelet / Salicylate NSAID",
      },
    ],
  },
  {
    name: "Lanoxin (Digoxin) + Lasix (Furosemide)",
    badge: "Moderate - Monitor closely",
    severity: "Moderate",
    drugs: [
      {
        id: "digoxin",
        name: "Lanoxin (Digoxin)",
        activeIngredients: ["Digoxin"],
        therapeuticClass: "Cardiac Glycoside",
      },
      {
        id: "furosemide",
        name: "Lasix (Furosemide)",
        activeIngredients: ["Furosemide"],
        therapeuticClass: "Loop Diuretic",
      },
    ],
  },
  {
    name: "Brufen 400 (Ibuprofen) + Disprin (Aspirin)",
    badge: "Severe - Reduced Heart Protection / GI Risk",
    severity: "Severe",
    drugs: [
      {
        id: "ibuprofen-200",
        name: "Brufen 400 (Ibuprofen)",
        activeIngredients: ["Ibuprofen"],
        therapeuticClass: "NSAID Analgesic",
      },
      {
        id: "disprin",
        name: "Disprin (Aspirin / Acetylsalicylic acid)",
        activeIngredients: ["Aspirin (Acetylsalicylic acid)"],
        therapeuticClass: "Antiplatelet / Salicylate",
      },
    ],
  },
  {
    name: "Envas (Enalapril) + Aldactone (Spironolactone)",
    badge: "Severe - Hyperkalemia Risk",
    severity: "Severe",
    drugs: [
      {
        id: "enalapril",
        name: "Envas (Enalapril)",
        activeIngredients: ["Enalapril"],
        therapeuticClass: "ACE Inhibitor",
      },
      {
        id: "spironolactone",
        name: "Aldactone (Spironolactone)",
        activeIngredients: ["Spironolactone"],
        therapeuticClass: "Potassium-Sparing Diuretic",
      },
    ],
  },
  {
    name: "Zestril (Lisinopril) + Aldactone (Spironolactone)",
    badge: "Severe - Hyperkalemia Risk",
    severity: "Severe",
    drugs: [
      {
        id: "lisinopril",
        name: "Zestril (Lisinopril)",
        activeIngredients: ["Lisinopril"],
        therapeuticClass: "ACE Inhibitor",
      },
      {
        id: "spironolactone",
        name: "Aldactone (Spironolactone)",
        activeIngredients: ["Spironolactone"],
        therapeuticClass: "Potassium-Sparing Diuretic",
      },
    ],
  },
  {
    name: "Paracetamol 500mg + Combiflam",
    badge: "Severe - Duplicate Ingredient Overdose",
    severity: "Severe",
    drugs: [
      {
        id: "paracetamol-500",
        name: "Paracetamol 500mg",
        activeIngredients: ["Paracetamol"],
        therapeuticClass: "Analgesic & Antipyretic",
      },
      {
        id: "combiflam",
        name: "Combiflam",
        activeIngredients: ["Paracetamol", "Ibuprofen"],
        therapeuticClass: "Combination Pain Relief",
      },
    ],
  },
];

export const InteractionChecker: React.FC<InteractionCheckerProps> = ({
  onOpenAiAssistant,
  initialDdiRecords,
  useDdiOnly = false,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { telemetryBanner, searchClientDataset } = useDataset();
  const [clientDdiRecords, setClientDdiRecords] = useState<InteractionRecord[]>(() =>
    initialDdiRecords && initialDdiRecords.length > 0
      ? initialDdiRecords
      : getCachedDdiRecords() || []
  );

  // Index unique drugs directly from the 11,980 DDI rows for fast autocomplete
  const uniqueDdiDrugsList = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < clientDdiRecords.length; i++) {
      const r = clientDdiRecords[i];
      const d1 = r.drug1 || r["Drug 1"] || "";
      const d2 = r.drug2 || r["Drug 2"] || "";
      if (d1) map.set(d1, (map.get(d1) || 0) + 1);
      if (d2) map.set(d2, (map.get(d2) || 0) + 1);
    }
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [clientDdiRecords]);

  // Active basket of medicines to check
  const [basket, setBasket] = useState<BasketMedicine[]>([
    {
      id: "ibuprofen-200",
      name: "Brufen 400 (Ibuprofen)",
      activeIngredients: ["Ibuprofen"],
      therapeuticClass: "NSAID Analgesic",
    },
    {
      id: "aspirin-75",
      name: "Ecosprin 75 (Aspirin)",
      activeIngredients: ["Acetylsalicylic acid"],
      therapeuticClass: "Antiplatelet / Salicylate",
    },
  ]);

  // Autocomplete search state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<BasketMedicine[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Direct backend interaction API evaluation state
  const [isCheckingInteraction, setIsCheckingInteraction] = useState(false);
  const [interactionResult, setInteractionResult] = useState<{
    severity: "Major" | "Moderate" | "Minor" | "None";
    overallSeverity?: "Severe" | "Moderate" | "Minor" | "None";
    title: string;
    explanation: string;
    mechanism: string;
    recommendation: string;
    saferAlternatives: Array<{
      name: string;
      replacesDrugName: string;
      reason: string;
    }>;
    isAiEvaluated: boolean;
    mappedIngredients?: Array<{
      inputName: string;
      genericIngredients: string[];
      displayMapping: string;
      category?: string;
    }>;
    seraFormattedReport?: string;
    hasRedFlag?: boolean;
    totalDatasetPairs?: number;
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
  } | null>(null);

  // DDI Dataset Explorer state (shows all 1,166 drugs and 11,980 pairs from db_drug_interactions.csv)
  const [datasetDrugs, setDatasetDrugs] = useState<
    Array<{
      name: string;
      interactionCount: number;
      samplePartners: string[];
      brandExamples: string[];
      category?: string;
    }>
  >([]);
  const [totalUniqueDdiDrugs, setTotalUniqueDdiDrugs] = useState(1166);
  const [totalDdiPairs, setTotalDdiPairs] = useState(11980);
  const [datasetSearchQuery, setDatasetSearchQuery] = useState("");
  const [selectedDatasetDrugFilter, setSelectedDatasetDrugFilter] = useState("");
  const [browsedRows, setBrowsedRows] = useState<
    Array<{
      drug1: string;
      drug2: string;
      description: string;
      severity: "Severe" | "Moderate" | "Minor" | "None";
      plainEnglish: string;
      safetyGuidance: string;
    }>
  >([]);
  const [totalMatchingRows, setTotalMatchingRows] = useState(0);
  const [isLoadingBrowse, setIsLoadingBrowse] = useState(false);

  // Synchronize initial URL query parameters
  useEffect(() => {
    const d1 = searchParams.get("drug1");
    const d2 = searchParams.get("drug2");
    if (d1 && d2) {
      const med1 = allMedicines.find((m) => m.id === d1);
      const med2 = allMedicines.find((m) => m.id === d2);
      if (med1 && med2 && med1.id !== med2.id) {
        setBasket([
          {
            id: med1.id,
            name: med1.name,
            activeIngredients: med1.activeIngredients,
            therapeuticClass: med1.category,
          },
          {
            id: med2.id,
            name: med2.name,
            activeIngredients: med2.activeIngredients,
            therapeuticClass: med2.category,
          },
        ]);
      }
    }
  }, [searchParams]);

  // Close autocomplete dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Helper to index and apply loaded DDI records to explorer state
  const applyDdiDataset = useCallback((records: InteractionRecord[]) => {
    if (!records || records.length === 0) return;
    setClientDdiRecords(records);
    setTotalDdiPairs(records.length);

    // Build unique drugs and counts from the records
    const drugCountMap = new Map<string, { name: string; count: number; samplePartners: string[] }>();
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const d1 = r.drug1 || r["Drug 1"] || "";
      const d2 = r.drug2 || r["Drug 2"] || "";
      if (!d1 || !d2) continue;

      const k1 = d1.toLowerCase();
      const k2 = d2.toLowerCase();

      const u1 = drugCountMap.get(k1) || { name: d1, count: 0, samplePartners: [] };
      u1.count++;
      if (u1.samplePartners.length < 5 && !u1.samplePartners.includes(d2)) {
        u1.samplePartners.push(d2);
      }
      drugCountMap.set(k1, u1);

      const u2 = drugCountMap.get(k2) || { name: d2, count: 0, samplePartners: [] };
      u2.count++;
      if (u2.samplePartners.length < 5 && !u2.samplePartners.includes(d1)) {
        u2.samplePartners.push(d1);
      }
      drugCountMap.set(k2, u2);
    }

    setTotalUniqueDdiDrugs(drugCountMap.size);

    const sortedDrugs = Array.from(drugCountMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 48)
      .map((d) => ({
        name: d.name,
        interactionCount: d.count,
        samplePartners: d.samplePartners,
        brandExamples: [],
      }));

    setDatasetDrugs(sortedDrugs);
  }, []);

  // Sync initialDdiRecords if provided by parent or updated
  useEffect(() => {
    if (initialDdiRecords && initialDdiRecords.length > 0) {
      applyDdiDataset(initialDdiRecords);
    }
  }, [initialDdiRecords, applyDdiDataset]);

  // Load DDI dataset drugs & initial browsed rows on mount from the shared CSV dataset loader
  useEffect(() => {
    const cached = getCachedDdiRecords();
    if (initialDdiRecords && initialDdiRecords.length > 0) {
      applyDdiDataset(initialDdiRecords);
      return;
    }
    if (cached && cached.length > 0) {
      applyDdiDataset(cached);
      return;
    }

    fetchAndParseDdiDataset()
      .then((records) => {
        applyDdiDataset(records);
      })
      .catch((err) => {
        console.error("Failed to load DDI records on InteractionChecker mount:", err);
      });
  }, [initialDdiRecords, applyDdiDataset]);

  // Filtered DDI records matching active search and active ingredient tags from the loaded CSV dataset array
  const filteredDdiRows = useMemo(() => {
    if (!clientDdiRecords || clientDdiRecords.length === 0) return [];
    const q = datasetSearchQuery.trim().toLowerCase();
    const filterDrug = selectedDatasetDrugFilter.trim().toLowerCase();

    if (!q && !filterDrug) {
      return clientDdiRecords;
    }

    // Resolve any brand or synonym in the search query to its canonical CSV search terms
    const queryTerms = q
      ? Array.from(
          new Set([
            q,
            ...resolveClientBrandToGenerics(q).flatMap((gen) =>
              getCsvSearchTermsForDrug(q, gen, normalizeToClinicalKey(gen))
            ),
          ])
        )
      : [];

    const filterTerms = filterDrug
      ? Array.from(
          new Set([
            filterDrug,
            ...resolveClientBrandToGenerics(filterDrug).flatMap((gen) =>
              getCsvSearchTermsForDrug(filterDrug, gen, normalizeToClinicalKey(gen))
            ),
          ])
        )
      : [];

    return clientDdiRecords.filter((r) => {
      const d1 = (r.drug1 || r["Drug 1"] || "").toLowerCase();
      const d2 = (r.drug2 || r["Drug 2"] || "").toLowerCase();
      const desc = (r.description || r["Interaction Description"] || "").toLowerCase();

      const matchesTag =
        filterTerms.length === 0 ||
        filterTerms.some((t) => d1 === t || d2 === t);
      const matchesQuery =
        queryTerms.length === 0 ||
        queryTerms.some((t) => d1.includes(t) || d2.includes(t) || desc.includes(t));

      return matchesTag && matchesQuery;
    });
  }, [clientDdiRecords, datasetSearchQuery, selectedDatasetDrugFilter]);

  // Compute dynamic color-coded severity breakdown from the exact same filtered DDI rows
  const severityChartData = useMemo(() => {
    return aggregateSeverityCounts(filteredDdiRows);
  }, [filteredDdiRows]);

  // Synchronize browsed rows and totalMatchingRows directly from filteredDdiRows in all environments
  useEffect(() => {
    setIsLoadingBrowse(true);
    setTotalMatchingRows(filteredDdiRows.length);
    setBrowsedRows(
      filteredDdiRows.slice(0, 18).map((r) => {
        const d1 = r.drug1 || r["Drug 1"] || "";
        const d2 = r.drug2 || r["Drug 2"] || "";
        const desc = r.description || r["Interaction Description"] || "";
        const interpreted = interpretCsvRowForDisplay(d1, d2, desc);

        return {
          drug1: d1,
          drug2: d2,
          description: desc,
          severity: interpreted.severity,
          plainEnglish: interpreted.plainEnglish,
          safetyGuidance: interpreted.safetyGuidance,
        };
      })
    );
    setIsLoadingBrowse(false);
  }, [filteredDdiRows]);

  // Perform live search query against full 248k dataset + 1,166 DDI drugs + local repository
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      const q = searchQuery.trim().toLowerCase();

      // If useDdiOnly is enabled (Interaction Analyzer), search purely within the 11,980 DDI rows & verified DDI compounds
      if (useDdiOnly) {
        const exactMatches: BasketMedicine[] = [];
        const prefixMatches: BasketMedicine[] = [];
        const substringMatches: BasketMedicine[] = [];

        // 1. Direct search over the unique drugs indexed from the 11,980 rows of Db_drug_interactions.csv
        for (let i = 0; i < uniqueDdiDrugsList.length; i++) {
          const item = uniqueDdiDrugsList[i];
          const lower = item.name.toLowerCase();
          const medObj: BasketMedicine = {
            id: `ddi-${lower.replace(/[^a-z0-9]+/g, "-")}`,
            name: item.name,
            activeIngredients: [item.name],
            therapeuticClass: `Verified DDI Compound (${item.count} interaction pairs)`,
            source: "ddi",
          };

          if (lower === q) {
            exactMatches.push(medObj);
          } else if (lower.startsWith(q)) {
            prefixMatches.push(medObj);
          } else if (lower.includes(q)) {
            substringMatches.push(medObj);
          }
        }

        // 2. Clinical brand names mapping to verified DDI generic ingredients
        const brandMatches: BasketMedicine[] = [];
        for (const [brandKey, generics] of Object.entries(CLIENT_BRAND_TO_GENERIC_MAP)) {
          if (brandKey.includes(q) || q.includes(brandKey)) {
            const displayName = brandKey.charAt(0).toUpperCase() + brandKey.slice(1);
            brandMatches.push({
              id: `brand-${brandKey.replace(/[^a-z0-9]+/g, "-")}`,
              name: `${displayName} (${generics.join(" + ")})`,
              activeIngredients: generics,
              therapeuticClass: `Clinical Brand (${generics.join(" + ")})`,
              source: "ddi",
            });
          }
        }

        // 3. Clinical drug suggestions (Coumadin, Disprin, Digoxin, Furosemide, etc.)
        const clinicalMatches: BasketMedicine[] = CLINICAL_DRUG_SUGGESTIONS
          .filter(
            (c) =>
              c.name.toLowerCase().includes(q) ||
              c.keywords.some((k) => k.toLowerCase().includes(q) || q.includes(k.toLowerCase()))
          )
          .map((c) => ({
            id: c.id,
            name: c.name,
            activeIngredients: c.activeIngredients,
            therapeuticClass: c.therapeuticClass,
            source: "ddi" as const,
          }));

        const combinedDdi = [
          ...exactMatches,
          ...clinicalMatches,
          ...brandMatches,
          ...prefixMatches,
          ...substringMatches,
        ];

        const seenNames = new Set<string>();
        const deduped: BasketMedicine[] = [];
        for (const item of combinedDdi) {
          const key = item.name.toLowerCase();
          if (!seenNames.has(key)) {
            seenNames.add(key);
            deduped.push(item);
          }
        }

        const finalResults = deduped
          .filter((item) => !basket.some((b) => b.name.toLowerCase() === item.name.toLowerCase()))
          .slice(0, 12);

        setSearchResults(finalResults);
        setShowDropdown(true);
        setIsSearching(false);
        return;
      }

      // 0. Clinical drug suggestions (e.g. Coumadin, Disprin, Digoxin, Furosemide, Enalapril, Spironolactone)
      const clinicalMatches: BasketMedicine[] = CLINICAL_DRUG_SUGGESTIONS
        .filter((c) =>
          c.name.toLowerCase().includes(q) ||
          c.keywords.some((k) => k.toLowerCase().includes(q) || q.includes(k.toLowerCase()))
        )
        .map((c) => ({
          id: c.id,
          name: c.name,
          activeIngredients: c.activeIngredients,
          therapeuticClass: c.therapeuticClass,
          source: "ddi" as const,
        }));

      // 1. Local search (with brandNames and activeIngredients)
      const localMatches: BasketMedicine[] = allMedicines
        .filter(
          (m) =>
            m.name.toLowerCase().includes(q) ||
            m.activeIngredients.some((i) => i.toLowerCase().includes(q)) ||
            (m.brandNames && m.brandNames.some((b) => b.toLowerCase().includes(q)))
        )
        .slice(0, 5)
        .map((m) => ({
          id: m.id,
          name: m.name,
          activeIngredients: m.activeIngredients,
          therapeuticClass: m.category,
          source: "local",
        }));

      // 1b. Client-side IndexedDB 248,114 dataset search
      const clientIdbMatches: BasketMedicine[] = searchClientDataset(q, 6).map((rec) => ({
        id: `idb-${rec.id}-${rec.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        name: rec.name,
        activeIngredients: resolveClientBrandToGenerics(rec.name),
        therapeuticClass: rec.therapeutic_class || rec.action_class || "Pharmaceutical",
        chemicalClass: rec.chemical_class,
        source: "dataset",
      }));

      try {
        const ddiClientMatches: BasketMedicine[] = uniqueDdiDrugsList
          .filter((item) => item.name.toLowerCase().includes(q))
          .slice(0, 8)
          .map((item) => ({
            id: `ddi-${item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
            name: item.name,
            activeIngredients: [item.name],
            therapeuticClass: `Verified DDI Compound (${item.count} pairs)`,
            source: "ddi" as const,
          }));

        const combined: BasketMedicine[] = [...clinicalMatches];
        for (const lm of localMatches) {
          if (!combined.some((c) => c.name.toLowerCase() === lm.name.toLowerCase())) {
            combined.push(lm);
          }
        }
        for (const cm of clientIdbMatches) {
          if (!combined.some((c) => c.name.toLowerCase() === cm.name.toLowerCase())) {
            combined.push(cm);
          }
        }
        for (const dm of ddiClientMatches) {
          if (!combined.some((c) => c.name.toLowerCase() === dm.name.toLowerCase())) {
            combined.push(dm);
          }
        }

        // Filter out medicines already in basket
        const finalResults = combined.filter(
          (item) =>
            !basket.some(
              (b) => b.id === item.id || b.name.toLowerCase() === item.name.toLowerCase()
            )
        );

        setSearchResults(finalResults.slice(0, 12));
        setShowDropdown(true);
      } catch {
        const filteredLocal = localMatches.filter(
          (item) =>
            !basket.some(
              (b) => b.id === item.id || b.name.toLowerCase() === item.name.toLowerCase()
            )
        );
        setSearchResults(filteredLocal);
        setShowDropdown(true);
      } finally {
        setIsSearching(false);
      }
    }, 160);

    return () => clearTimeout(timer);
  }, [searchQuery, basket, uniqueDdiDrugsList, useDdiOnly, searchClientDataset]);

  /**
   * Unified Interaction Check Function
   * Evaluates the basket directly against the loaded CSV dataset array (clientDdiRecords)
   * across all environments (local dev and Netlify static production).
   */
  const executeInteractionCheck = useCallback(
    async (targetBasket: BasketMedicine[] = basket) => {
      if (targetBasket.length < 2) {
        setInteractionResult(null);
        return;
      }

      setIsCheckingInteraction(true);

      try {
        let activeRecords = clientDdiRecords;
        if (!activeRecords || activeRecords.length === 0) {
          activeRecords = await fetchAndParseDdiDataset();
          applyDdiDataset(activeRecords);
        }

        const evaluated = evaluateBasketInteractions(targetBasket, activeRecords);
        setInteractionResult({
          severity: evaluated.severity,
          overallSeverity: evaluated.overallSeverity,
          title: evaluated.title,
          explanation: evaluated.explanation,
          mechanism: evaluated.mechanism,
          recommendation: evaluated.recommendation,
          saferAlternatives: evaluated.saferAlternatives,
          isAiEvaluated: evaluated.isAiEvaluated,
          mappedIngredients: evaluated.mappedIngredients,
          hasRedFlag: evaluated.hasRedFlag,
          totalDatasetPairs: activeRecords.length,
          pairResults: evaluated.pairResults,
        });
      } catch (err) {
        console.error("Error checking drug interactions against CSV dataset:", err);
      } finally {
        setIsCheckingInteraction(false);
      }
    },
    [basket, clientDdiRecords, applyDdiDataset]
  );

  // Automatically check interactions when basket or loaded CSV dataset changes
  useEffect(() => {
    if (basket.length < 2) {
      setInteractionResult(null);
      return;
    }
    executeInteractionCheck(basket);
  }, [basket, clientDdiRecords, executeInteractionCheck]);

  // Add medicine to basket
  const addMedicine = (med: BasketMedicine) => {
    if (basket.length >= 5) return;
    if (
      basket.some(
        (b) => b.id === med.id || b.name.toLowerCase() === med.name.toLowerCase()
      )
    ) {
      return;
    }

    const resolvedGenerics =
      med.activeIngredients && med.activeIngredients.length > 0
        ? med.activeIngredients
        : resolveClientBrandToGenerics(med.name);

    const enrichedMed: BasketMedicine = {
      ...med,
      activeIngredients: resolvedGenerics,
    };

    const next = [...basket, enrichedMed];
    setBasket(next);
    setSearchQuery("");
    setShowDropdown(false);
  };

  // Allow adding any typed brand or generic drug name directly on form submit
  const handleSearchFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (trimmed && basket.length < 5) {
      if (searchResults.length > 0 && searchResults[0].name.toLowerCase() === trimmed.toLowerCase()) {
        addMedicine(searchResults[0]);
      } else {
        const resolved = resolveClientBrandToGenerics(trimmed);
        addMedicine({
          id: `custom-${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          name: trimmed,
          activeIngredients: resolved,
          therapeuticClass: "Resolved Brand / Active Compound",
          source: "dataset",
        });
      }
    } else if (basket.length >= 2) {
      executeInteractionCheck(basket);
    }
  };

  // Remove medicine from basket
  const removeMedicine = (idOrName: string) => {
    if (basket.length <= 1) return;
    const next = basket.filter(
      (b) => b.id !== idOrName && b.name.toLowerCase() !== idOrName.toLowerCase()
    );
    setBasket(next);
  };

  // Replace medicine with safer alternative
  const replaceMedicine = (oldNameOrId: string, newDrug: BasketMedicine) => {
    const mapped = basket.map((b) =>
      b.id === oldNameOrId || b.name.toLowerCase() === oldNameOrId.toLowerCase()
        ? newDrug
        : b
    );
    const next = mapped.filter(
      (item, index, self) =>
        index ===
        self.findIndex(
          (t) => t.id === item.id || t.name.toLowerCase() === item.name.toLowerCase()
        )
    );
    setBasket(next);
  };

  // Load a demo combination
  const loadDemoPair = (demo: DemoPair) => {
    setBasket(demo.drugs);
    setSearchQuery("");
    setShowDropdown(false);
  };

  // Load any pair directly from the db_drug_interactions.csv explorer
  const loadCsvRowIntoChecker = (drug1: string, drug2: string) => {
    const nextBasket: BasketMedicine[] = [
      {
        id: `ddi-${drug1.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        name: drug1,
        activeIngredients: [drug1],
        therapeuticClass: "Verified DDI Compound",
        source: "ddi",
      },
      {
        id: `ddi-${drug2.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        name: drug2,
        activeIngredients: [drug2],
        therapeuticClass: "Verified DDI Compound",
        source: "ddi",
      },
    ];
    setBasket(nextBasket);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Pre-computed client basket analysis using the exact same loaded CSV dataset array (clientDdiRecords)
  const clientBasketEval = useMemo(
    () => evaluateBasketInteractions(basket, clientDdiRecords),
    [basket, clientDdiRecords]
  );

  // Pre-computed fallback analysis for batch advice / safer alternatives
  const medicineIds = basket.map((b) => b.id);
  const batchAdvice = analyzeBatchSafety(medicineIds, allMedicines);

  // Build unified pairwise cards from clientBasketEval and loaded CSV dataset array
  const mergedPairCardsMap = new Map<
    string,
    {
      drugAInput: string;
      drugBInput: string;
      genericA: string;
      genericB: string;
      combinedDrugNames: string;
      matchedInCsv: boolean;
      csvDescription?: string;
      matchDirection?: string;
      severity: "Severe" | "Moderate" | "Minor" | "None";
      ruleSeverity?: "HIGH" | "MAJOR" | "MODERATE" | "MINOR" | "NONE";
      title?: string;
      plainEnglish: string;
      safetyGuidance: string;
      isRedFlag: boolean;
    }
  >();

  // 1. Add all evaluated pairs from clientBasketEval (which already queries clientDdiRecords)
  for (const p of clientBasketEval.pairResults) {
    const key = `${p.genericA.toLowerCase()}||${p.genericB.toLowerCase()}`;
    const reverseKey = `${p.genericB.toLowerCase()}||${p.genericA.toLowerCase()}`;
    if (!mergedPairCardsMap.has(key) && !mergedPairCardsMap.has(reverseKey)) {
      mergedPairCardsMap.set(key, {
        drugAInput: p.drugAInput,
        drugBInput: p.drugBInput,
        genericA: p.genericA,
        genericB: p.genericB,
        combinedDrugNames: p.combinedDrugNames,
        matchedInCsv: p.matchedInCsv,
        csvDescription: p.csvDescription,
        matchDirection: p.matchDirection,
        severity: p.severity,
        ruleSeverity: p.ruleSeverity,
        title: p.title,
        plainEnglish: p.plainEnglish,
        safetyGuidance: p.safetyGuidance,
        isRedFlag: p.isRedFlag,
      });
    }
  }

  // 2. Merge any additional pairResults from interactionResult
  const serverPairList = interactionResult?.pairResults || interactionResult?.csvMatches || [];
  for (const s of serverPairList) {
    const key = `${s.genericA.toLowerCase()}||${s.genericB.toLowerCase()}`;
    const reverseKey = `${s.genericB.toLowerCase()}||${s.genericA.toLowerCase()}`;
    const existing = mergedPairCardsMap.get(key) || mergedPairCardsMap.get(reverseKey);

    const sSeverity = (s.severity as "Severe" | "Moderate" | "Minor" | "None") || "None";
    if (!existing || (existing.severity === "None" && sSeverity !== "None")) {
      mergedPairCardsMap.set(key, {
        drugAInput: s.drugAInput || s.genericA,
        drugBInput: s.drugBInput || s.genericB,
        genericA: s.genericA,
        genericB: s.genericB,
        combinedDrugNames: s.combinedDrugNames || `${s.genericA} + ${s.genericB}`,
        matchedInCsv: s.matchedInCsv,
        csvDescription: s.csvDescription,
        matchDirection: s.matchDirection || (s as any).direction,
        severity: sSeverity,
        title: (s as any).title,
        plainEnglish: s.plainEnglish || interactionResult?.explanation || "",
        safetyGuidance: s.safetyGuidance || interactionResult?.recommendation || "",
        isRedFlag: Boolean(s.isRedFlag),
      });
    }
  }

  // 3. Cross-reference all basket drug pairs directly against the loaded clientDdiRecords array
  if (clientDdiRecords.length > 0 && basket.length >= 2) {
    for (let i = 0; i < basket.length; i++) {
      for (let j = i + 1; j < basket.length; j++) {
        const bA = basket[i];
        const bB = basket[j];
        const namesA = [bA.name, ...(bA.activeIngredients || [])];
        const namesB = [bB.name, ...(bB.activeIngredients || [])];

        for (const rawA of namesA) {
          for (const rawB of namesB) {
            const lowA = rawA.toLowerCase().trim();
            const lowB = rawB.toLowerCase().trim();
            if (!lowA || !lowB || lowA === lowB) continue;

            const row = clientDdiRecords.find((r) => {
              const d1 = (r.drug1 || r["Drug 1"] || "").toLowerCase();
              const d2 = (r.drug2 || r["Drug 2"] || "").toLowerCase();
              return (
                (d1 === lowA && d2 === lowB) ||
                (d1 === lowB && d2 === lowA) ||
                (d1.includes(lowA) && d2.includes(lowB)) ||
                (d1.includes(lowB) && d2.includes(lowA))
              );
            });

            if (row) {
              const rowD1 = row.drug1 || row["Drug 1"] || rawA;
              const rowD2 = row.drug2 || row["Drug 2"] || rawB;
              const rowDesc = row.description || row["Interaction Description"] || "";
              const interpreted = interpretCsvRowForDisplay(rowD1, rowD2, rowDesc);

              const key = `${rowD1.toLowerCase()}||${rowD2.toLowerCase()}`;
              const reverseKey = `${rowD2.toLowerCase()}||${rowD1.toLowerCase()}`;
              const existingKey = mergedPairCardsMap.has(key)
                ? key
                : mergedPairCardsMap.has(reverseKey)
                ? reverseKey
                : null;
              const existing = existingKey ? mergedPairCardsMap.get(existingKey) : undefined;

              if (!existing || existing.severity === "None") {
                mergedPairCardsMap.set(existingKey || key, {
                  drugAInput: bA.name,
                  drugBInput: bB.name,
                  genericA: rowD1,
                  genericB: rowD2,
                  combinedDrugNames: `${bA.name} + ${bB.name}`,
                  matchedInCsv: true,
                  csvDescription: rowDesc,
                  matchDirection: `Verified in Db_drug_interactions.csv (${rowD1} + ${rowD2})`,
                  severity: interpreted.severity,
                  ruleSeverity: interpreted.ruleSeverity,
                  title: interpreted.title,
                  plainEnglish: interpreted.plainEnglish,
                  safetyGuidance: interpreted.safetyGuidance,
                  isRedFlag: interpreted.isRedFlag,
                });
              } else {
                existing.matchedInCsv = true;
                if (!existing.csvDescription) {
                  existing.csvDescription = rowDesc;
                }
              }
            }
          }
        }
      }
    }
  }

  const pairCards = Array.from(mergedPairCardsMap.values());

  // Unified summary banner calculation derived from the exact same loaded CSV dataset evaluation and pairCards
  const hasClientMajor =
    clientBasketEval.overallSeverity === "Severe" ||
    clientBasketEval.hasRedFlag ||
    pairCards.some((c) => c.severity === "Severe" || c.isRedFlag);
  const hasClientModerate =
    clientBasketEval.overallSeverity === "Moderate" ||
    pairCards.some((c) => c.severity === "Moderate");
  const hasClientMinor =
    clientBasketEval.overallSeverity === "Minor" ||
    pairCards.some((c) => c.severity === "Minor");

  const hasServerMajor =
    interactionResult?.severity === "Major" ||
    interactionResult?.overallSeverity === "Severe" ||
    Boolean(interactionResult?.hasRedFlag);
  const hasServerModerate =
    interactionResult?.severity === "Moderate" ||
    interactionResult?.overallSeverity === "Moderate";
  const hasServerMinor =
    interactionResult?.severity === "Minor" ||
    interactionResult?.overallSeverity === "Minor";

  const hasMajor = hasClientMajor || hasServerMajor;
  const hasModerate = !hasMajor && (hasClientModerate || hasServerModerate);
  const hasMinor = !hasMajor && !hasModerate && (hasClientMinor || hasServerMinor);

  const currentSeverity: "Major" | "Moderate" | "Minor" | "None" = hasMajor
    ? "Major"
    : hasModerate
    ? "Moderate"
    : hasMinor
    ? "Minor"
    : "None";

  const activeTitle =
    hasMajor || hasModerate || hasMinor
      ? pairCards.find((c) => c.severity === "Severe")?.title ||
        pairCards.find((c) => c.severity === "Moderate")?.title ||
        pairCards.find((c) => c.severity === "Minor")?.title ||
        interactionResult?.title ||
        clientBasketEval.title
      : "No Adverse Interaction Found • Calm Reassurance";

  const activeExplanation =
    hasMajor || hasModerate || hasMinor
      ? pairCards.find((c) => c.severity === "Severe")?.plainEnglish ||
        pairCards.find((c) => c.severity === "Moderate")?.plainEnglish ||
        pairCards.find((c) => c.severity === "Minor")?.plainEnglish ||
        interactionResult?.explanation ||
        clientBasketEval.explanation
      : "No harmful drug-drug interactions were found between your selected medicines in the Clinical Knowledge Base. Always follow standard package dosing instructions.";

  const activeRecommendation =
    hasMajor || hasModerate || hasMinor
      ? pairCards.find((c) => c.severity === "Severe")?.safetyGuidance ||
        pairCards.find((c) => c.severity === "Moderate")?.safetyGuidance ||
        pairCards.find((c) => c.severity === "Minor")?.safetyGuidance ||
        interactionResult?.recommendation ||
        clientBasketEval.recommendation
      : "Maintain standard individual dosages and take with water.";

  return (
    <div className="space-y-8 p-4 sm:p-8 pb-16 font-sans">
      {/* Warm Patient-Friendly Header */}
      <div className="bg-white dark:bg-[#18201C] shadow-sm dark:shadow-xl border border-slate-100 dark:border-white/5 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors">
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-400 tracking-wide block">
            {telemetryBanner} • {totalDdiPairs.toLocaleString()} Clinical Interaction Records
          </span>
          <h1 className="text-2xl sm:text-3xl font-serif font-semibold text-slate-900 dark:text-slate-50">
            Medication Safety Check
          </h1>
          <p className="text-base text-slate-700 dark:text-slate-200 max-w-3xl leading-relaxed">
            Enter the brand names or generic medicines you are taking (such as Brufen, Ecosprin, Combiflam, Lanoxin, Lasix, or Lipitor) to check if they are safe to take together.
          </p>
        </div>

        {/* Primary Action Button */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => executeInteractionCheck(basket)}
            disabled={basket.length < 2 || isCheckingInteraction}
            className="px-5 py-3 rounded-full bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-500 dark:hover:bg-emerald-400 disabled:opacity-50 text-white dark:text-slate-950 text-sm font-semibold flex items-center gap-2 transition-all shadow-sm cursor-pointer"
          >
            {isCheckingInteraction ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            <span>Check Safety ({basket.length} Medicines)</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Search Form, Selected Drug Pills & Quick Demos (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white dark:bg-[#18201C] shadow-sm dark:shadow-xl border border-slate-100 dark:border-white/5 rounded-2xl p-6 space-y-5 transition-colors">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-serif font-semibold text-slate-900 dark:text-slate-50">
                Your Medicine List ({basket.length}/5)
              </h2>
              {basket.length < 2 && (
                <span className="text-xs text-red-600 dark:text-rose-300 font-sans font-semibold">
                  Add at least 2 medicines
                </span>
              )}
            </div>

            {/* Selected Drug Pills: Matte Pastel / Soft Emerald Tint in Dark Mode */}
            <div className="flex flex-wrap gap-2">
              {basket.map((med, idx) => (
                <div
                  key={`pill-${med.id || med.name}-${idx}`}
                  className="inline-flex items-center gap-2 bg-emerald-50/90 text-emerald-900 border border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/40 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
                >
                  <Pill className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                  <span>{med.name}</span>
                  {basket.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMedicine(med.id || med.name)}
                      className="ml-0.5 p-0.5 rounded-full hover:bg-emerald-200/60 dark:hover:bg-emerald-800/60 text-emerald-800 dark:text-emerald-300 transition-colors cursor-pointer"
                      title={`Remove ${med.name}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Detailed Active Ingredient Breakdown for Selected Medicines */}
            <div className="flex flex-col gap-2.5">
              {basket.map((med, idx) => {
                const backendMapped = interactionResult?.mappedIngredients?.find(
                  (m) => m.inputName.toLowerCase() === med.name.toLowerCase()
                );
                const activeGenerics =
                  backendMapped?.genericIngredients && backendMapped.genericIngredients.length > 0
                    ? backendMapped.genericIngredients
                    : med.activeIngredients?.length > 0
                    ? med.activeIngredients
                    : resolveClientBrandToGenerics(med.name);

                return (
                  <div
                    key={`${med.id || med.name}-${idx}`}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border bg-emerald-50/60 border-emerald-200/70 text-emerald-950 dark:bg-[#121815] dark:border-emerald-800/40 dark:text-slate-200 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-white/80 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-200/60 dark:border-emerald-800/40">
                        <Pill className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-50 truncate">
                          {med.name}
                        </h4>
                        <span className="text-xs text-emerald-800 dark:text-emerald-400 font-medium block truncate mt-0.5">
                          Active Ingredient: {activeGenerics.join(" + ")}
                        </span>
                      </div>
                    </div>

                    {basket.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMedicine(med.id || med.name)}
                        className="w-7 h-7 rounded-full bg-white/80 dark:bg-white/5 hover:bg-red-100 dark:hover:bg-rose-950/60 text-slate-500 dark:text-slate-400 hover:text-red-700 dark:hover:text-rose-300 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                        title="Remove medicine"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Search & Add Drug Form with Rounded Corners and Soft Ring Focus */}
            {basket.length < 5 && (
              <form
                onSubmit={handleSearchFormSubmit}
                className="pt-4 border-t border-slate-100 dark:border-white/5 space-y-2.5 relative"
                ref={searchContainerRef}
              >
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                  <span>Add Another Medicine</span>
                  <span className="text-xs text-emerald-800 dark:text-emerald-400 font-medium">
                    Brand or Generic Name
                  </span>
                </label>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                      {isSearching ? (
                        <Loader2 className="w-4 h-4 animate-spin text-emerald-700 dark:text-emerald-400" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                    </div>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onFocus={() => {
                        if (searchResults.length > 0) setShowDropdown(true);
                      }}
                      placeholder="Type a medicine name (e.g., Warfarin, Brufen, Ecosprin)..."
                      className="w-full bg-slate-50/80 dark:bg-[#121815] text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 dark:border-white/10 focus:outline-hidden focus:border-emerald-600 dark:focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 dark:focus:ring-emerald-500/30 transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!searchQuery.trim()}
                    className="px-4 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-500 dark:hover:bg-emerald-400 disabled:opacity-40 text-white dark:text-slate-950 text-xs font-semibold flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add</span>
                  </button>
                </div>

                {/* Autocomplete Results Dropdown */}
                {showDropdown && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-30 mt-1.5 bg-white dark:bg-[#18201C] border border-slate-100 dark:border-white/10 rounded-2xl shadow-lg dark:shadow-2xl max-h-64 overflow-y-auto p-1.5 space-y-1">
                    {searchResults.map((med, idx) => (
                      <button
                        type="button"
                        key={`${med.id || med.name}-${idx}`}
                        onClick={() => addMedicine(med)}
                        className="w-full text-left p-2.5 rounded-xl hover:bg-emerald-50/60 dark:hover:bg-emerald-950/40 text-xs flex items-center justify-between group transition-colors"
                      >
                        <div className="pr-2 min-w-0">
                          <div className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-emerald-800 dark:group-hover:text-emerald-400 flex items-center gap-1.5 flex-wrap">
                            <span>{med.name}</span>
                          </div>
                          <span className="text-xs text-slate-500 dark:text-slate-400 block truncate max-w-xs">
                            Active Ingredient:{" "}
                            {med.activeIngredients?.length > 0
                              ? med.activeIngredients.join(" + ")
                              : med.therapeuticClass || "Pharmaceutical"}
                          </span>
                        </div>
                        <div className="w-6 h-6 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 group-hover:bg-emerald-700 dark:group-hover:bg-emerald-500 group-hover:text-white dark:group-hover:text-slate-950 flex items-center justify-center transition-colors shrink-0">
                          <Plus className="w-3.5 h-3.5" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </form>
            )}

            {/* Primary "Medication Safety Check" Button inside Form Card */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => executeInteractionCheck(basket)}
                disabled={basket.length < 2 || isCheckingInteraction}
                className="w-full py-3 px-5 rounded-full bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-500 dark:hover:bg-emerald-400 disabled:opacity-50 text-white dark:text-slate-950 font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                {isCheckingInteraction ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Checking Medication Safety...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Run Medication Safety Check</span>
                  </>
                )}
              </button>
            </div>

            {/* Common Example Combinations */}
            <div className="pt-4 border-t border-slate-100 dark:border-white/5 space-y-2.5">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                <span>Common Medication Combinations (Click to Test)</span>
              </span>

              <div className="flex flex-col gap-2">
                {DEMO_PAIRS.map((demo, idx) => (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => loadDemoPair(demo)}
                    className="w-full text-left p-3 rounded-xl bg-slate-50/80 dark:bg-[#121815] hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 border border-slate-100 dark:border-white/5 hover:border-emerald-200 dark:hover:border-emerald-500/30 text-xs transition-all flex items-center justify-between cursor-pointer"
                  >
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate pr-2">
                      {demo.name}
                    </span>
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full shrink-0 ${
                        demo.severity === "Severe"
                          ? "bg-red-100 text-red-800 dark:bg-rose-950/60 dark:text-rose-200 dark:border dark:border-rose-500/40"
                          : demo.severity === "Moderate"
                          ? "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 dark:border dark:border-amber-500/40"
                          : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border dark:border-emerald-800/40"
                      }`}
                    >
                      {demo.badge}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: High-Contrast Safety Alerts, Ingredient Analysis & What You Should Know (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* HIGH-CONTRAST DANGER / CAUTION / SAFE REASSURANCE BANNER */}
          {hasMajor ? (
            <div className="bg-red-50 dark:bg-rose-950/40 border-2 border-red-500 dark:border-rose-500/60 shadow-md rounded-2xl p-5 sm:p-7 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="p-3 rounded-xl bg-red-600 dark:bg-rose-600 text-white shrink-0 shadow-xs">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-red-900 dark:text-rose-200 font-bold text-lg leading-snug">
                      ⛔ {activeTitle.includes("MAJOR") ? activeTitle : `CRITICAL SAFETY WARNING: ${activeTitle}`}
                    </h3>
                    <p className="text-base text-red-900/90 dark:text-slate-200 leading-relaxed">
                      {activeExplanation}
                    </p>
                  </div>
                </div>

                {onOpenAiAssistant && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenAiAssistant(
                        `I am checking ${basket.map((m) => m.name).join(" and ")}. Please explain why this combination is unsafe and what safer options I can discuss with my doctor.`,
                        basket.map((d) => d.name)
                      )
                    }
                    className="px-4 py-2.5 rounded-full bg-white dark:bg-[#18201C] hover:bg-red-100 dark:hover:bg-rose-950/80 text-red-900 dark:text-rose-200 border border-red-300 dark:border-rose-500/50 text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors shadow-2xs cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-red-700 dark:text-rose-300" />
                    <span>Ask Care Guide</span>
                  </button>
                )}
              </div>

              {/* Solid Red / Crimson Alert Box for Required Action */}
              <div className="bg-red-600 dark:bg-rose-600 text-white p-4 rounded-xl font-medium space-y-1 shadow-xs">
                <div className="text-xs font-bold uppercase tracking-wider text-red-100 dark:text-rose-100">
                  Required Action
                </div>
                <p className="text-base leading-relaxed">
                  {activeRecommendation}
                </p>
              </div>
            </div>
          ) : hasModerate || hasMinor ? (
            <div className="bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-400 dark:border dark:border-amber-500/40 text-amber-950 dark:text-amber-200 shadow-sm rounded-2xl p-5 sm:p-7 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="p-3 rounded-xl bg-amber-500 dark:bg-amber-600 text-white shrink-0 shadow-xs">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-amber-950 dark:text-amber-200 font-bold text-lg leading-snug">
                      ⚠️ Moderate Interaction • Monitor closely
                    </h3>
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wide">
                      {activeTitle}
                    </p>
                    <p className="text-base text-slate-800 dark:text-slate-200 leading-relaxed">
                      {activeExplanation}
                    </p>
                  </div>
                </div>

                {onOpenAiAssistant && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenAiAssistant(
                        `I am checking ${basket.map((m) => m.name).join(" and ")}. How should I space or manage these medicines safely?`,
                        basket.map((d) => d.name)
                      )
                    }
                    className="px-4 py-2.5 rounded-full bg-white dark:bg-[#18201C] hover:bg-amber-100 dark:hover:bg-amber-950/60 text-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-500/40 text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors shadow-2xs cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-amber-700 dark:text-amber-300" />
                    <span>Ask Care Guide</span>
                  </button>
                )}
              </div>

              {/* Soft Amber Action Steps Badge */}
              <div className="bg-amber-100 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 border border-transparent dark:border-amber-500/30 p-3 rounded-xl space-y-1">
                <div className="text-xs font-bold uppercase tracking-wider text-amber-950 dark:text-amber-300">
                  Recommended Precaution
                </div>
                <p className="text-base font-medium leading-relaxed">
                  {activeRecommendation}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-200 rounded-2xl p-5 sm:p-7 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
              <div className="flex items-start gap-3.5">
                <div className="p-3 rounded-xl bg-emerald-700 dark:bg-emerald-500 text-white dark:text-slate-950 shrink-0">
                  {isCheckingInteraction ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-6 h-6" />
                  )}
                </div>
                <div className="space-y-1">
                  <h3 className="text-emerald-950 dark:text-emerald-200 font-bold text-lg leading-snug">
                    {isCheckingInteraction
                      ? "Checking Medication Safety..."
                      : "No Adverse Interaction Found • Calm Reassurance"}
                  </h3>
                  <p className="text-base text-emerald-900/90 dark:text-slate-200 leading-relaxed">
                    No harmful drug-drug interactions were found between your selected medicines in the Clinical Knowledge Base. Always follow standard package dosing instructions.
                  </p>
                </div>
              </div>

              {onOpenAiAssistant && (
                <button
                  type="button"
                  onClick={() =>
                    onOpenAiAssistant(
                      `I am taking ${basket.map((m) => m.name).join(" and ")}. What general dosing tips should I keep in mind?`,
                      basket.map((d) => d.name)
                    )
                  }
                  className="px-4 py-2.5 rounded-full bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors shadow-2xs cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Ask Care Guide</span>
                </button>
              )}
            </div>
          )}

          {/* INGREDIENT ANALYSIS CARD */}
          {clientBasketEval.mappedIngredients && clientBasketEval.mappedIngredients.length > 0 && (
            <div className="bg-white dark:bg-[#18201C] shadow-sm dark:shadow-xl border border-slate-100 dark:border-white/5 rounded-2xl p-6 space-y-4 transition-colors">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-base font-serif font-semibold text-slate-900 dark:text-slate-50 flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                  <span>Ingredient Analysis</span>
                </h3>
                <span className="text-xs font-medium text-emerald-800 dark:text-emerald-400">
                  Active Ingredients Identified in Your Medicines
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {clientBasketEval.mappedIngredients.map((m, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-slate-50/80 dark:bg-[#121815] border border-slate-100 dark:border-white/5 text-sm space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900 dark:text-slate-50">
                        {m.inputName}
                      </span>
                      {m.category && (
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {m.category}
                        </span>
                      )}
                    </div>
                    <div className="text-emerald-800 dark:text-emerald-400 font-semibold">
                      Contains: {m.genericIngredients.join(" + ")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* WHAT YOU SHOULD KNOW — PAIRWISE INTERACTION CARDS */}
          {pairCards.length > 0 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-lg font-serif font-semibold text-slate-900 dark:text-slate-50 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                  <span>
                    What You Should Know ({pairCards.length}{" "}
                    {pairCards.length === 1 ? "Combination" : "Combinations"} Checked)
                  </span>
                </h3>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Verified Clinical Guidance
                </span>
              </div>

              {pairCards.map((card, idx) => {
                const isSevere = card.severity === "Severe";
                const isMod = card.severity === "Moderate";
                const isMin = card.severity === "Minor";

                const combinedTitle =
                  card.combinedDrugNames ||
                  `${card.drugAInput || card.genericA} + ${card.drugBInput || card.genericB}`;

                return (
                  <div
                    key={idx}
                    className={`rounded-2xl p-5 sm:p-8 space-y-5 transition-all ${
                      isSevere
                        ? "bg-red-50 dark:bg-rose-950/40 border-2 border-red-500 dark:border-rose-500/60 shadow-md"
                        : isMod || isMin
                        ? "bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-400 dark:border dark:border-amber-500/40 shadow-sm"
                        : "bg-white dark:bg-[#18201C] shadow-sm dark:shadow-xl border border-slate-100 dark:border-white/5"
                    }`}
                  >
                    {/* Top Row: Warning Header + Combined Drug Names */}
                    <div className="space-y-2 border-b border-slate-200/70 dark:border-white/10 pb-4">
                      {isSevere ? (
                        <div className="text-red-900 dark:text-rose-200 font-bold text-lg flex items-center gap-2">
                          <span>⛔ CRITICAL SAFETY WARNING: SEVERE INTERACTION DETECTED</span>
                        </div>
                      ) : isMod || isMin ? (
                        <div className="text-amber-950 dark:text-amber-200 font-bold text-lg flex items-center gap-2">
                          <span>⚠️ MODERATE INTERACTION • CAUTION ADVISED</span>
                        </div>
                      ) : (
                        <div className="text-emerald-900 dark:text-emerald-200 font-bold text-lg flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                          <span>Safe Combination • No Interaction Found</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                        <span className="text-base sm:text-lg font-serif font-semibold text-slate-900 dark:text-slate-50">
                          {combinedTitle}
                        </span>
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                          Active Ingredients: <strong className="text-slate-900 dark:text-slate-200">{card.genericA}</strong> &amp; <strong className="text-slate-900 dark:text-slate-200">{card.genericB}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Plain English Explanation (16px / text-base / text-slate-800 dark:text-slate-200 / leading-relaxed) */}
                    <div className="bg-white/90 dark:bg-[#121815] rounded-xl p-5 border border-slate-100 dark:border-white/5 space-y-2">
                      <strong className="text-sm font-semibold text-slate-900 dark:text-slate-50 block">
                        What You Should Know (Plain English)
                      </strong>
                      <p className="text-base text-slate-800 dark:text-slate-200 leading-relaxed">
                        {card.plainEnglish}
                      </p>
                      {card.csvDescription && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-white/5">
                          Clinical Summary: “{card.csvDescription}”
                        </p>
                      )}
                    </div>

                    {/* Action Box: Solid Red / Crimson for Severe, Soft Amber Badge for Moderate, Soft Tint Banner for Safe/General */}
                    {isSevere ? (
                      <div className="space-y-3">
                        <div className="bg-red-600 dark:bg-rose-600 text-white p-4 rounded-xl font-medium space-y-1 shadow-xs">
                          <div className="text-xs font-bold uppercase tracking-wider text-red-100 dark:text-rose-100">
                            Required Action
                          </div>
                          <p className="text-base leading-relaxed">
                            {card.safetyGuidance}
                          </p>
                        </div>
                        <div className="bg-amber-50/60 dark:bg-amber-950/30 p-4 rounded-xl border border-amber-200/50 dark:border-amber-500/40 text-sm text-slate-800 dark:text-amber-200 leading-relaxed">
                          <strong className="font-semibold text-slate-900 dark:text-slate-50">Recommended Action: </strong>
                          Please speak with a doctor or pharmacist before taking both medications. If you experience severe stomach pain, dizziness, or unusual bleeding, seek medical care right away.
                        </div>
                      </div>
                    ) : isMod || isMin ? (
                      <div className="space-y-3">
                        <div className="bg-amber-100 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 border border-transparent dark:border-amber-500/30 p-3 rounded-xl space-y-1">
                          <div className="text-xs font-bold uppercase tracking-wider text-amber-950 dark:text-amber-300">
                            Action Steps
                          </div>
                          <p className="text-base font-medium leading-relaxed">
                            {card.safetyGuidance}
                          </p>
                        </div>
                        <div className="bg-amber-50/60 dark:bg-amber-950/30 p-4 rounded-xl border border-amber-200/50 dark:border-amber-500/40 text-sm text-slate-800 dark:text-amber-200 leading-relaxed">
                          <strong className="font-semibold text-slate-900 dark:text-slate-50">Recommended Action: </strong>
                          Space your doses as advised and monitor for increased drowsiness or stomach discomfort.
                        </div>
                      </div>
                    ) : (
                      <div className="bg-amber-50/60 dark:bg-emerald-950/30 p-4 rounded-xl border border-amber-200/50 dark:border-emerald-500/30 space-y-1">
                        <strong className="text-sm font-semibold text-slate-900 dark:text-emerald-200 block">
                          Recommended Action
                        </strong>
                        <p className="text-base text-slate-800 dark:text-slate-200 leading-relaxed">
                          {card.safetyGuidance}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 🚨 Emergency Care Contacts (If Severe) */}
          {hasMajor && (
            <div className="bg-red-50 dark:bg-rose-950/40 border-2 border-red-500 dark:border-rose-500/60 shadow-md rounded-2xl p-6 space-y-3">
              <div className="flex items-center gap-2 text-red-900 dark:text-rose-200 font-bold text-lg">
                <ShieldAlert className="w-5 h-5 text-red-700 dark:text-rose-300 shrink-0" />
                <span>When to Seek Immediate Medical Help</span>
              </div>
              <p className="text-base leading-relaxed text-slate-800 dark:text-slate-200">
                If anyone experiences shortness of breath, severe stomach pain, black tarry stools, vomiting blood, severe dizziness, or fainting, stop taking these medications immediately and contact emergency medical services:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs font-semibold">
                <div className="bg-white dark:bg-[#121815] px-3.5 py-2.5 rounded-xl border border-red-200 dark:border-rose-500/40 text-red-900 dark:text-rose-200">
                  India: 112 / 108 (Poison: 1800-116-117)
                </div>
                <div className="bg-white dark:bg-[#121815] px-3.5 py-2.5 rounded-xl border border-red-200 dark:border-rose-500/40 text-red-900 dark:text-rose-200">
                  US &amp; Canada: 911 (Poison: 1-800-222-1222)
                </div>
                <div className="bg-white dark:bg-[#121815] px-3.5 py-2.5 rounded-xl border border-red-200 dark:border-rose-500/40 text-red-900 dark:text-rose-200">
                  UK &amp; Europe: 999 / 112 (NHS: 111)
                </div>
              </div>
            </div>
          )}

          {/* SAFER ALTERNATIVES PANEL */}
          {batchAdvice.hasHazard && (
            <div className="bg-white dark:bg-[#18201C] shadow-sm dark:shadow-xl border border-slate-100 dark:border-white/5 rounded-2xl p-6 space-y-4 transition-colors">
              <div className="flex items-center gap-2">
                <Sparkle className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                <h3 className="text-lg font-serif font-semibold text-slate-900 dark:text-slate-50">
                  Safer Alternatives to Discuss with Your Pharmacist
                </h3>
              </div>

              {batchAdvice.saferAlternatives.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {batchAdvice.saferAlternatives.map((alt, idx) => {
                    const replacesMed = basket.find((m) => m.id === alt.replacesDrugId);
                    const targetMed = allMedicines.find((m) => m.id === alt.drugId);

                    return (
                      <div
                        key={idx}
                        className="p-4 rounded-xl bg-slate-50/80 dark:bg-[#121815] border border-slate-100 dark:border-white/5 text-sm space-y-2 flex flex-col justify-between"
                      >
                        <div className="space-y-1">
                          <span className="font-semibold text-slate-900 dark:text-slate-50 block">
                            {alt.name}
                          </span>
                          <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed">
                            {alt.reason}
                          </p>
                        </div>

                        {targetMed && replacesMed && (
                          <button
                            type="button"
                            onClick={() =>
                              replaceMedicine(alt.replacesDrugId, {
                                id: targetMed.id,
                                name: targetMed.name,
                                activeIngredients: targetMed.activeIngredients,
                                therapeuticClass: targetMed.category,
                              })
                            }
                            className="mt-2 w-full py-2 px-3 rounded-full bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 font-semibold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
                          >
                            <span>Replace {replacesMed.name} with {targetMed.name}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* CLINICAL KNOWLEDGE BASE EXPLORER */}
      <div className="bg-white dark:bg-[#18201C] shadow-sm dark:shadow-xl border border-slate-100 dark:border-white/5 rounded-2xl p-6 sm:p-8 space-y-6 transition-colors">
        {/* Streamlined Risk Distribution Card View */}
        <SeverityBarChart
          data={severityChartData}
          totalCount={filteredDdiRows.length}
          activeFilter={
            selectedDatasetDrugFilter && datasetSearchQuery
              ? `${selectedDatasetDrugFilter} + "${datasetSearchQuery}"`
              : selectedDatasetDrugFilter || (datasetSearchQuery ? `"${datasetSearchQuery}"` : undefined)
          }
        />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-white/5 pb-5">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-400 mb-1">
              <Database className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <span>Clinical Knowledge Base • Verified Interaction Directory</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-semibold text-slate-900 dark:text-slate-50">
              Explore {totalDdiPairs.toLocaleString()} Medication Interactions ({totalUniqueDdiDrugs.toLocaleString()} Active Ingredients)
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Search or select any medicine below to read plain-English safety guidance, or load a pair into the checker above.
            </p>
          </div>

          {/* Rounded Search Input with Soft Ring Focus */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={datasetSearchQuery}
              onChange={(e) => setDatasetSearchQuery(e.target.value)}
              placeholder="Search by medicine or brand name..."
              className="w-full bg-slate-50/80 dark:bg-[#121815] text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 dark:border-white/10 focus:outline-hidden focus:border-emerald-600 dark:focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 dark:focus:ring-emerald-500/30 transition-all"
            />
          </div>
        </div>

        {/* Matte Pastel Filter Pills for Indexed Active Compounds */}
        {datasetDrugs.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                Browse by Active Ingredient
              </span>
              {selectedDatasetDrugFilter && (
                <button
                  type="button"
                  onClick={() => setSelectedDatasetDrugFilter("")}
                  className="text-xs font-semibold text-red-600 dark:text-rose-300 hover:underline cursor-pointer"
                >
                  Clear Filter ({selectedDatasetDrugFilter})
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
              {datasetDrugs.map((d) => {
                const isSelected = selectedDatasetDrugFilter.toLowerCase() === d.name.toLowerCase();
                return (
                  <button
                    type="button"
                    key={d.name}
                    onClick={() =>
                      setSelectedDatasetDrugFilter(isSelected ? "" : d.name)
                    }
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 border cursor-pointer ${
                      isSelected
                        ? "bg-emerald-700 dark:bg-emerald-500 text-white dark:text-slate-950 border-emerald-700 dark:border-emerald-400 shadow-2xs"
                        : "bg-emerald-50/60 dark:bg-emerald-950/60 text-emerald-950 dark:text-emerald-300 border-emerald-200/70 dark:border-emerald-800/40 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/50"
                    }`}
                  >
                    <span>{d.name}</span>
                    {d.brandExamples && d.brandExamples.length > 0 && (
                      <span className="text-[11px] opacity-75">
                        ({d.brandExamples.slice(0, 2).join(", ")})
                      </span>
                    )}
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        isSelected
                          ? "bg-white/20 text-white dark:bg-slate-950/20 dark:text-slate-950"
                          : "bg-white dark:bg-[#121815] text-emerald-800 dark:text-emerald-300"
                      }`}
                    >
                      {d.interactionCount}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Grid of Patient-Friendly Clinical Interaction Cards */}
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            <span>
              Showing {browsedRows.length} of{" "}
              <strong className="text-slate-900 dark:text-slate-100">
                {totalMatchingRows.toLocaleString()}
              </strong>{" "}
              verified clinical records
            </span>
            {isLoadingBrowse && (
              <span className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Updating results...
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {browsedRows.map((row, i) => {
              const isSev = row.severity === "Severe";
              return (
                <div
                  key={`${row.drug1}-${row.drug2}-${i}`}
                  className={`p-6 rounded-2xl flex flex-col justify-between gap-4 transition-all ${
                    isSev
                      ? "bg-red-50/70 dark:bg-rose-950/40 border-2 border-red-400 dark:border-rose-500/60 shadow-sm"
                      : "bg-white dark:bg-[#121815] shadow-sm border border-slate-100 dark:border-white/5 hover:border-emerald-200 dark:hover:border-emerald-500/30"
                  }`}
                >
                  <div className="space-y-3.5">
                    <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-white/5 pb-3">
                      <h4 className="text-lg font-serif font-bold text-slate-900 dark:text-slate-50">
                        {row.drug1} + {row.drug2}
                      </h4>
                      <span
                        className={`text-xs font-bold px-3 py-1 rounded-full shrink-0 ${
                          isSev
                            ? "bg-red-600 dark:bg-rose-600 text-white"
                            : "bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 dark:border dark:border-amber-500/40"
                        }`}
                      >
                        {isSev ? "Severe Risk" : "Moderate Caution"}
                      </span>
                    </div>

                    {/* Plain English Explanation (16px / text-base / text-slate-800 dark:text-slate-200 / leading-relaxed) */}
                    <p className="text-base text-slate-800 dark:text-slate-200 leading-relaxed">
                      {row.plainEnglish || row.description}
                    </p>

                    {/* Soft Tint Recommended Action Banner */}
                    {row.safetyGuidance && (
                      <div className="bg-amber-50/60 dark:bg-amber-950/30 p-4 rounded-xl border border-amber-200/50 dark:border-amber-500/40 space-y-1">
                        <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-400 block">
                          Recommended Action
                        </span>
                        <p className="text-sm sm:text-base font-medium text-slate-800 dark:text-amber-200 leading-relaxed">
                          {row.safetyGuidance}
                        </p>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => loadCsvRowIntoChecker(row.drug1, row.drug2)}
                    className="w-full py-2.5 px-4 rounded-full bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-700 dark:hover:bg-emerald-500 hover:text-white dark:hover:text-slate-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/40 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>Check This Combination</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
