import { Router, Request, Response } from "express";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";

const router = Router();

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Serve uploaded files
router.get("/:bucket/:filename", (req: Request, res: Response) => {
  const { bucket, filename } = req.params;
  const safeBucket = bucket.replace(/[^a-z0-9-]/g, "");
  const safeFilename = path.basename(filename);
  const filePath = path.join(UPLOAD_DIR, safeBucket, safeFilename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }

  res.setHeader("Cache-Control", "public, max-age=86400");
  return res.sendFile(filePath);
});

// Upload file (multipart/form-data via base64 for simplicity)
router.post("/upload", async (req: Request, res: Response) => {
  try {
    const { bucket, path: filePath, data, contentType } = req.body;
    if (!bucket || !filePath || !data) {
      return res.status(400).json({ error: "bucket, path, and data are required" });
    }

    const safeBucket = String(bucket).replace(/[^a-z0-9-]/g, "");
    const bucketDir = path.join(UPLOAD_DIR, safeBucket);
    if (!fs.existsSync(bucketDir)) {
      fs.mkdirSync(bucketDir, { recursive: true });
    }

    const ext = String(filePath).split(".").pop() || "jpg";
    const filename = `${crypto.randomBytes(16).toString("hex")}.${ext}`;
    const fullPath = path.join(bucketDir, filename);

    // Decode base64 data
    const buffer = Buffer.from(data.replace(/^data:[^;]+;base64,/, ""), "base64");
    fs.writeFileSync(fullPath, buffer);

    const publicUrl = `/storage/${safeBucket}/${filename}`;
    return res.json({ url: publicUrl });
  } catch (err: any) {
    console.error("Upload error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
