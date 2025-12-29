// src/pages/OrganizerDashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel
} from "../components/ui/dropdown-menu";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Table, TableHead, TableRow, TableCell, TableHeader, TableBody } from "../components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Settings, LogOut, Plus, Edit, Trash2, Users, Calendar, Clock, MapPin, Eye, Shield, Minus, BarChart3 } from "lucide-react";
import { logoutApi } from "../services/auth";
import { getOrganizerEvents, createEvent, updateEvent, deleteEvent, getEventReservations, getEventSalesProgress } from "../services/organizer";
import { toast } from "react-toastify";

// Helper funkcije
function getToken() { return localStorage.getItem("token"); }
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
  if (!p) return "User";
  if (p.name && p.surname) return `${p.name} ${p.surname}`;
  return p.name || p.username || p.email || "User";
}
function getInitials(name) {
  return (name.split(" ").filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase() || "").join("")) || "U";
}

function getCurrentUserRole() {
  const token = getToken();
  if (!token) return null;
  const userStr = localStorage.getItem("user");
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      return user.role;
    } catch { }
  }
  return null;
}

const formatDateTime = (dateTimeString) => {
  if (!dateTimeString) return { date: "", time: "" };
  const dt = new Date(dateTimeString);
  const date = dt.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const time = dt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return { date, time };
};

const isEventInPast = (dateTimeString) => {
  const eventDate = new Date(dateTimeString);
  const currentDate = new Date();
  return eventDate < currentDate;
};

const formatDateTimeForMySQL = (dateTime) => {
  const date = new Date(dateTime);
  return date.getFullYear() + '-' +
    String(date.getMonth() + 1).padStart(2, '0') + '-' +
    String(date.getDate()).padStart(2, '0') + ' ' +
    String(date.getHours()).padStart(2, '0') + ':' +
    String(date.getMinutes()).padStart(2, '0') + ':' +
    String(date.getSeconds()).padStart(2, '0');
};

export default function OrganizerDashboard() {
  const navigate = useNavigate();
  const payload = useMemo(() => getToken() ? decodeJwt(getToken()) : null, []);
  const displayName = useMemo(() => getDisplayName(payload), [payload]);
  const initials = useMemo(() => getInitials(displayName), [displayName]);
  const userRole = useMemo(() => getCurrentUserRole(), []);
  const isAdmin = userRole === "Admin";

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showReservationsDialog, setShowReservationsDialog] = useState(false);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [salesProgress, setSalesProgress] = useState(null);

  const [ticketTypes, setTicketTypes] = useState([{ name: "", price: "", total_seats: "" }]);

  const getInitialFormData = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(12, 0, 0, 0);
    return {
      title: "",
      description: "",
      location: "",
      date_and_time: tomorrow.toISOString().slice(0, 16),
      image: ""
    };
  };
  const [formData, setFormData] = useState(getInitialFormData());

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const data = await getOrganizerEvents();
      setEvents(data);
    } catch (err) {
      console.error("Failed to load events:", err);
      toast.error("Failed to load events");
    } finally {
      setLoading(false);
    }
  };

  const addTicketType = () => {
    setTicketTypes([...ticketTypes, { name: "", price: "", total_seats: "" }]);
  };

  const removeTicketType = (index) => {
    if (ticketTypes.length > 1) {
      const newTypes = ticketTypes.filter((_, i) => i !== index);
      setTicketTypes(newTypes);
    }
  };

  const updateTicketType = (index, field, value) => {
    const newTypes = [...ticketTypes];
    newTypes[index][field] = value;
    setTicketTypes(newTypes);
  };

  const validateTicketTypes = () => {
    for (let tt of ticketTypes) {
      if (!tt.name.trim() || tt.price === "" || tt.total_seats === "" ||
        isNaN(parseFloat(tt.price)) || isNaN(parseInt(tt.total_seats)) ||
        parseFloat(tt.price) < 0 || parseInt(tt.total_seats) <= 0) {
        return false;
      }
    }
    return true;
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();

    if (!formData.date_and_time || new Date(formData.date_and_time) <= new Date()) {
      toast.error("Event date must be in the future");
      return;
    }

    if (!validateTicketTypes()) {
      toast.error("Please fill all ticket type fields correctly (name, price ≥ 0, seats > 0)");
      return;
    }

    try {
      const eventData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        location: formData.location.trim(),
        date_and_time: formatDateTimeForMySQL(formData.date_and_time),
        image: formData.image.trim() || null,
        ticketTypes: ticketTypes.map(tt => ({
          name: tt.name.trim(),
          price: parseFloat(tt.price),
          total_seats: parseInt(tt.total_seats)
        }))
      };

      await createEvent(eventData);
      toast.success("Event created successfully");
      setShowCreateDialog(false);
      resetForm();
      loadEvents();
    } catch (err) {
      console.error("Failed to create event:", err);
      toast.error(err.message || "Failed to create event");
    }
  };

  const handleUpdateEvent = async (e) => {
    e.preventDefault();

    if (!formData.date_and_time || new Date(formData.date_and_time) <= new Date()) {
      toast.error("Event date must be in the future");
      return;
    }

    try {
      const eventData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        location: formData.location.trim(),
        date_and_time: formatDateTimeForMySQL(formData.date_and_time),
        image: formData.image.trim() || null
      };

      await updateEvent(selectedEvent.id, eventData);
      toast.success("Event updated successfully");
      setShowEditDialog(false);
      resetForm();
      loadEvents();
    } catch (err) {
      console.error("Failed to update event:", err);
      toast.error(err.message || "Failed to update event");
    }
  };

  const handleDeleteEvent = async () => {
    try {
      await deleteEvent(selectedEvent.id);
      toast.success("Event deleted successfully");
      setShowDeleteDialog(false);
      setSelectedEvent(null);
      loadEvents();
    } catch (err) {
      console.error("Failed to delete event:", err);
      toast.error(err.message || "Failed to delete event");
    }
  };

  const handleViewReservations = async (event) => {
    try {
      setSelectedEvent(event);
      const data = await getEventReservations(event.id);
      setReservations(data);
      setShowReservationsDialog(true);
    } catch (err) {
      console.error("Failed to load reservations:", err);
      toast.error(`Failed to load reservations: ${err.message}`);
    }
  };

  const handleViewSalesProgress = async (event) => {
    try {
      setSelectedEvent(event);
      const data = await getEventSalesProgress(event.id);
      setSalesProgress(data);
      setShowProgressDialog(true);
    } catch (err) {
      console.error("Failed to load sales progress:", err);
      toast.error(`Failed to load sales progress: ${err.message}`);
    }
  };

  const handleEdit = (event) => {
    setSelectedEvent(event);
    setFormData({
      title: event.title,
      description: event.description || "",
      location: event.location || "",
      date_and_time: new Date(event.date_and_time).toISOString().slice(0, 16),
      image: event.image || ""
    });
    setShowEditDialog(true);
  };

  const resetForm = () => {
    setFormData(getInitialFormData());
    setTicketTypes([{ name: "", price: "", total_seats: "" }]);
  };

  const handleLogout = async () => {
    try { await logoutApi(); } catch { } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 w-full bg-white/80 backdrop-blur border-b">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Organizer Dashboard</h1>
            <p className="text-sm text-gray-600">
              Welcome, <span className="font-semibold">{displayName}</span>
            </p>
          </div>

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

              {isAdmin && (
                <>
                  <div className="p-1">
                    <DropdownMenuItem
                      onClick={() => navigate("/admin")}
                      className="flex items-center px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer rounded-sm"
                    >
                      <Shield className="mr-3 h-4 w-4" />
                      <span>Admin Panel</span>
                    </DropdownMenuItem>
                  </div>
                  <div className="h-px bg-gray-100 mx-2"></div>
                </>
              )}

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
                  onClick={() => navigate("/student-dashboard")}
                  className="flex items-center px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer rounded-sm"
                >
                  <Users className="mr-3 h-4 w-4" />
                  <span>Student Dashboard</span>
                </DropdownMenuItem>
              </div>

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
                  <span>Logout</span>
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">My Events</h2>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="!bg-blue-600 hover:!bg-blue-700 !text-white cursor-pointer font-semibold shadow-md border-0 px-6 py-2"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Event
          </Button>
        </div>

        {loading ? (
          <p className="text-center text-gray-500">Loading events...</p>
        ) : events.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No events yet</h3>
              <p className="text-gray-500 mb-4">Create your first event to get started.</p>
              <Button onClick={() => setShowCreateDialog(true)} className="!bg-blue-600 hover:!bg-blue-700 !text-white cursor-pointer font-semibold shadow-md border-0 px-6 py-2">
                <Plus className="mr-2 h-4 w-4" />
                Create Event
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => {
              const { date, time } = formatDateTime(event.date_and_time);
              const isPast = isEventInPast(event.date_and_time);

              return (
                <Card key={event.id} className={`${isPast ? 'opacity-75' : ''}`}>
                  <div className="relative">
                    <div className="w-full h-48 bg-gray-200 rounded-t-lg overflow-hidden">
                      {event.image ? (
                        <img
                          src={event.image}
                          alt={event.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                          <Calendar className="h-12 w-12" />
                        </div>
                      )}
                    </div>
                    {isPast && (
                      <Badge className="absolute top-2 right-2 bg-gray-600">
                        Past Event
                      </Badge>
                    )}
                  </div>
                  <CardHeader>
                    <CardTitle className="text-lg font-bold text-gray-900 line-clamp-2">
                      {event.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center text-sm text-gray-600">
                      <MapPin className="mr-2 h-4 w-4" />
                      {event.location || "Location not specified"}
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="mr-2 h-4 w-4" />
                      {date}
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Clock className="mr-2 h-4 w-4" />
                      {time}
                    </div>
                    {/* 🚫 CENA I BROJ TIPOVA UKLONJENI */}
                  </CardContent>
                  <div className="p-6 pt-0">
                    <div className="flex flex-col gap-2">
                      {/* ✅ BEZ IKONE "EYE" */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewReservations(event)}
                        className="w-full flex items-center justify-center text-gray-700 hover:text-gray-900 border-gray-300 hover:bg-gray-100 cursor-pointer"
                      >
                        View Reservations
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewSalesProgress(event)}
                        className="w-full flex items-center justify-center gap-2 text-green-600 hover:text-green-700 border-green-300 hover:bg-green-50 cursor-pointer"
                      >
                        <BarChart3 className="h-4 w-4" />
                        Sales Progress
                      </Button>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(event)}
                          className="flex-1 flex items-center justify-center gap-2 text-blue-600 hover:text-blue-700 border-blue-300 hover:bg-blue-50 cursor-pointer"
                        >
                          <Edit className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedEvent(event);
                            setShowDeleteDialog(true);
                          }}
                          className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 flex items-center justify-center gap-2 border-red-300 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* CREATE DIALOG SA LOKACIJOM */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="bg-white text-black max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Event</DialogTitle>
              <DialogDescription>Fill in event details and ticket types.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateEvent} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              <div>
                <label className="block text-sm font-medium mb-1">Event Title *</label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter event title"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Location</label>
                <Input
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Enter event location (e.g. City Hall, Banja Luka)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter event description"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Date & Time *</label>
                  <Input
                    type="datetime-local"
                    value={formData.date_and_time}
                    onChange={(e) => setFormData({ ...formData, date_and_time: e.target.value })}
                    min={new Date().toISOString().slice(0, 16)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Image URL</label>
                  <Input
                    type="url"
                    value={formData.image}
                    onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium">Ticket Types *</label>
                  <Button type="button" size="sm" variant="outline" onClick={addTicketType} className="!h-7 !px-2">
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                </div>
                <div className="space-y-3 p-3 bg-gray-50 rounded">
                  {ticketTypes.map((tt, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-4">
                        <Input
                          placeholder="Name (e.g. VIP)"
                          value={tt.name}
                          onChange={(e) => updateTicketType(index, "name", e.target.value)}
                          required
                        />
                      </div>
                      <div className="col-span-3">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Price"
                          value={tt.price}
                          onChange={(e) => updateTicketType(index, "price", e.target.value)}
                          required
                        />
                      </div>
                      <div className="col-span-3">
                        <Input
                          type="number"
                          min="1"
                          placeholder="Seats"
                          value={tt.total_seats}
                          onChange={(e) => updateTicketType(index, "total_seats", e.target.value)}
                          required
                        />
                      </div>
                      <div className="col-span-2 flex justify-end">
                        {ticketTypes.length > 1 && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => removeTicketType(index)}
                            className="text-red-500 hover:bg-red-50 p-1 h-8 w-8"
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreateDialog(false);
                    resetForm();
                  }}
                  className="!bg-gray-100 hover:!bg-gray-200 !text-gray-700 !border-gray-300 cursor-pointer font-medium px-6 py-2"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="!bg-blue-600 hover:!bg-blue-700 !text-white cursor-pointer font-semibold shadow-md border-0 px-6 py-2"
                >
                  Create Event
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* EDIT DIALOG SA LOKACIJOM */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="bg-white text-black max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Event</DialogTitle>
              <DialogDescription>Update basic event details.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdateEvent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Event Title *</label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter event title"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Location</label>
                <Input
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Enter event location"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter event description"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Date & Time *</label>
                  <Input
                    type="datetime-local"
                    value={formData.date_and_time}
                    onChange={(e) => setFormData({ ...formData, date_and_time: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Image URL</label>
                  <Input
                    type="url"
                    value={formData.image}
                    onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowEditDialog(false);
                    resetForm();
                  }}
                  className="!bg-gray-100 hover:!bg-gray-200 !text-gray-700 !border-gray-300 cursor-pointer font-medium px-6 py-2"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="!bg-blue-600 hover:!bg-blue-700 !text-white cursor-pointer font-semibold shadow-md border-0 px-6 py-2"
                >
                  Update Event
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* DELETE DIALOG */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent className="bg-white text-black">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Event</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{selectedEvent?.title}"? This action cannot be undone.
                All reservations for this event will also be deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="!bg-gray-100 hover:!bg-gray-200 !text-gray-700 !border-gray-300 cursor-pointer font-medium px-6 py-2">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteEvent}
                className="!bg-red-600 hover:!bg-red-700 !text-white cursor-pointer font-semibold shadow-md border-0 px-6 py-2"
              >
                Delete Event
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* RESERVATIONS DIALOG */}
        <Dialog open={showReservationsDialog} onOpenChange={setShowReservationsDialog}>
          <DialogContent className="bg-white text-black max-w-4xl max-h-[80vh] overflow-y-auto border-2 border-gray-200 shadow-2xl rounded-lg">
            <DialogHeader className="border-b border-gray-100 pb-4">
              <DialogTitle className="text-xl font-bold text-gray-900">Event Reservations - {selectedEvent?.title}</DialogTitle>
              <DialogDescription className="text-gray-600">
                View all reservations for this event
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {reservations.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-gray-500 text-lg">No reservations yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-gray-200">
                      <TableHead className="text-gray-900 font-semibold">Student</TableHead>
                      <TableHead className="text-gray-900 font-semibold">Ticket Type</TableHead>
                      <TableHead className="text-gray-900 font-semibold">Tickets</TableHead>
                      <TableHead className="text-gray-900 font-semibold">Reserved On</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reservations.map((reservation) => (
                      <TableRow key={reservation.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <TableCell>
                          <div className="text-sm font-medium text-gray-900">
                            {reservation.student_name}
                          </div>
                          <div className="text-xs text-gray-500">
                            @{reservation.student_username}
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-900">
                          {reservation.ticket_type_name || "N/A"}
                        </TableCell>
                        <TableCell className="text-gray-900 font-medium">
                          {reservation.number_of_tickets}
                        </TableCell>
                        <TableCell className="text-gray-900">
                          {new Date(reservation.reservation_date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
            <DialogFooter className="border-t border-gray-100 pt-4">
              <Button
                onClick={() => setShowReservationsDialog(false)}
                variant="outline"
                className="!bg-gray-100 hover:!bg-gray-200 !text-gray-700 !border-gray-300 cursor-pointer font-medium px-6 py-2"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ✅ SALES PROGRESS DIALOG - ISRAVQLJEN */}
        <Dialog open={showProgressDialog} onOpenChange={setShowProgressDialog}>
          <DialogContent className="bg-white text-black max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Sales Progress – {selectedEvent?.title}</DialogTitle>
              <DialogDescription>Track ticket sales for this event.</DialogDescription>
            </DialogHeader>

            {salesProgress ? (
              <div className="space-y-6">
                {/* Ukupan progres */}
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="font-medium">Total Sold</span>
                    <span>
                      {parseInt(salesProgress.total_sold) || 0} / {parseInt(salesProgress.total_seats) || 0} (
                      {Math.round(((parseInt(salesProgress.total_sold) || 0) / (parseInt(salesProgress.total_seats) || 1)) * 100)}%
                      )
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div
                      className="bg-green-500 h-4 rounded-full"
                      style={{ width: `${salesProgress.percentage_sold}%` }}
                    ></div>
                  </div>
                </div>

                {/* Po tipu karte */}
                <div>
                  <h4 className="font-semibold mb-3">By Ticket Type:</h4>
                  {salesProgress.ticket_types.map((tt) => (
                    <div key={tt.id} className="mb-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span>{tt.name}</span>
                        <span>
                          {parseInt(tt.sold) || 0} / {parseInt(tt.total_seats) || 0} (
                          {Math.round(((parseInt(tt.sold) || 0) / (parseInt(tt.total_seats) || 1)) * 100)}%
                          )
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                          className="bg-blue-500 h-2.5 rounded-full"
                          style={{ width: `${tt.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-gray-500">Loading...</p>
            )}

            <DialogFooter>
              <Button
                onClick={() => setShowProgressDialog(false)}
                variant="outline"
                className="!bg-gray-100 hover:!bg-gray-200 !text-gray-700 !border-gray-300"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}