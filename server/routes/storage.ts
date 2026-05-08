import { Router, Request, Response } from "express";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import { fileTypeFromBuffer } from "file-type";

const router = Router();

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// S9: Daftar MIME type yang diizinkan dan ukuran maksimum
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

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

// Upload file (base64 encoded)
router.post("/upload", async (req: Request, res: Response) => {
  try {
    const { bucket, path: filePath, data, contentType } = req.body;
    if (!bucket || !filePath || !data) {
      return res.status(400).json({ error: "bucket, path, dan data wajib diisi" });
    }

    const safeBucket = String(bucket).replace(/[^a-z0-9-]/g, "");

    // Decode base64
    const buffer = Buffer.from(
      String(data).replace(/^data:[^;]+;base64,/, ""),
      "base64"
    );

    // S9: Validasi ukuran file
    if (buffer.length > MAX_SIZE_BYTES) {
      return res.status(400).json({ error: "Ukuran file melebihi 5MB" });
    }

    // S9: Validasi magic bytes — cek konten sesungguhnya, bukan hanya ekstensi
    const fileType = await fileTypeFromBuffer(buffer);
    if (!fileType || !ALLOWED_MIME_TYPES.has(fileType.mime)) {
      return res.status(400).json({
        error: "Tipe file tidak diizinkan. Hanya JPG, PNG, WebP, dan GIF yang diperbolehkan.",
      });
    }

    const bucketDir = path.join(UPLOAD_DIR, safeBucket);
    if (!fs.existsSync(bucketDir)) {
      fs.mkdirSync(bucketDir, { recursive: true });
    }

    // Gunakan ekstensi dari magic bytes (bukan dari nama file pengguna)
    const filename = `${crypto.randomBytes(16).toString("hex")}.${fileType.ext}`;
    const fullPath = path.join(bucketDir, filename);

    fs.writeFileSync(fullPath, buffer);

    const publicUrl = `/storage/${safeBucket}/${filename}`;
    return res.json({ url: publicUrl });
  } catch (err: any) {
    console.error("Upload error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
