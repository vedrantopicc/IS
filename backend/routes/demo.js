// routes/demo.js
import { Router } from "express";
import { seedDemoData } from "../controllers/seed-demo-data.js";

const router = Router();

// ✅ Privremeno ukloni uslov — dovoljno je da se ne deployuje u produkciju
router.post("/seed", seedDemoData);

export default router;