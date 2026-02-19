// EventDetailPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Calendar, Clock, DollarSign, MapPin, MessageCircle, ArrowLeft, Ticket, Users, AlertCircle } from "lucide-react";
import { getEvent } from "../services/events";
import { createReservation, getUserReservations } from "../services/reservations";
import { toast } from "react-toastify";
import Comments from "./comments";

function formatDT(dtStr) {
  if (!dtStr) return { date: "", time: "" };
  const dt = new Date(dtStr);
  return {
    date: dt.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }),
    time: dt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
  };
}

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

function getCurrentUserRole() {
  const token = getToken();
  if (!token) return null;
  const userStr = localStorage.getItem("user");
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      return user.role;
    } catch {}
  }
  return null;
}

export default function EventDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const returnTo = searchParams.get("returnTo");
  const returnTab = searchParams.get("tab");
  
  const handleBackNavigation = () => {
    if (returnTo === "dashboard" && returnTab) {
      navigate(`/student-dashboard?tab=${returnTab}`);
    } else {
      navigate(-1);
    }
  };

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [reservationLoading, setReservationLoading] = useState(false);
  const [selectedTicketType, setSelectedTicketType] = useState("");
  const [numberOfTickets, setNumberOfTickets] = useState(1);
  const [userReservations, setUserReservations] = useState([]);
  
  const userRole = useMemo(() => getCurrentUserRole(), []);
  const isStudent = userRole === "Student";
  const isLoggedIn = !!getToken();

  const hasExistingReservation = useMemo(() => {
    return userReservations.some(res => res.event_id === parseInt(id));
  }, [userReservations, id]);

  const isEventInPast = useMemo(() => {
    if (!event) return false;
    const eventDate = new Date(event.date_and_time);
    const currentDate = new Date();
    return eventDate < currentDate;
  }, [event]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [eventData, reservationsData] = await Promise.all([
          getEvent(id),
          isLoggedIn ? getUserReservations().catch(() => []) : Promise.resolve([])
        ]);
        if (!alive) return;
        setEvent(eventData);
        setUserReservations(reservationsData);
        // Automatski izaberi prvi tip ako postoji
        if (eventData.ticket_types?.length > 0) {
          setSelectedTicketType(eventData.ticket_types[0].id.toString());
        }
      } catch (e) {
        if (!alive) return;
        setNotFound(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id, isLoggedIn]);

  const selectedTicket = useMemo(() => {
    if (!event?.ticket_types || !selectedTicketType) return null;
    return event.ticket_types.find(tt => tt.id.toString() === selectedTicketType);
  }, [event, selectedTicketType]);

  const handleReservation = async () => {
    if (!isLoggedIn) {
      toast.error("Please log in to make a reservation");
      navigate("/login");
      return;
    }

    if (hasExistingReservation) {
      toast.info("You already have a reservation for this event");
      return;
    }

    if (!selectedTicket) {
      toast.error("Please select a ticket type");
      return;
    }

    if (numberOfTickets > selectedTicket.available_seats) {
      toast.error(`Only ${selectedTicket.available_seats} seats available for this ticket type`);
      return;
    }

    try {
      setReservationLoading(true);
      await createReservation(id, parseInt(selectedTicketType), numberOfTickets);
      toast.success(`Successfully reserved ${numberOfTickets} ticket${numberOfTickets > 1 ? 's' : ''}!`);
      
      const [updatedEvent, updatedReservations] = await Promise.all([
        getEvent(id),
        getUserReservations()
      ]);
      setEvent(updatedEvent);
      setUserReservations(updatedReservations);
      
    } catch (err) {
      console.error("Reservation failed:", err);
      toast.error(err.message || "Failed to create reservation");
    } finally {
      setReservationLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <p className="text-gray-600">Loading event…</p>
      </div>
    );
  }

  if (notFound || !event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-xl w-full text-center space-y-4">
          <h1 className="text-2xl font-bold text-[#242424]">Event not found</h1>
          <Button onClick={() => navigate(-1)} className="bg-blue-600 hover:bg-blue-700 cursor-pointer transition-colors">Go Back</Button>
        </div>
      </div>
    );
  }

  const { date, time } = formatDT(event.date_and_time);
  const organizer =
    event.organizer_name?.trim() ||
    event.organizer_username ||
    `User #${event.user_id}`;

 return (
  <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50 text-[#242424]">
    <div className="max-w-5xl mx-auto px-4 py-4 md:py-6">
      {/* Back */}
      <button
        onClick={handleBackNavigation}
        className="mb-2 inline-flex items-center gap-2 text-gray-600 hover:text-black transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {/* Header / Hero */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-none">
        {event.image ? (
          <div className="relative">
            <img
              src={event.image}
              alt={event.title}
              className="w-full h-56 md:h-72 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 text-white">
              <h1 className="text-2xl md:text-3xl font-extrabold leading-tight">
                {event.title}
              </h1>
              <p className="text-white/90 mt-1">
                Organized by: <span className="font-semibold">{organizer}</span>
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3 md:p-5 border-b border-gray-200">
            <h1 className="text-2xl md:text-3xl font-extrabold">{event.title}</h1>
            <p className="text-gray-600 mt-1">
              Organized by: <span className="font-semibold text-gray-900">{organizer}</span>
            </p>
          </div>
        )}

        {/* Content grid */}
        <div className="p-4 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* MAIN */}
            <div className="md:col-span-8 space-y-4">
              {/* Quick info row (only if no image header text) */}
              {!event.image && (
                <div className="flex flex-wrap gap-2 md:hidden">
  <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-700">
    <Calendar className="h-4 w-4 text-blue-600" />
    <span>{date}</span>
  </div>
  <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-700">
    <Clock className="h-4 w-4 text-blue-600" />
    <span>{time}</span>
  </div>
  <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-700">
    <MapPin className="h-4 w-4 text-red-600" />
    <span>{event.location || "TBD"}</span>
  </div>
</div>
              )}

              {/* Description */}
              <section className="rounded-2xl border border-gray-200 bg-white p-4 md:p-6">
                <h3 className="text-lg font-bold mb-2">Description</h3>
                <p className="text-gray-700 leading-relaxed">
                  {event.description || "No description provided."}
                </p>
              </section>

              {/* Ticket Types (list) */}
              <section className="rounded-2xl border border-gray-200 bg-white p-4 md:p-6">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Ticket className="h-5 w-5 text-blue-600" />
                    Ticket types
                  </h3>
                  <span className="text-sm text-gray-500">
                    {event.ticket_types?.length || 0} type(s)
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {event.ticket_types?.length > 0 ? (
                    event.ticket_types.map((tt) => (
                      <div
                        key={tt.id}
                        className={`rounded-xl border px-4 py-3 flex items-center justify-between gap-4 ${
                          tt.available_seats > 0
                            ? "border-gray-200 bg-gray-50"
                            : "border-gray-200 bg-gray-50 opacity-70"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-gray-900 truncate">
                              {tt.name}
                            </h4>
                            {tt.available_seats <= 0 && (
                              <span className="text-xs font-semibold rounded-full bg-red-100 text-red-700 px-2 py-0.5">
                                Sold out
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-0.5">
                            {tt.available_seats > 0
                              ? `${tt.available_seats} seat${
                                  tt.available_seats !== 1 ? "s" : ""
                                } available`
                              : "No seats available"}
                          </p>
                        </div>

                        <div className="shrink-0 text-right">
                          <div className="text-base md:text-lg font-extrabold text-green-700">
                            {parseFloat(tt.price).toFixed(2)} KM
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-600">No ticket types available.</p>
                  )}
                </div>
              </section>

              {/* Comments */}
              <section className="rounded-2xl border border-gray-200 bg-white p-4 md:p-6">
                <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-blue-600" />
                  Comments
                </h3>
                <Comments eventId={id} />
              </section>
            </div>

            {/* SIDEBAR */}
            <div className="md:col-span-4 space-y-3 md:sticky md:top-6 h-fit">
              {/* Event info card */}
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <h3 className="text-base font-bold mb-3">Event info</h3>

                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 text-blue-600 mt-0.5" />
                    <div className="text-gray-700">
                      <div className="font-semibold text-gray-900">Date</div>
                      <div>{date}</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-blue-600 mt-0.5" />
                    <div className="text-gray-700">
                      <div className="font-semibold text-gray-900">Time</div>
                      <div>{time}</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-red-600 mt-0.5" />
                    <div className="text-gray-700">
                      <div className="font-semibold text-gray-900">Location</div>
                      <div>{event.location || "TBD"}</div>
                    </div>
                  </div>
                </div>

                {isEventInPast && (
                  <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <p className="text-sm font-semibold text-gray-700">⏰ Event has passed</p>
                    <p className="text-xs text-gray-600 mt-1">
                      Reservations are no longer available.
                    </p>
                  </div>
                )}
              </div>

              {/* Reservation card */}
              {isStudent && (
                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <h3 className="text-base font-bold flex items-center gap-2">
                    <Ticket className="h-5 w-5 text-blue-600" />
                    Reserve
                  </h3>

                  <div className="mt-4">
                    {!isLoggedIn ? (
                      <div className="text-center space-y-3">
                        <p className="text-sm text-gray-700">
                          Please log in to reserve tickets.
                        </p>
                        <Button
                          onClick={() => navigate("/login")}
                          className="w-full !bg-blue-600 hover:!bg-blue-700 !text-white cursor-pointer transition-colors"
                          disabled={isEventInPast}
                        >
                          Log In
                        </Button>
                      </div>
                    ) : hasExistingReservation ? (
                      <div className="rounded-xl border border-green-200 bg-green-50 p-3">
                        <p className="text-sm font-semibold text-green-800">
                          ✓ You already have a reservation
                        </p>
                        <Button
                          onClick={() => navigate("/student-dashboard?tab=reservations")}
                          className="mt-3 w-full !bg-green-600 hover:!bg-green-700 !text-white !border-0 cursor-pointer transition-colors"
                        >
                          View My Reservations
                        </Button>
                      </div>
                    ) : isEventInPast ? (
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                        <p className="text-sm font-semibold text-gray-700">
                          Reservations closed
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          This event is in the past.
                        </p>
                      </div>
                    ) : event.ticket_types?.some((tt) => tt.available_seats > 0) ? (
                      <div className="space-y-3">
                        {/* Ticket type */}
                        <div>
                          <label className="block text-sm font-medium mb-2 text-gray-800">
                            Ticket type
                          </label>
                          <Select value={selectedTicketType} onValueChange={setSelectedTicketType}>
                            <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                              <SelectValue placeholder="Choose a ticket type" />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-gray-200">
                              {event.ticket_types
                                .filter((tt) => tt.available_seats > 0)
                                .map((tt) => (
                                  <SelectItem
                                    key={tt.id}
                                    value={tt.id.toString()}
                                    className="cursor-pointer text-gray-900 hover:bg-gray-100"
                                  >
                                    {tt.name} — {parseFloat(tt.price).toFixed(2)} KM ({tt.available_seats} left)
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Quantity + total + CTA */}
                        {selectedTicket && (
                          <>
                            <div className="flex items-center justify-between gap-3">
                              <label
                                htmlFor="tickets"
                                className="text-sm font-medium text-gray-800"
                              >
                                Quantity
                              </label>
                              <Input
                                id="tickets"
                                type="number"
                                min="1"
                                max={selectedTicket.available_seats}
                                value={numberOfTickets}
                                onChange={(e) =>
                                  setNumberOfTickets(
                                    Math.max(
                                      1,
                                      Math.min(
                                        parseInt(e.target.value) || 1,
                                        selectedTicket.available_seats
                                      )
                                    )
                                  )
                                }
                                className="w-24 bg-white border-gray-300 text-gray-900"
                              />
                            </div>

                            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 flex items-center justify-between">
                              <span className="text-sm text-gray-700">Total</span>
                              <span className="text-sm font-extrabold text-green-700">
                                {(parseFloat(selectedTicket.price) * numberOfTickets).toFixed(2)} KM
                              </span>
                            </div>

                            <Button
                              onClick={handleReservation}
                              disabled={reservationLoading || !selectedTicketType}
                              className="w-full !bg-blue-600 hover:!bg-blue-700 !text-white disabled:opacity-50 cursor-pointer transition-colors disabled:cursor-not-allowed"
                            >
                              {reservationLoading ? "Reserving..." : `Reserve ${numberOfTickets} ticket${numberOfTickets > 1 ? "s" : ""}`}
                            </Button>

                            <p className="text-xs text-gray-500">
                              * You can reserve only once per event.
                            </p>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                        <p className="text-sm font-semibold text-red-800 flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          Sold out
                        </p>
                        <p className="text-xs text-red-700 mt-1">
                          All ticket types are sold out.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* If not student, optional compact note */}
              {!isStudent && (
                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <h3 className="text-base font-bold mb-1">Note</h3>
                  <p className="text-sm text-gray-700">
                    Reservations are available for students only.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);
}