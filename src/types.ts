export interface PriceEstimate {
  platform: string;
  priceRange: string;
  inStock: boolean;
  platformUrl: string;
  logoBg?: string;
  accentColor?: string;
}

export interface DosageInfo {
  adult: string;
  child: string;
  recommendedMinimumSafeDose?: string;
  maxDaily: string;
  maxDailySafeLimit?: string;
  maxContinuousDuration?: string;
  doctorEscalationRules?: string;
  instructions: string;
}

export type FAQCategory =
  | "Safe Usage & Escalation"
  | "Missed Dose Protocol"
  | "Food & Alcohol Guidelines"
  | "Side Effects & Red Flags"
  | "Storage & Safe Handling"
  | "Missed Dose"
  | "Alcohol & Food"
  | "Usage"
  | "Dosage"
  | "General"
  | "Safety";

export interface FAQItem {
  question: string;
  answer: string;
  category: FAQCategory;
}

export interface SideEffectsInfo {
  common: string[];
  rare: string[];
}

export type MedicineCategory =
  | "Pain & Fever"
  | "Allergy & Cold"
  | "Digestive Care"
  | "Skin & Topical"
  | "Vitamins & Supplements"
  | "Eye & Ear Care"
  | "First Aid & Antiseptic"
  | "Respiratory Care";

export interface Medicine {
  id: string;
  name: string;
  genericName: string;
  brandNames: string[];
  category: MedicineCategory;
  forms: ("Tablet" | "Syrup" | "Capsule" | "Cream" | "Gel" | "Drops" | "Effervescent" | "Sachet" | "Inhaler" | "Ointment" | "Powder")[];
  activeIngredients: string[];
  simpleExplanation: string;
  clinicalExplanation: string;
  usage: string;
  symptomsRelieved: string[];
  dosage: DosageInfo;
  sideEffects: SideEffectsInfo;
  warnings: string[];
  interactions: string[];
  pregnancySafety: string;
  alcoholInteraction: string;
  priceEstimates: PriceEstimate[];
  storage: string;
  categoryFAQs: FAQItem[];
  otcSafetyBadge: "General OTC" | "Pharmacist Consult OTC" | "External Use Only" | "Short-Term Use";
  isPopular?: boolean;
  safeUsageDuration?: string;
  maxDailyLimitNotice?: string;
}

export interface Symptom {
  id: string;
  name: string;
  category: string;
  description: string;
  iconName: string;
  commonCauses: string[];
  otcMedicineIds: string[];
  homeRemedies: string[];
  hydrationAdvice: string;
  restRecommendations: string;
  redFlags: string[];
}

export type InteractionSeverity = "None" | "Moderate" | "Major";

export interface SaferAlternative {
  drugId: string;
  name: string;
  replacesDrugId: string;
  reason: string;
  category?: string;
}

export interface BatchSafetyAdvice {
  hasHazard: boolean;
  severestLevel: InteractionSeverity;
  clashingPairs: Array<{
    drug1Id: string;
    drug2Id: string;
    drug1Name: string;
    drug2Name: string;
    title: string;
    severity: InteractionSeverity;
  }>;
  dropSuggestions: Array<{
    dropDrugId: string;
    dropDrugName: string;
    impact: string;
  }>;
  saferAlternatives: SaferAlternative[];
}

export interface InteractionPair {
  drug1Id: string;
  drug2Id: string;
  severity: InteractionSeverity;
  title: string;
  explanation: string;
  recommendation: string;
  mechanism?: string;
  saferAlternatives?: SaferAlternative[];
}

export interface HelplineNumber {
  title: string;
  number: string;
  desc: string;
  isPrimary?: boolean;
}

export interface HelplineRegion {
  code: string;
  name: string;
  flag: string;
  numbers: HelplineNumber[];
}
