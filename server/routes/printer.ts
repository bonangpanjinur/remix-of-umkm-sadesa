import { Router } from "express";
import * as net from "net";

const router = Router();

// POST /api/printer/wifi-print
// Proxy ESC/POS bytes ke printer via TCP (port 9100 biasanya)
router.post("/wifi-print", async (req, res) => {
  const { ip, port = 9100, data } = req.body as {
    ip: string;
    port?: number;
    data: number[];
  };

  if (!ip || !data || !Array.isArray(data)) {
    return res.status(400).json({ error: "ip dan data wajib diisi" });
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const socket = new net.Socket();
      const buffer = Buffer.from(data);
      let done = false;

      socket.setTimeout(5000);

      socket.connect(Number(port), ip, () => {
        socket.write(buffer, (err) => {
          if (err) {
            if (!done) { done = true; reject(err); }
          } else {
            socket.end();
          }
        });
      });

      socket.on("close", () => {
        if (!done) { done = true; resolve(); }
      });

      socket.on("error", (err) => {
        if (!done) { done = true; reject(err); }
      });

      socket.on("timeout", () => {
        socket.destroy();
        if (!done) { done = true; reject(new Error("Koneksi timeout. Pastikan IP dan port printer benar.")); }
      });
    });

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Gagal mengirim ke printer" });
  }
});

// POST /api/printer/wifi-test
// Cek koneksi ke printer WiFi
router.post("/wifi-test", async (req, res) => {
  const { ip, port = 9100 } = req.body as { ip: string; port?: number };
  if (!ip) return res.status(400).json({ error: "ip wajib diisi" });

  try {
    await new Promise<void>((resolve, reject) => {
      const socket = new net.Socket();
      socket.setTimeout(3000);
      socket.connect(Number(port), ip, () => {
        socket.destroy();
        resolve();
      });
      socket.on("error", reject);
      socket.on("timeout", () => {
        socket.destroy();
        reject(new Error("Timeout — printer tidak merespons"));
      });
    });
    return res.json({ success: true, message: `Printer ${ip}:${port} terhubung!` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Koneksi gagal" });
  }
});

export default router;
