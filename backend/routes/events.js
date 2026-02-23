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
  getEventSalesProgress,
  getEventTimeStats
} from "../controllers/events-controller.js";

import { requireAdmin, requireOrganizer } from "../middleware/auth-middleware.js";
import { upload } from "../middleware/upload.js";

const router = Router();

// javno
router.get("/", getAllEvents);

// organizer (mora prije /:id)
router.get("/organizer/my-events", requireOrganizer, getOrganizerEvents);

// ✅ CREATE: upload.array za više slika (max 10)
router.post("/organizer/create", requireOrganizer, upload.array("images", 10), createEvent);

// ✅ UPDATE: takođe upload.array za više slika (max 10)
router.put("/organizer/:id", requireOrganizer, upload.array("images", 10), updateEvent);

router.delete("/organizer/:id", requireOrganizer, deleteOrganizerEvent);
router.get("/organizer/:eventId/reservations", requireOrganizer, getEventReservations);
router.get("/organizer/:eventId/sales-progress", requireOrganizer, getEventSalesProgress);
router.get("/organizer/:eventId/time-stats", requireOrganizer, getEventTimeStats);

// admin
router.delete("/:id", requireAdmin, deleteEventById);

// pojedinacni event (uvijek na kraju)
router.get("/:id", getEventById);

export default router;