import { Router } from "express";
import { 
  getAllEvents, 
  getEventById, 
  deleteEventById, 
  getOrganizerEvents,
  createEvent,
  updateEvent,
  deleteOrganizerEvent,
  getEventReservations
} from "../controllers/events-controller.js";
import { requireAdmin, requireAuth, requireOrganizer } from "../middleware/auth-middleware.js";

const router = Router();

router.get("/", getAllEvents);
router.get("/:id", getEventById);

router.delete("/:id", requireAdmin, deleteEventById);

router.get("/organizer/my-events", requireOrganizer, getOrganizerEvents);
router.post("/organizer/create", requireOrganizer, createEvent);
router.put("/organizer/:id", requireOrganizer, updateEvent);
router.delete("/organizer/:id", requireOrganizer, deleteOrganizerEvent);
router.get("/organizer/:eventId/reservations", requireOrganizer, getEventReservations);

export default router;
