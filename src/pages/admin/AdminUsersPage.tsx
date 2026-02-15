import { useState, useEffect, useMemo } from 'react';
import { 
  Users, Search, Ban, CheckCircle, Eye, Filter, Download, 
  MoreHorizontal, ChevronLeft, ChevronRight, UserPlus, 
  Mail, Lock, Phone, User, Shield, AlertCircle, XCircle, Settings2
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { logAdminAction } from '@/lib/auditLog';

interface UserProfile {
  id: string;
  userId: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  isBlocked: boolean;
  blockedAt: string | null;
  blockReason: string | null;
  createdAt: string;
  roles: string[];
}

const AVAILABLE_ROLES = [
  { id: 'admin', label: 'Admin' },
  { id: 'verifikator', label: 'Verifikator' },
  { id: 'merchant', label: 'Merchant' },
  { id: 'courier', label: 'Kurir' },
  { id: 'admin_desa', label: 'Admin Desa' },
  { id: 'buyer', label: 'Pembeli' },
];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [roleUser, setRoleUser] = useState<UserProfile | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [blockReason, setBlockReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Add User Form State
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    role: 'buyer'
  });

  const loadUsers = async () => {
    try {
      setLoading(true);
      
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch roles for each user
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Map roles to users
      const roleMap = new Map<string, string[]>();
      roles?.forEach(r => {
        const existing = roleMap.get(r.user_id) || [];
        existing.push(r.role);
        roleMap.set(r.user_id, existing);
      });

      const mappedUsers: UserProfile[] = (profiles || []).map(p => ({
        id: p.id,
        userId: p.user_id,
        fullName: p.full_name || 'Tanpa Nama',
        phone: p.phone,
        avatarUrl: p.avatar_url,
        isBlocked: p.is_blocked || false,
        blockedAt: p.blocked_at,
        blockReason: p.block_reason,
        createdAt: p.created_at,
        roles: roleMap.get(p.user_id) || ['buyer'],
      }));

      setUsers(mappedUsers);
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Gagal memuat data pengguna');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleAddUser = async () => {
    if (!newUser.email || !newUser.password || !newUser.fullName) {
      toast.error('Email, password, dan nama lengkap harus diisi');
      return;
    }

    try {
      setActionLoading(true);
      
      // 1. Create user in Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUser.email,
        password: newUser.password,
        options: {
          data: {
            full_name: newUser.fullName,
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Gagal membuat user auth');

      const userId = authData.user.id;

      // 2. Profile is usually created by trigger, but let's ensure phone is updated
      if (newUser.phone) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ phone: newUser.phone })
          .eq('user_id', userId);
        
        if (profileError) console.error('Error updating profile phone:', profileError);
      }

      // 3. Assign role
      if (newUser.role !== 'buyer') {
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: userId,
            role: newUser.role as any
          });
        
        if (roleError) throw roleError;
      }

      await logAdminAction('CREATE_USER', 'user', userId, null, { 
        email: newUser.email, 
        fullName: newUser.fullName, 
        role: newUser.role 
      });

      toast.success('Pengguna berhasil ditambahkan');
      setAddDialogOpen(false);
      setNewUser({ email: '', password: '', fullName: '', phone: '', role: 'buyer' });
      loadUsers();
    } catch (error: any) {
      console.error('Error adding user:', error);
      toast.error(error.message || 'Gagal menambahkan pengguna');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBlockUser = async () => {
    if (!selectedUser || !blockReason.trim()) {
      toast.error('Alasan blokir harus diisi');
      return;
    }

    try {
      setActionLoading(true);
      
      const { error } = await supabase
        .from('profiles')
        .update({
          is_blocked: true,
          blocked_at: new Date().toISOString(),
          block_reason: blockReason,
        })
        .eq('id', selectedUser.id);

      if (error) throw error;

      await logAdminAction('BLOCK_USER', 'user', selectedUser.userId, 
        { is_blocked: false }, 
        { is_blocked: true, block_reason: blockReason }
      );

      toast.success('Pengguna berhasil diblokir');
      setBlockDialogOpen(false);
      setBlockReason('');
      setSelectedUser(null);
      loadUsers();
    } catch (error) {
      console.error('Error blocking user:', error);
      toast.error('Gagal memblokir pengguna');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnblockUser = async (user: UserProfile) => {
    try {
      setActionLoading(true);
      
      const { error } = await supabase
        .from('profiles')
        .update({
          is_blocked: false,
          blocked_at: null,
          block_reason: null,
        })
        .eq('id', user.id);

      if (error) throw error;

      await logAdminAction('UNBLOCK_USER', 'user', user.userId,
        { is_blocked: true, block_reason: user.blockReason },
        { is_blocked: false }
      );

      toast.success('Pengguna berhasil dibuka blokirnya');
      loadUsers();
    } catch (error) {
      console.error('Error unblocking user:', error);
      toast.error('Gagal membuka blokir pengguna');
    } finally {
      setActionLoading(false);
    }
  };

  const openRoleDialog = (user: UserProfile) => {
    setRoleUser(user);
    setSelectedRoles([...user.roles]);
    setRoleDialogOpen(true);
  };

  const handleSaveRoles = async () => {
    if (!roleUser) return;
    try {
      setActionLoading(true);

      // Remove all existing roles
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', roleUser.userId);

      // Insert selected roles (except 'buyer' which is default)
      const rolesToInsert = selectedRoles.filter(r => r !== 'buyer');
      if (rolesToInsert.length > 0) {
        const { error } = await supabase
          .from('user_roles')
          .insert(rolesToInsert.map(role => ({
            user_id: roleUser.userId,
            role: role as any,
          })));
        if (error) throw error;
      }

      await logAdminAction('UPDATE_ROLES', 'user', roleUser.userId,
        { roles: roleUser.roles },
        { roles: selectedRoles }
      );

      toast.success('Role berhasil diperbarui');
      setRoleDialogOpen(false);
      setRoleUser(null);
      loadUsers();
    } catch (error) {
      console.error('Error updating roles:', error);
      toast.error('Gagal memperbarui role');
    } finally {
      setActionLoading(false);
    }
  };

  const toggleRole = (roleId: string) => {
    setSelectedRoles(prev =>
      prev.includes(roleId) ? prev.filter(r => r !== roleId) : [...prev, roleId]
    );
  };

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = 
        user.fullName.toLowerCase().includes(search.toLowerCase()) ||
        user.phone?.includes(search) ||
        user.userId.includes(search);
      
      const matchesRole = roleFilter === 'all' || user.roles.includes(roleFilter);
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'blocked' && user.isBlocked) ||
        (statusFilter === 'active' && !user.isBlocked);
      
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedUsers = useMemo(() => {
    return filteredUsers.slice(startIndex, startIndex + pageSize);
  }, [filteredUsers, startIndex, pageSize]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, roleFilter, statusFilter]);

  const exportToCSV = () => {
    const headers = ['Nama', 'Telepon', 'Role', 'Status', 'Terdaftar'];
    const rows = filteredUsers.map(u => [
      u.fullName,
      u.phone || '-',
      u.roles.join(', '),
      u.isBlocked ? 'Diblokir' : 'Aktif',
      format(new Date(u.createdAt), 'dd/MM/yyyy', { locale: idLocale }),
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `users_${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
    toast.success('Data pengguna berhasil diekspor');
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'merchant': return 'default';
      case 'courier': return 'outline';
      case 'verifikator': return 'secondary';
      case 'admin_desa': return 'default';
      default: return 'secondary';
    }
  };

  return (
    <AdminLayout title="Manajemen Pengguna" subtitle="Kelola semua akun pengguna dan status akses mereka">
      <div className="space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Pengguna</p>
                <p className="text-2xl font-bold">{users.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-green-500/5 border-green-500/20">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-full">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Aktif</p>
                <p className="text-2xl font-bold text-green-600">{users.filter(u => !u.isBlocked).length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-destructive/5 border-destructive/20">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-destructive/10 rounded-full">
                <Ban className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Diblokir</p>
                <p className="text-2xl font-bold text-destructive">{users.filter(u => u.isBlocked).length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-blue-500/5 border-blue-500/20">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-full">
                <Shield className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Administrator</p>
                <p className="text-2xl font-bold text-blue-600">{users.filter(u => u.roles.includes('admin')).length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle>Daftar Pengguna</CardTitle>
                <CardDescription>Kelola akun, blokir akses, dan ekspor data pengguna</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={exportToCSV} className="gap-2">
                  <Download className="h-4 w-4" /> Ekspor CSV
                </Button>
                <Button size="sm" onClick={() => setAddDialogOpen(true)} className="gap-2">
                  <UserPlus className="h-4 w-4" /> Tambah Pengguna
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari nama, telepon, atau ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    <SelectValue placeholder="Role" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Role</SelectItem>
                  {AVAILABLE_ROLES.map(role => (
                    <SelectItem key={role.id} value={role.id}>{role.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    <SelectValue placeholder="Status" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="active">Aktif</SelectItem>
                  <SelectItem value="blocked">Diblokir</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
                <p className="text-muted-foreground">Memuat data pengguna...</p>
              </div>
            ) : (
              <>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>Pengguna</TableHead>
                        <TableHead>Telepon</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Terdaftar</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedUsers.length > 0 ? (
                        paginatedUsers.map((user) => (
                          <TableRow key={user.id} className="hover:bg-muted/30 transition-colors">
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9 border">
                                  <AvatarImage src={user.avatarUrl || undefined} />
                                  <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
                                    {user.fullName.substring(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col">
                                  <span className="font-medium text-sm leading-none mb-1">{user.fullName}</span>
                                  <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[120px]">
                                    ID: {user.userId.substring(0, 8)}...
                                  </span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{user.phone || '-'}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {user.roles.map((role) => (
                                  <Badge key={role} variant={getRoleBadgeVariant(role) as any} className="text-[10px] px-1.5 py-0 uppercase">
                                    {AVAILABLE_ROLES.find(r => r.id === role)?.label || role}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              {user.isBlocked ? (
                                <Badge variant="destructive" className="gap-1 text-[10px]">
                                  <Ban className="h-3 w-3" /> Diblokir
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="gap-1 text-[10px] text-green-600 border-green-200 bg-green-50">
                                  <CheckCircle className="h-3 w-3" /> Aktif
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {format(new Date(user.createdAt), 'dd MMM yyyy', { locale: idLocale })}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem className="gap-2">
                                    <Eye className="h-4 w-4" /> Lihat Detail
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="gap-2" onClick={() => openRoleDialog(user)}>
                                    <Settings2 className="h-4 w-4" /> Kelola Role
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  {user.isBlocked ? (
                                    <DropdownMenuItem 
                                      className="text-green-600 gap-2"
                                      onClick={() => handleUnblockUser(user)}
                                    >
                                      <CheckCircle className="h-4 w-4" /> Buka Blokir
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem 
                                      className="text-destructive gap-2"
                                      onClick={() => {
                                        setSelectedUser(user);
                                        setBlockDialogOpen(true);
                                      }}
                                    >
                                      <Ban className="h-4 w-4" /> Blokir Pengguna
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="h-40 text-center">
                            <div className="flex flex-col items-center justify-center text-muted-foreground">
                              <Users className="h-10 w-10 mb-2 opacity-20" />
                              <p>Tidak ada pengguna ditemukan</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-xs text-muted-foreground">
                      Menampilkan {startIndex + 1} - {Math.min(startIndex + pageSize, filteredUsers.length)} dari {filteredUsers.length} pengguna
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum = i + 1;
                          if (totalPages > 5 && currentPage > 3) {
                            pageNum = currentPage - 3 + i + 1;
                            if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                          }
                          return (
                            <Button
                              key={pageNum}
                              variant={currentPage === pageNum ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setCurrentPage(pageNum)}
                              className="h-8 w-8 p-0 text-xs"
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Add User Dialog */}
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogContent className="sm:max-w-[450px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                Tambah Pengguna Baru
              </DialogTitle>
              <DialogDescription>
                Buat akun pengguna baru secara manual. Pengguna akan menerima email konfirmasi.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" /> Nama Lengkap <span className="text-destructive">*</span>
                </label>
                <Input
                  placeholder="Contoh: Budi Santoso"
                  value={newUser.fullName}
                  onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" /> Email <span className="text-destructive">*</span>
                </label>
                <Input
                  type="email"
                  placeholder="email@contoh.com"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Lock className="h-4 w-4 text-muted-foreground" /> Password <span className="text-destructive">*</span>
                </label>
                <Input
                  type="password"
                  placeholder="Minimal 6 karakter"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" /> Telepon
                  </label>
                  <Input
                    placeholder="08123456789"
                    value={newUser.phone}
                    onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Role Awal</label>
                  <Select 
                    value={newUser.role} 
                    onValueChange={(value) => setNewUser({ ...newUser, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Role" />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_ROLES.map(role => (
                        <SelectItem key={role.id} value={role.id}>{role.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddDialogOpen(false)} disabled={actionLoading}>
                Batal
              </Button>
              <Button onClick={handleAddUser} disabled={actionLoading}>
                {actionLoading ? (
                  <>
                    <div className="animate-spin mr-2 h-4 w-4 border-2 border-background border-t-transparent rounded-full" />
                    Memproses...
                  </>
                ) : 'Simpan Pengguna'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Block Dialog */}
        <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <XCircle className="h-5 w-5" />
                Blokir Pengguna
              </DialogTitle>
              <DialogDescription>
                Tindakan ini akan mencabut akses pengguna ke aplikasi. Anda dapat membuka blokir nanti.
              </DialogDescription>
            </DialogHeader>
            {selectedUser && (
              <div className="space-y-4 py-2">
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg border">
                  <Avatar className="h-10 w-10 border">
                    <AvatarImage src={selectedUser.avatarUrl || undefined} />
                    <AvatarFallback>{selectedUser.fullName.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-sm">{selectedUser.fullName}</p>
                    <p className="text-xs text-muted-foreground">{selectedUser.phone || 'No phone'}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-muted-foreground" /> Alasan Blokir <span className="text-destructive">*</span>
                  </label>
                  <Textarea
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    placeholder="Contoh: Pelanggaran ketentuan layanan, aktivitas mencurigakan..."
                    rows={3}
                    className="resize-none"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setBlockDialogOpen(false)} disabled={actionLoading}>
                Batal
              </Button>
              <Button variant="destructive" onClick={handleBlockUser} disabled={actionLoading}>
                {actionLoading ? (
                  <>
                    <div className="animate-spin mr-2 h-4 w-4 border-2 border-background border-t-transparent rounded-full" />
                    Memproses...
                  </>
                ) : 'Konfirmasi Blokir'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Role Management Dialog */}
        <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-primary" />
                Kelola Role
              </DialogTitle>
              <DialogDescription>
                Atur role untuk {roleUser?.fullName}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              {AVAILABLE_ROLES.map(role => (
                <label
                  key={role.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-secondary/50 cursor-pointer transition"
                >
                  <Checkbox
                    checked={selectedRoles.includes(role.id)}
                    onCheckedChange={() => toggleRole(role.id)}
                  />
                  <div>
                    <p className="font-medium text-sm">{role.label}</p>
                  </div>
                </label>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRoleDialogOpen(false)} disabled={actionLoading}>
                Batal
              </Button>
              <Button onClick={handleSaveRoles} disabled={actionLoading}>
                {actionLoading ? (
                  <>
                    <div className="animate-spin mr-2 h-4 w-4 border-2 border-background border-t-transparent rounded-full" />
                    Menyimpan...
                  </>
                ) : 'Simpan Role'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
