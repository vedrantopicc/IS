import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { createBrowserRouter, RouterProvider } from "react-router";
import React from "react";
import RegisterPage from "./components/register-page";
import LoginPage from "./components/login-page";
import { EventsPage } from "./components/events-page";
import EventDetailPage from "./components/event-detail-page";
import AdminDashboard from "./components/admin-dashboard";
import StudentDashboard from "./components/student-dashboard";
import OrganizerDashboard from "./components/organizer-dashboard";
import { ToastContainer } from "react-toastify";
import SettingsPage from "./components/settings-page";
import ProtectedRoute from "./components/protected-route";
import PublicRoute from "./components/public-route";
import ForgotPassword from "./components/forgot-password.jsx";
import ResetPassword from "./components/reset-password";
import EventStatsChart from "./components/event-stats-chart";
const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <PublicRoute>
        <LoginPage />
      </PublicRoute>
    ),
  },
  {
    path: "/register",
    element: (
      <PublicRoute>
        <RegisterPage />
      </PublicRoute>
    ),
  },
  {
    path: "/events",
    element: (
      <ProtectedRoute>
        <EventsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/forgot-password",
    element: <ForgotPassword />,
  },
  {
    path: "/reset-password",
    element: <ResetPassword />,
  },
  {
    path: "/events/:id",
    element: (
      <ProtectedRoute>
        <EventDetailPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/settings",
    element: (
      <ProtectedRoute>
        <SettingsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin",
    element: (
      <ProtectedRoute>
        <AdminDashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: "/student-dashboard",
    element: (
      <ProtectedRoute>
        <StudentDashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: "/organizer-dashboard",
    element: (
      <ProtectedRoute>
        <OrganizerDashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: "/organizer-dashboard",
    element: (
      <ProtectedRoute>
        <OrganizerDashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: "/organizer/event-stats/:eventId", // Dodajemo parametar :eventId
    element: (
      <ProtectedRoute>
        <EventStatsChart />
      </ProtectedRoute>
    ),
  },
]);
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <RouterProvider router={router} />
    <ToastContainer
      position="bottom-center"
      autoClose={4000}
      hideProgressBar={false}
      newestOnTop={false}
      closeOnClick
      pauseOnHover
      draggable
      theme="dark"
      style={{ zIndex: 9999 }}
    />
  </StrictMode>
);
