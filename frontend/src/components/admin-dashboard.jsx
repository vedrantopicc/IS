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
  BarChart3, UserCheck, Clock, Shield, 
  Pointer
} from "lucide-react";
import { logoutApi } from "../services/auth";
import { 
  getAdminDashboard, getAllUsers, getAllAdminEvents, 
  deleteUser, deleteEvent, getUserStats 
} from "../services/admin";
import { toast } from "react-toastify";

function getToken() { 
  return localStorage.getItem("token"); 
}

function decodeJwt(token) { 
  try { 
    const b = token.split(".")[1]; 
    const j = atob(b.replace(/-/g, "+").replace(/_/g, "/")); 
    return JSON.parse(decodeURIComponent(escape(j))); 
  } catch { 
    return null; 
  } 
}

function getDisplayName(p) { 
  if (!p) return "Admin"; 
  if (p.name && p.surname) return `${p.name} ${p.surname}`; 
  return p.name || p.username || p.email || "Admin"; 
}

function getInitials(name) { 
  return (name.split(" ").filter(Boolean).slice(0,2).map(s=>s[0]?.toUpperCase()||"").join("")) || "A"; 
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString(undefined, { 
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const payload = useMemo(() => { 
    const t = getToken(); 
    return t ? decodeJwt(t) : null; 
  }, []);
  const displayName = useMemo(() => getDisplayName(payload), [payload]);
  const initials = useMemo(() => getInitials(displayName), [displayName]);

  const [dashboardData, setDashboardData] = useState(null);
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [error, setError] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserDetails, setShowUserDetails] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam && ['dashboard', 'users', 'events'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [location.search]);

  const loadDashboardData = async () => {
    setLoading(true);
    setError("");
    try {
      const [dashboard, usersData, eventsData] = await Promise.all([
        getAdminDashboard(),
        getAllUsers(),
        getAllAdminEvents()
      ]);
      setDashboardData(dashboard);
      setUsers(usersData);
      setEvents(eventsData);
    } catch (err) {
      setError(err.message);
      toast.error("Failed to load admin data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId, username) => {
    try {
      await deleteUser(userId);
      toast.success(`User ${username} deleted successfully`);
      setUsers(users.filter(user => user.id !== userId));
    } catch (err) {
      toast.error("Failed to delete user: " + err.message);
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
    try { 
      await logoutApi(); 
    } catch {} finally {
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 w-full bg-white/80 backdrop-blur border-b">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
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
            <DropdownMenuContent 
              align="end" 
              className="w-60 text-gray-900 bg-white shadow-xl border border-gray-200 rounded-md z-[9999] mt-2"
              side="bottom"
              sideOffset={8}
            >
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
              </div>
              
              <div className="p-1">
                <DropdownMenuItem 
                  onClick={() => navigate("/events")} 
                  className="flex items-center px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer rounded-sm"
                >
                  <Calendar className="mr-3 h-4 w-4" />
                  <span>View Events</span>
                </DropdownMenuItem>
              </div>
              
              <div className="h-px bg-gray-100 mx-2"></div>
              
              <div className="p-1">
                <DropdownMenuItem 
                  onClick={() => navigate("/settings")} 
                  className="flex items-center px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer rounded-sm"
                >
                  <Settings className="mr-3 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
              </div>
              
              <div className="h-px bg-gray-100 mx-2"></div>
              
              <div className="p-1">
                <DropdownMenuItem 
                  onClick={handleLogout} 
                  className="flex items-center px-3 py-2 text-sm hover:bg-red-50 hover:text-red-700 cursor-pointer rounded-sm"
                >
                  <LogOut className="mr-3 h-4 w-4" />
                  <span>Log out</span>
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger 
              value="dashboard" 
              className="flex items-center gap-2 text-black"
              style={{cursor: 'pointer'}}
            >
              <BarChart3 className="w-4 h-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger 
              value="users" 
              className="flex items-center gap-2 text-black"
              style={{cursor: 'pointer'}}
            >
              <Users className="w-4 h-4" />
              Users ({users.length})
            </TabsTrigger>
            <TabsTrigger 
              value="events" 
              className="flex items-center gap-2 text-black"
              style={{cursor: 'pointer'}}
            >
              <Calendar className="w-4 h-4" />
              Events ({events.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle style={{color: '#000000', fontSize: '14px', fontWeight: 'medium'}}>Total Users</CardTitle>
                  <Users className="h-4 w-4 text-gray-500" />
                </CardHeader>
                <CardContent>
                  <div style={{color: '#000000', fontSize: '24px', fontWeight: 'bold'}}>{dashboardData?.users?.total_users || 0}</div>
                  <p style={{color: '#333333', fontSize: '12px'}}>
                    {dashboardData?.users?.total_students || 0} students, {dashboardData?.users?.total_organizers || 0} organizers
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle style={{color: '#000000', fontSize: '14px', fontWeight: 'medium'}}>Total Events</CardTitle>
                  <Calendar className="h-4 w-4 text-gray-500" />
                </CardHeader>
                <CardContent>
                  <div style={{color: '#000000', fontSize: '24px', fontWeight: 'bold'}}>{dashboardData?.events?.total_events || 0}</div>
                  <p style={{color: '#333333', fontSize: '12px'}}>
                    {dashboardData?.events?.upcoming_events || 0} upcoming
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle style={{color: '#000000', fontSize: '14px', fontWeight: 'medium'}}>Past Events</CardTitle>
                  <Clock className="h-4 w-4 text-gray-500" />
                </CardHeader>
                <CardContent>
                  <div style={{color: '#000000', fontSize: '24px', fontWeight: 'bold'}}>{dashboardData?.events?.past_events || 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle style={{color: '#000000', fontSize: '14px', fontWeight: 'medium'}}>Admins</CardTitle>
                  <Shield className="h-4 w-4 text-gray-500" />
                </CardHeader>
                <CardContent>
                  <div style={{color: '#000000', fontSize: '24px', fontWeight: 'bold'}}>{dashboardData?.users?.total_admins || 0}</div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle style={{color: '#000000', fontSize: '18px', fontWeight: 'bold'}}>User Management</CardTitle>
                <CardDescription style={{color: '#333333', fontSize: '14px'}}>
                  Manage all users in the system. You can view details and delete users.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead style={{color: '#000000', fontWeight: 'bold'}}>User</TableHead>
                      <TableHead style={{color: '#000000', fontWeight: 'bold'}}>Email</TableHead>
                      <TableHead style={{color: '#000000', fontWeight: 'bold'}}>Role</TableHead>
                      <TableHead style={{color: '#000000', fontWeight: 'bold'}}>ID</TableHead>
                      <TableHead style={{color: '#000000', fontWeight: 'bold', textAlign: 'right'}}>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell style={{color: '#000000'}}>
                          <div>
                            <div style={{color: '#000000', fontWeight: 'medium'}}>{user.name} {user.surname}</div>
                            <div style={{color: '#666666', fontSize: '14px'}}>@{user.username}</div>
                          </div>
                        </TableCell>
                        <TableCell style={{color: '#000000'}}>{user.email}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={user.role === 'Admin' ? 'destructive' : user.role === 'Organizer' ? 'default' : 'secondary'}
                            style={{color: '#000000'}}
                          >
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell style={{color: '#000000'}}>ID: {user.id}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleViewUser(user)}
                              style={{
                                color: '#000000',
                                borderColor: '#d1d5db',
                                backgroundColor: '#ffffff',
                                cursor: 'pointer'
                              }}
                            >
                              <Eye className="w-4 h-4" style={{color: '#000000'}} />
                            </Button>
                            {user.role !== 'Admin' && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="text-red-600 hover:text-red-700"
                                    style={{
                                      borderColor: '#d1d5db',
                                      backgroundColor: '#ffffff',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4" style={{color: '#dc2626'}} />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete User</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete user "{user.username}"? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="!bg-gray-100 hover:!bg-gray-200 !text-gray-700 !border-gray-300 cursor-pointer font-medium px-6 py-2">Cancel</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => handleDeleteUser(user.id, user.username)}
                                      className="!bg-red-600 hover:!bg-red-700 !text-white cursor-pointer font-semibold shadow-md border-0 px-6 py-2"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-gray-900">Event Management</CardTitle>
                <CardDescription className="text-gray-600">
                  Manage all events in the system. You can view details and delete events.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-gray-900">Event</TableHead>
                      <TableHead className="text-gray-900">Organizer</TableHead>
                      <TableHead className="text-gray-900">Date</TableHead>
                      <TableHead className="text-gray-900">Price</TableHead>
                      <TableHead className="text-gray-900">Seats</TableHead>
                      <TableHead className="text-right text-gray-900">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="text-gray-900">
                          <div>
                            <div className="font-medium text-gray-900">{event.title}</div>
                            <div className="text-sm text-gray-500 truncate max-w-xs">{event.description}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-900">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{event.organizer_name}</div>
                            <div className="text-xs text-gray-500">@{event.organizer_username}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-900">{formatDate(event.date_and_time)}</TableCell>
                        <TableCell className="text-gray-900">${parseFloat(event.price).toFixed(2)}</TableCell>
                        <TableCell className="text-gray-900">{event.number_of_available_seats}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => {
                                window.history.replaceState({}, document.title, '/admin?tab=events');
                                navigate(`/events/${event.id}`);
                              }}
                              style={{
                                color: '#000000',
                                borderColor: '#d1d5db',
                                backgroundColor: '#ffffff',
                                cursor: 'pointer'
                              }}
                            >
                              <Eye className="w-4 h-4" style={{color: '#000000'}} />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="text-red-600 hover:text-red-700"
                                  style={{
                                    borderColor: '#d1d5db',
                                    backgroundColor: '#ffffff',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <Trash2 className="w-4 h-4" style={{color: '#dc2626'}} />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Event</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete event "{event.title}"? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="flex gap-2 justify-end">
                                  <AlertDialogCancel className="!bg-gray-100 hover:!bg-gray-200 !text-gray-700 !border-gray-300 cursor-pointer font-medium px-6 py-2 shadow-sm">Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => handleDeleteEvent(event.id, event.title)}
                                    className="!bg-red-600 hover:!bg-red-700 !text-white cursor-pointer font-semibold shadow-md !border-0 px-6 py-2 min-w-[100px]"
                                  >
                                    Delete
                                  </AlertDialogAction>
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
        </Tabs>
      </div>

      {selectedUser && (
        <AlertDialog open={showUserDetails} onOpenChange={setShowUserDetails}>
          <AlertDialogContent style={{backgroundColor: '#ffffff', maxWidth: '500px'}}>
            <AlertDialogHeader>
              <AlertDialogTitle style={{color: '#000000', fontSize: '18px', fontWeight: 'bold'}}>
                User Details
              </AlertDialogTitle>
            </AlertDialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <h4 style={{color: '#000000', fontWeight: 'bold', marginBottom: '8px'}}>Personal Information</h4>
                <div className="space-y-2">
                  <p style={{color: '#000000'}}><strong>Name:</strong> {selectedUser.name} {selectedUser.surname}</p>
                  <p style={{color: '#000000'}}><strong>Username:</strong> @{selectedUser.username}</p>
                  <p style={{color: '#000000'}}><strong>Email:</strong> {selectedUser.email}</p>
                  <p style={{color: '#000000'}}><strong>Role:</strong> {selectedUser.role}</p>
                  <p style={{color: '#000000'}}><strong>User ID:</strong> {selectedUser.id}</p>
                </div>
              </div>
              {selectedUser.bio && (
                <div>
                  <h4 style={{color: '#000000', fontWeight: 'bold', marginBottom: '8px'}}>Bio</h4>
                  <p style={{color: '#666666'}}>{selectedUser.bio}</p>
                </div>
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel 
                onClick={() => setShowUserDetails(false)}
                className="!bg-gray-100 hover:!bg-gray-200 !text-gray-700 !border-gray-300 cursor-pointer font-medium px-6 py-2"
              >
                Close
              </AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
