import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import multer from "multer";
import { medicineEngine } from "./server/medicineEngine.ts";
import { drugInteractionEngine } from "./server/interactionEngine.ts";
import { executeRagQuery, evaluateDynamicInteraction } from "./server/ragService.ts";

let uploadDir = path.resolve(process.cwd(), "uploads");
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch {
  uploadDir = path.join(os.tmpdir(), "uploads");
  try {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
  } catch {}
}

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
});

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.text({ limit: "100mb", type: ["text/csv", "text/plain"] }));

  // Health check endpoint for Cloud Run container probes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", app: "MediGuide" });
  });

  // CORS-safe proxy fallback for https://files.catbox.moe/4yhd1p.zip
  app.get("/api/dataset/remote-zip", async (req, res) => {
    try {
      const response = await fetch("https://files.catbox.moe/4yhd1p.zip");
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        res.setHeader("Content-Type", "application/zip");
        res.setHeader("Cache-Control", "public, max-age=86400");
        return res.send(Buffer.from(arrayBuffer));
      }
    } catch (err) {
      console.warn("Remote catbox zip fetch failed on server, using local fallback:", err);
    }

    // Fallback: compress local sera_prioritized_10000.csv on the fly using JSZip if catbox is unreachable
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const localCsvPath = path.resolve(process.cwd(), "sera_prioritized_10000.csv");
      if (fs.existsSync(localCsvPath)) {
        zip.file("medicines_dataset.csv", fs.readFileSync(localCsvPath));
      }
      const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
      res.setHeader("Content-Type", "application/zip");
      return res.send(zipBuffer);
    } catch (fallbackErr: any) {
      return res.status(500).json({ error: fallbackErr.message || "Failed to provide zip archive" });
    }
  });

      // Dataset Status & Index Statistics Endpoint
  app.get("/api/dataset/status", (req, res) => {
    const stats = medicineEngine.getStats();
    const interactionStats = drugInteractionEngine.getStats();
    res.json({
      ...stats,
      interactionPairsCount: interactionStats.totalInteractionPairs,
      uniqueInteractionDrugsCount: interactionStats.uniqueDrugsCount,
      interactionFiles: interactionStats.loadedFiles,
    });
  });

  // Fast Medicine Search & Autocomplete Endpoint (Exact, Partial, Fuzzy)
  app.get("/api/medicines/search", async (req, res) => {
    try {
      const q = String(req.query.q || "").trim();
      const limit = parseInt(String(req.query.limit || "10"), 10);
      const threshold = parseFloat(String(req.query.threshold || "0.55"));

      if (!q) {
        return res.json({ results: [] });
      }

      const results = await medicineEngine.search(q, { limit, threshold });
      res.json({
        query: q,
        count: results.length,
        results: results.map((r) => ({
          name: r.record.name,
          matchType: r.matchType,
          score: Math.round(r.score * 100) / 100,
          chemicalClass: r.record.chemicalClass,
          therapeuticClass: r.record.therapeuticClass,
          actionClass: r.record.actionClass,
          uses: r.record.uses,
          sideEffects: r.record.sideEffects,
          substitutes: r.record.substitutes,
          composition: r.record.composition,
          habitForming: r.record.habitForming,
          source: r.record.source,
        })),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to execute search" });
    }
  });

  // Get specific medicine by exact/normalized name
  app.get("/api/medicines/record/:name", async (req, res) => {
    try {
      const record = await medicineEngine.getByName(req.params.name);
      if (!record) {
        return res.status(404).json({ error: "Medicine not found in dataset" });
      }
      res.json({ record });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // RAG Powered AI Assistant Endpoint
  app.post("/api/ai-assistant", async (req, res) => {
    try {
      const { prompt, selectedDrugs } = req.body;
      if (!prompt || typeof prompt !== "string") {
        return res.status(400).json({ error: "Prompt is required" });
      }

      const safeSelectedDrugs = Array.isArray(selectedDrugs)
        ? selectedDrugs.map((d) => String(d || "").trim()).filter(Boolean)
        : undefined;

      const result = await executeRagQuery(prompt, safeSelectedDrugs);
      res.json(result);
    } catch (error: any) {
      console.error("AI Assistant RAG API Error:", error);
      res.status(500).json({
        error: error.message || "An error occurred while consulting SERA AI Assistant.",
      });
    }
  });

  // Standalone Bidirectional Drug-Drug Interaction Checker Endpoint (POST /api/check-interactions)
  const handleInteractionCheck = async (req: express.Request, res: express.Response) => {
    try {
      const { drugs, drug1, drug2 } = req.body || {};
      let drugList: string[] = [];

      if (Array.isArray(drugs)) {
        drugList = drugs.map((d) => String(d || "").trim()).filter(Boolean);
      } else if (drug1 && drug2) {
        drugList = [String(drug1).trim(), String(drug2).trim()].filter(Boolean);
      }

      if (drugList.length < 2) {
        return res.status(400).json({
          error: "At least 2 drug names or records are required for interaction analysis.",
        });
      }

      const evaluation = await evaluateDynamicInteraction(drugList);
      res.json(evaluation);
    } catch (error: any) {
      console.error("Interaction evaluation error:", error);
      res.status(500).json({
        error: error.message || "Failed to evaluate interaction safety.",
      });
    }
  };

  app.post("/api/check-interactions", handleInteractionCheck);
  app.post("/api/interactions/evaluate", handleInteractionCheck);

  // Search / List Unique Drugs in db_drug_interactions.csv
  app.get("/api/interactions/drugs", (req, res) => {
    try {
      const q = String(req.query.q || "").trim();
      const limit = parseInt(String(req.query.limit || "40"), 10);
      const drugs = drugInteractionEngine.searchDatasetDrugs(q, limit);
      const stats = drugInteractionEngine.getStats();
      res.json({
        query: q,
        totalUniqueDrugs: stats.uniqueDrugsCount,
        totalInteractionPairs: stats.totalInteractionPairs,
        drugs,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to search DDI drugs" });
    }
  });

  // Browse / Filter Interaction Rows directly from db_drug_interactions.csv
  app.get("/api/interactions/browse", (req, res) => {
    try {
      const query = String(req.query.q || "").trim();
      const drug = String(req.query.drug || "").trim();
      const limit = parseInt(String(req.query.limit || "24"), 10);
      const offset = parseInt(String(req.query.offset || "0"), 10);
      const result = drugInteractionEngine.browseInteractions({ query, drug, limit, offset });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to browse DDI dataset" });
    }
  });

  // Dynamic Multipart File Upload Endpoint (Handles large ZIP and CSV files directly)
  app.post("/api/dataset/upload", upload.any(), async (req, res) => {
    try {
      const files = (req as any).files as any[] | undefined;
      const file = (req as any).file || (files && files[0]);
      if (!file) {
        return res.status(400).json({ error: "No file uploaded. Please select a .zip or .csv file." });
      }

      const filePath = file.path;
      const originalName = (file.originalname || "").toLowerCase();
      const mimeType = file.mimetype || "";

      // Check if it's a drug interaction CSV (e.g. db_drug_interactions.csv)
      let interactionLoadCount = 0;
      if (!originalName.endsWith(".zip") && !mimeType.includes("zip")) {
        const firstLine = fs.readFileSync(filePath, { encoding: "utf8" }).slice(0, 200).toLowerCase();
        if (firstLine.includes("drug 1") || firstLine.includes("interaction") || originalName.includes("interaction")) {
          const intRes = await drugInteractionEngine.loadCsvFromFile(filePath);
          interactionLoadCount = intRes.count;
        }
      }

      let loadResult;
      if (interactionLoadCount > 0) {
        loadResult = { success: true, count: interactionLoadCount };
      } else if (originalName.endsWith(".zip") || mimeType.includes("zip") || mimeType.includes("compressed")) {
        const zipBuf = new Uint8Array(fs.readFileSync(filePath));
        loadResult = await medicineEngine.loadZipBuffer(zipBuf, originalName);
      } else {
        const csvText = fs.readFileSync(filePath, "utf8");
        loadResult = await medicineEngine.loadCSVText(csvText, originalName);
      }

      // Cleanup uploaded temp file
      try {
        fs.unlinkSync(filePath);
      } catch {}

      if (!loadResult.success) {
        return res.status(400).json({
          error: (loadResult as any).error || "Failed to process dataset file",
        });
      }

      res.json({
        message: `Dataset processed successfully! Indexed ${loadResult.count.toLocaleString()} records.`,
        count: loadResult.count,
        recordCount: loadResult.count,
        stats: {
          ...medicineEngine.getStats(),
          interactionPairsCount: drugInteractionEngine.getStats().totalInteractionPairs,
        },
      });
    } catch (err: any) {
      console.error("Upload error:", err);
      res.status(500).json({ error: err.message || "Failed to process uploaded file" });
    }
  });

  // Dynamic CSV/ZIP Upload / Ingestion Endpoint
  app.post("/api/dataset/upload-csv", async (req, res) => {
    try {
      const isZip = req.headers["content-type"]?.includes("zip") || req.body?.isZip;
      const base64Data = req.body?.base64;
      const csvData = typeof req.body === "string" ? req.body : req.body?.csv;

      if (base64Data || isZip) {
        const buffer = new Uint8Array(Buffer.from(base64Data, "base64"));
        const loadResult = await medicineEngine.loadZipBuffer(buffer, "archive.zip");
        return res.json({
          message: "Zip archive decompressed and loaded successfully",
          stats: medicineEngine.getStats(),
          ...loadResult,
        });
      }

      if (!csvData) {
        return res.status(400).json({ error: "Dataset content (CSV or Zip) is required" });
      }

      const loadResult = await medicineEngine.loadCSVText(csvData, "medicine_dataset.csv");
      res.json({
        message: "CSV dataset loaded successfully",
        stats: medicineEngine.getStats(),
        ...loadResult,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to process dataset" });
    }
  });

  const publicPath = path.join(process.cwd(), "public");
  if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
  }

  const distPath = path.join(process.cwd(), "dist");
  const distIndexHtml = path.join(distPath, "index.html");
  const isProduction =
    process.env.NODE_ENV === "production" && fs.existsSync(distIndexHtml);

  // Vite middleware for development; static dist serving for production / Cloud Run
  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(distIndexHtml);
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`MediGuide server running on http://0.0.0.0:${PORT}`);

    // Preload local seed CSV asynchronously after server port is bound
    setImmediate(() => {
      const localPrioritizedCsv = path.resolve(process.cwd(), "sera_prioritized_10000.csv");
      if (fs.existsSync(localPrioritizedCsv)) {
        try {
          const csvContent = fs.readFileSync(localPrioritizedCsv, "utf8");
          medicineEngine.loadCSVText(csvContent, "Clinical Knowledge Base").catch(() => {});
        } catch {}
      }
    });
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
