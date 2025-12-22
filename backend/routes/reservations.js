import { Router } from "express";
import {
  createReservation,
  getUserReservations,
  deleteReservation,
  getReservationById
} from "../controllers/reservations-controller.js";
import { requireAuth } from "../middleware/auth-middleware.js";

const router = Router();

router.use(requireAuth);

router.get("/", getUserReservations);

router.get("/:reservationId", getReservationById);

router.post("/events/:eventId", createReservation);

router.delete("/:reservationId", deleteReservation);

export default router;
