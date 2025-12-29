// routes/role-requests.js
import express from "express";
import { createRoleRequest } from "../controllers/role-request-controller.js";
import { requireAuth } from "../middleware/auth-middleware.js";

const router = express.Router();

router.post("/", requireAuth, createRoleRequest);

export default router;