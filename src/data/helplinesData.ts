import { HelplineRegion } from "../types";

export const helplineRegions: HelplineRegion[] = [
  {
    code: "US",
    name: "United States",
    flag: "🇺🇸",
    numbers: [
      {
        title: "Universal Emergency Dispatch",
        number: "911",
        desc: "Immediate dispatch for Police, Fire Rescue, and Emergency Medical Services (EMS).",
        isPrimary: true,
      },
      {
        title: "National Poison Control Center",
        number: "1-800-222-1222",
        desc: "Immediate 24/7 expert medical guidance for toxic exposures, chemical ingestion, and acute drug overdoses.",
        isPrimary: true,
      },
      {
        title: "988 Suicide & Crisis Lifeline",
        number: "988",
        desc: "Free, confidential 24/7 mental health crisis support and acute emotional distress intervention.",
        isPrimary: false,
      },
    ],
  },
  {
    code: "UK",
    name: "United Kingdom",
    flag: "🇬🇧",
    numbers: [
      {
        title: "Emergency Services Dispatch",
        number: "999",
        desc: "Direct emergency dispatch for Police, NHS Ambulance Service, and Fire Brigade.",
        isPrimary: true,
      },
      {
        title: "NHS 111 Medical Consultation",
        number: "111",
        desc: "Free 24/7 urgent medical assessment, triage guidance, and out-of-hours clinical direction.",
        isPrimary: true,
      },
      {
        title: "National Poisons Information Service (NPIS)",
        number: "0344 892 0111",
        desc: "Specialized clinical advisory service for accidental pharmaceutical poisonings and chemical exposure.",
        isPrimary: false,
      },
    ],
  },
  {
    code: "IN",
    name: "India",
    flag: "🇮🇳",
    numbers: [
      {
        title: "National Emergency Response Support",
        number: "112",
        desc: "Unified pan-India emergency number integrating Police, Fire, and Ambulance response.",
        isPrimary: true,
      },
      {
        title: "National Ambulance & Medical Dispatch",
        number: "108 / 102",
        desc: "Dedicated emergency medical transport and acute critical health response service.",
        isPrimary: true,
      },
      {
        title: "AIIMS National Poison Information Centre",
        number: "1800-116-117",
        desc: "Toll-free 24/7 national toxicology center providing guidance on overdoses, bites, and poisoning.",
        isPrimary: true,
      },
      {
        title: "KIRAN National Mental Health Line",
        number: "1800-599-0019",
        desc: "24/7 helpline providing psychological first-aid and acute emotional crisis counseling.",
        isPrimary: false,
      },
    ],
  },
  {
    code: "CA",
    name: "Canada",
    flag: "🇨🇦",
    numbers: [
      {
        title: "Universal Emergency Services",
        number: "911",
        desc: "Emergency dispatcher for Paramedics, Fire, and Regional Police forces across Canada.",
        isPrimary: true,
      },
      {
        title: "Canadian Poison Centre / CAPCC",
        number: "1-844-POISON-X (1-844-764-7669)",
        desc: "Toll-free emergency advice for poisonings, toxic plant ingestion, and drug overdoses.",
        isPrimary: true,
      },
      {
        title: "Health Link Tele-Triage",
        number: "811",
        desc: "Confidential non-emergency healthcare advice provided directly by registered nurses.",
        isPrimary: false,
      },
    ],
  },
  {
    code: "AU",
    name: "Australia",
    flag: "🇦🇺",
    numbers: [
      {
        title: "Triple Zero Emergency Dispatch",
        number: "000",
        desc: "Primary national emergency number connecting Ambulance, Police, and Fire services.",
        isPrimary: true,
      },
      {
        title: "Poisons Information Centre",
        number: "13 11 26",
        desc: "24/7 Australia-wide immediate toxicology advice for suspected overdoses and venomous bites.",
        isPrimary: true,
      },
      {
        title: "Healthdirect Nurse Triage",
        number: "1800 022 222",
        desc: "Free 24-hour telephone health advice from registered healthcare professionals.",
        isPrimary: false,
      },
    ],
  },
  {
    code: "EU",
    name: "European Union",
    flag: "🇪🇺",
    numbers: [
      {
        title: "European Universal Emergency",
        number: "112",
        desc: "Universal toll-free emergency service operating across all European Union member countries.",
        isPrimary: true,
      },
      {
        title: "European Medical Emergency Triage",
        number: "116 117",
        desc: "Harmonized European helpline for non-life-threatening urgent medical consultations.",
        isPrimary: true,
      },
    ],
  },
];
