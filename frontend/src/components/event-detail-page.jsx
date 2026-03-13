import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Calendar, Clock, DollarSign, MapPin, MessageCircle, ArrowLeft, Ticket, Users, AlertCircle, Maximize2, X, ChevronLeft, ChevronRight } from "lucide-react";
import { getEvent } from "../services/events";
import { createReservation, getUserReservations } from "../services/reservations";
import { toast } from "react-toastify";
import Comments from "./comments";
import { resolveImage } from "../lib/image";

function formatDT(dtStr) {
    if (!dtStr) return { date: "", time: "" };
    const dt = new Date(dtStr);
    return {
        date: dt.toLocaleDateString('sr-Latn-RS', { year: "numeric", month: "long", day: "numeric" }),
        time: dt.toLocaleTimeString('sr-Latn-RS', { hour: "2-digit", minute: "2-digit" }),
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
        } catch { }
    }
    return null;
}

function getCurrentUserId() {
    const token = getToken();
    if (!token) return null;
    const decoded = decodeJwt(token);
    return decoded?.id || decoded?.userId || decoded?.user_id || decoded?.sub || null;
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

    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [showLightbox, setShowLightbox] = useState(false);

    const userRole = useMemo(() => getCurrentUserRole(), []);
    const isStudent = userRole === "Student";
    const isLoggedIn = !!getToken();

    const currentUserId = useMemo(() => getCurrentUserId(), []);

    const isOrganizer = useMemo(() => {
        if (!currentUserId || !event) return false;
        return (
            event.user_id === parseInt(currentUserId) ||
            event.organizer_id === parseInt(currentUserId)
        );
    }, [currentUserId, event]);

    const hasExistingReservation = useMemo(() => {
        return userReservations.some(res => res.event_id === parseInt(id));
    }, [userReservations, id]);

    const isEventInPast = useMemo(() => {
        if (!event) return false;
        const eventDate = new Date(event.date_and_time);
        const currentDate = new Date();
        return eventDate < currentDate;
    }, [event]);

    const mainImage = useMemo(() => {
        if (!event) return null;

        if (event.additional_images?.length > 0) {
            const primary = event.additional_images.find(img => img.is_primary === 1);
            if (primary) return primary.image_path;
        }

        return event.image || (event.additional_images?.[0]?.image_path) || null;
    }, [event]);

    const galleryImages = useMemo(() => {
        if (!event) return [];
        const images = [];
        const seenPaths = new Set();

        if (mainImage && !seenPaths.has(mainImage)) {
            images.push({
                id: 'main',
                path: mainImage,
                isPrimary: true
            });
            seenPaths.add(mainImage);
        }

        if (event.additional_images && event.additional_images.length > 0) {
            event.additional_images.forEach(img => {
                if (!seenPaths.has(img.image_path)) {
                    images.push({
                        id: img.id,
                        path: img.image_path,
                        isPrimary: img.is_primary === 1
                    });
                    seenPaths.add(img.image_path);
                }
            });
        }

        return images;
    }, [event, mainImage]);

    const allImages = useMemo(() => galleryImages, [galleryImages]);

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

    const nextImage = () => {
        if (allImages.length > 1) {
            setCurrentImageIndex((prev) => (prev + 1) % allImages.length);
        }
    };

    const prevImage = () => {
        if (allImages.length > 1) {
            setCurrentImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
        }
    };

    const openLightbox = (index) => {
        setCurrentImageIndex(index);
        setShowLightbox(true);
    };

    // ✅ Keyboard navigation for lightbox
    useEffect(() => {
        if (!showLightbox) return;

        const handleKeyDown = (e) => {
            if (e.key === "ArrowLeft") {
                e.preventDefault();
                prevImage();
            } else if (e.key === "ArrowRight") {
                e.preventDefault();
                nextImage();
            } else if (e.key === "Escape") {
                e.preventDefault();
                setShowLightbox(false);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [showLightbox, prevImage, nextImage]);

    const handleReservation = async () => {
        if (!isLoggedIn) {
            toast.error("Molimo prijavite se da biste napravili rezervaciju");
            navigate("/login");
            return;
        }

        if (hasExistingReservation) {
            toast.info("Već imate rezervaciju za ovaj događaj");
            return;
        }

        if (!selectedTicket) {
            toast.error("Molimo odaberite vrstu karte");
            return;
        }

        if (numberOfTickets > selectedTicket.available_seats) {
            toast.error(`Samo ${selectedTicket.available_seats} mjesta dostupno za ovu vrstu karte`);
            return;
        }

        try {
            setReservationLoading(true);
            await createReservation(id, parseInt(selectedTicketType), numberOfTickets);
            // Ispravna verzija:
            toast.success(`Uspješno ste rezervisali ${numberOfTickets} ${numberOfTickets === 1 ? 'kartu' :
                    numberOfTickets >= 2 && numberOfTickets <= 4 ? 'karte' :
                        'karata'
                }!`);

            const [updatedEvent, updatedReservations] = await Promise.all([
                getEvent(id),
                getUserReservations()
            ]);
            setEvent(updatedEvent);
            setUserReservations(updatedReservations);

        } catch (err) {
            console.error("Reservation failed:", err);
            toast.error(err.message || "Kreiranje rezervacije nije uspjelo");
        } finally {
            setReservationLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
                <p className="text-gray-600">Učitavanje događaja…</p>
            </div>
        );
    }

    if (notFound || !event) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
                <div className="max-w-xl w-full text-center space-y-4">
                    <h1 className="text-2xl font-bold text-[#242424]">Događaj nije pronađen</h1>
                    <Button onClick={() => navigate(-1)} className="bg-blue-600 hover:bg-blue-700 cursor-pointer transition-colors">Nazad</Button>
                </div>
            </div>
        );
    }

    const { date, time } = formatDT(event.date_and_time);
    const organizer =
        event.organizer_name?.trim() ||
        event.organizer_username ||
        `Korisnik #${event.user_id}`;

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50 text-[#242424]">
            <div className="max-w-5xl mx-auto px-4 py-4 md:py-6">
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-none">
                    {mainImage ? (
                        <div className="relative">
                            <img
                                src={resolveImage(mainImage)}
                                alt={event.title}
                                className="w-full h-48 md:h-72 object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                            <div className="absolute bottom-3 md:bottom-4 left-4 right-4 text-white">
                                <h1 className="text-xl md:text-2xl font-extrabold leading-tight drop-shadow-sm">
                                    {event.title}
                                </h1>
                                <p className="text-white/95 text-sm md:text-base mt-0.5 drop-shadow-sm">
                                    Organizovao/la: <span className="font-semibold">{organizer}</span>
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 md:p-6 border-b border-gray-200">
                            <h1 className="text-2xl md:text-3xl font-extrabold">{event.title}</h1>
                            <p className="text-gray-600 mt-1">
                                Organizovao/la: <span className="font-semibold text-gray-900">{organizer}</span>
                            </p>
                        </div>
                    )}

                    <div className="p-4 md:p-8">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">
                            <div className="md:col-span-8 space-y-4 md:space-y-6">
                                {/* Gallery */}
                                {galleryImages.length > 0 && (
                                    <section className="rounded-2xl border border-gray-200 bg-white p-4 md:p-6">
                                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                            <span>Galerija</span>
                                            <span className="text-sm font-normal text-gray-500">
                                                ({galleryImages.length} {galleryImages.length === 1 ? 'slika' : 'slike'})
                                            </span>
                                        </h3>

                                        <div className="grid grid-cols-4 md:grid-cols-5 gap-2">
                                            {galleryImages.map((img, idx) => (
                                                <button
                                                    key={img.id}
                                                    onClick={() => openLightbox(idx)}
                                                    className="relative aspect-square rounded-lg overflow-hidden group cursor-pointer border border-gray-200 hover:border-blue-500 transition-all"
                                                >
                                                    <img
                                                        src={resolveImage(img.path)}
                                                        alt={img.isPrimary ? "Naslovna slika" : "Galerija događaja"}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                    />
                                                    {img.isPrimary && (
                                                        <span className="absolute top-1.5 left-1.5 text-[10px] font-semibold bg-blue-600/95 text-white px-1.5 py-0.5 rounded shadow-sm">
                                                            Naslovna
                                                        </span>
                                                    )}
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors" />
                                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <div className="bg-white/95 rounded-full p-1.5 shadow-lg">
                                                            <Maximize2 className="h-3.5 w-3.5 text-gray-800" />
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </section>
                                )}

                                {/* Description */}
                                <section className="rounded-2xl border border-gray-200 bg-white p-4 md:p-6">
                                    <h3 className="text-lg font-bold mb-2">Opis</h3>
                                    <p className="text-gray-700 leading-relaxed">
                                        {event.description || "Opis nije naveden."}
                                    </p>
                                </section>

                                {/* Ticket Types */}
                                <section className="rounded-2xl border border-gray-200 bg-white p-4 md:p-6">
                                    <div className="flex items-center justify-between gap-3">
                                        <h3 className="text-lg font-bold flex items-center gap-2">
                                            <Ticket className="h-5 w-5 text-blue-600" />
                                            Vrste karata
                                        </h3>
                                    </div>

                                    <div className="mt-4 space-y-3">
                                        {event.ticket_types?.length > 0 ? (
                                            event.ticket_types.map((tt) => (
                                                <div
                                                    key={tt.id}
                                                    className={`rounded-xl border px-4 py-3 flex items-center justify-between gap-4 transition-colors ${tt.available_seats > 0
                                                        ? "border-gray-200 bg-gray-50 hover:border-blue-300"
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
                                                                    Rasprodano
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-gray-600 mt-0.5">
                                                            {tt.available_seats > 0
                                                                ? `${tt.available_seats} mjest${tt.available_seats !== 1 ? "a" : "o"} dostupno`
                                                                : "Nema dostupnih mjesta"}
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
                                            <p className="text-gray-600">Nema dostupnih vrsta karata.</p>
                                        )}
                                    </div>
                                </section>

                                {/* Reviews Section */}
                                <section className="rounded-2xl border border-gray-200 bg-white p-4 md:p-6">
                                    <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                                        <MessageCircle className="h-5 w-5 text-blue-600" />
                                        Recenzije
                                    </h3>

                                    <div className="max-h-60 overflow-y-auto pr-2">
                                        <Comments eventId={id} isOrganizer={isOrganizer} />
                                    </div>
                                </section>
                            </div>

                            {/* SIDEBAR */}
                            <div className="md:col-span-4 space-y-3 md:sticky md:top-6 h-fit">
                                {/* Event info card */}
                                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                                    <h3 className="text-base font-bold mb-3">Informacije o događaju</h3>

                                    <div className="space-y-3 text-sm">
                                        <div className="flex items-start gap-2">
                                            <Calendar className="h-4 w-4 text-blue-600 mt-0.5" />
                                            <div className="text-gray-700">
                                                <div className="font-semibold text-gray-900">Datum</div>
                                                <div>{date}</div>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-2">
                                            <Clock className="h-4 w-4 text-blue-600 mt-0.5" />
                                            <div className="text-gray-700">
                                                <div className="font-semibold text-gray-900">Vrijeme</div>
                                                <div>{time}</div>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-2">
                                            <MapPin className="h-4 w-4 text-red-600 mt-0.5" />
                                            <div className="text-gray-700">
                                                <div className="font-semibold text-gray-900">Lokacija</div>
                                                <div>{event.location || "Biće naknadno objavljeno"}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {isEventInPast && (
                                        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
                                            <p className="text-sm font-semibold text-gray-700">⏰ Događaj je prošao</p>
                                            <p className="text-xs text-gray-600 mt-1">
                                                Rezervacije više nisu dostupne.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Reservation card */}
                                {isStudent && !isOrganizer && (
                                    <div className="rounded-2xl border border-gray-200 bg-white p-4">
                                        <h3 className="text-base font-bold flex items-center gap-2">
                                            <Ticket className="h-5 w-5 text-blue-600" />
                                            Rezerviši
                                        </h3>

                                        <div className="mt-4">
                                            {!isLoggedIn ? (
                                                <div className="text-center space-y-3">
                                                    <p className="text-sm text-gray-700">
                                                        Molimo prijavite se da biste rezervisali karte.
                                                    </p>
                                                    <Button
                                                        onClick={() => navigate("/login")}
                                                        className="w-full !bg-blue-600 hover:!bg-blue-700 !text-white cursor-pointer transition-colors"
                                                        disabled={isEventInPast}
                                                    >
                                                        Prijavi se
                                                    </Button>
                                                </div>
                                            ) : hasExistingReservation ? (
                                                <div className="rounded-xl border border-green-200 bg-green-50 p-3">
                                                    <p className="text-sm font-semibold text-green-800">
                                                        Već imate rezervaciju za ovaj događaj!
                                                    </p>
                                                </div>
                                            ) : isEventInPast ? (
                                                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                                                    <p className="text-sm font-semibold text-gray-700">
                                                        Rezervacije zatvorene
                                                    </p>
                                                    <p className="text-xs text-gray-600 mt-1">
                                                        Ovaj događaj je u prošlosti.
                                                    </p>
                                                </div>
                                            ) : event.ticket_types?.some((tt) => tt.available_seats > 0) ? (
                                                <div className="space-y-3">
                                                    <div>
                                                        <label className="block text-sm font-medium mb-2 text-gray-800">
                                                            Vrsta karte
                                                        </label>
                                                        <Select value={selectedTicketType} onValueChange={setSelectedTicketType}>
                                                            <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                                                                <SelectValue placeholder="Odaberite vrstu karte" />
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
                                                                            {tt.name} — {parseFloat(tt.price).toFixed(2)} KM ({tt.available_seats} preostalo)
                                                                        </SelectItem>
                                                                    ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    {selectedTicket && (
                                                        <>
                                                            <div className="flex items-center justify-between gap-3">
                                                                <label
                                                                    htmlFor="tickets"
                                                                    className="text-sm font-medium text-gray-800"
                                                                >
                                                                    Količina
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
                                                                <span className="text-sm text-gray-700">Ukupno</span>
                                                                <span className="text-sm font-extrabold text-green-700">
                                                                    {(parseFloat(selectedTicket.price) * numberOfTickets).toFixed(2)} KM
                                                                </span>
                                                            </div>

                                                            <Button
                                                                onClick={handleReservation}
                                                                disabled={reservationLoading || !selectedTicketType}
                                                                className="w-full !bg-blue-600 hover:!bg-blue-700 !text-white disabled:opacity-50 cursor-pointer transition-colors disabled:cursor-not-allowed"
                                                            >
                                                                {reservationLoading ? "Rezervisanje u toku..." : `Rezerviši ${numberOfTickets} kartu${numberOfTickets > 1 ? "e" : ""}`}
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                                                    <p className="text-sm font-semibold text-red-800 flex items-center gap-2">
                                                        <AlertCircle className="h-4 w-4" />
                                                        Rasprodano
                                                    </p>
                                                    <p className="text-xs text-red-700 mt-1">
                                                        Sve vrste karata su rasprodane.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {isStudent && isOrganizer && (
                                    <div className="rounded-2xl border border-gray-200 bg-white p-4">
                                        <h3 className="text-base font-bold flex items-center gap-2 mb-3">
                                            <Ticket className="h-5 w-5 text-blue-600" />
                                            Rezerviši
                                        </h3>

                                        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                                            <p className="text-sm font-semibold text-yellow-900 flex items-center gap-2">
                                                <AlertCircle className="h-4 w-4" />
                                                Obavještenje organizatora
                                            </p>
                                            <p className="text-sm text-yellow-800 mt-1">
                                                Kao organizator događaja, ne možete rezervisati karte za svoj vlastiti događaj.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {!isStudent && (
                                    <div className="rounded-2xl border border-gray-200 bg-white p-4">
                                        <h3 className="text-base font-bold mb-1">Napomena</h3>
                                        <p className="text-sm text-gray-700">
                                            Rezervacije nisu dostupne.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Lightbox */}
            {showLightbox && allImages.length > 0 && (
                <div
                    className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
                    onClick={() => setShowLightbox(false)}
                >
                    <button
                        onClick={() => setShowLightbox(false)}
                        className="absolute top-4 right-4 
                 bg-gray-900/80 hover:bg-gray-900
                 text-gray-900
                 p-2 rounded-lg
                 transition-all duration-200
                 border border-white/20
                 shadow-lg"
                        aria-label="Zatvori prikaz"
                    >
                        <X className="h-5 w-5" />
                    </button>

                    {allImages.length > 1 && (
                        <>
                            <button
                                onClick={(e) => { e.stopPropagation(); prevImage(); }}
                                className="absolute left-4 top-1/2 -translate-y-1/2 
                     bg-gray-900/80 hover:bg-gray-900
                     text-gray-900
                     p-2 rounded-lg
                     transition-all duration-200
                     border border-white/20
                     shadow-lg"
                                aria-label="Prethodna slika"
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); nextImage(); }}
                                className="absolute right-4 top-1/2 -translate-y-1/2 
                     bg-gray-900/80 hover:bg-gray-900
                     text-gray-900
                     p-2 rounded-lg
                     transition-all duration-200
                     border border-white/20
                     shadow-lg"
                                aria-label="Sljedeća slika"
                            >
                                <ChevronRight className="h-5 w-5" />
                            </button>
                        </>
                    )}

                    <img
                        src={resolveImage(allImages[currentImageIndex].path)}
                        alt={event.title}
                        className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />

                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm font-medium bg-gray-900/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/20">
                        {currentImageIndex + 1} / {allImages.length}
                    </div>
                </div>
            )}
        </div>
    );
}