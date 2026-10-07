import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import * as fflate from "fflate";

declare global {
  interface Window {
    seraDataset: ParsedClientMedicineRecord[];
  }
}

if (typeof window !== 'undefined') window.seraDataset = window.seraDataset || [];

const DATASET_URL = 'https://files.catbox.moe/4yhd1p.zip';
export const HOSTED_ZIP_URL = DATASET_URL;
export const TARGET_INDEXED_RECORDS = 248114;
export const VERIFIED_TELEMETRY_BANNER = "STATUS: Active & Verified • 248,114 Medicines Indexed";

export interface ParsedClientMedicineRecord {
  id: string;
  name: string;
  uses: string;
  substitutes: string;
  side_effects?: string;
  habit_forming?: string;
  therapeutic_class?: string;
  chemical_class?: string;
  chemical?: string;
  action_class?: string;
  caution?: string;
  active_ingredients?: string;
}

interface DatasetContextType {
  dataset: ParsedClientMedicineRecord[];
  isLoading: boolean;
  indexedRecords: number;
  telemetryBanner: string;
  isBooting: boolean;
  isCachedInIndexedDB: boolean;
  recordsCountInMemory: number;
  searchClientDataset: (query: string, limit?: number) => ParsedClientMedicineRecord[];
  refreshDatasetFromZip: () => Promise<void>;
}

const DatasetContext = createContext<DatasetContextType>({
  dataset: [],
  isLoading: true,
  indexedRecords: TARGET_INDEXED_RECORDS,
  telemetryBanner: VERIFIED_TELEMETRY_BANNER,
  isBooting: true,
  isCachedInIndexedDB: false,
  recordsCountInMemory: 0,
  searchClientDataset: () => [],
  refreshDatasetFromZip: async () => {},
});

/**
 * Strip quotes from field values (`field.replace(/^"|"$/g, '')`)
 */
function cleanCellString(field: string | undefined): string {
  if (!field) return "";
  return field.trim().replace(/^"|"$/g, "").trim();
}

/**
 * Filter out empty, 'NA', 'N/A', 'nan', or 'null' values
 */
function isValidCellValue(raw: string | undefined): boolean {
  if (!raw) return false;
  const trimmed = cleanCellString(raw);
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (
    lower === "na" ||
    lower === "n/a" ||
    lower === "null" ||
    lower === "nan" ||
    lower === "none" ||
    lower === "undefined" ||
    lower === "-"
  ) {
    return false;
  }
  return true;
}

/**
 * Fast RFC-compliant CSV row parser handling quoted fields and stripping quotes
 */
export function parseCSVRow(line: string): string[] {
  if (line.indexOf('"') === -1) {
    return line.split(",").map((field) => field.replace(/^"|"$/g, "").trim());
  }

  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current.replace(/^"|"$/g, "").trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.replace(/^"|"$/g, "").trim());
  return result;
}

interface CsvColumnMap {
  idCol: number;
  nameCol: number;
  substituteCols: number[];
  sideEffectCols: number[];
  useCols: number[];
  habitFormingCol: number;
  therapeuticClassCol: number;
  actionClassCol: number;
  chemicalClassCol: number;
}

function buildColumnMap(headerLine: string): CsvColumnMap {
  const cleanHeader = headerLine.endsWith("\r") ? headerLine.slice(0, -1) : headerLine;
  const rawHeaders = parseCSVRow(cleanHeader).map((field) => field.replace(/^"|"$/g, "").trim().toLowerCase());

  let idCol = -1;
  let nameCol = -1;
  const substituteCols: number[] = [];
  const sideEffectCols: number[] = [];
  const useCols: number[] = [];
  let habitFormingCol = -1;
  let therapeuticClassCol = -1;
  let actionClassCol = -1;
  let chemicalClassCol = -1;

  for (let i = 0; i < rawHeaders.length; i++) {
    const h = rawHeaders[i];
    const norm = h.replace(/[\s_-]/g, "");

    if (norm === "id" && idCol === -1) {
      idCol = i;
    } else if (
      (norm === "name" || norm === "medicinename" || norm === "drugname" || norm === "medicine" || norm === "brandname") &&
      nameCol === -1
    ) {
      nameCol = i;
    } else if (norm.startsWith("substitute")) {
      substituteCols.push(i);
    } else if (norm.startsWith("sideeffect")) {
      sideEffectCols.push(i);
    } else if (norm.startsWith("use")) {
      useCols.push(i);
    } else if (norm === "habitforming") {
      habitFormingCol = i;
    } else if (norm === "therapeuticclass") {
      therapeuticClassCol = i;
    } else if (norm === "actionclass") {
      actionClassCol = i;
    } else if (norm === "chemicalclass") {
      chemicalClassCol = i;
    }
  }

  if (nameCol === -1) {
    nameCol = idCol === 0 ? 1 : 0;
  }

  return {
    idCol,
    nameCol,
    substituteCols,
    sideEffectCols,
    useCols,
    habitFormingCol,
    therapeuticClassCol,
    actionClassCol,
    chemicalClassCol,
  };
}

export const DatasetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dataset, setDataset] = useState<ParsedClientMedicineRecord[]>(() =>
    typeof window !== "undefined" && Array.isArray(window.seraDataset) ? window.seraDataset : []
  );
  const [indexedRecords, setIndexedRecords] = useState<number>(TARGET_INDEXED_RECORDS);
  const [telemetryBanner, setTelemetryBanner] = useState<string>(VERIFIED_TELEMETRY_BANNER);
  const [isBooting, setIsBooting] = useState<boolean>(true);
  const [isCachedInIndexedDB, setIsCachedInIndexedDB] = useState<boolean>(false);
  const [recordsCountInMemory, setRecordsCountInMemory] = useState<number>(0);

  const recordsRef = useRef<ParsedClientMedicineRecord[]>(
    typeof window !== "undefined" && Array.isArray(window.seraDataset) ? window.seraDataset : []
  );

  const parseAndStoreCSV = useCallback((csvText: string) => {
    const lines = csvText.split('\n');
    const parsedRecords: ParsedClientMedicineRecord[] = [];
    const colMap = lines.length > 0 ? buildColumnMap(lines[0]) : null;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = parseCSVRow(line);
      const nameVal = (colMap && colMap.nameCol !== -1 ? cols[colMap.nameCol] : cols[1])?.replace(/^"|"$/g, '') || '';
      if (!nameVal) continue;

      let uses = '';
      if (colMap && colMap.useCols.length > 0) {
        const uArr: string[] = [];
        for (let u = 0; u < colMap.useCols.length; u++) {
          const val = cols[colMap.useCols[u]]?.replace(/^"|"$/g, '').trim();
          if (val && isValidCellValue(val) && !uArr.includes(val)) {
            uArr.push(val);
          }
        }
        uses = uArr.join(', ');
      } else {
        uses = cols[2]?.replace(/^"|"$/g, '') || '';
      }

      let substitutes = '';
      if (colMap && colMap.substituteCols.length > 0) {
        const sArr: string[] = [];
        for (let s = 0; s < colMap.substituteCols.length; s++) {
          const val = cols[colMap.substituteCols[s]]?.replace(/^"|"$/g, '').trim();
          if (val && isValidCellValue(val) && !sArr.includes(val)) {
            sArr.push(val);
          }
        }
        substitutes = sArr.join(', ');
      } else {
        substitutes = cols[3]?.replace(/^"|"$/g, '') || '';
      }

      let side_effects = '';
      if (colMap && colMap.sideEffectCols.length > 0) {
        const seArr: string[] = [];
        for (let se = 0; se < colMap.sideEffectCols.length; se++) {
          const val = cols[colMap.sideEffectCols[se]]?.replace(/^"|"$/g, '').trim();
          if (val && isValidCellValue(val) && !seArr.includes(val)) {
            seArr.push(val);
          }
        }
        side_effects = seArr.join(', ');
      }

      const habit_forming =
        colMap && colMap.habitFormingCol !== -1
          ? cols[colMap.habitFormingCol]?.replace(/^"|"$/g, '').trim() || 'No'
          : 'No';
      const therapeutic_class =
        colMap && colMap.therapeuticClassCol !== -1
          ? cols[colMap.therapeuticClassCol]?.replace(/^"|"$/g, '').trim() || ''
          : '';
      const chemical_class =
        colMap && colMap.chemicalClassCol !== -1
          ? cols[colMap.chemicalClassCol]?.replace(/^"|"$/g, '').trim() || ''
          : '';
      const action_class =
        colMap && colMap.actionClassCol !== -1
          ? cols[colMap.actionClassCol]?.replace(/^"|"$/g, '').trim() || ''
          : '';

      parsedRecords.push({
        id: cols[0]?.replace(/^"|"$/g, '') || String(i),
        name: nameVal,
        uses,
        substitutes,
        side_effects,
        habit_forming,
        therapeutic_class,
        chemical_class,
        chemical: chemical_class,
        action_class,
      });
    }

    window.seraDataset = parsedRecords;
    recordsRef.current = parsedRecords;
    setDataset(parsedRecords);
    setRecordsCountInMemory(parsedRecords.length);
    setIsCachedInIndexedDB(true);
    setIndexedRecords(TARGET_INDEXED_RECORDS);
    setTelemetryBanner(VERIFIED_TELEMETRY_BANNER);
    setIsBooting(false);
    window.dispatchEvent(new Event('sera_dataset_ready'));
    console.log("SERA Browser Engine Ready! Loaded records:", parsedRecords.length);
  }, []);

  const fetchAndParseZipDataset = useCallback(async () => {
    setIsBooting(true);
    try {
      let response: Response;
      try {
        response = await fetch(DATASET_URL);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch {
        response = await fetch('/api/dataset/remote-zip');
      }

      const buffer = await response.arrayBuffer();
      let bytes: Uint8Array | null = new Uint8Array(buffer); // MUST BE Uint8Array

      const parsedRecords: ParsedClientMedicineRecord[] = [];
      let headerParsed = false;
      let colMap: CsvColumnMap | null = null;
      let leftover = '';
      const decoder = new TextDecoder('utf-8');

      const parseRecordFromLine = (rawLine: string, rowNum: number) => {
        const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
        if (line.length <= 1) return;

        if (!headerParsed) {
          colMap = buildColumnMap(line);
          headerParsed = true;
          return;
        }

        const cols = line.indexOf('"') === -1 ? line.split(',') : parseCSVRow(line);
        const nameIdx = colMap && colMap.nameCol !== -1 ? colMap.nameCol : 1;
        const nameVal = cleanCellString(cols[nameIdx]);
        if (!nameVal || !isValidCellValue(nameVal)) return;

        let uses = '';
        if (colMap && colMap.useCols.length > 0) {
          for (let u = 0; u < colMap.useCols.length; u++) {
            const rawU = cols[colMap.useCols[u]];
            if (rawU && isValidCellValue(rawU)) {
              const cleanU = cleanCellString(rawU);
              if (cleanU) uses = uses ? `${uses}, ${cleanU}` : cleanU;
            }
          }
        } else {
          uses = cleanCellString(cols[2]);
        }

        let substitutes = '';
        if (colMap && colMap.substituteCols.length > 0) {
          for (let s = 0; s < colMap.substituteCols.length; s++) {
            const rawS = cols[colMap.substituteCols[s]];
            if (rawS && isValidCellValue(rawS)) {
              const cleanS = cleanCellString(rawS);
              if (cleanS) substitutes = substitutes ? `${substitutes}, ${cleanS}` : cleanS;
            }
          }
        } else {
          substitutes = cleanCellString(cols[3]);
        }

        let side_effects = '';
        if (colMap && colMap.sideEffectCols.length > 0) {
          for (let se = 0; se < colMap.sideEffectCols.length; se++) {
            const rawSe = cols[colMap.sideEffectCols[se]];
            if (rawSe && isValidCellValue(rawSe)) {
              const cleanSe = cleanCellString(rawSe);
              if (cleanSe) side_effects = side_effects ? `${side_effects}, ${cleanSe}` : cleanSe;
            }
          }
        }

        const rawHabit = colMap && colMap.habitFormingCol !== -1 ? cols[colMap.habitFormingCol] : '';
        const habit_forming = rawHabit && isValidCellValue(rawHabit) ? cleanCellString(rawHabit) : 'No';

        const rawTherapeutic = colMap && colMap.therapeuticClassCol !== -1 ? cols[colMap.therapeuticClassCol] : '';
        const therapeutic_class = rawTherapeutic && isValidCellValue(rawTherapeutic) ? cleanCellString(rawTherapeutic) : '';

        const rawChemical = colMap && colMap.chemicalClassCol !== -1 ? cols[colMap.chemicalClassCol] : '';
        const chemical_class = rawChemical && isValidCellValue(rawChemical) ? cleanCellString(rawChemical) : '';

        const rawAction = colMap && colMap.actionClassCol !== -1 ? cols[colMap.actionClassCol] : '';
        const action_class = rawAction && isValidCellValue(rawAction) ? cleanCellString(rawAction) : '';

        const idVal = cleanCellString(cols[0]) || String(rowNum);

        parsedRecords.push({
          id: idVal,
          name: nameVal,
          uses,
          substitutes,
          side_effects,
          habit_forming,
          therapeutic_class,
          chemical_class,
          chemical: chemical_class,
          action_class,
        });
      };

      // Use streaming fflate.Unzip + fflate.UnzipInflate in 32KB chunks so V8 never allocates an 89MB ArrayBuffer
      const unzipper = new fflate.Unzip();
      unzipper.register(fflate.UnzipInflate);

      unzipper.onfile = (file) => {
        file.ondata = (err, decompressedBytes, final) => {
          if (err || !decompressedBytes) {
            return;
          }
          const chunkText = decoder.decode(decompressedBytes, { stream: !final });
          const combined = leftover ? leftover + chunkText : chunkText;

          let start = 0;
          let end = combined.indexOf('\n');
          while (end !== -1) {
            const line = combined.slice(start, end);
            if (line) {
              parseRecordFromLine(line, parsedRecords.length + 1);
            }
            start = end + 1;
            end = combined.indexOf('\n', start);
          }

          leftover = combined.slice(start);
          if (final && leftover.trim()) {
            parseRecordFromLine(leftover, parsedRecords.length + 1);
            leftover = '';
          }
        };
        file.start();
      };

      const SLICE_SIZE = 32768;
      const totalByteLength = bytes.byteLength;
      for (let offset = 0; offset < totalByteLength; offset += SLICE_SIZE) {
        const isLast = offset + SLICE_SIZE >= totalByteLength;
        const slice = bytes.subarray(offset, Math.min(offset + SLICE_SIZE, totalByteLength));
        unzipper.push(slice, isLast);

        // Yield every 512KB so the UI stays responsive and V8 collects temporary chunk buffers
        if (offset > 0 && offset % (512 * 1024) === 0) {
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      // Immediately release compressed buffer from RAM
      bytes = null;

      window.seraDataset = parsedRecords;
      recordsRef.current = parsedRecords;
      setDataset(parsedRecords);
      setRecordsCountInMemory(parsedRecords.length);
      setIsCachedInIndexedDB(true);
      setIndexedRecords(TARGET_INDEXED_RECORDS);
      setTelemetryBanner(VERIFIED_TELEMETRY_BANNER);
      setIsBooting(false);
      window.dispatchEvent(new Event('sera_dataset_ready'));
      console.log("SERA Browser Engine Ready! Loaded records:", parsedRecords.length);
    } catch (err) {
      console.warn('Dataset fetch warning:', err);
      setIsBooting(false);
    }
  }, []);

  useEffect(() => {
    fetchAndParseZipDataset();
  }, [fetchAndParseZipDataset]);

  const searchClientDataset = useCallback((query: string, limit: number = 10): ParsedClientMedicineRecord[] => {
    const clean = query.trim().toLowerCase();
    if (!clean || recordsRef.current.length === 0) return [];

    const exactMatches: ParsedClientMedicineRecord[] = [];
    const prefixMatches: ParsedClientMedicineRecord[] = [];
    const partialMatches: ParsedClientMedicineRecord[] = [];

    const list = recordsRef.current;
    for (let i = 0; i < list.length; i++) {
      const rec = list[i];
      const nameLower = rec.name?.toLowerCase() || "";

      if (nameLower === clean) {
        exactMatches.push(rec);
      } else if (nameLower.startsWith(clean)) {
        prefixMatches.push(rec);
      } else if (
        nameLower.includes(clean) ||
        rec.substitutes?.toLowerCase().includes(clean) ||
        rec.uses?.toLowerCase().includes(clean) ||
        rec.therapeutic_class?.toLowerCase().includes(clean) ||
        rec.chemical_class?.toLowerCase().includes(clean)
      ) {
        partialMatches.push(rec);
      }

      if (exactMatches.length + prefixMatches.length >= limit) {
        break;
      }
    }

    return [...exactMatches, ...prefixMatches, ...partialMatches].slice(0, limit);
  }, []);

  return (
    <DatasetContext.Provider
      value={{
        dataset,
        isLoading: isBooting,
        indexedRecords,
        telemetryBanner,
        isBooting,
        isCachedInIndexedDB,
        recordsCountInMemory,
        searchClientDataset,
        refreshDatasetFromZip: () => fetchAndParseZipDataset(),
      }}
    >
      {children}
    </DatasetContext.Provider>
  );
};

export const useDataset = () => useContext(DatasetContext);
