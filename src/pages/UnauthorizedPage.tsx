import { useNavigate } from 'react-router-dom';
import { safeGoBack } from '@/lib/utils';
import { ShieldX, Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/useUserRoles';
import { getRedirectPathForRoles, ROLE_CONFIGS } from '@/types/auth';

export default function UnauthorizedPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { roles } = useUserRoles();

  const handleGoBack = () => {
    safeGoBack(navigate);
  };

  const handleGoHome = () => {
    if (user && roles.length > 0) {
      navigate(getRedirectPathForRoles(roles));
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-destructive/10 flex items-center justify-center">
          <ShieldX className="h-10 w-10 text-destructive" />
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">
          Akses Ditolak
        </h1>
        
        <p className="text-muted-foreground mb-6">
          Anda tidak memiliki izin untuk mengakses halaman ini. 
          Silakan hubungi administrator jika Anda merasa ini adalah kesalahan.
        </p>

        {user && roles.length > 0 && (
          <div className="bg-secondary/50 rounded-lg p-4 mb-6">
            <p className="text-sm text-muted-foreground mb-2">Role Anda saat ini:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {roles.map(role => (
                <span 
                  key={role}
                  className="px-3 py-1 text-sm rounded-full bg-primary/10 text-primary font-medium"
                >
                  {ROLE_CONFIGS[role]?.label || role}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="outline" onClick={handleGoBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali
          </Button>
          <Button onClick={handleGoHome}>
            <Home className="h-4 w-4 mr-2" />
            Ke Beranda
          </Button>
        </div>
      </div>
    </div>
  );
}
