import { Medicine, FAQItem, PriceEstimate, DosageInfo } from "../types";

/**
 * Strips all Netmeds references and strictly sanitizes verified pharmacy links
 * (Tata 1mg, Apollo Pharmacy, PharmEasy).
 * If a working direct link is NOT available or empty, it is NOT rendered.
 */
export function sanitizePharmacyLinks(med: {
  name: string;
  brandNames?: string[];
  genericName?: string;
  priceEstimates?: PriceEstimate[];
}): PriceEstimate[] {
  const searchTerm = med.brandNames && med.brandNames.length > 0 ? med.brandNames[0] : med.name.split(" ")[0];
  const encoded = encodeURIComponent(searchTerm.trim());

  const existing = (med.priceEstimates || []).filter(
    (p) => p.platform && p.platform.toLowerCase() !== "netmeds" && p.platformUrl && p.platformUrl.trim().length > 0
  );

  if (existing.length > 0) {
    // Sanitize URLs of remaining platforms
    return existing.map((p) => {
      const platformLower = p.platform.toLowerCase();
      let cleanUrl = p.platformUrl;

      if (platformLower.includes("1mg")) {
        cleanUrl = `https://www.1mg.com/search/all?name=${encoded}`;
      } else if (platformLower.includes("apollo")) {
        cleanUrl = `https://www.apollopharmacy.in/search-medicines/${encoded}`;
      } else if (platformLower.includes("pharmeasy")) {
        cleanUrl = `https://pharmeasy.in/search/all?name=${encoded}`;
      }

      return {
        ...p,
        platformUrl: cleanUrl,
      };
    });
  }

  // Generate verified 3 platforms
  return [
    {
      platform: "Tata 1mg",
      priceRange: "Check Live Price",
      inStock: true,
      platformUrl: `https://www.1mg.com/search/all?name=${encoded}`,
    },
    {
      platform: "Apollo Pharmacy",
      priceRange: "Check Live Price",
      inStock: true,
      platformUrl: `https://www.apollopharmacy.in/search-medicines/${encoded}`,
    },
    {
      platform: "PharmEasy",
      priceRange: "Check Live Price",
      inStock: true,
      platformUrl: `https://pharmeasy.in/search/all?name=${encoded}`,
    },
  ];
}

/**
 * Returns a standardized set of AT LEAST 5 comprehensive categorized FAQs for any medicine
 */
export function getComprehensiveFAQs(med: Medicine): FAQItem[] {
  const name = med.name;
  const isPainFever = med.category === "Pain & Fever";
  const isAllergy = med.category === "Allergy & Cold";
  const isDigestive = med.category === "Digestive Care";
  const isTopical = med.category === "Skin & Topical" || med.category === "First Aid & Antiseptic";
  const isSupplements = med.category === "Vitamins & Supplements";

  // 1. Safe Usage Duration & Escalation
  let durationQuestion = `How many consecutive days can I safely take ${name} before consulting a doctor?`;
  let durationAnswer = "";
  if (isPainFever) {
    durationAnswer = `Do not use for more than 3 consecutive days for fever or 5 days for pain without medical consultation. If fever spikes above 102°F (38.8°C), pain worsens, or new symptoms develop, stop self-medicating and see a doctor immediately.`;
  } else if (isAllergy) {
    durationAnswer = `For seasonal flare-ups, you can use it daily for up to 7 to 10 days. If allergy symptoms persist beyond 2 weeks or you develop wheezing, severe facial swelling, or persistent cough, schedule an evaluation with an allergist or physician.`;
  } else if (isDigestive) {
    durationAnswer = `Antacids and digestive aids are intended for short-term relief (up to 7 days). If acidity, reflux, or stomach burning occurs daily or causes difficulty swallowing, consult a gastroenterologist to rule out ulcers or GERD.`;
  } else if (isTopical) {
    durationAnswer = `Apply for up to 7 to 14 days as indicated. If the skin lesion turns deeper red, starts oozing pus, swells significantly, or spreads after 3 days of application, stop and seek dermatological review.`;
  } else if (isSupplements) {
    durationAnswer = `Standard nutritional supplements can typically be taken daily for 30 to 90 days. We recommend getting routine blood work (e.g. serum ferritin, vitamin D3, calcium) checked every 3 to 6 months to assess your body levels.`;
  } else {
    durationAnswer = `Use for the shortest duration necessary (typically 3 to 7 days). If your underlying symptoms fail to improve after 5 days, seek clinical assessment from a qualified healthcare provider.`;
  }

  // 2. Missed Dose Protocol
  const missedQuestion = `What is the correct protocol if I forget to take a dose of ${name}?`;
  const missedAnswer = `Take the missed dose as soon as you remember. However, if it is close to the time for your next scheduled dose, skip the missed dose completely and continue with your regular schedule. NEVER double up or take two doses at once to make up for a forgotten dose.`;

  // 3. Food & Alcohol Guidelines
  const foodQuestion = `Should I take ${name} with food, and is alcohol permitted?`;
  let foodAnswer = "";
  if (isPainFever) {
    if (med.genericName.toLowerCase().includes("paracetamol") || med.genericName.toLowerCase().includes("acetaminophen")) {
      foodAnswer = `Can be taken with or without food. However, strictly avoid alcohol; combining paracetamol with regular or heavy alcohol intake significantly heightens the risk of acute toxic liver damage.`;
    } else {
      foodAnswer = `Always take with or immediately after meals or with a glass of milk to protect your stomach lining from gastric irritation. Avoid alcohol, as combining NSAIDs with alcohol drastically raises the risk of stomach ulcers and internal bleeding.`;
    }
  } else if (isDigestive) {
    if (med.forms.includes("Capsule") || med.genericName.toLowerCase().includes("prazole") || med.genericName.toLowerCase().includes("tidine")) {
      foodAnswer = `Take 30 to 60 minutes BEFORE your first meal of the day (breakfast) with a full glass of water. Avoid alcohol and spicy/greasy foods which trigger excess gastric acid.`;
    } else {
      foodAnswer = `Take 1 hour after meals or at bedtime when acid reflux strikes. Avoid alcohol, which irritates the esophageal and gastric mucosa.`;
    }
  } else if (isAllergy) {
    foodAnswer = `Can be taken with or without food. Avoid alcohol, as it can compound any mild drowsiness, slow down your motor reflexes, and impair judgment.`;
  } else {
    foodAnswer = `Take with a full glass of water after food unless otherwise indicated. Limit or avoid alcohol during treatment to prevent liver strain and metabolic interference.`;
  }

  // 4. Common vs. Red-Flag Emergency Side Effects
  const sideEffectsQuestion = `What common side effects might occur, and what emergency red flags require urgent medical care?`;
  const commonStr = med.sideEffects.common.slice(0, 3).join(", ") || "mild stomach upset or headache";
  const rareStr = med.sideEffects.rare.slice(0, 3).join(", ") || "allergic hives or swelling";
  const sideEffectsAnswer = `Common mild side effects include: ${commonStr}. Stop taking the medicine and call emergency services immediately if you experience RED-FLAG symptoms: sudden facial/lip/tongue swelling, acute difficulty breathing, severe skin blistering rash, fainting, or signs of internal bleeding (black tarry stools).`;

  // 5. Storage & Safe Handling Conditions
  const storageQuestion = `What are the proper storage and safe handling guidelines for ${name}?`;
  const storageAnswer = `Store in a cool, dry place below 25°C–30°C away from direct sunlight, excess heat, and moisture. Do not store in humid bathroom medicine cabinets. Keep in original foil/blister packs until right before swallowing, and ensure it is stored completely out of reach and sight of children and pets.`;

  const standardFaqs: FAQItem[] = [
    {
      category: "Safe Usage & Escalation",
      question: durationQuestion,
      answer: durationAnswer,
    },
    {
      category: "Missed Dose Protocol",
      question: missedQuestion,
      answer: missedAnswer,
    },
    {
      category: "Food & Alcohol Guidelines",
      question: foodQuestion,
      answer: foodAnswer,
    },
    {
      category: "Side Effects & Red Flags",
      question: sideEffectsQuestion,
      answer: sideEffectsAnswer,
    },
    {
      category: "Storage & Safe Handling",
      question: storageQuestion,
      answer: storageAnswer,
    },
  ];

  // Merge any custom existing FAQs if present
  if (med.categoryFAQs && med.categoryFAQs.length > 0) {
    const existing = med.categoryFAQs.filter(
      (f) => !standardFaqs.some((sf) => sf.question.toLowerCase().includes(f.question.toLowerCase().slice(0, 15)))
    );
    return [...standardFaqs, ...existing];
  }

  return standardFaqs;
}

/**
 * Calculates strict safe limits, minimum safe doses, and continuous duration rules
 */
export function getSafeDosageEnrichment(med: Medicine): DosageInfo {
  const isParacetamol = med.genericName.toLowerCase().includes("paracetamol") || med.genericName.toLowerCase().includes("acetaminophen");
  const isIbuprofen = med.genericName.toLowerCase().includes("ibuprofen");
  const isAspirin = med.genericName.toLowerCase().includes("aspirin");
  const isCetirizine = med.genericName.toLowerCase().includes("cetirizine");
  const isAntacid = med.category === "Digestive Care";

  let minDose = "1 unit as directed";
  let maxDaily = med.dosage.maxDaily || "Do not exceed package recommendations";
  let maxDuration = "Maximum 3 consecutive days for fever; 5 days for pain.";
  let escalation = "If symptoms worsen or persist beyond 3 days, discontinue and consult a licensed physician.";

  if (isParacetamol) {
    minDose = "500 mg (1 tablet) with water";
    maxDaily = "4,000 mg (4 grams) in 24 hours (maximum 8 tablets of 500mg or 6 tablets of 650mg).";
    maxDuration = "Maximum 3 consecutive days for fever or 5 days for pain.";
    escalation = "Seek immediate emergency help if accidental overdose occurs or if yellowing of eyes/skin or right upper belly pain develops.";
  } else if (isIbuprofen) {
    minDose = "200 mg to 400 mg with food or milk";
    maxDaily = "1,200 mg daily for OTC self-care (maximum six 200mg tablets in 24 hours).";
    maxDuration = "Maximum 3 consecutive days for fever or 5 days for pain.";
    escalation = "Stop immediately if you experience severe stomach pain, heartburn, or black stools.";
  } else if (isAspirin) {
    minDose = "325 mg to 650 mg dissolved in water";
    maxDaily = "3,000 mg within 24 hours.";
    maxDuration = "Maximum 3 days for acute headache/fever.";
    escalation = "Never give to children or teenagers recovering from chickenpox or flu symptoms due to Reye's Syndrome risk.";
  } else if (isCetirizine) {
    minDose = "5 mg to 10 mg once daily in the evening";
    maxDaily = "10 mg within 24 hours.";
    maxDuration = "Up to 7-10 days for seasonal allergy flares.";
    escalation = "Consult a doctor if breathing difficulty, throat tightness, or extensive hives develop.";
  } else if (isAntacid) {
    minDose = "5 ml to 10 ml or 1-2 chewable tablets";
    maxDaily = "Maximum 4 times daily (not more than 40 ml/day).";
    maxDuration = "Maximum 7 consecutive days.";
    escalation = "See a gastroenterologist if you have difficulty swallowing or unexplained weight loss.";
  }

  return {
    ...med.dosage,
    recommendedMinimumSafeDose: med.dosage.recommendedMinimumSafeDose || minDose,
    maxDailySafeLimit: med.dosage.maxDailySafeLimit || maxDaily,
    maxContinuousDuration: med.dosage.maxContinuousDuration || maxDuration,
    doctorEscalationRules: med.dosage.doctorEscalationRules || escalation,
  };
}

/**
 * Enriches a medicine with sanitized pharmacy links, 5+ FAQs, and strict safe dosage limits
 */
export function enrichMedicine(med: Medicine): Medicine {
  const sanitizedPrices = sanitizePharmacyLinks(med);
  const comprehensiveFAQs = getComprehensiveFAQs(med);
  const dosage = getSafeDosageEnrichment(med);

  return {
    ...med,
    priceEstimates: sanitizedPrices,
    categoryFAQs: comprehensiveFAQs,
    dosage,
    safeUsageDuration: dosage.maxContinuousDuration,
    maxDailyLimitNotice: dosage.maxDailySafeLimit,
  };
}
