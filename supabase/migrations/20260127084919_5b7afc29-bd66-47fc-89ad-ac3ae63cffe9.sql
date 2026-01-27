-- Create wishlists table for buyer wishlist functionality
CREATE TABLE IF NOT EXISTS public.wishlists (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, product_id)
);

-- Enable RLS on wishlists
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;

-- RLS policies for wishlists
CREATE POLICY "Users can view own wishlists" 
    ON public.wishlists 
    FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can add to own wishlist" 
    ON public.wishlists 
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove from own wishlist" 
    ON public.wishlists 
    FOR DELETE 
    USING (auth.uid() = user_id);

-- Create index for better query performance
CREATE INDEX idx_wishlists_user_id ON public.wishlists(user_id);
CREATE INDEX idx_wishlists_product_id ON public.wishlists(product_id);