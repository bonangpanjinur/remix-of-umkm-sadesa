-- Add COD settings to app_settings
INSERT INTO public.app_settings (key, value, description, category)
VALUES (
  'cod_settings',
  '{"enabled": true, "max_amount": 75000, "max_distance_km": 3, "service_fee": 1000, "min_trust_score": 50, "confirmation_timeout_minutes": 15, "penalty_points": 50, "success_bonus_points": 1}',
  'Pengaturan fitur COD (Cash on Delivery)',
  'payment'
) ON CONFLICT (key) DO NOTHING;