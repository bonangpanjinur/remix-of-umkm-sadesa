import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Share2, 
  MapPin, 
  Star, 
  Clock, 
  Check,
  MessageCircle,
  Instagram,
  Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchTourismById } from '@/lib/api';
import type { Tourism } from '@/types';

export default function TourismDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tourism, setTourism] = useState<Tourism | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      try {
        const data = await fetchTourismById(id);
        setTourism(data);
      } catch (error) {
        console.error('Error loading tourism:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  if (loading) {
    return (
      <div className="mobile-shell flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  
  if (!tourism) {
    return (
      <div className="mobile-shell flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Wisata tidak ditemukan</p>
          <Button onClick={() => navigate('/')}>Kembali</Button>
        </div>
      </div>
    );
  }

  const handleWhatsAppClick = () => {
    window.open(tourism.waLink, '_blank');
  };

  return (
    <div className="mobile-shell bg-card flex flex-col min-h-screen relative">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-24">
        {/* Hero Image */}
        <div className="relative h-72">
          <img 
            src={tourism.image} 
            alt={tourism.name}
            className="w-full h-full object-cover"
          />
          
          {/* Top Navigation */}
          <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-20">
            <button 
              onClick={() => navigate(-1)}
              className="w-10 h-10 bg-foreground/20 backdrop-blur rounded-full flex items-center justify-center text-primary-foreground hover:bg-foreground/40 transition border border-primary-foreground/20"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <button className="w-10 h-10 bg-foreground/20 backdrop-blur rounded-full flex items-center justify-center text-primary-foreground hover:bg-foreground/40 transition border border-primary-foreground/20">
              <Share2 className="h-5 w-5" />
            </button>
          </div>
          
          {/* Gradient overlay */}
          <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-card to-transparent" />
        </div>
        
        {/* Content */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-6 -mt-6 relative z-10"
        >
          <div className="flex justify-between items-start mb-2">
            <div>
              <h2 className="text-2xl font-bold text-foreground leading-tight">
                {tourism.name}
              </h2>
              <div className="flex items-center gap-1.5 mt-2">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                <span className="text-sm text-muted-foreground">
                  {tourism.villageName}
                </span>
              </div>
            </div>
            
            {tourism.viewCount && (
              <div className="bg-brand-light px-3 py-1.5 rounded-xl flex items-center gap-1.5 border border-primary/20">
                <Eye className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold text-primary">
                  {tourism.viewCount.toLocaleString('id-ID')}
                </span>
              </div>
            )}
          </div>

          {/* Info Cards */}
          <div className="flex gap-3 my-6">
            <div className="flex-1 bg-secondary rounded-2xl p-3 text-center border border-border">
              <Clock className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
              <div className="font-bold text-sm text-foreground">Setiap Hari</div>
              <div className="text-[10px] text-muted-foreground">Waktu Kunjungan</div>
            </div>
            <div className="flex-1 bg-secondary rounded-2xl p-3 text-center border border-border">
              <Star className="h-4 w-4 text-gold mx-auto mb-1" />
              <div className="font-bold text-sm text-foreground">Gratis</div>
              <div className="text-[10px] text-muted-foreground">Tidak Ada Tiket</div>
            </div>
          </div>

          <h3 className="font-bold text-foreground mb-2">Tentang Wisata</h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            {tourism.description}
          </p>

          {tourism.facilities.length > 0 && (
            <>
              <h3 className="font-bold text-foreground mb-3">Fasilitas</h3>
              <div className="grid grid-cols-2 gap-3 mb-10">
                {tourism.facilities.map((facility, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <Check className="h-4 w-4 text-primary" />
                    {facility}
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* Sticky CTA */}
      <div className="absolute bottom-0 w-full bg-card border-t border-border p-4 px-6 shadow-lg flex gap-3 z-20">
        {tourism.sosmedLink && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => window.open(tourism.sosmedLink, '_blank')}
            className="flex-shrink-0"
          >
            <Instagram className="h-5 w-5" />
          </Button>
        )}
        <Button
          onClick={handleWhatsAppClick}
          className="flex-1 bg-primary text-primary-foreground shadow-brand font-bold"
        >
          <MessageCircle className="h-5 w-5 mr-2" />
          Hubungi Pengelola
        </Button>
      </div>
    </div>
  );
}
