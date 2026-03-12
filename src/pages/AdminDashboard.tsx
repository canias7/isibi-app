import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import { Users, DollarSign, Phone, Bot, CreditCard, TrendingUp, Activity, MessageSquare, LogOut, UserCircle, ShieldCheck, ShieldX, UserX, UserCheck, Clock, Building2, Globe, Zap, BarChart3, Layout, CheckCircle2, CircleDollarSign, ExternalLink } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const API_BASE_URL = 'https://isibi-backend.onrender.com';
const ADMIN_EMAIL = 'cristiananias7@gmail.com';

interface DashboardStats {
  users: { total: number; new_week: number };
  revenue: { total: number; month: number };
  calls: { total: number; week: number; avg_duration: number };
  agents: { total: number; active_users: number };
  credits: { total_purchased: number; total_used: number };
}

interface AdminUser {
  id: number;
  email: string;
  account_type?: string;
  balance: number;
  total_purchased: number;
  total_used: number;
  agent_count: number;
  call_count: number;
  created_at: string;
  is_banned?: boolean;
  is_active?: boolean;
  status?: string;
}

interface DeveloperRequest {
  id: number;
  email: string;
  full_name?: string;
  company_name?: string;
  website?: string;
  use_case?: string;
  call_volume?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

interface WebsiteOrder {
  id: number;
  full_name: string;
  email: string;
  phone?: string;
  business_name?: string;
  business_address?: string;
  business_hours?: string;
  current_website?: string;
  // About
  business_description?: string;
  services_offered?: string;
  competitive_advantage?: string;
  // Goals
  website_goals?: string;
  customer_actions?: string;
  // Services
  services_list?: string;
  pricing_info?: string;
  special_offers?: string;
  // Design
  preferred_colors?: string;
  website_examples?: string;
  has_logo?: string;
  // Content
  has_photos?: string;
  features_needed?: string;
  // Social
  social_facebook?: string;
  social_instagram?: string;
  social_tiktok?: string;
  social_google?: string;
  // Extra
  additional_notes?: string;
  payment_status: 'pending' | 'paid' | 'completed';
  stripe_session_id?: string;
  created_at: string;
  // Uploaded files
  logo_data?: string;
  logo_filename?: string;
  photos_data?: string;
  photos_filenames?: string;
}

interface ActivityItem {
  type: string;
  user_email: string;
  details: string;
  timestamp: string;
}

interface VoiceLog {
  id: number;
  session_id: string;
  client_ip: string;
  total_turns: number;
  created_at: string;
  conversation: { role: string; content: string; timestamp: string }[];
}

interface RevenueDataPoint {
  month: string;
  revenue: number;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [voiceLogs, setVoiceLogs] = useState<VoiceLog[]>([]);
  const [revenueData, setRevenueData] = useState<RevenueDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessRequests, setAccessRequests] = useState<DeveloperRequest[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<VoiceLog | null>(null);
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [banDialogUser, setBanDialogUser] = useState<AdminUser | null>(null);
  const [requestFilter, setRequestFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [websiteOrders, setWebsiteOrders] = useState<WebsiteOrder[]>([]);
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const { toast } = useToast();

  const token = localStorage.getItem('token');
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  const getEmailFromToken = (jwt: string | null): string | null => {
    if (!jwt) return null;

    try {
      const payloadPart = jwt.split('.')[1];
      if (!payloadPart) return null;

      const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
      const payload = JSON.parse(atob(padded));

      return typeof payload?.email === 'string' ? payload.email.toLowerCase().trim() : null;
    } catch {
      return null;
    }
  };

  const adminFetch = async (path: string, init?: RequestInit) => {
    return fetch(`${API_BASE_URL}/api${path}`, init);
  };

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    const currentEmail = getEmailFromToken(token);

    if (!token || currentEmail !== ADMIN_EMAIL) {
      setAuthorized(false);
      return;
    }

    setAuthorized(true);
    loadDashboardData();
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      const [statsRes, activityRes, revenueRes] = await Promise.all([
        adminFetch('/admin/dashboard', { headers: { 'Authorization': `Bearer ${token}` } }),
        adminFetch('/admin/activity?limit=50', { headers: { 'Authorization': `Bearer ${token}` } }),
        adminFetch('/admin/revenue-chart', { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);

      if (statsRes?.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (activityRes?.ok) {
        const activityData = await activityRes.json();
        setActivity(activityData.activity || []);
      }

      if (revenueRes?.ok) {
        const revenueJson = await revenueRes.json();
        const revArr = revenueJson.chart || revenueJson.data || revenueJson;
        setRevenueData(Array.isArray(revArr) ? revArr : []);
      }

      setLoading(false);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      toast({
        title: "Error",
        description: "Failed to load admin dashboard",
        variant: "destructive"
      });
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await adminFetch('/admin/users?limit=100', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res?.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const loadVoiceLogs = async () => {
    try {
      const res = await adminFetch('/admin/voice-chat-logs?limit=50', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res?.ok) {
        const data = await res.json();
        setVoiceLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Failed to load voice logs:', error);
    }
  };

  const loadWebsiteOrders = async () => {
    try {
      const res = await adminFetch('/admin/website-orders?limit=100', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res?.ok) {
        const data = await res.json();
        setWebsiteOrders(data.orders || []);
      }
    } catch (error) {
      console.error('Failed to load website orders:', error);
    }
  };

  const handleMarkOrderStatus = async (orderId: number, action: 'mark-paid' | 'mark-complete') => {
    try {
      const res = await adminFetch(`/admin/website-orders/${orderId}/${action}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res?.ok) {
        toast({ title: action === 'mark-paid' ? 'Marked as paid' : 'Marked as completed' });
        loadWebsiteOrders();
      }
    } catch {
      toast({ title: 'Error', description: 'Could not update order.', variant: 'destructive' });
    }
  };

  const handleAddCredits = async () => {
    if (!selectedUser || !creditAmount) return;

    try {
      const res = await adminFetch(`/admin/users/${selectedUser.id}/credits`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ amount: parseFloat(creditAmount) })
      });

      if (res?.ok) {
        toast({
          title: "Success",
          description: `Added $${creditAmount} to ${selectedUser.email}`,
        });
        setCreditDialogOpen(false);
        setCreditAmount('');
        loadUsers();
      } else {
        throw new Error('Failed to add credits');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add credits",
        variant: "destructive"
      });
    }
  };

  const loadAccessRequests = async () => {
    try {
      const res = await adminFetch('/admin/access-requests', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res?.ok) {
        const data = await res.json();
        setAccessRequests(data.requests ?? (Array.isArray(data) ? data : []));
      }
    } catch (error) {
      console.error('Failed to load access requests:', error);
    }
  };

  const handleApproveRequest = async (id: number) => {
    try {
      const res = await adminFetch(`/admin/access-requests/${id}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res?.ok) {
        toast({ title: 'Access approved', description: 'The developer can now sign in.' });
        loadAccessRequests();
      } else {
        throw new Error('Failed');
      }
    } catch {
      toast({ title: 'Error', description: 'Could not approve request.', variant: 'destructive' });
    }
  };

  const handleRejectRequest = async (id: number) => {
    try {
      const res = await adminFetch(`/admin/access-requests/${id}/reject`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res?.ok) {
        toast({ title: 'Request rejected' });
        loadAccessRequests();
      } else {
        throw new Error('Failed');
      }
    } catch {
      toast({ title: 'Error', description: 'Could not reject request.', variant: 'destructive' });
    }
  };

  const handleBanUser = async () => {
    if (!banDialogUser) return;
    const isBanned = banDialogUser.is_banned;
    try {
      const res = await adminFetch(`/admin/users/${banDialogUser.id}/${isBanned ? 'unban' : 'ban'}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res?.ok) {
        toast({
          title: isBanned ? 'Account reinstated' : 'Account eliminated',
          description: isBanned
            ? `${banDialogUser.email} can now sign in again.`
            : `${banDialogUser.email} has been blocked from signing in.`,
        });
        setBanDialogUser(null);
        loadUsers();
      } else {
        throw new Error('Failed');
      }
    } catch {
      toast({ title: 'Error', description: 'Could not update account status.', variant: 'destructive' });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (authorized === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (authorized === false) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="text-6xl">🔒</div>
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">You are not authorized to view this page.</p>
          <Button onClick={() => navigate('/home')}>Go Home</Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="w-8 h-8" />
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">Platform management and analytics</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <UserCircle className="h-6 w-6" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="text-xs text-muted-foreground" disabled>
              {ADMIN_EMAIL}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { localStorage.removeItem('token'); navigate('/'); }}>
              <LogOut className="mr-2 h-4 w-4" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users" onClick={loadUsers}>Users</TabsTrigger>
          <TabsTrigger value="access-requests" onClick={loadAccessRequests} className="relative">
            Access Requests
            {accessRequests.filter(r => r.status === 'pending').length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                {accessRequests.filter(r => r.status === 'pending').length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="website-orders" onClick={loadWebsiteOrders} className="relative">
            Website Orders
            {websiteOrders.filter(o => o.payment_status === 'pending').length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                {websiteOrders.filter(o => o.payment_status === 'pending').length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="voice-chats" onClick={loadVoiceLogs}>Voice Chats</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-6">
          {stats && (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.users.total}</div>
                    <p className="text-xs text-muted-foreground">+{stats.users.new_week} this week</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(stats.revenue.total)}</div>
                    <p className="text-xs text-muted-foreground">{formatCurrency(stats.revenue.month)} this month</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
                    <Phone className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.calls.total}</div>
                    <p className="text-xs text-muted-foreground">{stats.calls.week} this week</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
                    <Bot className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.agents.total}</div>
                    <p className="text-xs text-muted-foreground">{stats.agents.active_users} active users</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Credits Sold</CardTitle>
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(stats.credits.total_purchased)}</div>
                    <p className="text-xs text-muted-foreground">{formatCurrency(stats.credits.total_used)} used</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg Call Duration</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {Math.floor(stats.calls.avg_duration / 60)}m {stats.calls.avg_duration % 60}s
                    </div>
                    <p className="text-xs text-muted-foreground">Across all calls</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Latest platform events</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {activity.slice(0, 10).map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 rounded-lg border">
                        <div className="text-2xl">
                          {item.type === 'call' && '📞'}
                          {item.type === 'purchase' && '💳'}
                          {item.type === 'signup' && '✨'}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.user_email}</p>
                          <p className="text-xs text-muted-foreground">{item.details}</p>
                        </div>
                        <div className="text-xs text-muted-foreground">{formatDate(item.timestamp)}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* USERS TAB */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>All Users</CardTitle>
              <CardDescription>Manage platform users and account status</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Purchased</TableHead>
                    <TableHead>Agents</TableHead>
                    <TableHead>Calls</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id} className={user.is_banned ? 'opacity-60' : ''}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={user.account_type === 'developer' ? 'default' : 'secondary'} className="text-xs">
                          {user.account_type ?? 'developer'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.is_banned ? (
                          <Badge variant="destructive" className="text-xs gap-1">
                            <UserX className="h-3 w-3" /> Banned
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-green-600 border-green-300 gap-1">
                            <UserCheck className="h-3 w-3" /> Active
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatCurrency(user.balance)}</TableCell>
                      <TableCell>{formatCurrency(user.total_purchased)}</TableCell>
                      <TableCell>{user.agent_count}</TableCell>
                      <TableCell>{user.call_count}</TableCell>
                      <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setSelectedUser(user); setCreditDialogOpen(true); }}
                          >
                            Add Credits
                          </Button>
                          <Button
                            size="sm"
                            variant={user.is_banned ? 'outline' : 'destructive'}
                            onClick={() => setBanDialogUser(user)}
                          >
                            {user.is_banned ? 'Reinstate' : 'Eliminate'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ACCESS REQUESTS TAB */}
        <TabsContent value="access-requests" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Developer Access Requests</CardTitle>
                  <CardDescription>Review and approve developer account applications</CardDescription>
                </div>
                <div className="flex gap-2">
                  {(['pending', 'approved', 'rejected', 'all'] as const).map((f) => (
                    <Button
                      key={f}
                      size="sm"
                      variant={requestFilter === f ? 'default' : 'outline'}
                      onClick={() => setRequestFilter(f)}
                      className="capitalize"
                    >
                      {f}
                      {f !== 'all' && (
                        <span className="ml-1.5 text-xs opacity-70">
                          ({accessRequests.filter(r => r.status === f).length})
                        </span>
                      )}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {accessRequests.filter(r => requestFilter === 'all' || r.status === requestFilter).length === 0 ? (
                <div className="text-center py-16">
                  <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No {requestFilter !== 'all' ? requestFilter : ''} requests found.</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {accessRequests
                    .filter(r => requestFilter === 'all' || r.status === requestFilter)
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .map((req) => (
                      <div key={req.id} className={`rounded-xl border p-5 space-y-3 transition-all ${
                        req.status === 'pending'
                          ? 'border-amber-500/30 bg-amber-500/5'
                          : req.status === 'approved'
                          ? 'border-green-500/30 bg-green-500/5'
                          : 'border-border/50 bg-secondary/20'
                      }`}>
                        {/* Header row */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{req.full_name || '—'}</p>
                            <p className="text-xs text-muted-foreground truncate">{req.email}</p>
                          </div>
                          <Badge
                            variant={req.status === 'pending' ? 'outline' : req.status === 'approved' ? 'default' : 'secondary'}
                            className={`shrink-0 text-xs capitalize ${req.status === 'pending' ? 'border-amber-500/50 text-amber-600' : req.status === 'approved' ? 'bg-green-600' : ''}`}
                          >
                            {req.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                            {req.status === 'approved' && <ShieldCheck className="h-3 w-3 mr-1" />}
                            {req.status === 'rejected' && <ShieldX className="h-3 w-3 mr-1" />}
                            {req.status}
                          </Badge>
                        </div>

                        {/* Details */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {req.company_name && (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Building2 className="h-3 w-3 shrink-0" />
                              <span className="truncate">{req.company_name}</span>
                            </div>
                          )}
                          {req.website && (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Globe className="h-3 w-3 shrink-0" />
                              <a href={req.website} target="_blank" rel="noopener noreferrer" className="truncate hover:text-primary">
                                {req.website.replace(/^https?:\/\//, '')}
                              </a>
                            </div>
                          )}
                          {req.use_case && (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Zap className="h-3 w-3 shrink-0" />
                              <span className="truncate">{req.use_case}</span>
                            </div>
                          )}
                          {req.call_volume && (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <BarChart3 className="h-3 w-3 shrink-0" />
                              <span className="truncate">{req.call_volume}</span>
                            </div>
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground">
                          Applied {formatDate(req.created_at)}
                        </p>

                        {req.status === 'pending' && (
                          <div className="flex gap-2 pt-1">
                            <Button
                              size="sm"
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => handleApproveRequest(req.id)}
                            >
                              <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                              onClick={() => handleRejectRequest(req.id)}
                            >
                              <ShieldX className="h-3.5 w-3.5 mr-1" />
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* WEBSITE ORDERS TAB */}
        <TabsContent value="website-orders" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Layout className="w-5 h-5" /> Website Build Orders
                  </CardTitle>
                  <CardDescription>Form submissions from /website-agent page</CardDescription>
                </div>
                <Badge variant="outline" className="text-sm">
                  {websiteOrders.length} total
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {websiteOrders.length === 0 ? (
                <div className="text-center py-16">
                  <Layout className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No website orders yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {websiteOrders.map((order) => (
                    <div
                      key={order.id}
                      className={`rounded-xl border p-5 space-y-3 transition-all ${
                        order.payment_status === 'completed'
                          ? 'border-green-500/30 bg-green-500/5'
                          : order.payment_status === 'paid'
                          ? 'border-blue-500/30 bg-blue-500/5'
                          : 'border-amber-500/30 bg-amber-500/5'
                      }`}
                    >
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <p className="font-semibold">{order.full_name}</p>
                          <p className="text-sm text-muted-foreground">{order.email}</p>
                          {order.phone && <p className="text-xs text-muted-foreground">{order.phone}</p>}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            className={`text-xs capitalize ${
                              order.payment_status === 'completed' ? 'bg-green-600' :
                              order.payment_status === 'paid' ? 'bg-blue-600' :
                              'border-amber-500/50 text-amber-600'
                            }`}
                            variant={order.payment_status === 'pending' ? 'outline' : 'default'}
                          >
                            {order.payment_status === 'completed' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                            {order.payment_status === 'paid' && <CircleDollarSign className="h-3 w-3 mr-1" />}
                            {order.payment_status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                            {order.payment_status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">#{order.id}</span>
                          <span className="text-xs text-muted-foreground">{formatDate(order.created_at)}</span>
                        </div>
                      </div>

                      {/* Business info */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                        {order.business_name && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Building2 className="h-3 w-3 shrink-0" />
                            <span className="truncate font-medium text-foreground">{order.business_name}</span>
                          </div>
                        )}
                        {order.industry && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Zap className="h-3 w-3 shrink-0" />
                            <span className="truncate">{order.industry}</span>
                          </div>
                        )}
                        {order.current_website && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Globe className="h-3 w-3 shrink-0" />
                            <a href={order.current_website} target="_blank" rel="noopener noreferrer" className="truncate hover:text-primary flex items-center gap-1">
                              {order.current_website.replace(/^https?:\/\//, '')}
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Expandable details */}
                      <button
                        className="text-xs text-primary hover:underline"
                        onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                      >
                        {expandedOrder === order.id ? 'Hide details ▲' : 'View full details ▼'}
                      </button>

                      {expandedOrder === order.id && (
                        <div className="space-y-4 pt-3 border-t text-sm">

                          {/* Contact */}
                          <div>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">📋 Contact Info</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-muted/30 rounded-lg p-3">
                              <div><span className="text-xs text-muted-foreground">Name: </span><span className="font-medium">{order.full_name}</span></div>
                              <div><span className="text-xs text-muted-foreground">Email: </span><span className="font-medium">{order.email}</span></div>
                              {order.phone && <div><span className="text-xs text-muted-foreground">Phone: </span><span className="font-medium">{order.phone}</span></div>}
                              {order.business_address && <div><span className="text-xs text-muted-foreground">Address: </span><span className="font-medium">{order.business_address}</span></div>}
                              {order.business_hours && <div><span className="text-xs text-muted-foreground">Hours: </span><span className="font-medium">{order.business_hours}</span></div>}
                              {order.current_website && (
                                <div><span className="text-xs text-muted-foreground">Current site: </span>
                                  <a href={order.current_website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{order.current_website}</a>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* About */}
                          {(order.business_description || order.services_offered || order.competitive_advantage) && (
                            <div>
                              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">🏢 About the Business</p>
                              <div className="space-y-2 bg-muted/30 rounded-lg p-3">
                                {order.business_description && (
                                  <div><p className="text-xs text-muted-foreground mb-0.5">Description:</p><p className="whitespace-pre-wrap">{order.business_description}</p></div>
                                )}
                                {order.services_offered && (
                                  <div><p className="text-xs text-muted-foreground mb-0.5">Services / Products:</p><p className="whitespace-pre-wrap">{order.services_offered}</p></div>
                                )}
                                {order.competitive_advantage && (
                                  <div><p className="text-xs text-muted-foreground mb-0.5">What makes them different:</p><p className="whitespace-pre-wrap">{order.competitive_advantage}</p></div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Goals */}
                          {(order.website_goals || order.customer_actions) && (
                            <div>
                              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">🎯 Website Goals</p>
                              <div className="space-y-2 bg-muted/30 rounded-lg p-3">
                                {order.website_goals && (
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Main goals:</p>
                                    <div className="flex flex-wrap gap-1">
                                      {order.website_goals.split(',').map((g) => <Badge key={g} variant="secondary" className="text-xs">{g.trim()}</Badge>)}
                                    </div>
                                  </div>
                                )}
                                {order.customer_actions && (
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Customer actions:</p>
                                    <div className="flex flex-wrap gap-1">
                                      {order.customer_actions.split(',').map((a) => <Badge key={a} variant="secondary" className="text-xs">{a.trim()}</Badge>)}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Services list */}
                          {(order.services_list || order.pricing_info || order.special_offers) && (
                            <div>
                              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">🛒 Services & Pricing</p>
                              <div className="space-y-2 bg-muted/30 rounded-lg p-3">
                                {order.services_list && <div><p className="text-xs text-muted-foreground mb-0.5">Services list:</p><p className="whitespace-pre-wrap">{order.services_list}</p></div>}
                                {order.pricing_info && <div><p className="text-xs text-muted-foreground mb-0.5">Pricing:</p><p>{order.pricing_info}</p></div>}
                                {order.special_offers && <div><p className="text-xs text-muted-foreground mb-0.5">Special offers:</p><p>{order.special_offers}</p></div>}
                              </div>
                            </div>
                          )}

                          {/* Design */}
                          {(order.preferred_colors || order.website_examples || order.has_logo) && (
                            <div>
                              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">🎨 Design Preferences</p>
                              <div className="space-y-2 bg-muted/30 rounded-lg p-3">
                                {order.has_logo && <div><span className="text-xs text-muted-foreground">Has logo: </span><Badge variant={order.has_logo === 'yes' ? 'default' : 'secondary'} className="text-xs capitalize">{order.has_logo}</Badge></div>}
                                {order.preferred_colors && <div><p className="text-xs text-muted-foreground mb-0.5">Colors:</p><p>{order.preferred_colors}</p></div>}
                                {order.website_examples && <div><p className="text-xs text-muted-foreground mb-0.5">Inspiration sites:</p><p className="whitespace-pre-wrap">{order.website_examples}</p></div>}
                              </div>
                            </div>
                          )}

                          {/* Content */}
                          {(order.has_photos || order.features_needed) && (
                            <div>
                              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">📁 Content & Features</p>
                              <div className="space-y-2 bg-muted/30 rounded-lg p-3">
                                {order.has_photos && <div><span className="text-xs text-muted-foreground">Has photos: </span><Badge variant={order.has_photos === 'yes' ? 'default' : 'secondary'} className="text-xs capitalize">{order.has_photos}</Badge></div>}
                                {order.features_needed && (
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Features needed:</p>
                                    <div className="flex flex-wrap gap-1">
                                      {order.features_needed.split(',').map((f) => <Badge key={f} variant="secondary" className="text-xs">{f.trim()}</Badge>)}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Uploaded Files */}
                          {(order.logo_data || order.photos_data) && (
                            <div>
                              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">📎 Uploaded Files</p>
                              <div className="space-y-3 bg-muted/30 rounded-lg p-3">
                                {order.logo_data && (
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1.5">Logo — <span className="font-medium text-foreground">{order.logo_filename || 'uploaded'}</span></p>
                                    <div className="flex items-start gap-3">
                                      <img
                                        src={order.logo_data}
                                        alt="Customer logo"
                                        className="max-h-24 max-w-[200px] rounded border border-border/50 bg-white object-contain p-1"
                                      />
                                      <a
                                        href={order.logo_data}
                                        download={order.logo_filename || 'logo'}
                                        className="text-xs text-primary hover:underline mt-1"
                                      >
                                        ⬇ Download logo
                                      </a>
                                    </div>
                                  </div>
                                )}
                                {order.photos_data && (() => {
                                  try {
                                    const photos: string[] = JSON.parse(order.photos_data);
                                    const names: string[] = order.photos_filenames ? JSON.parse(order.photos_filenames) : [];
                                    return (
                                      <div>
                                        <p className="text-xs text-muted-foreground mb-1.5">Business Photos ({photos.length})</p>
                                        <div className="flex flex-wrap gap-2">
                                          {photos.map((src, i) => (
                                            <div key={i} className="relative group">
                                              <img
                                                src={src}
                                                alt={`Photo ${i + 1}`}
                                                className="h-24 w-24 object-cover rounded border border-border/50"
                                              />
                                              <a
                                                href={src}
                                                download={names[i] || `photo-${i + 1}`}
                                                className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded text-white text-xs"
                                              >
                                                ⬇ Download
                                              </a>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  } catch { return null; }
                                })()}
                              </div>
                            </div>
                          )}

                          {/* Social Media */}
                          {(order.social_facebook || order.social_instagram || order.social_tiktok || order.social_google) && (
                            <div>
                              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">📱 Social Media</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-muted/30 rounded-lg p-3">
                                {order.social_facebook && <div><span className="text-xs text-muted-foreground">Facebook: </span><a href={order.social_facebook} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs">{order.social_facebook}</a></div>}
                                {order.social_instagram && <div><span className="text-xs text-muted-foreground">Instagram: </span><a href={order.social_instagram} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs">{order.social_instagram}</a></div>}
                                {order.social_tiktok && <div><span className="text-xs text-muted-foreground">TikTok: </span><a href={order.social_tiktok} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs">{order.social_tiktok}</a></div>}
                                {order.social_google && <div><span className="text-xs text-muted-foreground">Google: </span><a href={order.social_google} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs">{order.social_google}</a></div>}
                              </div>
                            </div>
                          )}

                          {/* Notes */}
                          {order.additional_notes && (
                            <div>
                              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">📝 Additional Notes</p>
                              <div className="bg-muted/30 rounded-lg p-3">
                                <p className="whitespace-pre-wrap">{order.additional_notes}</p>
                              </div>
                            </div>
                          )}

                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 pt-1">
                        {order.payment_status === 'pending' && (
                          <Button
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={() => handleMarkOrderStatus(order.id, 'mark-paid')}
                          >
                            <CircleDollarSign className="h-3.5 w-3.5 mr-1" />
                            Mark Paid
                          </Button>
                        )}
                        {(order.payment_status === 'paid') && (
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => handleMarkOrderStatus(order.id, 'mark-complete')}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            Mark Completed
                          </Button>
                        )}
                        {order.payment_status === 'completed' && (
                          <span className="text-sm text-green-600 flex items-center gap-1">
                            <CheckCircle2 className="h-4 w-4" /> Website delivered
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* REVENUE TAB */}
        <TabsContent value="revenue">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Analytics</CardTitle>
              <CardDescription>Revenue trends and insights</CardDescription>
            </CardHeader>
            <CardContent>
              {revenueData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis tickFormatter={(v) => `$${v}`} className="text-xs" />
                    <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']} />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12">
                  <TrendingUp className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No revenue data available yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* VOICE CHATS TAB */}
        <TabsContent value="voice-chats">
          <Card>
            <CardHeader>
              <CardTitle>Talk to ISIBI Conversations</CardTitle>
              <CardDescription>Voice chat logs from homepage</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {voiceLogs.map((log) => (
                  <Card
                    key={log.id}
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => setSelectedConversation(log)}
                  >
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        Session {log.session_id ? log.session_id.substring(0, 8) : log.id}...
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Messages:</span>
                          <Badge>{log.total_turns}</Badge>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">IP:</span>
                          <span className="font-mono text-xs">{log.client_ip}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{formatDate(log.created_at)}</div>
                        <Button size="sm" className="w-full mt-2">View Transcript</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ACTIVITY TAB */}
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Platform Activity</CardTitle>
              <CardDescription>All recent events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {activity.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-4 p-4 rounded-lg border hover:bg-accent transition-colors"
                  >
                    <Badge variant={
                      item.type === 'call' ? 'default' :
                      item.type === 'purchase' ? 'secondary' :
                      'outline'
                    }>
                      {item.type === 'call' && '📞 Call'}
                      {item.type === 'purchase' && '💳 Purchase'}
                      {item.type === 'signup' && '✨ Signup'}
                    </Badge>
                    <div className="flex-1">
                      <p className="font-medium">{item.user_email}</p>
                      <p className="text-sm text-muted-foreground">{item.details}</p>
                    </div>
                    <div className="text-sm text-muted-foreground">{formatDate(item.timestamp)}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Conversation Modal */}
      <Dialog open={!!selectedConversation} onOpenChange={() => setSelectedConversation(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Conversation Transcript</DialogTitle>
            <DialogDescription>
              {selectedConversation && (
                <div className="space-y-2 text-sm">
                  <p><strong>Session:</strong> {selectedConversation.session_id}</p>
                  <p><strong>IP:</strong> {selectedConversation.client_ip}</p>
                  <p><strong>Date:</strong> {formatDate(selectedConversation.created_at)}</p>
                  <p><strong>Messages:</strong> {selectedConversation.total_turns}</p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedConversation && (
            <div className="space-y-3 mt-4">
              {(selectedConversation.conversation || []).map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-primary/10 ml-8'
                      : 'bg-secondary mr-8'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-semibold text-sm">
                      {msg.role === 'user' ? '👤 Customer' : '🤖 ISIBI'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm">{msg.content}</p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Ban / Reinstate Dialog */}
      <Dialog open={!!banDialogUser} onOpenChange={(open) => !open && setBanDialogUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {banDialogUser?.is_banned ? (
                <><UserCheck className="h-5 w-5 text-green-600" /> Reinstate Account</>
              ) : (
                <><UserX className="h-5 w-5 text-destructive" /> Eliminate Account</>
              )}
            </DialogTitle>
            <DialogDescription>
              {banDialogUser?.is_banned ? (
                <>
                  This will <strong>reinstate</strong> <span className="font-mono text-foreground">{banDialogUser?.email}</span>.
                  They will be able to sign in and use the platform again.
                </>
              ) : (
                <>
                  This will <strong>permanently block</strong> <span className="font-mono text-foreground">{banDialogUser?.email}</span>.
                  They will not be able to sign in or create a new account with this email.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setBanDialogUser(null)}>
              Cancel
            </Button>
            <Button
              variant={banDialogUser?.is_banned ? 'default' : 'destructive'}
              onClick={handleBanUser}
            >
              {banDialogUser?.is_banned ? 'Yes, reinstate' : 'Yes, eliminate account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Credits Dialog */}
      <Dialog open={creditDialogOpen} onOpenChange={setCreditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Credits to User</DialogTitle>
            <DialogDescription>
              {selectedUser && `Adding credits to ${selectedUser.email}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="amount">Amount ($)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="25.00"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleAddCredits} className="flex-1">Add Credits</Button>
              <Button
                variant="outline"
                onClick={() => {
                  setCreditDialogOpen(false);
                  setCreditAmount('');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
