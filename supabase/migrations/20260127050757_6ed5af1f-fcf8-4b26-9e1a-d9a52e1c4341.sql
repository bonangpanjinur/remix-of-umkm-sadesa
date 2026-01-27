-- Create couriers table for village delivery persons
CREATE TABLE public.couriers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    -- Address fields
    province TEXT NOT NULL,
    city TEXT NOT NULL,
    district TEXT NOT NULL,
    subdistrict TEXT NOT NULL,
    address TEXT NOT NULL,
    -- Documents
    ktp_number TEXT NOT NULL,
    ktp_image_url TEXT NOT NULL,
    photo_url TEXT NOT NULL,
    vehicle_type TEXT NOT NULL DEFAULT 'motor',
    vehicle_plate TEXT,
    vehicle_image_url TEXT NOT NULL,
    -- Status
    registration_status TEXT NOT NULL DEFAULT 'PENDING',
    status TEXT NOT NULL DEFAULT 'INACTIVE',
    is_available BOOLEAN NOT NULL DEFAULT false,
    -- Tracking
    current_lat NUMERIC,
    current_lng NUMERIC,
    last_location_update TIMESTAMP WITH TIME ZONE,
    -- Metadata
    village_id UUID REFERENCES public.villages(id),
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create app_settings table for dynamic configuration
CREATE TABLE public.app_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL DEFAULT '{}',
    description TEXT,
    category TEXT NOT NULL DEFAULT 'general',
    updated_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.couriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for couriers
CREATE POLICY "Admins can manage couriers" ON public.couriers
FOR ALL USING (is_admin());

CREATE POLICY "Verifikator can manage couriers" ON public.couriers
FOR ALL USING (is_verifikator());

CREATE POLICY "Anyone can register as courier" ON public.couriers
FOR INSERT WITH CHECK (registration_status = 'PENDING' AND status = 'INACTIVE');

CREATE POLICY "Active couriers visible to authenticated" ON public.couriers
FOR SELECT USING (status = 'ACTIVE' AND auth.uid() IS NOT NULL);

CREATE POLICY "Couriers can view own data" ON public.couriers
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Couriers can update own location" ON public.couriers
FOR UPDATE USING (user_id = auth.uid() AND status = 'ACTIVE');

-- RLS policies for app_settings
CREATE POLICY "Admins can manage settings" ON public.app_settings
FOR ALL USING (is_admin());

CREATE POLICY "Anyone can view settings" ON public.app_settings
FOR SELECT USING (true);

-- Update trigger for couriers
CREATE TRIGGER update_couriers_updated_at
BEFORE UPDATE ON public.couriers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update trigger for app_settings
CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default settings
INSERT INTO public.app_settings (key, value, description, category) VALUES
('registration_village', '{"enabled": true}', 'Enable/disable village registration', 'registration'),
('registration_merchant', '{"enabled": true}', 'Enable/disable merchant registration', 'registration'),
('registration_courier', '{"enabled": true}', 'Enable/disable courier registration', 'registration'),
('address_api', '{"provider": "emsifa", "base_url": "https://emsifa.github.io/api-wilayah-indonesia/api"}', 'Address API configuration', 'integration'),
('payment_midtrans', '{"enabled": false, "server_key": "", "client_key": "", "is_production": false}', 'Midtrans payment gateway', 'payment'),
('payment_xendit', '{"enabled": false, "secret_key": "", "public_key": ""}', 'Xendit payment gateway', 'payment');