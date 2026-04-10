-- Enable realtime for orders table so buyers get live status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;