import { Router } from "express";
import { requireAuth } from "../middleware/auth-middleware.js";
import {
  getMyNotifications,
  markAllRead,
  markOneRead,
} from "../controllers/notifications-controller.js";

const router = Router();

router.get("/", requireAuth, getMyNotifications);          // list
router.patch("/read-all", requireAuth, markAllRead);
router.patch("/:id/read", requireAuth, markOneRead);
    

// mark one read

export default router;
