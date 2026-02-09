import express from "express";
import usersRouter from "./routes/users.js";
import authRouter from "./routes/auth.js";
import eventsRouter from "./routes/events.js";
import adminRouter from "./routes/admin.js";
import reservationsRouter from "./routes/reservations.js";
import commentsRouter from "./routes/comments.js";
import cors from "cors";
import demoRouter from "./routes/demo.js"; // ← novi import
import roleRequestRoutes from "./routes/role-requests.js";
import categoriesRouter from "./routes/categories.js";



const app = express();
app.use(cors({
  origin: /^http:\/\/localhost:\d+$/,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

app.use("/auth", authRouter);
app.use("/users", usersRouter);
app.use("/events", eventsRouter);
app.use("/categories", categoriesRouter);
app.use("/admin", adminRouter);
app.use("/reservations", reservationsRouter);
app.use("/comments", commentsRouter);
app.use("/demo", demoRouter); // ← novi demo endpoint (samo u developmentu)
app.use("/role-requests", roleRequestRoutes);


app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || "Internal Server Error" });
});

export default app;