import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import EventCard from "./event-card";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Avatar, AvatarFallback } from "../components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../components/ui/dropdown-menu";
import { Button } from "../components/ui/button";
import {
  Settings,
  LogOut,
  Calendar as CalendarIcon,
  Shield,
  Ticket,
} from "lucide-react";
import { logoutApi } from "../services/auth";
import { getEvents } from "../services/events";
import { getCategories } from "../services/categories";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../components/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "../components/ui/popover";
import { Calendar } from "../components/ui/calendar";

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
  if (!p) return "User";
  if (p.name && p.surname) return `${p.name} ${p.surname}`;
  return p.name || p.username || p.email || "User";
}

function getInitials(name) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() || "")
      .join("") || "U"
  );
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

const z = (n) => String(n).padStart(2, "0");
const toParamDate = (d) =>
  d ? `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}` : undefined;
const fmtDisplay = (d) =>
  d ? `${z(d.getDate())}.${z(d.getMonth() + 1)}.${d.getFullYear()}` : "";

export const EventsPage = () => {
  const navigate = useNavigate();

  const payload = useMemo(() => {
    const t = getToken();
    return t ? decodeJwt(t) : null;
  }, []);

  const displayName = useMemo(() => getDisplayName(payload), [payload]);
  const initials = useMemo(() => getInitials(displayName), [displayName]);
  const userRole = useMemo(() => getCurrentUserRole(), []);

  const isAdmin = userRole === "Admin";
  const isStudent = userRole === "Student";
  const isOrganizer = userRole === "Organizer";

  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState("all");

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [sort, setSort] = useState("date_asc");
  const [search, setSearch] = useState("");

  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);

  const fromParam = useMemo(() => toParamDate(fromDate), [fromDate]);
  const toParam = useMemo(() => toParamDate(toDate), [toDate]);

  const [page, setPage] = useState(1);
  const [limit] = useState(9);
  const [meta, setMeta] = useState({ page: 1, limit: 9, total: 0, totalPages: 1 });


  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const cats = await getCategories();
        if (!alive) return;
        setCategories(cats);
      } catch (e) {
        console.error(e);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    (async () => {
      try {
        const data = await getEvents({
          from: fromParam,
          to: toParam,
          sort,
          search,
          page,
          limit,
          category_id: categoryId === "all" ? undefined : categoryId,
        });

        if (!alive) return;

        setMeta(data.meta);

        setRows(
          (data.items || []).map((r) => ({
            id: r.id,
            title: r.title,
            image: r.image,
            location: r.location,
            dt: r.date_and_time ? new Date(r.date_and_time) : null,
            averageRating: r.averageRating || null,
          }))
        );
        
        // ✅ DEBUG - dodaj ovo
        console.log("📊 API Response:", data.items);
        console.log("📊 First event averageRating:", data.items[0]?.averageRating);
      } catch (e) {
        if (alive) console.error(e);
      } finally {
        if (alive) setLoading(false);
      }
      
    })();


    return () => {
      alive = false;
    };
  }, [sort, fromParam, toParam, categoryId, search, page]);




  useEffect(() => {
  setPage(1);
}, [sort, fromParam, toParam, categoryId, search]);


  const cards = useMemo(() => {
    const currentDate = new Date();
    return rows.map((e) => ({
      id: e.id,
      image: e.image,
      title: e.title,
      location: e.location,
      date: e.dt
        ? e.dt.toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : "",
      time: e.dt
        ? e.dt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
        : "",
      isPastEvent: e.dt ? e.dt < currentDate : false,
      averageRating: e.averageRating,  // ✅ DODATO
    }));
  }, [rows]);

  const handleLogout = async () => {
    try {
      await logoutApi();
    } catch {
      // ignore
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/");
    }
  };

  const selectedCategoryLabel =
    categoryId === "all"
      ? null
      : categories.find((c) => String(c.id) === String(categoryId))?.name ?? String(categoryId);

      
function renderPagination() {
  const totalPages = meta?.totalPages ?? 1;
  if (totalPages <= 1) return null;

  const go = (p) => setPage(Math.min(totalPages, Math.max(1, p)));

  const maxMiddle = 5;
  const pages = [];

  const start = Math.max(2, page - Math.floor(maxMiddle / 2));
  const end = Math.min(totalPages - 1, start + maxMiddle - 1);
  const startFixed = Math.max(2, end - maxMiddle + 1);

  const PageBtn = ({ p, active }) => (
    <button
      onClick={() => go(p)}
      className={[
        "h-10 w-10 rounded-full text-sm font-medium transition",
        "hover:bg-gray-100 active:scale-[0.98]",
        active
          ? "ring-2 ring-gray-900 text-gray-900 bg-white"
          : "text-gray-700",
      ].join(" ")}
      aria-current={active ? "page" : undefined}
    >
      {p}
    </button>
  );

  const ArrowBtn = ({ dir }) => {
    const disabled = dir === "left" ? page === 1 : page === totalPages;
    const Icon = dir === "left" ? ChevronLeft : ChevronRight;

    return (
      <button
        onClick={() => go(dir === "left" ? page - 1 : page + 1)}
        disabled={disabled}
        className={[
          "h-10 w-10 rounded-full grid place-items-center transition",
          disabled
            ? "text-gray-300 cursor-not-allowed"
            : "text-gray-800 hover:bg-gray-100",
        ].join(" ")}
        aria-label={dir === "left" ? "Previous page" : "Next page"}
      >
        <Icon className="h-5 w-5" />
      </button>
    );
  };

  return (
    <div className="mt-10 flex items-center justify-center gap-2 select-none">
      <ArrowBtn dir="left" />

      <PageBtn p={1} active={page === 1} />

      {startFixed > 2 && (
        <span className="px-1 text-gray-400">…</span>
      )}

      {(() => {
        for (let p = startFixed; p <= end; p++) {
          pages.push(<PageBtn key={p} p={p} active={p === page} />);
        }
        return pages;
      })()}

      {end < totalPages - 1 && (
        <span className="px-1 text-gray-400">…</span>
      )}

      {totalPages > 1 && (
        <PageBtn p={totalPages} active={page === totalPages} />
      )}

      <ArrowBtn dir="right" />
    </div>
  );
}

      
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-24 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-blue-200/25 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-purple-200/20 blur-3xl" />
      </div>

      <header className="sticky top-0 z-10 w-full border-b border-gray-200 bg-white/70 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex flex-col">
            <h2 className="text-sm text-gray-600">
              Welcome, <span className="font-semibold text-gray-900">{displayName}</span>
            </h2>
          
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-10 w-10 rounded-full p-0 relative z-50 cursor-pointer hover:bg-gray-100 transition-colors"
              >
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-gray-900 text-white text-sm font-medium">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              className="w-60 text-gray-900 bg-white shadow-xl border border-gray-200 rounded-xl z-[9999] mt-2"
              side="bottom"
              sideOffset={8}
            >
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
              </div>

              {isAdmin && (
                <div className="p-1">
                  <DropdownMenuItem
                    onClick={() => navigate("/admin")}
                    className="flex items-center px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer rounded-md"
                  >
                    <Shield className="mr-3 h-4 w-4" />
                    <span>Admin Panel</span>
                  </DropdownMenuItem>
                </div>
              )}

              {isStudent && (
                <div className="p-1">
                  <DropdownMenuItem
                    onClick={() => navigate("/student-dashboard")}
                    className="flex items-center px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer rounded-md"
                  >
                    <Ticket className="mr-3 h-4 w-4" />
                    <span>My Reservations</span>
                  </DropdownMenuItem>
                </div>
              )}

              {isOrganizer && (
                <div className="p-1">
                  <DropdownMenuItem
                    onClick={() => navigate("/organizer-dashboard")}
                    className="flex items-center px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer rounded-md"
                  >
                    <span>My Events</span>
                  </DropdownMenuItem>
                </div>
              )}

              <div className="p-1">
                <DropdownMenuItem
                  onClick={() => navigate("/settings")}
                  className="flex items-center px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer rounded-md"
                >
                  <Settings className="mr-3 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
              </div>

              <div className="p-1">
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="flex items-center px-3 py-2 text-sm hover:bg-red-50 hover:text-red-700 cursor-pointer rounded-md"
                >
                  <LogOut className="mr-3 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="px-4 py-6">
        <div className="mx-auto max-w-6xl">
             
<div className="mb-4">
  <div className="rounded-3xl border border-gray-200 bg-white/70 backdrop-blur shadow-sm overflow-hidden">
    <div className="relative px-5 py-4 md:px-6 md:py-5">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-purple-500/10 blur-3xl" />
      </div>

      <div className="relative flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">
            Upcoming Events
          </h1>
          <p className="text-sm text-gray-600">
            Discover what's next.
          </p>
        </div>

   
        <div className="hidden sm:flex items-center gap-2 text-xs text-gray-600">
          <span className="rounded-full border border-gray-200 bg-white px-3 py-1">
            {cards.length} results
          </span>
          <span className="rounded-full border border-gray-200 bg-white px-3 py-1">
            Sort:{" "}
          
            <span className="font-medium text-gray-900">
              {sort === "date_asc" ? "Soonest" : "Latest"}
            </span>
          </span>
        </div>
      </div>
    </div>
  </div>
</div>



          {(isStudent || isAdmin) && (
          <div className="mb-5 rounded-2xl border border-gray-200 bg-white/80 backdrop-blur shadow-sm">
            <div className="p-3 md:p-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">


                <div className="flex flex-col gap-4 md:flex-row md:items-end md:flex-wrap">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold tracking-wide text-gray-600">
                      Category
                    </span>
                    <Select value={categoryId} onValueChange={setCategoryId}>
                      <SelectTrigger className="w-full md:w-44 h-10 bg-white text-gray-900 border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors rounded-md shadow-sm">
                        <SelectValue placeholder="All categories" />
                      </SelectTrigger>
                      <SelectContent className="text-white bg-gray-800 border-gray-800">
                        <SelectItem value="all" className="cursor-pointer hover:bg-gray-700">
                          ALL
                        </SelectItem>

                        {categories.map((c) => (
                          <SelectItem
                            key={c.id}
                            value={String(c.id)}
                            className="cursor-pointer hover:bg-gray-700"
                          >
                            {c.name.toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold tracking-wide text-gray-600">Sort</span>
                    <div className="inline-flex h-10 rounded-md border border-gray-200 bg-gray-50 p-1 shadow-sm">
                      <button
                        type="button"
                        onClick={() => setSort("date_asc")}
                        className={[
                          "px-3 text-sm rounded-[8px] transition",
                          sort === "date_asc"
                            ? "bg-white shadow-sm text-gray-900"
                            : "text-gray-600 hover:text-gray-900",
                        ].join(" ")}
                      >
                        Soonest
                      </button>

                      <button
                        type="button"
                        onClick={() => setSort("date_desc")}
                        className={[
                          "px-3 text-sm rounded-[8px] transition",
                          sort === "date_desc"
                            ? "bg-white shadow-sm text-gray-900"
                            : "text-gray-600 hover:text-gray-900",
                        ].join(" ")}
                      >
                        Latest
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 w-full md:w-64">
                    <span className="text-xs font-semibold tracking-wide text-gray-600">Search</span>
                    <div className="relative">
                      <svg
                        className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M21 21l-4.3-4.3m1.8-5.2a7 7 0 11-14 0 7 7 0 0114 0z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>

                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by title…"
                        className="w-full h-10 pl-10 pr-16 rounded-full border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400
                                   shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400"
                      />

                    
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-gray-900">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="h-10 w-full sm:w-40 justify-start bg-white border-gray-200 hover:bg-gray-50 transition-colors rounded-md shadow-sm"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {fromDate ? fmtDisplay(fromDate) : "From date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="!bg-gray-800 !border-gray-800" align="start">
                      <Calendar
                        mode="single"
                        selected={fromDate}
                        onSelect={(d) => setFromDate(d ?? null)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="h-10 w-full sm:w-40 justify-start bg-white border-gray-200 hover:bg-gray-50 transition-colors rounded-md shadow-sm"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {toDate ? fmtDisplay(toDate) : "To date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="!bg-gray-800 !border-gray-800" align="start">
                      <Calendar
                        mode="single"
                        selected={toDate}
                        onSelect={(d) => setToDate(d ?? null)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  <Button
                    variant="ghost"
                    className="h-10 px-4 rounded-md text-sm border border-transparent hover:border-gray-200 hover:bg-gray-100 transition-colors"
                    onClick={() => {
                      setFromDate(null);
                      setToDate(null);
                      setSearch("");
                      setCategoryId("all");
                      setSort("date_asc");
                    }}
                  >
                    Clear
                  </Button>
                </div>
              </div>

              <div className="px-4 md:px-5 pb-4 md:pb-5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {selectedCategoryLabel && (
                    <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-gray-700">
                      Category: <span className="font-medium text-gray-900">{selectedCategoryLabel}</span>
                    </span>
                  )}

                  {fromDate && (
                    <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-gray-700">
                      From: <span className="font-medium text-gray-900">{fmtDisplay(fromDate)}</span>
                    </span>
                  )}

                  {toDate && (
                    <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-gray-700">
                      To: <span className="font-medium text-gray-900">{fmtDisplay(toDate)}</span>
                    </span>
                  )}

                  {search?.trim() && (
                    <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-gray-700">
                      Search: <span className="font-medium text-gray-900">"{search.trim()}"</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex items-center gap-3 text-gray-600">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
                <span>Loading events…</span>
              </div>
            </div>
          ) : cards.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-gray-600 shadow-sm">
              No events match your filters.
            </div>
          ) : (
            <>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {cards.map((event) => (
        <EventCard
          key={event.id}
          image={event.image}
          title={event.title}
          location={event.location}
          date={event.date}
          time={event.time}
          rating={event.averageRating}
          isPastEvent={event.isPastEvent}
          onClick={() => navigate(`/events/${event.id}`)}
        />
      ))}
    </div>
    {renderPagination()}


  
      </>
    )}
        </div>
      </main>
    </div>
  );
};