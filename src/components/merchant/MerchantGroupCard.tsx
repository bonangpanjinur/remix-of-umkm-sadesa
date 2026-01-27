import { useState, useEffect } from 'react';
import { Users, Wallet, Check, X, Calendar, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatPrice } from '@/lib/utils';

interface GroupMembership {
  id: string;
  group: {
    id: string;
    name: string;
    description: string | null;
    monthly_fee: number;
  };
  status: string;
  joined_at: string;
}

interface KasPayment {
  id: string;
  amount: number;
  payment_month: number;
  payment_year: number;
  payment_date: string | null;
  status: string;
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

export function MerchantGroupCard() {
  const { user } = useAuth();
  const [membership, setMembership] = useState<GroupMembership | null>(null);
  const [payments, setPayments] = useState<KasPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Get merchant
        const { data: merchant } = await supabase
          .from('merchants')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!merchant) {
          setLoading(false);
          return;
        }

        // Get group membership
        const { data: memberData } = await supabase
          .from('group_members')
          .select(`
            id,
            status,
            joined_at,
            group:trade_groups(id, name, description, monthly_fee)
          `)
          .eq('merchant_id', merchant.id)
          .eq('status', 'ACTIVE')
          .maybeSingle();

        if (memberData) {
          setMembership(memberData as unknown as GroupMembership);

          // Get payments for this merchant
          const { data: paymentData } = await supabase
            .from('kas_payments')
            .select('*')
            .eq('merchant_id', merchant.id)
            .eq('group_id', memberData.group?.id)
            .order('payment_year', { ascending: false })
            .order('payment_month', { ascending: false })
            .limit(12);

          setPayments(paymentData || []);
        }
      } catch (error) {
        console.error('Error fetching group data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="animate-pulse h-24 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!membership) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6 text-center">
          <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-medium mb-1">Belum Bergabung dengan Kelompok</h3>
          <p className="text-sm text-muted-foreground">
            Hubungi verifikator Anda untuk bergabung dengan kelompok dagang
          </p>
        </CardContent>
      </Card>
    );
  }

  const unpaidPayments = payments.filter(p => p.status === 'UNPAID');
  const paidPayments = payments.filter(p => p.status === 'PAID');
  const totalUnpaid = unpaidPayments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              {membership.group.name}
            </CardTitle>
            <CardDescription>
              {membership.group.description || 'Kelompok Dagang'}
            </CardDescription>
          </div>
          <Badge variant="outline">
            {formatPrice(membership.group.monthly_fee)}/bln
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Alert for unpaid */}
        {unpaidPayments.length > 0 && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">
                {unpaidPayments.length} Tagihan Belum Dibayar
              </p>
              <p className="text-xs text-muted-foreground">
                Total: {formatPrice(totalUnpaid)}
              </p>
            </div>
          </div>
        )}

        {/* Payment History */}
        <div className="pt-2">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Riwayat Pembayaran
          </h4>
          
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Belum ada data pembayaran
            </p>
          ) : (
            <div className="space-y-2">
              {payments.slice(0, 6).map((payment) => (
                <div 
                  key={payment.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-2">
                    {payment.status === 'PAID' ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <X className="h-4 w-4 text-destructive" />
                    )}
                    <span className="text-sm">
                      {MONTHS[payment.payment_month - 1]} {payment.payment_year}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {formatPrice(payment.amount)}
                    </span>
                    <Badge 
                      variant={payment.status === 'PAID' ? 'default' : 'destructive'}
                      className="text-xs"
                    >
                      {payment.status === 'PAID' ? 'Lunas' : 'Belum'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground pt-2">
          Bergabung sejak {new Date(membership.joined_at).toLocaleDateString('id-ID')}
        </p>
      </CardContent>
    </Card>
  );
}
