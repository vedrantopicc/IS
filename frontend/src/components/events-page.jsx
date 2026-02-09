// EventsPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import EventCard from "./event-card";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../components/ui/dropdown-menu";
import { Button } from "../components/ui/button";
import { Settings, LogOut, Calendar as CalendarIcon, Shield, Ticket } from "lucide-react";
import { logoutApi } from "../services/auth";
import { getEvents } from "../services/events";
import { getCategories } from "../services/categories";

import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
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
    } catch {}
  }

  return null;
}

const z = (n) => String(n).padStart(2, "0");
const toParamDate = (d) => (d ? `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}` : undefined);
const fmtDisplay = (d) => (d ? `${z(d.getDate())}.${z(d.getMonth() + 1)}.${d.getFullYear()}` : "");

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
const [categoryId, setCategoryId] = useState("all"); // "" = sve


  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

const [sort, setSort] = useState("desc");
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);

  const fromParam = useMemo(() => toParamDate(fromDate), [fromDate]);
  const toParam = useMemo(() => toParamDate(toDate), [toDate]);

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
        category_id: categoryId === "all" ? undefined : categoryId,
});

        if (!alive) return;

        setRows(
          data.map((r) => ({
            id: r.id,
            title: r.title,
            image: r.image,
            location: r.location, // ✅ DODATO
            dt: r.date_and_time ? new Date(r.date_and_time) : null,
          }))
        );
      } catch (e) {
        if (alive) console.error(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [sort, fromParam, toParam, categoryId]);

  const cards = useMemo(() => {
    const currentDate = new Date();
    return rows.map((e) => ({
      id: e.id,
      image: e.image,
      title: e.title,
      location: e.location, // ✅ DODATO
      date: e.dt ? e.dt.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "",
      time: e.dt ? e.dt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "",
      isPastEvent: e.dt ? e.dt < currentDate : false,
    }));
  }, [rows]);

  const handleLogout = async () => {
    try {
      await logoutApi();
    } catch {}
    finally {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 w-full bg-white/80 backdrop-blur border-b">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <h2 className="text-sm text-gray-600">
            Welcome, <span className="font-semibold text-gray-900">{displayName}</span>
          </h2>

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
              className="w-60 text-gray-900 bg-white shadow-xl border border-gray-200 rounded-md z-[9999] mt-2"
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
                    className="flex items-center px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer rounded-sm"
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
                    className="flex items-center px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer rounded-sm"
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
                    className="flex items-center px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer rounded-sm"
                  >
                    <span>My Events</span>
                  </DropdownMenuItem>
                </div>
                
              )}

              <div className="p-1">
                <DropdownMenuItem
                  onClick={() => navigate("/settings")}
                  className="flex items-center px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer rounded-sm"
                >
                  <Settings className="mr-3 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
              </div>

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

      <main className="p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">
            Upcoming Events
          </h1>
{(isStudent || isAdmin) && (
  <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

           <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">

  {/* CATEGORY */}
  <div className="flex items-center gap-2">
    <span className="text-sm text-black">Category:</span>

    <Select value={categoryId} onValueChange={setCategoryId}>
      <SelectTrigger className="w-52 bg-white text-black cursor-pointer hover:bg-gray-50 transition-colors">
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

  {/* SORT */}
  <div className="flex items-center gap-2">
    <span className="text-sm text-black">Sort:</span>

    <Select value={sort} onValueChange={setSort}>
      <SelectTrigger className="w-44 bg-white text-black cursor-pointer hover:bg-gray-50 transition-colors">
        <SelectValue placeholder="Sort" />
      </SelectTrigger>
      <SelectContent className="text-white bg-gray-800 border-gray-800">
        <SelectItem value="desc">Newest first</SelectItem>
        <SelectItem value="asc">Oldest first</SelectItem>
      </SelectContent>
    </Select>
  </div>

</div>


            <div className="flex items-center gap-3 text-black">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-40 justify-start bg-white cursor-pointer hover:bg-gray-50 transition-colors"
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
                    className="w-40 justify-start bg-white cursor-pointer hover:bg-gray-50 transition-colors"
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
                className="text-sm cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => {
                  setFromDate(null);
                  setToDate(null);
                }}
              >
                Clear
              </Button>
            </div>
          </div>
          )}

          {loading ? (
            <p className="text-center text-gray-500">Loading events…</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {cards.map((event) => (
                <EventCard
                  key={event.id}
                  image={event.image}
                  title={event.title}
                  location={event.location} // ✅ DODATO
                  date={event.date}
                  time={event.time}
                  isPastEvent={event.isPastEvent}
                  onClick={() => navigate(`/events/${event.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};