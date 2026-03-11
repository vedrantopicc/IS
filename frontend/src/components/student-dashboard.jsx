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
import { Bell } from "lucide-react";
import { CheckCheck } from "lucide-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { resolveImage } from "../lib/image";

import {
    getNotifications,
    markNotificationRead,
    markAllNotificationsRead
} from "../services/notifications";


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
        console.error("Greška pri dekodiranju JWT-a:", err);
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
    const fallbackUrl =
        "https://images.pexels.com/photos/1190298/pexels-photo-1190298.jpeg?auto=compress&cs=tinysrgb&w=800  ";

    const activeTab = searchParams.get("tab") || "events";
    const setActiveTab = (tab) => {
        const next = new URLSearchParams(searchParams);
        next.set("tab", tab);
        next.set("page", "1"); // ✅ reset na prvu stranicu
        setSearchParams(next);
    };



    const [notifications, setNotifications] = useState([]);
    const [unreadNotif, setUnreadNotif] = useState(0);

    const [notifOpen, setNotifOpen] = useState(false);


    const z = (n) => String(n).padStart(2, "0");
    const toParamDate = (d) =>
        d ? `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}` : undefined;

    const [eventsLimit] = useState(9);
    const [eventsMeta, setEventsMeta] = useState({ page: 1, limit: 9, total: 0, totalPages: 1 });

    const eventsPage = useMemo(() => {
        const p = Number(searchParams.get("page") || "1");
        return Number.isFinite(p) && p > 0 ? p : 1;
    }, [searchParams]);

    const setPageInUrl = (p) => {
        const next = new URLSearchParams(searchParams);
        next.set("tab", activeTab);          // zadrži tab
        next.set("page", String(p));         // upiši page
        setSearchParams(next);
    };


    useEffect(() => {
        if (activeTab === "events") {
            loadStudentData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [eventsPage, activeTab]);


    const loadNotifications = async () => {
        try {
            const data = await getNotifications();
            setNotifications((data.items || []).map(n => ({ ...n, is_read: Number(n.is_read) })));
            setUnreadNotif(Number(data?.meta?.unread || 0));
        } catch (e) {
            console.error(e);
        }
    };



    const handleMarkAllRead = async () => {
        try {
            await markAllNotificationsRead();

            // odmah promijeni UI (ne čekaj polling)
            setUnreadNotif(0);
            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));

            // opcionalno: sync sa serverom
            // await loadNotifications();
        } catch (e) {
            console.error(e);
        }
    };


    const handleOpenNotification = async (n) => {
        try {
            if (!n.is_read) {
                await markNotificationRead(n.id);
                setUnreadNotif((prev) => Math.max(0, prev - 1));
                setNotifications((prev) =>
                    prev.map(x => x.id === n.id ? { ...x, is_read: 1 } : x)
                );
            }
            if (n.event_id) navigate(`/events/${n.event_id}?returnTo=dashboard&tab=events`);
            setNotifOpen(false);
        } catch (e) {
            console.error(e);
        }
    };



    useEffect(() => {
        loadNotifications(); // odmah

        const t = setInterval(() => {
            loadNotifications();
        }, 15000); // 15 sekundi

        return () => clearInterval(t);
    }, []);



    function renderEventsPagination() {
        const totalPages = eventsMeta?.totalPages ?? 1;
        if (totalPages <= 1) return null;

        const go = (p) => setPageInUrl(Math.min(totalPages, Math.max(1, p)));
        const maxMiddle = 5;
        const pages = [];

        const start = Math.max(2, eventsPage - Math.floor(maxMiddle / 2));
        const end = Math.min(totalPages - 1, start + maxMiddle - 1);
        const startFixed = Math.max(2, end - maxMiddle + 1);

        const PageBtn = ({ p, active }) => (
            <button
                type="button"
                onClick={() => go(p)}
                className={[
                    "h-10 w-10 rounded-full text-sm font-medium transition",
                    "hover:bg-gray-100 active:scale-[0.98]",
                    active ? "ring-2 ring-gray-900 text-gray-900 bg-white" : "text-gray-700",
                ].join(" ")}
                aria-current={active ? "page" : undefined}
            >
                {p}
            </button>
        );

        const ArrowBtn = ({ dir }) => {
            const disabled = dir === "left" ? eventsPage === 1 : eventsPage === totalPages;
            const Icon = dir === "left" ? ChevronLeft : ChevronRight;

            return (
                <button
                    type="button"
                    onClick={() => go(dir === "left" ? eventsPage - 1 : eventsPage + 1)}
                    disabled={disabled}
                    className={[
                        "h-10 w-10 rounded-full grid place-items-center transition",
                        disabled ? "text-gray-300 cursor-not-allowed" : "text-gray-800 hover:bg-gray-100",
                    ].join(" ")}
                    aria-label={dir === "left" ? "Prethodna stranica" : "Sljedeća stranica"}
                >
                    <Icon className="h-5 w-5" />
                </button>
            );
        };

        return (
            <div className="mt-10 flex items-center justify-center gap-2 select-none">
                <ArrowBtn dir="left" />
                <PageBtn p={1} active={eventsPage === 1} />

                {startFixed > 2 && <span className="px-1 text-gray-400">…</span>}

                {(() => {
                    for (let p = startFixed; p <= end; p++) {
                        pages.push(<PageBtn key={p} p={p} active={p === eventsPage} />);
                    }
                    return pages;
                })()}

                {end < totalPages - 1 && <span className="px-1 text-gray-400">…</span>}

                {totalPages > 1 && <PageBtn p={totalPages} active={eventsPage === totalPages} />}
                <ArrowBtn dir="right" />
            </div>
        );
    }

    const loadStudentData = async () => {
        try {
            setLoading(true);
            setError("");

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const from = toParamDate(today);

            const [reservationsData, eventsResp] = await Promise.all([
                getUserReservations(),
                getEvents({ sort: "date_asc", from, page: eventsPage, limit: eventsLimit }),
            ]);

            const eventsItems = Array.isArray(eventsResp) ? eventsResp : (eventsResp?.items ?? []);
            const meta = Array.isArray(eventsResp) ? null : (eventsResp?.meta ?? null);

            // sada više ne filtriraš na frontu, jer backend već šalje upcoming (from=today)
            setReservations(reservationsData);
            setAvailableEvents(eventsItems);
            setEventsMeta(meta ?? { page: eventsPage, limit: eventsLimit, total: eventsItems.length, totalPages: 1 });

            if (meta?.totalPages && eventsPage > meta.totalPages) {
                setPageInUrl(meta.totalPages);
                return; // da ne postavljaš "prazne" rezultate
            }
            // backend sada vraća { data, meta }


        } catch (err) {
            console.error("Greška pri učitavanju podataka studenta:", err);
            setError(err.message || "Greška pri učitavanju podataka");
        } finally {
            setLoading(false);
        }
    };

    const handleRequestOrganizer = async () => {
        try {
            setRequesting(true);
            await sendRoleRequest();
            toast.success("Zahtjev poslan! Administrator će ga uskoro pregledati.");
        } catch (err) {
            toast.error(err.message || "Greška pri slanju zahtjeva");
        } finally {
            setRequesting(false);
        }
    };

    const handleDeleteReservation = async (reservationId) => {
        try {
            await deleteReservation(reservationId);
            toast.success("Rezervacija uspješno otkazana");
            setShowDeleteDialog(false);
            setSelectedReservation(null);
            loadStudentData();
        } catch (err) {
            console.error("Greška pri brisanju rezervacije:", err);
            toast.error(err.message || "Greška pri otkazivanju rezervacije");
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
            return date.toLocaleDateString('sr-Latn-RS', {
                year: "numeric", month: "long", day: "numeric",
                hour: "2-digit", minute: "2-digit"
            });
        } catch {
            return dateString;
        }
    };

    const getNotificationMeta = (notification) => {
    const title = (notification?.title || "").toLowerCase();
    const message = (notification?.message || "").toLowerCase();

    if (
        title.includes("izmjena") ||
        message.includes("promijenjen") ||
        message.includes("promijenjena") ||
        message.includes("promijenjeno")
    ) {
        return {
            badgeText: "IZMJENA",
            badgeClass: "bg-amber-100 text-amber-700",
            dotClass: "bg-amber-500",
        };
    }

    if (
        title.includes("novi događaj") ||
        title.includes("objavljen")
    ) {
        return {
            badgeText: "NOVO",
            badgeClass: "bg-blue-100 text-blue-700",
            dotClass: "bg-blue-600",
        };
    }

    return {
        badgeText: "INFO",
        badgeClass: "bg-gray-100 text-gray-700",
        dotClass: "bg-gray-400",
    };
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
                    <p className="text-gray-600">Učitavanje...</p>
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
                        Dobrodošli, <span className="font-semibold text-gray-900">{displayName}</span>
                    </h2>

                    <div className="flex items-center gap-2">

                        {/* 🔔 Bell notification */}
                        <DropdownMenu open={notifOpen} onOpenChange={(open) => {setNotifOpen(open);
                        if (open) loadNotifications(); }}>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    className="relative h-10 w-10 rounded-full p-0 hover:bg-gray-100 transition-colors"
                                >
                                    <Bell className="h-5 w-5 text-gray-700" />
                                    {unreadNotif > 0 && (
                                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px]
                         rounded-full bg-red-600 text-white text-[11px]
                         font-bold flex items-center justify-center px-1">
                                            {unreadNotif > 99 ? "99+" : unreadNotif}
                                        </span>
                                    )}
                                </Button>
                            </DropdownMenuTrigger>

                            <DropdownMenuContent
                                align="end"
                                className="w-96 text-gray-900 bg-white shadow-xl border border-gray-200 rounded-md z-[9999] mt-2"
                                side="bottom"
                                sideOffset={8}
                            >
                                <div className="px-3 py-2 flex items-center justify-between gap-2 border-b border-gray-100">
                                    <span className="text-sm font-semibold">Obavještenja</span>
                                </div>

                                <DropdownMenuItem
                                    onSelect={(e) => {
                                        e.preventDefault(); // sprijeci auto-close i "pojeden" klik
                                        handleMarkAllRead();
                                    }}
                                    disabled={unreadNotif === 0}
                                    className="cursor-pointer justify-center text-sm"
                                >
                                    Označi sve kao pročitano
                                </DropdownMenuItem>



                                <div className="max-h-80 overflow-auto">
                                    {notifications.length === 0 ? (
                                        <div className="p-4 text-sm text-gray-500">Još nema obavještenja.</div>
                                    ) : (
                                       notifications.map((n) => {
    const meta = getNotificationMeta(n);

    return (
        <DropdownMenuItem
            key={n.id}
            onClick={() => handleOpenNotification(n)}
            className={[
                "cursor-pointer flex items-start gap-3 px-3 py-3 border-b border-gray-100 last:border-b-0",
                "focus:bg-gray-50",
                n.is_read ? "opacity-80 bg-white" : "bg-blue-50/60"
            ].join(" ")}
        >
            <div className="pt-1">
                <span className={`block h-2.5 w-2.5 rounded-full ${n.is_read ? "bg-gray-300" : meta.dotClass}`} />
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-900 line-clamp-1">
                        {n.title}
                    </span>

                    <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.badgeClass}`}
                    >
                        {n.is_read ? "PROČITANO" : meta.badgeText}
                    </span>
                </div>

                <div className="mt-1 text-xs text-gray-600 line-clamp-2">
                    {n.message}
                </div>

                <div className="mt-2 text-[11px] text-gray-400">
                    {formatDateTime(n.created_at)}
                </div>
            </div>
        </DropdownMenuItem>
    );
})
                                    )}
                                </div>
                            </DropdownMenuContent>
                        </DropdownMenu>



                        {/* 👤 Avatar dropdown */}
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
                                        <span>Pregled događaja</span>
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
                                                <span>Panel organizatora</span>
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
                                        <span>Postavke</span>
                                    </DropdownMenuItem>
                                </div>

                                <div className="h-px bg-gray-100 mx-2"></div>

                                <div className="p-1">
                                    <DropdownMenuItem
                                        onClick={handleLogout}
                                        className="flex items-center px-3 py-2 text-sm hover:bg-red-50 hover:text-red-700 cursor-pointer rounded-sm"
                                    >
                                        <LogOut className="mr-3 h-4 w-4" />
                                        <span>Odjava</span>
                                    </DropdownMenuItem>
                                </div>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </header>

            <main className="p-8">
                <div className="max-w-6xl mx-auto">
                    {payload && payload.is_organizer === 0 && (
                        <div className="mb-4 flex justify-between items-center px-4 py-2 border-b">
                            <span className="text-sm text-gray-600 font-medium">
                                Možete zatražiti da postanete organizator
                            </span>
                            <Button
                                onClick={handleRequestOrganizer}
                                disabled={requesting}
                                className={`text-sm px-4 py-2 ${requesting
                                    ? "!bg-blue-600 !text-white cursor-not-allowed opacity-70"
                                    : "!bg-blue-600 hover:!bg-blue-700 !text-white"
                                    }`}
                            >
                                {requesting ? "Zahtjev poslan" : "Zatraži ulogu organizatora"}
                            </Button>
                        </div>
                    )}

                    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="events" className="text-black cursor-pointer hover:bg-gray-100 transition-colors">Predstojeći događaji</TabsTrigger>
                            <TabsTrigger value="reservations" className="text-black cursor-pointer hover:bg-gray-100 transition-colors">Moje rezervacije</TabsTrigger>
                        </TabsList>

                        <TabsContent value="reservations" className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-black">
                                        <Ticket className="w-5 h-5 text-blue-600" />
                                        Moje rezervacije ({reservations.length})
                                    </CardTitle>
                                    <CardDescription className="text-black">
                                        Upravljajte svojim rezervacijama događaja
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {reservations.length === 0 ? (
                                        <div className="text-center py-8">
                                            <Ticket className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                            <p className="text-gray-500">Još nema rezervacija</p>
                                            <Button
                                                onClick={() => setActiveTab("events")}
                                                className="mt-4 text-black cursor-pointer hover:bg-gray-50 transition-colors"
                                                variant="outline"
                                            >
                                                Pretraži događaje
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="text-gray-900 font-semibold">Događaj</TableHead>
                                                        <TableHead className="text-gray-900 font-semibold">Vrsta ulaznice</TableHead>
                                                        <TableHead className="text-gray-900 font-semibold">Datum i vrijeme</TableHead>
                                                        <TableHead className="text-gray-900 font-semibold">Ulaznice</TableHead>
                                                        <TableHead className="text-gray-900 font-semibold">Ukupna cijena</TableHead>
                                                        <TableHead className="text-gray-900 font-semibold">Rezervisano dana</TableHead>
                                                        <TableHead className="text-gray-900 font-semibold">Radnje</TableHead>
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
                                                                    {reservation.number_of_tickets} ulaznic{reservation.number_of_tickets !== 1 ? 'e' : 'a'}
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
                                        Predstojeći događaji ({eventsMeta?.total ?? availableEvents.length})
                                    </CardTitle>
                                    <CardDescription className="text-black">
                                        Pretražite i rezervišite ulaznice za predstojeće događaje
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {availableEvents.length === 0 ? (
                                        <div className="text-center py-8">
                                            <CalendarDays className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                            <p className="text-gray-500">Nema dostupnih predstojećih događaja</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                                                {availableEvents.map((event) => {
                                                    const totalAvailable = event.total_available_seats || 0;
                                                    const seatsDisplay =
                                                        totalAvailable > 0
                                                            ? `${totalAvailable} dostupn${totalAvailable === 1 ? "o mjesto" : "ih mjesta"}`
                                                            : "Nema dostupnih mjesta";

                                                    return (
                                                        <Card key={event.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
                                                            <div className="relative h-48 overflow-hidden">
                                                                <img
                                                                    src={resolveImage(event.image) || fallbackUrl}
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
                                                                    {totalAvailable === 0 ? "Rasprodano" : "Pogledaj detalje i rezerviši"}
                                                                </Button>
                                                            </CardContent>
                                                        </Card>
                                                    );
                                                })}
                                            </div>

                                            {renderEventsPagination()}
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>

                    <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Otkaži rezervaciju</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Jeste li sigurni da želite otkazati svoju rezervaciju za "{selectedReservation?.event_title}"?
                                    Ova radnja se ne može poništiti.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="!bg-white hover:!bg-gray-200 !text-gray-900 !border-gray-300 cursor-pointer">Zadrži rezervaciju</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={() => {
                                        const reservationId = selectedReservation?.reservation_id || selectedReservation?.id;
                                        if (reservationId) {
                                            handleDeleteReservation(reservationId);
                                        } else {
                                            toast.error('Nevažeći ID rezervacije');
                                        }
                                    }}
                                    className="!bg-red-600 hover:!bg-red-700 !text-white cursor-pointer"
                                >
                                    Otkaži rezervaciju
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </main>
        </div>
    );
}