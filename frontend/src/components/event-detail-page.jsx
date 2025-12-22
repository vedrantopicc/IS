import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Calendar, Clock, DollarSign, MapPin, MessageCircle, ArrowLeft, Ticket, Users } from "lucide-react";
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
      } catch (e) {
        if (!alive) return;
        setNotFound(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id, isLoggedIn]);

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

    try {
      setReservationLoading(true);
      await createReservation(id, numberOfTickets);
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
    <div className="min-h-screen bg-gray-50 text-white">
      <div className="max-w-5xl mx-auto p-4 md:p-8">
        <button onClick={handleBackNavigation} className="mb-4 inline-flex items-center gap-2 text-[#242424] cursor-pointer hover:text-black transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="rounded-xl overflow-hidden bg-gray-800">
          {event.image && (
            <img src={event.image} alt={event.title} className="w-full h-72 object-cover" />
          )}
          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold">{event.title}</h1>
              <p className="text-gray-300">
                Organized by: <span className="font-medium text-white">{organizer}</span>
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-500" />
                <span>{date}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-500" />
                <span>{time}</span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-500" />
                <span className="text-green-500 font-semibold text-xl">
                  ${Number(event.price ?? 0).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-500" />
                <span>{event.available_seats || event.number_of_available_seats} seats available</span>
              </div>
            </div>

            {isStudent && (
              <div className="bg-gray-700 rounded-lg p-6 space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Ticket className="h-5 w-5 text-blue-500" />
                  Reserve Your Tickets
                </h3>
                
                {isEventInPast ? (
                  <div className="bg-gray-600/20 border border-gray-500/30 rounded-lg p-4">
                    <p className="text-gray-400 font-medium">⏰ This event has already passed</p>
                    <p className="text-sm text-gray-500 mt-1">Reservations are no longer available for past events</p>
                  </div>
                ) : hasExistingReservation ? (
                  <div className="bg-green-600/20 border border-green-600/30 rounded-lg p-4">
                    <p className="text-green-400 font-medium">✓ You already have a reservation for this event</p>
                    <Button 
                      onClick={() => navigate("/student-dashboard?tab=reservations")} 
                      className="mt-3 !bg-green-600 hover:!bg-green-700 !text-white !border-0 cursor-pointer transition-colors"
                    >
                      View My Reservations
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <label htmlFor="tickets" className="text-sm font-medium">
                          Number of tickets:
                        </label>
                        <Input
                          id="tickets"
                          type="number"
                          min="1"
                          max="10"
                          value={numberOfTickets}
                          onChange={(e) => setNumberOfTickets(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-20 bg-gray-600 border-gray-500 text-white"
                        />
                      </div>
                      <div className="text-sm text-gray-400">
                        Total: <span className="text-green-400 font-semibold">
                          ${(Number(event.price ?? 0) * numberOfTickets).toFixed(2)}
                        </span>
                      </div>
                    </div>
                    
                    <Button
                      onClick={handleReservation}
                      disabled={reservationLoading}
                      className="!bg-blue-600 hover:!bg-blue-700 !text-white disabled:opacity-50 flex items-center gap-2 cursor-pointer transition-colors disabled:cursor-not-allowed"
                    >
                      {reservationLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Reserving...
                        </>
                      ) : (
                        <>
                          <Ticket className="w-4 h-4" />
                          Reserve {numberOfTickets} Ticket{numberOfTickets > 1 ? 's' : ''}
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {!isLoggedIn && !isEventInPast && (
              <div className="bg-gray-700 rounded-lg p-6 text-center space-y-3">
                <Ticket className="h-8 w-8 text-blue-500 mx-auto" />
                <h3 className="text-lg font-semibold">Want to reserve tickets?</h3>
                <p className="text-gray-300">Please log in to reserve tickets for this event</p>
                <Button onClick={() => navigate("/login")} className="!bg-blue-600 hover:!bg-blue-700 !text-white cursor-pointer transition-colors">
                  Log In to Reserve
                </Button>
              </div>
            )}

            {!isLoggedIn && isEventInPast && (
              <div className="bg-gray-600/20 border border-gray-500/30 rounded-lg p-6 text-center space-y-3">
                <Ticket className="h-8 w-8 text-gray-400 mx-auto" />
                <h3 className="text-lg font-semibold text-gray-400">Event Has Passed</h3>
                <p className="text-gray-500">This event has already taken place. Reservations are no longer available.</p>
              </div>
            )}

    
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Location</h3>
              <div className="flex items-center gap-2 text-gray-300">
                <MapPin className="h-5 w-5 text-red-500" />
                <span>{event.location || "TBD"}</span>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Description</h3>
              <p className="text-gray-300 leading-relaxed">{event.description}</p>
            </div>
            
            <Comments eventId={id} />
          </div>
        </div>
      </div>
    </div>
  );
}