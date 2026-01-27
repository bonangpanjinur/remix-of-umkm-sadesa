-- ============================================
-- DESA WISATA & UMKM - DATABASE SCHEMA
-- ============================================

-- 1. Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'buyer');

-- 2. Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'buyer',
    UNIQUE (user_id, role)
);

-- 3. Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT NOT NULL DEFAULT '',
    phone TEXT,
    address TEXT,
    village TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Create villages table
CREATE TABLE public.villages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    district TEXT NOT NULL,
    regency TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Create merchants table
CREATE TABLE public.merchants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    village_id UUID REFERENCES public.villages(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    open_time TIME,
    close_time TIME,
    classification_price TEXT CHECK (classification_price IN ('UNDER_5K', 'FROM_5K_TO_10K', 'FROM_10K_TO_20K', 'ABOVE_20K')),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    order_mode TEXT NOT NULL DEFAULT 'ADMIN_ASSISTED' CHECK (order_mode IN ('SELF', 'ADMIN_ASSISTED')),
    rating_avg DECIMAL(2,1) DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    badge TEXT CHECK (badge IN ('VERIFIED', 'POPULAR', 'NEW')),
    image_url TEXT,
    is_open BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. Create products table
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL CHECK (price >= 0),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    image_url TEXT,
    category TEXT NOT NULL CHECK (category IN ('kuliner', 'fashion', 'kriya')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_promo BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 7. Create tourism table
CREATE TABLE public.tourism (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    village_id UUID REFERENCES public.villages(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    wa_link TEXT,
    sosmed_link TEXT,
    facilities TEXT[] DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    view_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 8. Create orders table
CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
    merchant_id UUID REFERENCES public.merchants(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'PROCESSED', 'SENT', 'DONE', 'CANCELED')),
    handled_by TEXT NOT NULL DEFAULT 'ADMIN' CHECK (handled_by IN ('ADMIN', 'MERCHANT')),
    delivery_type TEXT NOT NULL DEFAULT 'PICKUP' CHECK (delivery_type IN ('PICKUP', 'INTERNAL')),
    delivery_address TEXT,
    delivery_phone TEXT,
    delivery_name TEXT,
    shipping_cost INTEGER NOT NULL DEFAULT 0,
    subtotal INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 9. Create order_items table
CREATE TABLE public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    product_price INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    subtotal INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update timestamps
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_merchants_updated_at
    BEFORE UPDATE ON public.merchants
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile and buyer role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, full_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'buyer');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- RLS POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.villages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tourism ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- USER_ROLES policies
CREATE POLICY "Users can view own roles"
    ON public.user_roles FOR SELECT
    USING (auth.uid() = user_id);

-- PROFILES policies
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- VILLAGES policies (public read)
CREATE POLICY "Anyone can view active villages"
    ON public.villages FOR SELECT
    USING (is_active = true);

CREATE POLICY "Admins can manage villages"
    ON public.villages FOR ALL
    USING (public.is_admin());

-- MERCHANTS policies (public read)
CREATE POLICY "Anyone can view active merchants"
    ON public.merchants FOR SELECT
    USING (status = 'ACTIVE');

CREATE POLICY "Admins can manage merchants"
    ON public.merchants FOR ALL
    USING (public.is_admin());

-- PRODUCTS policies (public read)
CREATE POLICY "Anyone can view active products"
    ON public.products FOR SELECT
    USING (is_active = true);

CREATE POLICY "Admins can manage products"
    ON public.products FOR ALL
    USING (public.is_admin());

-- TOURISM policies (public read)
CREATE POLICY "Anyone can view active tourism"
    ON public.tourism FOR SELECT
    USING (is_active = true);

CREATE POLICY "Admins can manage tourism"
    ON public.tourism FOR ALL
    USING (public.is_admin());

-- ORDERS policies
CREATE POLICY "Buyers can view own orders"
    ON public.orders FOR SELECT
    USING (auth.uid() = buyer_id OR public.is_admin());

CREATE POLICY "Buyers can create orders"
    ON public.orders FOR INSERT
    WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Buyers can update own pending orders"
    ON public.orders FOR UPDATE
    USING (auth.uid() = buyer_id AND status = 'NEW');

CREATE POLICY "Admins can manage all orders"
    ON public.orders FOR ALL
    USING (public.is_admin());

-- ORDER_ITEMS policies
CREATE POLICY "Users can view own order items"
    ON public.order_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.orders 
            WHERE orders.id = order_items.order_id 
            AND (orders.buyer_id = auth.uid() OR public.is_admin())
        )
    );

CREATE POLICY "Users can insert order items for own orders"
    ON public.order_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.orders 
            WHERE orders.id = order_items.order_id 
            AND orders.buyer_id = auth.uid()
        )
    );

-- ============================================
-- SEED DATA
-- ============================================

-- Insert sample villages
INSERT INTO public.villages (id, name, district, regency, description, is_active) VALUES
('11111111-1111-1111-1111-111111111111', 'Desa Bojong', 'Megamendung', 'Bogor', 'Desa wisata dengan pemandangan sawah terasering yang memukau dan udara sejuk pegunungan.', true),
('22222222-2222-2222-2222-222222222222', 'Desa Sukamaju', 'Cisarua', 'Sukabumi', 'Desa dengan kebun teh yang indah dan arsitektur tradisional Sunda yang masih terjaga.', true);

-- Insert sample merchants
INSERT INTO public.merchants (id, village_id, name, address, phone, open_time, close_time, classification_price, status, order_mode, rating_avg, rating_count, badge, is_open) VALUES
('aaaa1111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Warung Bu Siti', 'Jl. Sawah Indah No. 5', '081234567890', '08:00', '17:00', 'UNDER_5K', 'ACTIVE', 'ADMIN_ASSISTED', 4.8, 124, 'VERIFIED', true),
('aaaa2222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Kopi Desa', 'Jl. Perkebunan No. 12', '081234567891', '07:00', '20:00', 'FROM_10K_TO_20K', 'ACTIVE', 'SELF', 4.9, 89, 'POPULAR', true),
('aaaa3333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Kerajinan Mandiri', 'Kampung Kriya Rt 03/02', '081234567892', '09:00', '16:00', 'ABOVE_20K', 'ACTIVE', 'ADMIN_ASSISTED', 4.7, 56, 'VERIFIED', true),
('aaaa4444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'Dapur Emak', 'Jl. Kuliner Desa No. 8', '081234567893', '06:00', '18:00', 'FROM_5K_TO_10K', 'ACTIVE', 'ADMIN_ASSISTED', 4.6, 203, NULL, true);

-- Insert sample products
INSERT INTO public.products (id, merchant_id, name, description, price, stock, category, is_active, is_promo) VALUES
('bbbb1111-1111-1111-1111-111111111111', 'aaaa1111-1111-1111-1111-111111111111', 'Keripik Pisang Manis', 'Keripik pisang renyah dengan rasa manis gurih khas desa. Dibuat dari pisang pilihan yang diolah dengan cara tradisional.', 15000, 50, 'kuliner', true, true),
('bbbb2222-2222-2222-2222-222222222222', 'aaaa2222-2222-2222-2222-222222222222', 'Kopi Bubuk Robusta', 'Kopi robusta pilihan dari kebun kopi desa, digiling halus dengan aroma yang kuat dan rasa yang nikmat.', 35000, 30, 'kuliner', true, false),
('bbbb3333-3333-3333-3333-333333333333', 'aaaa3333-3333-3333-3333-333333333333', 'Tas Anyaman Bambu', 'Tas anyaman bambu buatan tangan dengan desain modern namun tetap tradisional. Cocok untuk berbagai acara.', 75000, 15, 'kriya', true, false),
('bbbb4444-4444-4444-4444-444444444444', 'aaaa4444-4444-4444-4444-444444444444', 'Sambal Bawang Botol', 'Sambal bawang pedas gurih dalam kemasan botol, tahan lama dan cocok untuk oleh-oleh.', 20000, 100, 'kuliner', true, true);

-- Insert sample tourism
INSERT INTO public.tourism (id, village_id, name, description, wa_link, sosmed_link, facilities, is_active, view_count) VALUES
('cccc1111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Kampung Awan & Sawah', 'Menawarkan pengalaman otentik hidup di desa dengan pemandangan sawah terasering yang memukau mata. Udara sejuk pegunungan dan keramahan warga lokal akan membuat liburan Anda tak terlupakan.', 'https://wa.me/6281234567890', 'https://instagram.com/kampungawan', ARRAY['Area Parkir Luas', 'Toilet Bersih', 'Spot Foto', 'Warung Makan', 'Mushola', 'Penginapan'], true, 1523),
('cccc2222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Kebun Teh Panorama', 'Hamparan kebun teh yang hijau dengan pemandangan pegunungan. Udara segar dan suasana tenang cocok untuk melepas penat.', 'https://wa.me/6281234567891', NULL, ARRAY['Parkir', 'Toilet', 'Warung', 'Spot Foto'], true, 892);