import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription } from "./ui/alert";
import { Avatar, AvatarFallback } from "./ui/avatar";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator
} from "./ui/dropdown-menu";
import {
  Tabs, TabsContent, TabsList, TabsTrigger
} from "./ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "./ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger
} from "./ui/alert-dialog";
import {
  Users, Calendar, Settings, LogOut, Trash2, Eye,
  BarChart3, UserCheck, Clock, Shield, Undo, Info, UserX, TrendingUp, PieChart
} from "lucide-react";
import { logoutApi } from "../services/auth";
import {
  getAdminDashboard, getAllUsers, getAllAdminEvents,
  deleteUser, deleteEvent, getUserStats, getDeletedUsers, restoreUser
} from "../services/admin";
import { toast } from "react-toastify";

// === IMPORT ZA GRAFIKON ===
import UserActivityChart from "./user-activity";

// === POMOĆNI SERVISI (Direktno u fajlu) ===

async function getUserRoleStats() {
  const token = localStorage.getItem("token");
  const res = await fetch("http://localhost:3000/admin/stats/roles", {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("Failed to fetch role statistics");
  return res.json();
}

async function getRoleRequests() {
  const token = localStorage.getItem("token");
  const res = await fetch("http://localhost:3000/admin/role-requests", {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("Failed to fetch role requests");
  return res.json();
}

async function approveRoleRequest(requestId) {
  const token = localStorage.getItem("token");
  const res = await fetch(`http://localhost:3000/admin/role-requests/${requestId}/approve`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("Failed to approve request");
  return res.json();
}

async function rejectRoleRequest(requestId) {
  const token = localStorage.getItem("token");
  const res = await fetch(`http://localhost:3000/admin/role-requests/${requestId}/reject`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("Failed to reject request");
  return res.json();
}

// === POMOĆNE FUNKCIJE ===
function getToken() { return localStorage.getItem("token"); }

function decodeJwt(token) {
  try {
    const b = token.split(".")[1];
    const j = atob(b.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decodeURIComponent(escape(j)));
  } catch { return null; }
}

function getDisplayName(p) {
  if (!p) return "Admin";
  if (p.name && p.surname) return `${p.name} ${p.surname}`;
  return p.name || p.username || p.email || "Admin";
}

function getInitials(name) {
  return (name.split(" ").filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase() || "").join("")) || "A";
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

// ✅ FUNKCIJA: vraća role na osnovu is_organizer polja sa fallback logikom
const getUserRole = (user) => {
  if (user.role === 'Admin') return 'Admin';
  if (user.is_organizer === 1 || user.is_organizer === '1' || user.is_organizer === true) {
    return 'Organizer';
  }
  return 'Student';
};

// === GLAVNA KOMPONENTA ===
export default function AdminDashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  const payload = useMemo(() => {
    const t = getToken();
    return t ? decodeJwt(t) : null;
  }, []);

  const displayName = useMemo(() => getDisplayName(payload), [payload]);
  const initials = useMemo(() => getInitials(displayName), [displayName]);

  // State-ovi
  const [dashboardData, setDashboardData] = useState(null);
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [deletedUsers, setDeletedUsers] = useState([]);
  const [roleRequests, setRoleRequests] = useState([]);
  const [roleStats, setRoleStats] = useState({ students: 0, organizers: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [error, setError] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam && ['dashboard', 'users', 'deleted', 'role-requests', 'events', 'statistics'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [location.search]);

  const loadDashboardData = async () => {
    setLoading(true);
    setError("");
    try {
      const [dashboard, usersData, eventsData, deletedUsersData, requestsData, statsData] = await Promise.all([
        getAdminDashboard(),
        getAllUsers(),
        getAllAdminEvents(),
        getDeletedUsers(),
        getRoleRequests(),
        getUserRoleStats()
      ]);

      setDashboardData(dashboard);

      // ✅ Transformiši korisnike - dodaj displayRole na osnovu is_organizer
      const transformedUsers = usersData.map(user => ({
        ...user,
        displayRole: getUserRole(user)
      }));

      setUsers(transformedUsers);
      setEvents(eventsData);
      setDeletedUsers(deletedUsersData || []);
      setRoleRequests(requestsData || []);
      setRoleStats(statsData);
    } catch (err) {
      setError(err.message);
      toast.error("Failed to load admin  " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const totalForPercent = (roleStats.students + roleStats.organizers) || 1;

  // Handlers
  const handleApproveRequest = async (requestId, username) => {
    try {
      setLoadingRequests(true);
      await approveRoleRequest(requestId);
      toast.success(`Request approved for ${username}`);
      loadDashboardData();
    } catch (err) {
      toast.error("Failed to approve request: " + err.message);
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleRejectRequest = async (requestId, username) => {
    try {
      setLoadingRequests(true);
      await rejectRoleRequest(requestId);
      toast.success(`Request rejected for ${username}`);
      const requests = await getRoleRequests();
      setRoleRequests(requests);
    } catch (err) {
      toast.error("Failed to reject request: " + err.message);
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleDeleteUser = async (userId, username) => {
    try {
      await deleteUser(userId);
      toast.success(`User ${username} deleted successfully`);
      loadDashboardData();
    } catch (err) {
      toast.error("Failed to delete user: " + err.message);
    }
  };

  const handleRestoreUser = async (userId, username) => {
    try {
      await restoreUser(userId);
      toast.success(`User ${username} restored successfully`);
      loadDashboardData();
    } catch (err) {
      toast.error("Failed to restore user: " + err.message);
    }
  };

  const handleDeleteEvent = async (eventId, title) => {
    try {
      await deleteEvent(eventId);
      toast.success(`Event "${title}" deleted successfully`);
      setEvents(events.filter(event => event.id !== eventId));
    } catch (err) {
      toast.error("Failed to delete event: " + err.message);
    }
  };

  const handleLogout = async () => {
    try { await logoutApi(); } catch { } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/");
    }
  };

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    const newUrl = `/admin${newTab !== 'dashboard' ? `?tab=${newTab}` : ''}`;
    window.history.replaceState({}, document.title, newUrl);
  };

  const handleViewUser = (user) => {
    setSelectedUser(user);
    setShowUserDetails(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  // ✅ userCount sada koristi displayRole
  const userCount = users.filter(user => user.displayRole !== 'Admin').length;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 w-full bg-white/80 backdrop-blur border-b">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <h2 className="text-sm text-gray-600">
            Welcome, <span className="font-semibold text-gray-900">{displayName}</span>
          </h2>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-10 w-10 rounded-full p-0 relative z-50 cursor-pointer hover:bg-gray-100 transition-colors">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-gray-900 text-white text-sm font-medium">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60 text-gray-900 bg-white shadow-xl border border-gray-200 rounded-md z-[9999] mt-2">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
              </div>
              <div className="p-1">
                <DropdownMenuItem onClick={() => navigate("/events")} className="flex items-center px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer rounded-sm">
                  <Calendar className="mr-3 h-4 w-4" /> <span>View Events</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/settings")} className="flex items-center px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer rounded-sm">
                  <Settings className="mr-3 h-4 w-4" /> <span>Settings</span>
                </DropdownMenuItem>
              </div>
              <div className="h-px bg-gray-100 mx-2"></div>
              <div className="p-1">
                <DropdownMenuItem onClick={handleLogout} className="flex items-center px-3 py-2 text-sm hover:bg-red-50 hover:text-red-700 cursor-pointer rounded-sm text-red-600">
                  <LogOut className="mr-3 h-4 w-4" /> <span>Log out</span>
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {error && (
          <Alert className="mb-4 border-red-200 bg-red-50">
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="flex w-full justify-start gap-8 bg-transparent rounded-none p-0 h-12 overflow-x-auto overflow-y-hidden">
            <TabsTrigger value="dashboard" className="flex items-center gap-2 text-black"><BarChart3 className="w-4 h-4" /> Dashboard</TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2 text-black"><Users className="w-4 h-4" /> Users ({userCount})</TabsTrigger>
            <TabsTrigger value="deleted" className="flex items-center gap-2 text-black"><Trash2 className="w-4 h-4" /> Deleted ({deletedUsers.length})</TabsTrigger>
            <TabsTrigger value="role-requests" className="flex items-center gap-2 text-black"><UserCheck className="w-4 h-4" /> Requests ({roleRequests.length})</TabsTrigger>
            <TabsTrigger value="events" className="flex items-center gap-2 text-black"><Calendar className="w-4 h-4" /> Events ({events.length})</TabsTrigger>
            <TabsTrigger value="statistics" className="flex items-center gap-2 text-black"><TrendingUp className="w-4 h-4" /> Statistics</TabsTrigger>
          </TabsList>

          {/* DASHBOARD TAB */}
          <TabsContent value="dashboard" className="mt-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-black">Total Users</CardTitle>
                  <Users className="h-4 w-4 text-gray-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-black">
                    {roleStats.students + roleStats.organizers}
                  </div>
                  <p className="text-xs text-gray-500">
                    {roleStats.students} students, {roleStats.organizers} organizers
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-black">Total Events</CardTitle>
                  <Calendar className="h-4 w-4 text-gray-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-black">{dashboardData?.events?.total_events || 0}</div>
                  <p className="text-xs text-gray-500">{dashboardData?.events?.upcoming_events || 0} upcoming</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-black">Past Events</CardTitle>
                  <Clock className="h-4 w-4 text-gray-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-black">{dashboardData?.events?.past_events || 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-black">Admins</CardTitle>
                  <Shield className="h-4 w-4 text-gray-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-black">{dashboardData?.users?.total_admins || 0}</div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* USERS TAB */}
          <TabsContent value="users" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-gray-900">User Management</CardTitle>
                <CardDescription>Manage all users in the system.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-black font-bold">User</TableHead>
                      <TableHead className="text-black font-bold">Email</TableHead>
                      <TableHead className="text-black font-bold">Role</TableHead>
                      <TableHead className="text-black font-bold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users
                      .filter(user => {
                        const s = searchTerm.toLowerCase();
                        // ✅ Filter sada koristi displayRole
                        return user.displayRole !== 'Admin' && (user.name.toLowerCase().includes(s) || user.email.toLowerCase().includes(s) || user.username.toLowerCase().includes(s));
                      })
                      .map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="font-medium text-black">{user.name} {user.surname}</div>
                            <div className="text-xs text-gray-500">@{user.username}</div>
                          </TableCell>
                          <TableCell className="text-black">{user.email}</TableCell>
                          <TableCell>
                            {/* ✅ Prikaz role - uklonjen debug info, prilagođen font */}
                            <Badge
                              variant={user.displayRole === 'Organizer' ? 'default' : 'secondary'}
                              className="text-xs font-medium"
                            >
                              {user.displayRole || user.role || 'N/A'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="sm" onClick={() => handleViewUser(user)} className="cursor-pointer"><Info className="w-4 h-4" /></Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="outline" size="sm" className="text-red-600 cursor-pointer"><Trash2 className="w-4 h-4" /></Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader><AlertDialogTitle>Delete User</AlertDialogTitle><AlertDialogDescription>Delete "{user.username}"?</AlertDialogDescription></AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteUser(user.id, user.username)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* DELETED TAB */}
          <TabsContent value="deleted" className="mt-6">
            <Card>
              <CardHeader><CardTitle className="text-gray-900">Deleted Users</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-black">User</TableHead>
                      <TableHead className="text-black">Deleted At</TableHead>
                      <TableHead className="text-right text-black">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deletedUsers.length > 0 ? (
                      deletedUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="text-black">{user.name} {user.surname} (@{user.username})</TableCell>
                          <TableCell className="text-black">{formatDate(user.deleted_at)}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" onClick={() => handleRestoreUser(user.id, user.username)} className="border-green-500 text-green-600 hover:bg-green-50 cursor-pointer"><Undo className="w-4 h-4" /></Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow><TableCell colSpan={3} className="text-center py-4 text-gray-500">No deleted users found.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* REQUESTS TAB */}
          <TabsContent value="role-requests" className="mt-6">
            <Card>
              <CardHeader><CardTitle className="text-gray-900">Role Requests</CardTitle></CardHeader>
              <CardContent>
                {roleRequests.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No pending requests</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-black">User</TableHead>
                        <TableHead className="text-black">Requested At</TableHead>
                        <TableHead className="text-right text-black">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {roleRequests.map((req) => (
                        <TableRow key={req.id}>
                          <TableCell className="text-black">{req.name} {req.surname} (@{req.username})</TableCell>
                          <TableCell className="text-black">{formatDate(req.created_at)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="sm" onClick={() => handleApproveRequest(req.id, req.username)} disabled={loadingRequests} className="border-green-500 text-green-600 hover:bg-green-50 cursor-pointer"><UserCheck className="w-4 h-4" /></Button>
                              <Button variant="outline" size="sm" onClick={() => handleRejectRequest(req.id, req.username)} disabled={loadingRequests} className="border-red-500 text-red-600 hover:bg-red-50 cursor-pointer"><UserX className="w-4 h-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* EVENTS TAB */}
          <TabsContent value="events" className="mt-6">
            <Card>
              <CardHeader><CardTitle className="text-gray-900">Event Management</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-black font-bold w-1/4">Event</TableHead>
                      <TableHead className="text-black font-bold w-1/6">Organizer</TableHead>
                      <TableHead className="text-black font-bold w-1/6">Date</TableHead>
                      <TableHead className="text-black font-bold w-1/6">Revenue</TableHead>
                      <TableHead className="text-black font-bold text-right w-1/6">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="font-medium text-black py-3">{event.title}</TableCell>
                        <TableCell className="text-black py-3">{event.organizer_name}</TableCell>
                        <TableCell className="text-black text-xs py-3">{formatDate(event.date_and_time)}</TableCell>
                        <TableCell className="text-black font-semibold py-3">{parseFloat(event.total_revenue || 0).toFixed(2)} KM</TableCell>
                        <TableCell className="text-right py-3">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => navigate(`/events/${event.id}`)} className="cursor-pointer"><Eye className="w-4 h-4" /></Button>
                            <Button variant="outline" size="sm" onClick={() => handleDeleteEvent(event.id, event.title)} className="text-red-600 cursor-pointer"><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* STATISTICS TAB */}
          <TabsContent value="statistics" className="mt-6">
            <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-black-600" />
                    <CardTitle className="text-black">Registration Trends</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="h-[400px]">
                  <UserActivityChart />
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <PieChart className="w-5 h-5 text-blue-600" />
                      <CardTitle className="text-black">Role Share</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="py-6">
                    <div className="w-full space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Students</span>
                        <span className="font-bold text-black">{roleStats.students}</span>
                      </div>
                      <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-blue-500 h-full transition-all duration-500" style={{ width: `${(roleStats.students / totalForPercent) * 100}%` }}></div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Organizers</span>
                        <span className="font-bold text-black">{roleStats.organizers}</span>
                      </div>
                      <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-green-50 h-full transition-all duration-500 bg-green-500" style={{ width: `${(roleStats.organizers / totalForPercent) * 100}%` }}></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-black">Revenue Insights</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <p className="text-sm text-gray-500">Total Revenue Generated</p>
                      <p className="text-3xl font-bold text-green-600 mt-2">
                        {events.reduce((acc, ev) => acc + parseFloat(ev.total_revenue || 0), 0).toFixed(2)} KM
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* USER DETAILS MODAL */}
      {selectedUser && (
        <AlertDialog open={showUserDetails} onOpenChange={setShowUserDetails}>
          <AlertDialogContent className="bg-white max-w-md">
            <AlertDialogHeader><AlertDialogTitle className="text-black">User Details</AlertDialogTitle></AlertDialogHeader>
            <div className="space-y-3 py-4 text-sm text-black">
              <p><strong>Name:</strong> {selectedUser.name} {selectedUser.surname}</p>
              <p><strong>Username:</strong> @{selectedUser.username}</p>
              <p><strong>Email:</strong> {selectedUser.email}</p>
              {/* ✅ Modal sada prikazuje displayRole */}
              <p><strong>Role:</strong> {selectedUser.displayRole || selectedUser.role}</p>
              {selectedUser.bio && <p><strong>Bio:</strong> {selectedUser.bio}</p>}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowUserDetails(false)} className="cursor-pointer">Close</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}