import { Medicine } from "../types";
import { painAndFeverMedicines } from "./medicines/painAndFever";
import { allergyAndColdMedicines } from "./medicines/allergyAndCold";
import { digestiveMedicines } from "./medicines/digestive";
import { topicalAndSkinMedicines } from "./medicines/topicalAndSkin";
import { vitaminsAndSupplementsMedicines } from "./medicines/vitaminsAndSupplements";
import { respiratoryAndEyeEarMedicines } from "./medicines/respiratoryAndEyeEar";

// Expanded supplementary OTC items to ensure comprehensive 100+ dataset coverage
const supplementaryMedicines: Medicine[] = [
  {
    id: "chlorhexidine-mouthwash",
    name: "Chlorhexidine 0.2% Antiseptic Mouthwash (Hexidine / Clohex)",
    genericName: "Chlorhexidine Gluconate 0.2% w/v",
    brandNames: ["Hexidine", "Clohex", "Rexidin", "Corsodyl"],
    category: "First Aid & Antiseptic",
    forms: ["Drops"],
    activeIngredients: ["Chlorhexidine Gluconate"],
    simpleExplanation: "An antibacterial oral rinse that cures bleeding gums, painful mouth ulcers, and gingivitis after dental cleaning.",
    clinicalExplanation: "Cationic bisbiguanide antiseptic that binds to bacterial cell walls, disrupting cell membrane permeability and killing oral microbes.",
    usage: "Gingivitis, gum bleeding, post-dental extraction mouth wash, severe aphthous ulcers.",
    symptomsRelieved: ["Bleeding Gums", "Gingivitis Swelling", "Mouth Ulcer Pain", "Post-Dental Wash"],
    dosage: {
      adult: "Rinse mouth with 10ml undiluted for 1 minute twice daily after tooth brushing.",
      child: "Not for children under 6.",
      maxDaily: "Use twice daily for maximum 14 days.",
      instructions: "Do not swallow mouthwash. Do not rinse with water or eat for 30 minutes after use.",
    },
    sideEffects: {
      common: ["Temporary brownish tooth staining (cleared by dental scaling)", "Altered taste sensation"],
      rare: ["Oral mucosal scaling"],
    },
    warnings: [
      "Avoid long-term daily use over 14 days without dental consultation due to surface tooth staining.",
      "Toothpaste detergents neutralize chlorhexidine; wait 15 minutes after brushing before rinsing.",
    ],
    interactions: ["Anionic toothpaste detergents."],
    pregnancySafety: "Safe for topical oral rinse under advice.",
    alcoholInteraction: "No interaction.",
    priceEstimates: [
      { platform: "Tata 1mg", priceRange: "₹95 - ₹125 (150ml bottle)", inStock: true, platformUrl: "https://www.1mg.com/search/all?name=Hexidine" },
      { platform: "Apollo Pharmacy", priceRange: "₹100 - ₹130 (150ml bottle)", inStock: true, platformUrl: "https://www.apollopharmacy.in/search-medicines/Hexidine" },
      { platform: "Netmeds", priceRange: "₹98 - ₹128 (150ml bottle)", inStock: true, platformUrl: "https://www.netmeds.com/catalogsearch/result?q=Hexidine" },
      { platform: "PharmEasy", priceRange: "₹90 - ₹120 (150ml bottle)", inStock: true, platformUrl: "https://pharmeasy.in/search/all?name=Hexidine" },
    ],
    storage: "Protect from light.",
    categoryFAQs: [
      { category: "General", question: "Why does Chlorhexidine mouthwash stain teeth?", answer: "Chlorhexidine binds to protein pellicle on teeth, attracting dark dietary pigments; dentist cleaning removes the stain easily." },
    ],
    otcSafetyBadge: "General OTC",
    isPopular: true,
  },
  {
    id: "benzydamine-throat-spray",
    name: "Benzydamine Anti-Inflammatory Throat Spray (Difflam / Tantum)",
    genericName: "Benzydamine Hydrochloride 0.15%",
    brandNames: ["Difflam Spray", "Tantum Verde", "Benzydamine Spray"],
    category: "Allergy & Cold",
    forms: ["Inhaler"],
    activeIngredients: ["Benzydamine Hydrochloride"],
    simpleExplanation: "A targeted oral spray that numbs sore throat pain, tonsillitis inflammation, and painful swallowing within seconds.",
    clinicalExplanation: "Locally-acting non-steroidal anti-inflammatory drug with local anesthetic and analgesic properties on pharyngeal mucosa.",
    usage: "Severe sore throat, acute tonsillitis pain, post-tonsillectomy pain, mouth ulcer pain.",
    symptomsRelieved: ["Sore Throat", "Painful Swallowing", "Tonsil Inflammation", "Severe Mouth Ulcers"],
    dosage: {
      adult: "4 to 8 sprays directly onto throat every 1.5 to 3 hours.",
      child: "4 sprays for ages 6-12.",
      maxDaily: "Apply every 2-3 hours.",
      instructions: "Aim nozzle at back of throat and pump. Do not inhale deeply while spraying.",
    },
    sideEffects: {
      common: ["Transient local numbness or stinging sensation"],
      rare: ["Laryngospasm (rare)"],
    },
    warnings: [
      "Do not use continuously for more than 7 days without medical review.",
    ],
    interactions: ["None."],
    pregnancySafety: "Consult physician.",
    alcoholInteraction: "No interaction.",
    priceEstimates: [
      { platform: "Tata 1mg", priceRange: "₹180 - ₹230 (30ml spray bottle)", inStock: true, platformUrl: "https://www.1mg.com/search/all?name=Benzydamine" },
      { platform: "Apollo Pharmacy", priceRange: "₹185 - ₹235 (30ml spray bottle)", inStock: true, platformUrl: "https://www.apollopharmacy.in/search-medicines/Benzydamine" },
      { platform: "Netmeds", priceRange: "₹182 - ₹232 (30ml spray bottle)", inStock: true, platformUrl: "https://www.netmeds.com/catalogsearch/result?q=Benzydamine" },
      { platform: "PharmEasy", priceRange: "₹175 - ₹225 (30ml spray bottle)", inStock: true, platformUrl: "https://pharmeasy.in/search/all?name=Benzydamine" },
    ],
    storage: "Store below 30°C.",
    categoryFAQs: [
      { category: "General", question: "How fast does Benzydamine numb sore throat pain?", answer: "It provides noticeable localized numbing and pain relief within 1 to 2 minutes after spraying." },
    ],
    otcSafetyBadge: "General OTC",
  },
  {
    id: "permethrin-lotion-5",
    name: "Permethrin 5% Anti-Scabies Lotion (Scabper / Scaboma)",
    genericName: "Permethrin 5% w/v",
    brandNames: ["Scabper Lotion", "Scaboma", "Permite", "Phermin"],
    category: "Skin & Topical",
    forms: ["Cream"],
    activeIngredients: ["Permethrin"],
    simpleExplanation: "A single-application topical lotion that cures scabies mite infestations and severe body itching.",
    clinicalExplanation: "Neurotoxic synthetic pyrethroid that disrupts sodium channel voltage-gating in nerve cell membranes of Sarcoptes scabiei mites, causing paralysis.",
    usage: "Scabies infestation, body lice.",
    symptomsRelieved: ["Severe Nighttime Body Itching", "Scabies Skin Burrows", "Small Red Itchy Bumps"],
    dosage: {
      adult: "Apply neck-to-toe on clean dry skin, leave on for 8 to 14 hours overnight, then wash off thoroughly in shower.",
      child: "Include face/scalp for infants avoiding mouth/eyes.",
      maxDaily: "Single overnight application; repeat in 7 days if required.",
      instructions: "Apply to entire body from neck down to soles of feet. Wash all bedding/clothes in hot water.",
    },
    sideEffects: {
      common: ["Transient mild skin stinging or itching right after application"],
      rare: ["Topical skin allergy"],
    },
    warnings: [
      "ALL household family members and intimate contacts must be treated simultaneously, even if they have no symptoms yet.",
    ],
    interactions: ["None."],
    pregnancySafety: "Category B; drug of choice for scabies in pregnancy under doctor guidance.",
    alcoholInteraction: "No interaction.",
    priceEstimates: [
      { platform: "Tata 1mg", priceRange: "₹90 - ₹120 (60ml lotion bottle)", inStock: true, platformUrl: "https://www.1mg.com/search/all?name=Scabper" },
      { platform: "Apollo Pharmacy", priceRange: "₹95 - ₹125 (60ml lotion bottle)", inStock: true, platformUrl: "https://www.apollopharmacy.in/search-medicines/Scabper" },
      { platform: "Netmeds", priceRange: "₹92 - ₹122 (60ml lotion bottle)", inStock: true, platformUrl: "https://www.netmeds.com/catalogsearch/result?q=Scabper" },
      { platform: "PharmEasy", priceRange: "₹85 - ₹115 (60ml lotion bottle)", inStock: true, platformUrl: "https://pharmeasy.in/search/all?name=Scabper" },
    ],
    storage: "Store room temperature.",
    categoryFAQs: [
      { category: "Safety", question: "Why does skin still itch after scabies treatment?", answer: "Post-scabies itch can persist for 2-3 weeks as the body sheds dead mites; calamine lotion or antihistamines help during healing." },
    ],
    otcSafetyBadge: "Pharmacist Consult OTC",
  },
  {
    id: "salicylic-acid-wart-paint",
    name: "Salicylic Acid Corn & Wart Paint (Corn Caps / Salicyl)",
    genericName: "Salicylic Acid 16.7% + Lactic Acid 16.7%",
    brandNames: ["Salicyl Paint", "Carnation Corn Caps", "Duofilm", "Warticon"],
    category: "Skin & Topical",
    forms: ["Ointment"],
    activeIngredients: ["Salicylic Acid", "Lactic Acid"],
    simpleExplanation: "A keratolytic paint that gently dissolves hard foot corns, painful calluses, and stubborn plantar warts.",
    clinicalExplanation: "Potent desmolytic agent that solubilizes intercellular cement, producing desquamation of hyperkeratotic stratum corneum.",
    usage: "Foot corns, painful heel calluses, common warts, plantar warts.",
    symptomsRelieved: ["Painful Foot Corns", "Hard Heel Calluses", "Plantar Warts"],
    dosage: {
      adult: "Soak foot in warm water 5 minutes, dry well, apply 1 drop directly onto wart/corn once daily at night.",
      child: "Avoid in young children without podiatrist care.",
      maxDaily: "Apply once daily at bedtime.",
      instructions: "Apply only to dead hard corn skin; protect surrounding healthy skin with petroleum jelly (Vaseline).",
    },
    sideEffects: {
      common: ["Mild skin peeling and redness around application spot"],
      rare: ["Chemical skin ulceration if applied to healthy skin"],
    },
    warnings: [
      "DO NOT USE IF DIABETIC or if you have poor blood circulation in feet, to prevent non-healing leg ulcers.",
      "Never apply to facial warts, birthmarks, or genital warts.",
    ],
    interactions: ["None."],
    pregnancySafety: "Consult doctor for foot wart care.",
    alcoholInteraction: "No interaction.",
    priceEstimates: [
      { platform: "Tata 1mg", priceRange: "₹120 - ₹160 (10ml bottle)", inStock: true, platformUrl: "https://www.1mg.com/search/all?name=Duofilm" },
      { platform: "Apollo Pharmacy", priceRange: "₹125 - ₹165 (10ml bottle)", inStock: true, platformUrl: "https://www.apollopharmacy.in/search-medicines/Duofilm" },
      { platform: "Netmeds", priceRange: "₹122 - ₹162 (10ml bottle)", inStock: true, platformUrl: "https://www.netmeds.com/catalogsearch/result?q=Duofilm" },
      { platform: "PharmEasy", priceRange: "₹115 - ₹155 (10ml bottle)", inStock: true, platformUrl: "https://pharmeasy.in/search/all?name=Duofilm" },
    ],
    storage: "Keep highly flammable liquid away from open flame.",
    categoryFAQs: [
      { category: "Safety", question: "Why are diabetic patients advised against using corn paints?", answer: "Diabetes lowers nerve sensation and blood supply in feet; chemical corn removers can trigger painless deep diabetic foot ulcers." },
    ],
    otcSafetyBadge: "Pharmacist Consult OTC",
  },
  {
    id: "potassium-permanganate-soak",
    name: "Potassium Permanganate Antiseptic Soak (KMNO4)",
    genericName: "Potassium Permanganate Crystals",
    brandNames: ["KMNO4 Crystals", "Permanganate Salt"],
    category: "First Aid & Antiseptic",
    forms: ["Powder"],
    activeIngredients: ["Potassium Permanganate"],
    simpleExplanation: "Purplish antiseptic crystals dissolved in warm bath water to dry weeping eczema blisters and disinfect athlete's foot.",
    clinicalExplanation: "Oxidizing antiseptic agent that releases oxygen upon contact with organic tissue, destroying bacteria and drying weeping skin lesions.",
    usage: "Weeping eczema blisters, infected athlete's foot ulcers, wound bathing.",
    symptomsRelieved: ["Weeping Eczema Blisters", "Smelly Athlete's Foot", "Skin Ulcer Disinfection"],
    dosage: {
      adult: "DISSOLVE A FEW CRYSTALS IN WARM WATER UNTIL FAINT PINK. Soak feet or body for 10-15 minutes.",
      child: "Dilute under medical advice.",
      maxDaily: "Once daily.",
      instructions: "Water MUST be faint light pink. A dark purple solution is too concentrated and will burn skin!",
    },
    sideEffects: {
      common: ["Harmless brown skin/nail staining"],
      rare: ["Chemical skin burns if crystals are insufficiently dissolved"],
    },
    warnings: [
      "CRITICAL: Solution must be faint light pink (1:10,000 dilution). Dark purple concentrated liquid causes severe skin chemical burns.",
    ],
    interactions: ["None."],
    pregnancySafety: "Safe for foot soak when diluted correctly.",
    alcoholInteraction: "No interaction.",
    priceEstimates: [
      { platform: "Tata 1mg", priceRange: "₹20 - ₹35 (20g container)", inStock: true, platformUrl: "https://www.1mg.com/search/all?name=Potassium%20Permanganate" },
      { platform: "Apollo Pharmacy", priceRange: "₹22 - ₹38 (20g container)", inStock: true, platformUrl: "https://www.apollopharmacy.in/search-medicines/Potassium%20Permanganate" },
      { platform: "Netmeds", priceRange: "₹21 - ₹36 (20g container)", inStock: true, platformUrl: "https://www.netmeds.com/catalogsearch/result?q=Potassium%20Permanganate" },
      { platform: "PharmEasy", priceRange: "₹18 - ₹32 (20g container)", inStock: true, platformUrl: "https://pharmeasy.in/search/all?name=Potassium%20Permanganate" },
    ],
    storage: "Keep dry in original dark container.",
    categoryFAQs: [
      { category: "Safety", question: "How do I know if my Potassium Permanganate solution is safe?", answer: "Dissolve just 2 to 3 tiny crystals in a bucket of water until it turns pale pink like rose water; dark purple is dangerous!" },
    ],
    otcSafetyBadge: "External Use Only",
  },
];

import { enrichMedicine } from "./medicineEnhancements";

const rawMedicines: Medicine[] = [
  ...painAndFeverMedicines,
  ...allergyAndColdMedicines,
  ...digestiveMedicines,
  ...topicalAndSkinMedicines,
  ...vitaminsAndSupplementsMedicines,
  ...respiratoryAndEyeEarMedicines,
  ...supplementaryMedicines,
];

export const allMedicines: Medicine[] = rawMedicines.map(enrichMedicine);

