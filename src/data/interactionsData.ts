import { InteractionPair, InteractionSeverity, BatchSafetyAdvice, SaferAlternative, Medicine } from "../types";
import { extractActiveGenerics, checkGenericPairInteraction } from "../utils/interactionEngine";

export const knownInteractionPairs: InteractionPair[] = [
  {
    drug1Id: "warfarin",
    drug2Id: "disprin-325",
    severity: "Major",
    title: "MAJOR SEVERE BLEEDING RISK: Warfarin + Aspirin (Hemorrhage Hazard)",
    explanation: "Combining Warfarin (Coumadin) with Aspirin / Acetylsalicylic acid (Disprin / Ecosprin) blocks both vitamin K clotting factors and platelet aggregation while irritating the stomach lining. This creates a severe, life-threatening risk of internal gastrointestinal and systemic hemorrhage.",
    recommendation: "DO NOT combine Warfarin and Aspirin unless explicitly prescribed and closely monitored (INR checks) by your cardiologist or hematologist.",
    mechanism: "Synergistic anticoagulation (VKORC1 inhibition) + irreversible platelet COX-1 blockade and gastric mucosal erosion.",
    saferAlternatives: [
      {
        drugId: "paracetamol-500",
        name: "Paracetamol 500mg (Single Agent)",
        replacesDrugId: "disprin-325",
        reason: "Provides pain and fever relief without irritating gastric mucosa or inhibiting platelet aggregation.",
      },
    ],
  },
  {
    drug1Id: "warfarin",
    drug2Id: "aspirin-75",
    severity: "Major",
    title: "MAJOR SEVERE BLEEDING RISK: Warfarin + Low-Dose Aspirin (Hemorrhage Hazard)",
    explanation: "Combining Warfarin (Coumadin) with Aspirin (Ecosprin 75) compounds anticoagulant and antiplatelet effects, drastically increasing the risk of severe internal gastrointestinal and systemic hemorrhage.",
    recommendation: "Do NOT combine Warfarin and Aspirin without explicit specialist supervision and frequent INR monitoring.",
    mechanism: "Dual inhibition of coagulation cascade and platelet COX-1 aggregation.",
  },
  {
    drug1Id: "digoxin",
    drug2Id: "furosemide",
    severity: "Moderate",
    title: "Moderate Interaction • Monitor Closely: Hypokalemia-Induced Digoxin Toxicity Risk",
    explanation: "Furosemide (Lasix) increases urinary potassium and magnesium loss. Low blood potassium (hypokalemia) sensitizes the heart muscle to Digoxin (Lanoxin), significantly increasing the risk of Digoxin toxicity and dangerous cardiac arrhythmias.",
    recommendation: "Monitor serum potassium, magnesium, and renal function closely. Consult your physician regarding potassium supplementation or dose adjustment.",
    mechanism: "Loop diuretic-induced hypokalemia enhancing myocardial Na+/K+-ATPase binding of Digoxin.",
  },
  {
    drug1Id: "enalapril",
    drug2Id: "spironolactone",
    severity: "Major",
    title: "MAJOR INTERACTION: Severe Hyperkalemia Risk (Enalapril + Spironolactone)",
    explanation: "Combining an ACE inhibitor (Enalapril) with a potassium-sparing diuretic (Spironolactone) causes additive potassium retention, risking severe hyperkalemia and potentially fatal cardiac arrhythmias.",
    recommendation: "Monitor serum potassium and kidney function closely. Avoid potassium supplements or salt substitutes.",
    mechanism: "Dual suppression of aldosterone-mediated renal potassium excretion.",
  },
  {
    drug1Id: "lisinopril",
    drug2Id: "spironolactone",
    severity: "Major",
    title: "MAJOR INTERACTION: Severe Hyperkalemia Risk (Lisinopril + Spironolactone)",
    explanation: "Combining an ACE inhibitor (Lisinopril) with a potassium-sparing diuretic (Spironolactone) causes additive potassium retention, risking severe hyperkalemia and cardiac arrhythmias.",
    recommendation: "Monitor serum potassium and kidney function closely. Avoid potassium supplements or salt substitutes.",
    mechanism: "Dual suppression of aldosterone-mediated renal potassium excretion.",
  },
  {
    drug1Id: "paracetamol-500",
    drug2Id: "combiflam",
    severity: "Major",
    title: "Duplicate Paracetamol Intake (Overdose Hazard)",
    explanation: "Both medicines contain active Paracetamol. Taking Paracetamol 500mg along with Combiflam (which contains 325mg paracetamol) significantly increases the risk of exceeding the safe 4,000mg maximum daily paracetamol threshold, potentially causing severe acute liver damage.",
    recommendation: "DO NOT combine standalone Paracetamol with combination painkillers like Combiflam. Choose one or consult a pharmacist.",
    mechanism: "Hepatic CYP2E1 saturation leading to accumulation of toxic metabolite NAPQI.",
    saferAlternatives: [
      {
        drugId: "paracetamol-500",
        name: "Paracetamol 500mg (Single Agent)",
        replacesDrugId: "combiflam",
        reason: "Use pure Paracetamol alone to stay safely within daily liver safety thresholds.",
      },
      {
        drugId: "volini-gel",
        name: "Diclofenac / Volini Topical Gel",
        replacesDrugId: "combiflam",
        reason: "Provides localized joint and muscle pain relief without systemic oral NSAID/paracetamol loading.",
      },
    ],
  },
  {
    drug1Id: "paracetamol-650",
    drug2Id: "combiflam",
    severity: "Major",
    title: "Severe Paracetamol Overdose Hazard",
    explanation: "Combining high-strength Dolo 650 with Combiflam delivers 975mg of paracetamol per single dose. Taking this combination 3 times daily quickly breaches safe hepatic limits.",
    recommendation: "Avoid combining Dolo 650 with Combiflam. Use only one product at a time.",
    mechanism: "Dangerous additive acetaminophen burden.",
    saferAlternatives: [
      {
        drugId: "paracetamol-650",
        name: "Dolo 650 (Standalone)",
        replacesDrugId: "combiflam",
        reason: "High strength paracetamol provides sufficient fever relief alone without adding NSAID complexity.",
      },
    ],
  },
  {
    drug1Id: "ibuprofen-200",
    drug2Id: "combiflam",
    severity: "Major",
    title: "Duplicate NSAID Intake (Gastric Ulcer Hazard)",
    explanation: "Both Ibuprofen 200mg and Combiflam contain active Ibuprofen. Stacking NSAIDs does not improve pain relief but exponentially increases gastrointestinal mucosal damage, stomach ulcers, and stomach bleeding risk.",
    recommendation: "Avoid taking standalone Ibuprofen with Combiflam. Use a single NSAID medication.",
    mechanism: "Additive COX-1 inhibition in gastric mucosa reducing protective prostaglandins.",
    saferAlternatives: [
      {
        drugId: "paracetamol-500",
        name: "Paracetamol 500mg",
        replacesDrugId: "ibuprofen-200",
        reason: "Non-NSAID pain reliever that is gentle on the stomach lining.",
      },
    ],
  },
  {
    drug1Id: "ibuprofen-200",
    drug2Id: "aspirin-75",
    severity: "Major",
    title: "Reduced Aspirin Heart Protection & Elevated Bleeding",
    explanation: "Ibuprofen competes with low-dose Aspirin at the COX-1 binding site on blood platelets, blocking Aspirin's cardio-protective blood-thinning effect. In addition, taking two NSAIDs together severely heightens stomach bleeding risk.",
    recommendation: "If you take low-dose Aspirin for heart protection, take Aspirin at least 30 minutes BEFORE Ibuprofen, or consult your cardiologist for an alternative pain reliever like Paracetamol.",
    mechanism: "Steric hindrance of platelet COX-1 acetylation + additive gastric toxicity.",
    saferAlternatives: [
      {
        drugId: "paracetamol-500",
        name: "Paracetamol 500mg",
        replacesDrugId: "ibuprofen-200",
        reason: "Does not interfere with the antiplatelet cardio-protective action of Aspirin.",
      },
    ],
  },
  {
    drug1Id: "ibuprofen-200",
    drug2Id: "disprin-325",
    severity: "Major",
    title: "Additive Gastrointestinal Bleeding Risk",
    explanation: "Combining soluble Aspirin (Disprin) with Ibuprofen doubles stomach lining irritation and significantly increases the risk of acute gastric ulcers and internal GI bleeding.",
    recommendation: "Do not combine Aspirin and Ibuprofen. For acute pain, use Paracetamol instead.",
    mechanism: "Dual systemic and local gastric mucosal injury.",
    saferAlternatives: [
      {
        drugId: "paracetamol-500",
        name: "Paracetamol 500mg",
        replacesDrugId: "ibuprofen-200",
        reason: "Safer analgesic alternative that avoids dual NSAID mucosal damage.",
      },
    ],
  },
  {
    drug1Id: "cetirizine-10",
    drug2Id: "avil-25",
    severity: "Moderate",
    title: "Additive Sedation & CNS Depression",
    explanation: "Combining second-generation Cetirizine with strongly sedating first-generation Avil (Pheniramine) causes severe drowsiness, slowed motor reflexes, dry mouth, and impaired cognitive function.",
    recommendation: "Do not take two different antihistamines together. Choose a single non-drowsy allergy option like Cetirizine or Fexofenadine.",
    mechanism: "Additive central H1 blockade and anticholinergic synergism.",
    saferAlternatives: [
      {
        drugId: "cetirizine-10",
        name: "Cetirizine 10mg (Single Daily)",
        replacesDrugId: "avil-25",
        reason: "Provides 24-hour non-sedating relief without combining sedating 1st-generation antihistamines.",
      },
    ],
  },
  {
    drug1Id: "phenylephrine-paracetamol-cpm",
    drug2Id: "paracetamol-500",
    severity: "Major",
    title: "Duplicate Paracetamol Intake",
    explanation: "Sinarest / Wikoryl already contains 500mg of Paracetamol per tablet. Taking additional Paracetamol pills risks exceeding the daily 4g limit.",
    recommendation: "Do not take extra Paracetamol while taking multi-symptom cold tablets like Sinarest.",
    mechanism: "Hidden paracetamol stacking in multi-ingredient cold medicines.",
    saferAlternatives: [
      {
        drugId: "saline-nasal-spray",
        name: "Saline Nasal Spray",
        replacesDrugId: "phenylephrine-paracetamol-cpm",
        reason: "Provides direct nasal decongestion without systemic paracetamol loading.",
      },
    ],
  },
  {
    drug1Id: "phenylephrine-paracetamol-cpm",
    drug2Id: "paracetamol-650",
    severity: "Major",
    title: "Dangerous Paracetamol Accumulation",
    explanation: "Combining Sinarest with Dolo 650 provides 1,150mg of paracetamol in a single sitting, risking acute hepatotoxicity.",
    recommendation: "Use either the cold tablet OR the fever tablet, never both together.",
    mechanism: "Severe acute acetaminophen overload.",
    saferAlternatives: [
      {
        drugId: "paracetamol-650",
        name: "Dolo 650 + Saline Spray",
        replacesDrugId: "phenylephrine-paracetamol-cpm",
        reason: "Relieves fever while using non-medicated saline for nasal clearance.",
      },
    ],
  },
  {
    drug1Id: "omeprazole-20",
    drug2Id: "gelusil-antacid-liquid",
    severity: "Moderate",
    title: "Altered Drug Absorption Timing",
    explanation: "Taking liquid antacids like Gelusil simultaneously with Omeprazole capsules can temporarily alter stomach pH in a way that affects the dissolution of Omeprazole's enteric coating.",
    recommendation: "Take Omeprazole 30 minutes BEFORE breakfast on an empty stomach. If instant acidity strikes later, wait at least 1-2 hours before taking Gelusil.",
    mechanism: "Premature breakdown of acid-labile enteric polymer coating in elevated pH.",
  },
  {
    drug1Id: "shelcal-500",
    drug2Id: "dexorange-syrup",
    severity: "Moderate",
    title: "Calcium Binding & Reduced Iron Absorption",
    explanation: "Calcium carbonate in Shelcal binds to elemental Iron in Dexorange syrup in the stomach, forming insoluble complexes that drastically reduce iron absorption into the bloodstream.",
    recommendation: "Separate Calcium and Iron supplements by at least 2 to 4 hours (e.g., Iron after lunch, Calcium after dinner).",
    mechanism: "Cation chelation and competitive intestinal mucosal DMT-1 transport.",
  },
  {
    drug1Id: "fexofenadine-120",
    drug2Id: "gelusil-antacid-liquid",
    severity: "Moderate",
    title: "Reduced Fexofenadine Absorption",
    explanation: "Antacids containing Aluminum and Magnesium Hydroxide (like Gelusil) bind to Fexofenadine in the gut, reducing its absorption and anti-allergy effectiveness by approximately 50%.",
    recommendation: "Take Fexofenadine at least 2 hours before or 2 hours after taking liquid antacids.",
    mechanism: "Chelation/adsorption reducing systemic bioavailability.",
  },
];

export const analyzeInteractionPairs = (medicineIds: string[]): InteractionPair[] => {
  const results: InteractionPair[] = [];
  
  if (medicineIds.length < 2) return results;

  for (let i = 0; i < medicineIds.length; i++) {
    for (let j = i + 1; j < medicineIds.length; j++) {
      const id1 = medicineIds[i];
      const id2 = medicineIds[j];

      // 1. Find known pair by direct ID
      const match = knownInteractionPairs.find(
        (pair) =>
          (pair.drug1Id === id1 && pair.drug2Id === id2) ||
          (pair.drug1Id === id2 && pair.drug2Id === id1)
      );

      if (match) {
        results.push(match);
        continue;
      }

      // 2. Perform pairwise active generic ingredient lookup (Bidirectional)
      const genInfo1 = extractActiveGenerics(id1);
      const genInfo2 = extractActiveGenerics(id2);
      let genericMatchedPair: InteractionPair | null = null;

      for (let a = 0; a < genInfo1.clinicalKeys.length; a++) {
        for (let b = 0; b < genInfo2.clinicalKeys.length; b++) {
          const evalRes = checkGenericPairInteraction(
            id1,
            genInfo1.genericNames[a] || genInfo1.clinicalKeys[a],
            genInfo1.clinicalKeys[a],
            id2,
            genInfo2.genericNames[b] || genInfo2.clinicalKeys[b],
            genInfo2.clinicalKeys[b]
          );

          if (evalRes.severity === "Severe" || evalRes.severity === "Moderate") {
            const mappedSev: InteractionSeverity = evalRes.severity === "Severe" ? "Major" : "Moderate";
            if (!genericMatchedPair || mappedSev === "Major") {
              genericMatchedPair = {
                drug1Id: id1,
                drug2Id: id2,
                severity: mappedSev,
                title: evalRes.title,
                explanation: evalRes.plainEnglish,
                recommendation: evalRes.safetyGuidance,
                mechanism: evalRes.mechanism,
                saferAlternatives: (evalRes.saferAlternatives || []).map((sa) => ({
                  drugId: sa.drugId || "paracetamol-500",
                  name: sa.name,
                  replacesDrugId: sa.replacesDrugName === id1 ? id1 : id2,
                  reason: sa.reason,
                })),
              };
            }
          }
        }
      }

      if (genericMatchedPair) {
        results.push(genericMatchedPair);
      } else {
        results.push({
          drug1Id: id1,
          drug2Id: id2,
          severity: "None",
          title: "No Major Known Direct Interaction",
          explanation: "There are no major critical reported contraindications when these two OTC medicines are taken together at standard recommended dosages.",
          recommendation: "Maintain recommended individual dosages, avoid taking excessive doses, and take with water after meals when appropriate.",
        });
      }
    }
  }

  return results;
};

/**
 * Smart Batch Safety Analyzer:
 * Evaluates the entire basket of medicines, detects specific clashing pairs,
 * calculates drop advice (e.g., dropping Drug A makes the rest safe),
 * and suggests non-interacting OTC alternatives.
 */
export function analyzeBatchSafety(
  medicineIds: string[],
  allMedicinesList: Medicine[]
): BatchSafetyAdvice {
  const pairs = analyzeInteractionPairs(medicineIds);
  const clashingPairs = pairs.filter((p) => p.severity === "Major" || p.severity === "Moderate");

  const hasHazard = clashingPairs.length > 0;
  const hasMajor = clashingPairs.some((p) => p.severity === "Major");
  const severestLevel: InteractionSeverity = hasMajor ? "Major" : hasHazard ? "Moderate" : "None";

  const getMedName = (id: string) => {
    const med = allMedicinesList.find((m) => m.id === id);
    return med ? med.name : id;
  };

  const formattedClashes = clashingPairs.map((p) => ({
    drug1Id: p.drug1Id,
    drug2Id: p.drug2Id,
    drug1Name: getMedName(p.drug1Id),
    drug2Name: getMedName(p.drug2Id),
    title: p.title,
    severity: p.severity,
  }));

  // Calculate drop impact for each drug in the batch
  const dropSuggestions: BatchSafetyAdvice["dropSuggestions"] = [];
  const saferAlternatives: SaferAlternative[] = [];

  // Collect all safer alternatives defined in known clashing pairs
  clashingPairs.forEach((pair) => {
    if (pair.saferAlternatives && pair.saferAlternatives.length > 0) {
      pair.saferAlternatives.forEach((alt) => {
        if (!saferAlternatives.some((sa) => sa.name === alt.name)) {
          saferAlternatives.push(alt);
        }
      });
    }
  });

  if (hasHazard && medicineIds.length >= 2) {
    medicineIds.forEach((drugId) => {
      const remainingIds = medicineIds.filter((id) => id !== drugId);
      if (remainingIds.length >= 1) {
        const remainingPairs = analyzeInteractionPairs(remainingIds);
        const remainingClashes = remainingPairs.filter(
          (p) => p.severity === "Major" || p.severity === "Moderate"
        );

        const drugName = getMedName(drugId);

        if (remainingClashes.length === 0) {
          dropSuggestions.push({
            dropDrugId: drugId,
            dropDrugName: drugName,
            impact: `Dropping ${drugName} resolves all clashing interactions and makes the remaining ${remainingIds.length} medicine(s) safe to take.`,
          });
        } else {
          dropSuggestions.push({
            dropDrugId: drugId,
            dropDrugName: drugName,
            impact: `Removing ${drugName} reduces interaction risk, but ${remainingClashes.length} other potential interaction(s) remain in the batch.`,
          });
        }
      }
    });
  }

  // If no specific alternatives were found in pair defs, provide general category alternatives
  if (saferAlternatives.length === 0 && hasHazard) {
    if (clashingPairs.some((p) => p.drug1Id.includes("ibuprofen") || p.drug2Id.includes("ibuprofen") || p.drug1Id.includes("combiflam") || p.drug2Id.includes("combiflam"))) {
      saferAlternatives.push({
        drugId: "paracetamol-500",
        name: "Paracetamol 500mg",
        replacesDrugId: "combiflam",
        reason: "Non-NSAID gentle pain reliever that does not irritate gastric mucosa or double NSAID load.",
      });
    }
    if (clashingPairs.some((p) => p.drug1Id.includes("avil") || p.drug2Id.includes("avil"))) {
      saferAlternatives.push({
        drugId: "cetirizine-10",
        name: "Cetirizine 10mg",
        replacesDrugId: "avil-25",
        reason: "Second-generation non-sedating antihistamine that avoids severe CNS depression.",
      });
    }
  }

  return {
    hasHazard,
    severestLevel,
    clashingPairs: formattedClashes,
    dropSuggestions,
    saferAlternatives,
  };
}
