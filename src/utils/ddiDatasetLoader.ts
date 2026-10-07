import Papa from "papaparse";

export interface InteractionRecord {
  drug1: string;
  drug2: string;
  description: string;
  "Drug 1": string;
  "Drug 2": string;
  "Interaction Description": string;
}

let cachedDdiRecords: InteractionRecord[] | null = null;
let ongoingFetchPromise: Promise<InteractionRecord[]> | null = null;

/**
 * Fetches /Db_drug_interactions.csv from the root public directory
 * and parses it into interaction records array using PapaParse.
 * Includes fallback paths for casing and sub-path deployment resilience.
 */
export async function fetchAndParseDdiDataset(): Promise<InteractionRecord[]> {
  if (cachedDdiRecords && cachedDdiRecords.length > 0) {
    return cachedDdiRecords;
  }

  if (ongoingFetchPromise) {
    return ongoingFetchPromise;
  }

  ongoingFetchPromise = (async () => {
    try {
      const baseUrl = import.meta.env.BASE_URL || "/";
      const cleanBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

      const candidateUrls = [
        "/Db_drug_interactions.csv",
        "/db_drug_interactions.csv",
        `${cleanBase}Db_drug_interactions.csv`,
        `${cleanBase}db_drug_interactions.csv`,
        "Db_drug_interactions.csv",
        "db_drug_interactions.csv",
      ];

      // Deduplicate URLs
      const uniqueUrls = Array.from(new Set(candidateUrls));
      let csvText = "";
      let successfulUrl = "";

      for (const url of uniqueUrls) {
        try {
          const response = await fetch(url);
          if (response.ok) {
            const text = await response.text();
            // Verify it is actual CSV content and not HTML from SPA fallback
            if (
              text &&
              !text.trim().toLowerCase().startsWith("<!doctype") &&
              !text.trim().toLowerCase().startsWith("<html") &&
              (text.includes(",") || text.includes("\t"))
            ) {
              csvText = text;
              successfulUrl = url;
              break;
            }
          }
        } catch {
          // Continue to next candidate URL
        }
      }

      if (!csvText) {
        // Fallback: try fetching from server browse API if static file couldn't be loaded
        try {
          const apiRes = await fetch("/api/interactions/browse?limit=5000");
          if (apiRes.ok) {
            const apiData = await apiRes.json();
            if (Array.isArray(apiData.rows) && apiData.rows.length > 0) {
              const apiRecords: InteractionRecord[] = apiData.rows.map((r: any) => ({
                drug1: r.drug1 || r["Drug 1"] || "",
                drug2: r.drug2 || r["Drug 2"] || "",
                description: r.description || r["Interaction Description"] || "",
                "Drug 1": r.drug1 || r["Drug 1"] || "",
                "Drug 2": r.drug2 || r["Drug 2"] || "",
                "Interaction Description": r.description || r["Interaction Description"] || "",
              }));
              cachedDdiRecords = apiRecords;
              return apiRecords;
            }
          }
        } catch (apiErr) {
          console.warn("Backend API browse fallback also unavailable:", apiErr);
        }

        throw new Error(
          "Could not locate Db_drug_interactions.csv across attempted static paths and API endpoints."
        );
      }

      return new Promise<InteractionRecord[]>((resolve, reject) => {
        Papa.parse<Record<string, string>>(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            if (results.errors && results.errors.length > 0) {
              console.warn("PapaParse reported parsing notices on DDI CSV:", results.errors[0]);
            }

            const records: InteractionRecord[] = [];
            for (let i = 0; i < results.data.length; i++) {
              const row = results.data[i];
              const d1 = (row["Drug 1"] || row["drug1"] || row["Drug1"] || "").trim();
              const d2 = (row["Drug 2"] || row["drug2"] || row["Drug2"] || "").trim();
              const desc = (
                row["Interaction Description"] ||
                row["description"] ||
                row["InteractionDescription"] ||
                ""
              ).trim();

              if (d1 && d2) {
                records.push({
                  drug1: d1,
                  drug2: d2,
                  description: desc,
                  "Drug 1": d1,
                  "Drug 2": d2,
                  "Interaction Description": desc,
                });
              }
            }

            console.log(
              `SERA DDI Engine Ready! Loaded ${records.length.toLocaleString()} interaction records from ${successfulUrl}`
            );
            cachedDdiRecords = records;
            resolve(records);
          },
          error: (parseError: Error) => {
            console.error("PapaParse error parsing DDI CSV dataset:", parseError);
            reject(parseError);
          },
        });
      });
    } catch (err) {
      console.error("Failed to load or parse DDI CSV dataset:", err);
      throw err;
    } finally {
      ongoingFetchPromise = null;
    }
  })();

  return ongoingFetchPromise;
}

export function getCachedDdiRecords(): InteractionRecord[] | null {
  return cachedDdiRecords;
}
