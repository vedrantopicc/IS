// StudentDashboard.jsx
import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription } from "./ui/alert";
import { Avatar, AvatarFallback } from "./ui/avatar";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel
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
  AlertDialogTitle
} from "./ui/alert-dialog";
import {
  Calendar, Settings, LogOut, Trash2, Ticket, Clock, CalendarDays, Info
} from "lucide-react";
import { logoutApi } from "../services/auth";
import { getUserReservations, deleteReservation } from "../services/reservations";
import { getEvents } from "../services/events";
import { sendRoleRequest } from "../services/roleRequest";
import { toast } from "react-toastify";

// Helper funkcije
function getToken() { return localStorage.getItem("token"); }
function decodeJwt(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(atob(base64).split("").map(function (c) {
      return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(""));
    return JSON.parse(jsonPayload);
  } catch (err) {
    console.error("Failed to decode JWT:", err);
    return null;
  }
}
function getDisplayName(p) {
  if (!p) return "Student";
  if (p.name && p.surname) return `${p.name} ${p.surname}`;
  return p.name || p.username || p.email || "Student";
}
function getInitials(name) {
  return (name.split(" ").filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase() || "").join("")) || "S";
}

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const payload = useMemo(() => getToken() ? decodeJwt(getToken()) : null, []);
  const displayName = useMemo(() => getDisplayName(payload), [payload]);
  const initials = useMemo(() => getInitials(displayName), [displayName]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reservations, setReservations] = useState([]);
  const [availableEvents, setAvailableEvents] = useState([]);
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const activeTab = searchParams.get("tab") || "events";
  const setActiveTab = (tab) => setSearchParams({ tab });

  useEffect(() => {
    loadStudentData();
  }, []);



  const loadStudentData = async () => {
    try {
      setLoading(true);
      setError("");

    const [reservationsData, eventsResp] = await Promise.all([
    getUserReservations(),
    getEvents({ sort: "date_asc", page: 1, limit: 30})
    ]);

// backend sada vraća { data, meta }
  const eventsData = Array.isArray(eventsResp)
    ? eventsResp
    : (eventsResp?.items ?? []);

  const currentDate = new Date();

  const upcomingEvents = eventsData.filter(event => {
    const eventDate = new Date(event.date_and_time);
    return eventDate > currentDate;
    });

  setReservations(reservationsData);
  setAvailableEvents(upcomingEvents);



    } catch (err) {
      console.error("Failed to load student data:", err);
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOrganizer = async () => {
    try {
      setRequesting(true);
      await sendRoleRequest();
      toast.success("Request sent! Admin will review it soon.");
    } catch (err) {
      toast.error(err.message || "Failed to send request");
    } finally {
      setRequesting(false);
    }
  };

  const handleDeleteReservation = async (reservationId) => {
    try {
      await deleteReservation(reservationId);
      toast.success("Reservation cancelled successfully");
      setShowDeleteDialog(false);
      setSelectedReservation(null);
      loadStudentData();
    } catch (err) {
      console.error("Failed to delete reservation:", err);
      toast.error(err.message || "Failed to cancel reservation");
    }
  };

  const handleLogout = async () => {
    try { await logoutApi(); } catch { } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/");
    }
  };

  const formatDateTime = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit"
      });
    } catch {
      return dateString;
    }
  };

  const openDeleteDialog = (reservation) => {
    setSelectedReservation(reservation);
    setShowDeleteDialog(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {error && (
        <Alert className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

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
                  <CalendarDays className="mr-3 h-4 w-4" />
                  <span>View Events</span>
                </DropdownMenuItem>
              </div>

              {payload && payload.is_organizer === 1 && (
                <>
                  <div className="h-px bg-gray-100 mx-2"></div>
                  <div className="p-1">
                    <DropdownMenuItem
                      onClick={() => navigate("/organizer-dashboard")}
                      className="flex items-center px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer rounded-sm"
                    >
                      <Ticket className="mr-3 h-4 w-4" />
                      <span>Organizer Dashboard</span>
                    </DropdownMenuItem>
                  </div>
                </>
              )}

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

      <main className="p-8">
        <div className="max-w-6xl mx-auto">
          {payload && payload.is_organizer === 0 && (
            <div className="mb-4 flex justify-between items-center px-4 py-2 border-b">
              <span className="text-sm text-gray-600 font-medium">
                You can request to become an organizer
              </span>
              <Button
                onClick={handleRequestOrganizer}
                disabled={requesting}
                className={`text-sm px-4 py-2 ${requesting
                  ? "!bg-blue-600 !text-white cursor-not-allowed opacity-70"
                  : "!bg-blue-600 hover:!bg-blue-700 !text-white"
                  }`}
              >
                {requesting ? "Request Sent" : "Request Organizer Role"}
              </Button>
            </div>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="events" className="text-black cursor-pointer hover:bg-gray-100 transition-colors">Upcoming Events</TabsTrigger>
              <TabsTrigger value="reservations" className="text-black cursor-pointer hover:bg-gray-100 transition-colors">My Reservations</TabsTrigger>
            </TabsList>

            <TabsContent value="reservations" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-black">
                    <Ticket className="w-5 h-5 text-blue-600" />
                    My Reservations ({reservations.length})
                  </CardTitle>
                  <CardDescription className="text-black">
                    Manage your event reservations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {reservations.length === 0 ? (
                    <div className="text-center py-8">
                      <Ticket className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-500">No reservations yet</p>
                      <Button
                        onClick={() => setActiveTab("events")}
                        className="mt-4 text-black cursor-pointer hover:bg-gray-50 transition-colors"
                        variant="outline"
                      >
                        Browse Events
                      </Button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-gray-900 font-semibold">Event</TableHead>
                            <TableHead className="text-gray-900 font-semibold">Ticket Type</TableHead>
                            <TableHead className="text-gray-900 font-semibold">Date & Time</TableHead>
                            <TableHead className="text-gray-900 font-semibold">Tickets</TableHead>
                            <TableHead className="text-gray-900 font-semibold">Total Price</TableHead>
                            <TableHead className="text-gray-900 font-semibold">Reserved On</TableHead>
                            <TableHead className="text-gray-900 font-semibold">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reservations.map((reservation) => (
                            <TableRow key={reservation.id}>
                              <TableCell>
                                <div className="font-medium text-gray-900">{reservation.event_title}</div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-xs">
                                  {reservation.ticket_type_name}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1 text-gray-800">
                                  <Clock className="w-4 h-4 text-gray-500" />
                                  {formatDateTime(reservation.event_date_and_time)}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-gray-800 border-gray-300">
                                  {reservation.number_of_tickets} ticket{reservation.number_of_tickets !== 1 ? 's' : ''}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="text-green-600 font-semibold">
                                  {reservation.total_price} KM
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm text-gray-700">
                                  {formatDateTime(reservation.reservation_date)}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => navigate(`/events/${reservation.event_id}?returnTo=dashboard&tab=reservations`)}
                                    className="hover:bg-blue-50 hover:border-blue-300 transition-colors cursor-pointer group"
                                  >
                                    <Info className="w-4 h-4 text-gray-700 group-hover:text-blue-600" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openDeleteDialog(reservation)}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-300 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="events" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-black">
                    <CalendarDays className="w-5 h-5 text-blue-600" />
                    Upcoming Events ({availableEvents.length})
                  </CardTitle>
                  <CardDescription className="text-black">
                    Browse and reserve tickets for upcoming events
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {availableEvents.length === 0 ? (
                    <div className="text-center py-8">
                      <CalendarDays className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-500">No upcoming events available</p>
                    </div>
                  ) : (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {availableEvents.map((event) => {
                        const totalAvailable = event.total_available_seats || 0;
                        const seatsDisplay = totalAvailable > 0
                          ? `${totalAvailable} seat${totalAvailable === 1 ? '' : 's'} available`
                          : "No seats available";

                        return (
                          <Card key={event.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
                            <div className="relative h-48 overflow-hidden">
                              <img
                                src={event.image || "https://images.pexels.com/photos/1190298/pexels-photo-1190298.jpeg?auto=compress&cs=tinysrgb&w=800"}
                                alt={event.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <CardContent className="p-4">
                              <h3 className="font-semibold text-lg mb-2 line-clamp-2 text-gray-900">{event.title}</h3>
                              <div className="space-y-2 text-sm text-gray-600 mb-4">
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4" />
                                  {formatDateTime(event.date_and_time)}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Ticket className="w-4 h-4" />
                                  <span className={totalAvailable === 0 ? "text-red-600" : ""}>
                                    {seatsDisplay}
                                  </span>
                                </div>
                              </div>
                              <Button
                                className="w-full !bg-blue-600 hover:!bg-blue-700 !text-white font-medium py-2 px-4 rounded-md transition-all duration-200 hover:shadow-md hover:scale-105 border-0 cursor-pointer"
                                onClick={() => navigate(`/events/${event.id}?returnTo=dashboard&tab=events`)}
                                disabled={totalAvailable === 0}
                              >
                                {totalAvailable === 0 ? "Sold Out" : "View Details & Reserve"}
                              </Button>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel Reservation</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to cancel your reservation for "{selectedReservation?.event_title}"?
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="!bg-white hover:!bg-gray-200 !text-gray-900 !border-gray-300 cursor-pointer">Keep Reservation</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    const reservationId = selectedReservation?.reservation_id || selectedReservation?.id;
                    if (reservationId) {
                      handleDeleteReservation(reservationId);
                    } else {
                      toast.error('Invalid reservation ID');
                    }
                  }}
                  className="!bg-red-600 hover:!bg-red-700 !text-white cursor-pointer"
                >
                  Cancel Reservation
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </main>
    </div>
  );
}