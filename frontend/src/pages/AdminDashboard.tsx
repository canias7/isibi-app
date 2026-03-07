import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import { Users, DollarSign, Phone, Bot, CreditCard, TrendingUp, Activity, MessageSquare, LogOut, UserCircle } from "lucide-react";
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
  balance: number;
  total_purchased: number;
  total_used: number;
  agent_count: number;
  call_count: number;
  created_at: string;
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
  const [selectedConversation, setSelectedConversation] = useState<VoiceLog | null>(null);
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users" onClick={loadUsers}>Users</TabsTrigger>
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
              <CardDescription>Manage platform users</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Purchased</TableHead>
                    <TableHead>Used</TableHead>
                    <TableHead>Agents</TableHead>
                    <TableHead>Calls</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell>{formatCurrency(user.balance)}</TableCell>
                      <TableCell>{formatCurrency(user.total_purchased)}</TableCell>
                      <TableCell>{formatCurrency(user.total_used)}</TableCell>
                      <TableCell>{user.agent_count}</TableCell>
                      <TableCell>{user.call_count}</TableCell>
                      <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedUser(user);
                            setCreditDialogOpen(true);
                          }}
                        >
                          Add Credits
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
