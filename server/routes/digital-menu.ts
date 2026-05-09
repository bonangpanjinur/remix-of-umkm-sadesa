/**
 * Digital Menu QR — endpoint publik tanpa autentikasi
 * GET  /api/menu/:tenantId              — info restoran + daftar produk per kategori
 * GET  /api/menu/:tenantId/table/:tableId — validasi meja + info meja
 * POST /api/menu/:tenantId/order        — kirim pesanan dari HP pelanggan
 */
import { Router, Request, Response } from "express";
import { pool } from "../db";

const router = Router();

// GET /api/menu/:tenantId
router.get("/:tenantId", async (req: Request, res: Response) => {
  const { tenantId } = req.params;
  const client = await pool.connect();
  try {
    // Info tenant
    const tenantRes = await client.query(
      `SELECT id, name, logo_url, address, phone, currency
       FROM public.pos_tenants WHERE id = $1 AND is_active = true`,
      [tenantId]
    );
    if (!tenantRes.rows[0]) {
      return res.status(404).json({ error: "Restoran tidak ditemukan" });
    }
    const tenant = tenantRes.rows[0];

    // Kategori aktif
    const catRes = await client.query(
      `SELECT id, name, sort_order
       FROM public.pos_categories
       WHERE tenant_id = $1 AND is_active = true
       ORDER BY sort_order, name`,
      [tenantId]
    );

    // Produk aktif (ambil semua sekaligus, group di aplikasi)
    const prodRes = await client.query(
      `SELECT id, name, price, original_price, category_id, description,
              image_url, unit, is_available, sku
       FROM public.pos_products
       WHERE tenant_id = $1 AND is_active = true AND is_available = true
       ORDER BY category_id, name`,
      [tenantId]
    );

    return res.json({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        logo_url: tenant.logo_url,
        address: tenant.address,
        phone: tenant.phone,
        currency: tenant.currency || "IDR",
      },
      categories: catRes.rows,
      products: prodRes.rows,
    });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  } finally {
    client.release();
  }
});

// GET /api/menu/:tenantId/table/:tableId
router.get("/:tenantId/table/:tableId", async (req: Request, res: Response) => {
  const { tenantId, tableId } = req.params;
  const client = await pool.connect();
  try {
    const tableRes = await client.query(
      `SELECT id, name, section, capacity, status
       FROM public.pos_tables
       WHERE id = $1 AND tenant_id = $2 AND is_active = true`,
      [tableId, tenantId]
    );
    if (!tableRes.rows[0]) {
      return res.status(404).json({ error: "Meja tidak ditemukan" });
    }
    return res.json({ table: tableRes.rows[0] });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  } finally {
    client.release();
  }
});

// POST /api/menu/:tenantId/order
router.post("/:tenantId/order", async (req: Request, res: Response) => {
  const { tenantId } = req.params;
  const { table_id, table_name, customer_name, notes, items } = req.body;

  if (!table_id || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "table_id dan items wajib diisi" });
  }

  const client = await pool.connect();
  try {
    // Validasi tenant aktif
    const tenantRes = await client.query(
      `SELECT id, name, store_name FROM public.pos_tenants WHERE id = $1 AND is_active = true`,
      [tenantId]
    );
    if (!tenantRes.rows[0]) {
      return res.status(404).json({ error: "Restoran tidak ditemukan" });
    }

    // Validasi meja
    const tableRes = await client.query(
      `SELECT id, name, outlet_id FROM public.pos_tables WHERE id = $1 AND tenant_id = $2 AND is_active = true`,
      [table_id, tenantId]
    );
    if (!tableRes.rows[0]) {
      return res.status(404).json({ error: "Meja tidak valid" });
    }
    const table = tableRes.rows[0];

    // Validasi produk yang dipesan
    const productIds = items.map((i: any) => i.product_id);
    const prodRes = await client.query(
      `SELECT id, name, price FROM public.pos_products
       WHERE id = ANY($1) AND tenant_id = $2 AND is_active = true AND is_available = true`,
      [productIds, tenantId]
    );
    const validProducts: Record<string, any> = {};
    prodRes.rows.forEach((p: any) => { validProducts[p.id] = p; });

    // Susun items dengan harga dari server (hindari manipulasi harga)
    const verifiedItems: any[] = [];
    let subtotal = 0;
    for (const item of items) {
      const p = validProducts[item.product_id];
      if (!p) continue;
      const qty = Math.max(1, Math.floor(Number(item.qty) || 1));
      const price = Number(p.price);
      verifiedItems.push({
        product_id: p.id,
        product_name: p.name,
        qty,
        price,
        subtotal: qty * price,
        notes: item.notes || null,
      });
      subtotal += qty * price;
    }

    if (verifiedItems.length === 0) {
      return res.status(400).json({ error: "Tidak ada produk valid yang dipesan" });
    }

    const orderNumber = `QR-${Date.now().toString(36).toUpperCase()}`;

    // Buat pesanan di pos_table_orders
    const orderRes = await client.query(
      `INSERT INTO public.pos_table_orders
         (tenant_id, outlet_id, table_id, table_name, order_number, status, items, customer_name, notes, source)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, 'qr_menu')
       RETURNING id, order_number`,
      [
        tenantId,
        table.outlet_id,
        table_id,
        table_name || table.name,
        orderNumber,
        JSON.stringify(verifiedItems),
        customer_name || "Tamu",
        notes || null,
      ]
    );

    // Update status meja ke occupied
    await client.query(
      `UPDATE public.pos_tables SET status = 'occupied', updated_at = now() WHERE id = $1`,
      [table_id]
    );

    return res.json({
      success: true,
      order_id: orderRes.rows[0].id,
      order_number: orderRes.rows[0].order_number,
      items: verifiedItems,
      subtotal,
      message: "Pesanan berhasil dikirim ke dapur!",
    });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  } finally {
    client.release();
  }
});

export default router;
