import express from "express";
import dotenv from "dotenv";
import multer from "multer";
import csv from "csv-parser";
import fs from "fs";
import fetch from "node-fetch"; // ok to keep if using node-fetch
import path from "path";

dotenv.config();

const app = express();

// ensure uploads dir exists so multer won't fail
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
const upload = multer({ dest: UPLOAD_DIR });

// use absolute path for public folder
const PUBLIC_DIR = path.join(process.cwd(), "public");

// serve static files from /public (absolute path avoids ambiguity)
app.use(express.static(PUBLIC_DIR));
app.use(express.json());

// health check
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

// root route -> explicit file send (fixes Cannot GET /)
app.get("/", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// Email verification route (single)
app.post("/verify", async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "Email required" });

  try {
    const response = await fetch(
      `https://api.zerobounce.net/v2/validate?api_key=${process.env.API_KEY}&email=${encodeURIComponent(
        email
      )}`
    );
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("verify error:", error);
    res.status(500).json({ error: "Verification failed." });
  }
});

// CSV upload + bulk check route
app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const filePath = req.file.path;
  const rows = [];

  fs.createReadStream(filePath)
    .pipe(csv())
    .on("data", (row) => rows.push(row))
    .on("error", (err) => {
      console.error("CSV parse error:", err);
      try { fs.unlinkSync(filePath); } catch {}
      res.status(400).json({ error: "Invalid CSV" });
    })
    .on("end", async () => {
      const output = [];

      for (const row of rows) {
        const email = (row.email || row.Email || row.EMAIL || "").trim();
        if (!email) continue;

        try {
          const response = await fetch(
            `https://api.zerobounce.net/v2/validate?api_key=${process.env.API_KEY}&email=${encodeURIComponent(
              email
            )}`
          );
          const data = await response.json();
          output.push({ email, status: data.status, sub_status: data.sub_status });
        } catch (e) {
          console.error("bulk verify error for", email, e);
          output.push({ email, status: "error", sub_status: "network_error" });
        }
      }

      // cleanup uploaded file
      try { fs.unlinkSync(filePath); } catch (e) { console.warn("unlink failed", e); }

      res.json(output);
    });
});

// catch-all for client-side routes (place last so API routes work)
// optional: uncomment if you want all unknown GETs to return index.html (SPA)
app.get("*", (req, res) => {
  // only serve for GET requests (avoid interfering with POSTs)
  if (req.method !== "GET") return res.status(404).send("Not found");
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// Use Render's assigned port or 3000 locally
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
