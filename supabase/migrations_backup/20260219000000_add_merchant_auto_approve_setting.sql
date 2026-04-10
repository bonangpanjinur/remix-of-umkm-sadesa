-- Add merchant auto approve setting to app_settings
INSERT INTO public.app_settings (key, value, description, category)
VALUES (
    'merchant_auto_approve',
    '{"enabled": false}',
    'Enable/disable automatic approval for new merchant registrations',
    'registration'
)
ON CONFLICT (key) DO NOTHING;
