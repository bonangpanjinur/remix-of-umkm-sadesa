-- Insert shipping and platform fee settings into app_settings
INSERT INTO public.app_settings (key, category, value, description) VALUES
  ('shipping_base_fee', 'shipping', '{"base_fee": 5000, "per_km_fee": 2000, "min_fee": 5000, "max_fee": 50000, "free_shipping_min_order": 100000}'::jsonb, 'Pengaturan biaya kirim dasar'),
  ('platform_fee', 'platform', '{"percentage": 5, "min_fee": 1000, "max_fee": 50000, "enabled": true}'::jsonb, 'Pengaturan biaya platform/komisi'),
  ('shipping_zones', 'shipping', '{"zones": [{"name": "Dalam Desa", "max_distance_km": 5, "fee": 5000}, {"name": "Antar Desa", "max_distance_km": 15, "fee": 10000}, {"name": "Luar Kecamatan", "max_distance_km": 30, "fee": 20000}]}'::jsonb, 'Zona pengiriman berdasarkan jarak')
ON CONFLICT (key) DO NOTHING;