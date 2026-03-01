// routes/demo.js
import { Router } from "express";
import { seedDemoData } from "../controllers/seed-demo-data.js";

const router = Router();

// ✅ Privremeno ukloni uslov — dovoljno je da se ne postavi u produkcijsko okruženje
router.post("/seed", seedDemoData);

export default router;