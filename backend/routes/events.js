import { Router } from "express";
import {
  getAllEvents,
  getEventById,
  deleteEventById,
  getOrganizerEvents,
  createEvent,
  updateEvent,
  deleteOrganizerEvent,
  getEventReservations,
  getEventSalesProgress
} from "../controllers/events-controller.js";

import { requireAdmin, requireOrganizer } from "../middleware/auth-middleware.js";

const router = Router();

// javno
router.get("/", getAllEvents);

// organizer (mora prije /:id)
router.get("/organizer/my-events", requireOrganizer, getOrganizerEvents);
router.post("/organizer/create", requireOrganizer, createEvent);
router.put("/organizer/:id", requireOrganizer, updateEvent);
router.delete("/organizer/:id", requireOrganizer, deleteOrganizerEvent);
router.get("/organizer/:eventId/reservations", requireOrganizer, getEventReservations);
router.get("/organizer/:eventId/sales-progress", requireOrganizer, getEventSalesProgress);

// admin
router.delete("/:id", requireAdmin, deleteEventById);

// pojedinacni event (uvijek na kraju)
router.get("/:id", getEventById);

export default router;
