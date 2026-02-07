import { useState, useEffect, useMemo } from 'react';
import { TicketCheck, Plus, Copy, MoreHorizontal, Users, Search } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { DataTable } from '@/components/admin/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface CodeRow {
  id: string;
  code: string;
  trade_group: string;
  description: string | null;
  is_active: boolean;
  usage_count: number;
  max_usage: number | null;
  created_at: string;
}

interface TradeGroup {
  id: string;
  name: string;
}

export default function AdminCodesPage() {
  const { user } = useAuth();
  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tradeGroups, setTradeGroups] = useState<TradeGroup[]>([]);
  const [tradeGroupSearch, setTradeGroupSearch] = useState('');
  const [tradeGroupPopoverOpen, setTradeGroupPopoverOpen] = useState(false);
  const [newCode, setNewCode] = useState({
    code: '',
    trade_group: '',
    description: '',
    max_usage: '',
  });

  const fetchCodes = async () => {
    try {
      const { data, error } = await supabase
        .from('verifikator_codes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCodes(data || []);
    } catch (error) {
      console.error('Error fetching codes:', error);
      toast.error('Gagal memuat data kode');
    } finally {
      setLoading(false);
    }
  };

  const fetchTradeGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('trade_groups')
        .select('id, name')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      setTradeGroups(data || []);
    } catch (error) {
      console.error('Error fetching trade groups:', error);
    }
  };

  useEffect(() => {
    fetchCodes();
    fetchTradeGroups();
  }, []);

  const filteredTradeGroups = useMemo(() => {
    if (!tradeGroupSearch) return tradeGroups;
    const q = tradeGroupSearch.toLowerCase();
    return tradeGroups.filter(g => g.name.toLowerCase().includes(q));
  }, [tradeGroups, tradeGroupSearch]);

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewCode(prev => ({ ...prev, code }));
  };

  const createCode = async () => {
    if (!newCode.code || !newCode.trade_group) {
      toast.error('Kode dan kelompok dagang wajib diisi');
      return;
    }

    try {
      const { error } = await supabase
        .from('verifikator_codes')
        .insert({
          code: newCode.code.toUpperCase(),
          trade_group: newCode.trade_group,
          description: newCode.description || null,
          max_usage: newCode.max_usage ? parseInt(newCode.max_usage) : null,
          verifikator_id: user?.id,
        });

      if (error) throw error;
      toast.success('Kode berhasil dibuat');
      setDialogOpen(false);
      setNewCode({ code: '', trade_group: '', description: '', max_usage: '' });
      setTradeGroupSearch('');
      fetchCodes();
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === '23505') {
        toast.error('Kode sudah digunakan');
      } else {
        toast.error('Gagal membuat kode');
      }
    }
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from('verifikator_codes')
        .update({ is_active: !currentActive })
        .eq('id', id);

      if (error) throw error;
      toast.success(currentActive ? 'Kode dinonaktifkan' : 'Kode diaktifkan');
      fetchCodes();
    } catch (error) {
      toast.error('Gagal mengubah status kode');
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Kode disalin');
  };

  const columns = [
    {
      key: 'code',
      header: 'Kode',
      render: (item: CodeRow) => (
        <div className="flex items-center gap-2">
          <code className="bg-secondary px-2 py-1 rounded font-mono text-sm">{item.code}</code>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyCode(item.code)}>
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      ),
    },
    {
      key: 'trade_group',
      header: 'Kelompok Dagang',
      render: (item: CodeRow) => (
        <div>
          <p className="font-medium">{item.trade_group}</p>
          <p className="text-xs text-muted-foreground">{item.description || '-'}</p>
        </div>
      ),
    },
    {
      key: 'usage',
      header: 'Penggunaan',
      render: (item: CodeRow) => (
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span>
            {item.usage_count}
            {item.max_usage ? ` / ${item.max_usage}` : ''}
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: CodeRow) => {
        if (item.max_usage && item.usage_count >= item.max_usage) {
          return <Badge variant="secondary">Habis</Badge>;
        }
        return item.is_active 
          ? <Badge variant="success">Aktif</Badge>
          : <Badge variant="outline">Nonaktif</Badge>;
      },
    },
    {
      key: 'created_at',
      header: 'Dibuat',
      render: (item: CodeRow) => new Date(item.created_at).toLocaleDateString('id-ID'),
    },
    {
      key: 'actions',
      header: '',
      render: (item: CodeRow) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => toggleActive(item.id, item.is_active)}>
              {item.is_active ? 'Nonaktifkan' : 'Aktifkan'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <AdminLayout title="Kode Verifikator" subtitle="Kelola kode referral untuk pendaftaran merchant">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TicketCheck className="h-5 w-5 text-primary" />
          <span className="text-muted-foreground text-sm">{codes.length} kode</span>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Buat Kode Baru
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Buat Kode Verifikator Baru</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Kode</Label>
                <div className="flex gap-2">
                  <Input
                    value={newCode.code}
                    onChange={(e) => setNewCode(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    placeholder="KODE123"
                    className="font-mono"
                  />
                  <Button variant="outline" onClick={generateRandomCode}>
                    Generate
                  </Button>
                </div>
              </div>

              {/* Searchable trade group dropdown */}
              <div className="space-y-2">
                <Label>Kelompok Dagang</Label>
                <Popover open={tradeGroupPopoverOpen} onOpenChange={setTradeGroupPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal"
                    >
                      {newCode.trade_group || 'Pilih atau ketik kelompok dagang...'}
                      <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <div className="p-2">
                      <Input
                        value={tradeGroupSearch}
                        onChange={(e) => setTradeGroupSearch(e.target.value)}
                        placeholder="Cari kelompok dagang..."
                        className="mb-2"
                      />
                      <div className="max-h-48 overflow-y-auto space-y-0.5">
                        {filteredTradeGroups.length > 0 ? (
                          filteredTradeGroups.map((g) => (
                            <button
                              key={g.id}
                              className={cn(
                                "w-full text-left px-3 py-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground transition-colors",
                                newCode.trade_group === g.name && "bg-primary/10 text-primary font-medium"
                              )}
                              onClick={() => {
                                setNewCode(prev => ({ ...prev, trade_group: g.name }));
                                setTradeGroupPopoverOpen(false);
                                setTradeGroupSearch('');
                              }}
                            >
                              {g.name}
                            </button>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground px-3 py-2">
                            Tidak ditemukan. Ketik manual di bawah.
                          </p>
                        )}
                      </div>
                      {/* Manual input fallback */}
                      {tradeGroupSearch && !filteredTradeGroups.some(g => g.name.toLowerCase() === tradeGroupSearch.toLowerCase()) && (
                        <button
                          className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-accent mt-1 border-t border-border text-primary"
                          onClick={() => {
                            setNewCode(prev => ({ ...prev, trade_group: tradeGroupSearch }));
                            setTradeGroupPopoverOpen(false);
                            setTradeGroupSearch('');
                          }}
                        >
                          Gunakan "{tradeGroupSearch}"
                        </button>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Deskripsi (Opsional)</Label>
                <Input
                  value={newCode.description}
                  onChange={(e) => setNewCode(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Deskripsi kode"
                />
              </div>
              <div className="space-y-2">
                <Label>Batas Penggunaan (Opsional)</Label>
                <Input
                  type="number"
                  value={newCode.max_usage}
                  onChange={(e) => setNewCode(prev => ({ ...prev, max_usage: e.target.value }))}
                  placeholder="Tanpa batas"
                />
              </div>
              <Button className="w-full" onClick={createCode}>
                Buat Kode
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        data={codes}
        columns={columns}
        searchKeys={['code']}
        searchPlaceholder="Cari kode..."
        loading={loading}
        emptyMessage="Belum ada kode verifikator"
      />
    </AdminLayout>
  );
}
