import express from "express";
import dotenv from "dotenv";
import multer from "multer";
import csv from "csv-parser";
import fs from "fs";
import fetch from "node-fetch";
import path from "path";

dotenv.config();

const app = express();
const upload = multer({ dest: "uploads/" });
const __dirname = path.resolve();

app.use(express.static("public"));
app.use(express.json());

// Email verification route
app.post("/verify", async (req, res) => {
  const { email } = req.body;

  try {
    const response = await fetch(
      `https://api.zerobounce.net/v2/validate?api_key=${process.env.API_KEY}&email=${email}`
    );
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Verification failed." });
  }
});

// CSV upload + bulk check route
app.post("/upload", upload.single("file"), async (req, res) => {
  const results = [];
  const filePath = req.file.path;

  fs.createReadStream(filePath)
    .pipe(csv())
    .on("data", (data) => results.push(data))
    .on("end", async () => {
      const verified = [];

      for (const row of results) {
        const email = row.email || row.Email;
        if (email) {
          const response = await fetch(
            `https://api.zerobounce.net/v2/validate?api_key=${process.env.API_KEY}&email=${email}`
          );
          const data = await response.json();
          verified.push({
            email: email,
            status: data.status,
            sub_status: data.sub_status,
          });
        }
      }

      fs.unlinkSync(filePath); // delete uploaded file
      res.json(verified);
    });
});

app.listen(process.env.PORT, () => {
  console.log(`✅ Server running on http://localhost:${process.env.PORT}`);
});
