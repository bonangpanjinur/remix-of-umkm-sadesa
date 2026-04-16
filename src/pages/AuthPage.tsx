import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { safeGoBack } from '@/lib/utils';
import { motion } from 'framer-motion';
import { ArrowLeft, Eye, EyeOff, Mail, Lock, User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { getRedirectPathForRoles } from '@/types/auth';
import { lovable } from '@/integrations/lovable/index';
import { z } from 'zod';

const signUpSchema = z.object({
  fullName: z.string().min(2, 'Nama minimal 2 karakter').max(100, 'Nama terlalu panjang'),
  email: z.string().email('Email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Password tidak sama',
  path: ['confirmPassword'],
});

const signInSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
});

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, roles, loading: authLoading, rolesLoading, signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  // Redirect authenticated users to their role-specific dashboard
  useEffect(() => {
    if (authLoading || rolesLoading) return;
    
    if (user && roles.length > 0) {
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname;
      const redirectPath = from || getRedirectPathForRoles(roles);
      navigate(redirectPath, { replace: true });
    }
  }, [user, roles, authLoading, rolesLoading, navigate, location]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setErrors(prev => ({ ...prev, [e.target.name]: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      if (isLogin) {
        const result = signInSchema.safeParse(formData);
        if (!result.success) {
          const fieldErrors: Record<string, string> = {};
          result.error.errors.forEach(err => {
            if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
          });
          setErrors(fieldErrors);
          setLoading(false);
          return;
        }

        const { error } = await signIn(formData.email, formData.password);
        if (error) {
          toast({
            title: 'Gagal masuk',
            description: error.message === 'Invalid login credentials' 
              ? 'Email atau password salah' 
              : error.message,
            variant: 'destructive',
          });
        } else {
          toast({ title: 'Berhasil masuk!' });
          // Redirect will happen automatically via useEffect
        }
      } else {
        const result = signUpSchema.safeParse(formData);
        if (!result.success) {
          const fieldErrors: Record<string, string> = {};
          result.error.errors.forEach(err => {
            if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
          });
          setErrors(fieldErrors);
          setLoading(false);
          return;
        }

        const { data, error } = await signUp(formData.email, formData.password, formData.fullName);
        if (error) {
          toast({
            title: 'Gagal daftar',
            description: error.message,
            variant: 'destructive',
          });
        } else {
          if (data?.session) {
            toast({ title: 'Akun berhasil didaftarkan dan otomatis terverifikasi!' });
          } else {
            navigate('/email-confirmation', { state: { email: formData.email } });
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking auth state
  if (authLoading || rolesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Memuat...</p>
        </div>
      </div>
    );
  }

  // Don't render if user is already logged in (will redirect)
  if (user) {
    return null;
  }

  return (
    <div className="mobile-shell bg-background flex flex-col min-h-screen">
      {/* Header */}
      <div className="p-4 flex items-center gap-3">
        <button 
          onClick={() => safeGoBack(navigate)}
          className="w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="font-bold text-lg text-foreground">
          {isLogin ? 'Masuk' : 'Daftar'}
        </h2>
      </div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-1 px-6 py-4"
      >
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {isLogin ? 'Selamat Datang!' : 'Buat Akun Baru'}
          </h1>
          <p className="text-muted-foreground text-sm">
            {isLogin 
              ? 'Masuk untuk melanjutkan belanja' 
              : 'Daftar untuk mulai berbelanja di DesaMart'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="fullName">Nama Lengkap</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="fullName"
                  name="fullName"
                  placeholder="Masukkan nama lengkap"
                  value={formData.fullName}
                  onChange={handleChange}
                  className="pl-10"
                />
              </div>
              {errors.fullName && (
                <p className="text-xs text-destructive">{errors.fullName}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="contoh@email.com"
                value={formData.email}
                onChange={handleChange}
                className="pl-10"
              />
            </div>
            <p className="text-[10px] text-muted-foreground italic">masukan email yang aktif</p>
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Masukkan password"
                value={formData.password}
                onChange={handleChange}
                className="pl-10 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password}</p>
            )}
          </div>

          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Konfirmasi Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Ulangi password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="pl-10"
                />
              </div>
              {errors.confirmPassword && (
                <p className="text-xs text-destructive">{errors.confirmPassword}</p>
              )}
            </div>
          )}

          {isLogin && (
            <div className="mt-4 text-center">
              <Link to="/forgot-password" className="text-sm text-muted-foreground hover:text-primary">
                Lupa password?
              </Link>
            </div>
          )}
          <Button 
            type="submit" 
            className="w-full shadow-brand" 
            size="lg"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isLogin ? 'Masuk...' : 'Mendaftar...'}
              </>
            ) : (
              isLogin ? 'Masuk' : 'Daftar'
            )}
          </Button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 border-t border-border" />
          <span className="text-xs text-muted-foreground">atau</span>
          <div className="flex-1 border-t border-border" />
        </div>

        {/* Google Sign-In */}
        <Button
          type="button"
          variant="outline"
          className="w-full"
          size="lg"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            try {
              const result = await lovable.auth.signInWithOAuth("google", {
                redirect_uri: window.location.origin,
              });
              if (result.error) {
                toast({
                  title: 'Gagal masuk dengan Google',
                  description: result.error instanceof Error ? result.error.message : 'Terjadi kesalahan',
                  variant: 'destructive',
                });
              }
              if (result.redirected) return;
            } catch {
              toast({ title: 'Gagal masuk dengan Google', variant: 'destructive' });
            } finally {
              setLoading(false);
            }
          }}
        >
          <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Masuk dengan Google
        </Button>

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            {isLogin ? 'Belum punya akun?' : 'Sudah punya akun?'}
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setErrors({});
              }}
              className="ml-1 text-primary font-semibold hover:underline"
            >
              {isLogin ? 'Daftar' : 'Masuk'}
            </button>
          </p>
        </div>

        <div className="mt-4 text-center">
          <p className="text-[10px] text-muted-foreground">
            Dengan masuk, Anda menyetujui{' '}
            <Link to="/terms" className="underline hover:text-primary">Syarat & Ketentuan</Link>
            {' '}dan{' '}
            <Link to="/privacy" className="underline hover:text-primary">Kebijakan Privasi</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
