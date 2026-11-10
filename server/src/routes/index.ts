import { Router } from "express";
import * as admin from "../controllers/admin.controller.js";
import * as auth from "../controllers/auth.controller.js";
import * as pub from "../controllers/public.controller.js";
import * as team from "../controllers/team.controller.js";
import { COORDINATORS, STAFF, requireAuth, requireRole } from "../middleware/auth.js";
import {
  loginLimiter,
  publicReadLimiter,
  reportLimiter,
  trackLimiter,
  uploadLimiter,
} from "../middleware/rateLimit.js";

/**
 * Permission matrix
 *
 *                         public  RESPONDER  DISPATCHER  ADMIN
 *  report / track / map     ✓        ✓          ✓          ✓
 *  list / view / notes               ✓          ✓          ✓
 *  change status                     ✓          ✓          ✓
 *  self-assign                       ✓          ✓          ✓
 *  assign others                                ✓          ✓
 *  verification / severity                      ✓          ✓
 *  view teams, recommendations, routes ✓        ✓          ✓
 *  add / edit teams, availability               ✓          ✓
 *  assign / unassign / reassign teams           ✓          ✓
 *  delete, manage users, delete teams                      ✓
 */
export const api = Router();

// ---------- Public ----------
const incidents = Router();
incidents.post("/report", reportLimiter, pub.report);
incidents.get("/track/:trackingCode", trackLimiter, pub.track);
incidents.get("/nearby", publicReadLimiter, pub.nearby);
incidents.get("/hotspots", publicReadLimiter, pub.hotspots);
incidents.get("/summary", publicReadLimiter, pub.summary);
api.use("/incidents", incidents);

api.post("/uploads/presigned-url", uploadLimiter, pub.presign);

// ---------- Auth ----------
api.post("/auth/login", loginLimiter, auth.login);
api.get("/auth/me", requireAuth, auth.me);

// ---------- Staff console ----------
const adminRouter = Router();
adminRouter.use(requireAuth, requireRole(...STAFF));

adminRouter.get("/incidents", admin.list);
adminRouter.get("/incidents/:id", admin.get);
adminRouter.patch("/incidents/:id/status", admin.updateStatus);
adminRouter.post("/incidents/:id/notes", admin.addNote);
adminRouter.patch("/incidents/:id/assignee", admin.assign); // responders: self-assign only (enforced in controller)
adminRouter.patch("/incidents/:id/verification", requireRole(...COORDINATORS), admin.updateVerification);
adminRouter.patch("/incidents/:id/severity", requireRole(...COORDINATORS), admin.updateSeverity);
adminRouter.delete("/incidents/:id", requireRole("ADMIN"), admin.remove);

// Response teams & location-based assignment (Round 2)
adminRouter.get("/teams", team.list);
adminRouter.get("/teams/:id", team.get);
adminRouter.post("/teams", requireRole(...COORDINATORS), team.create);
adminRouter.put("/teams/:id", requireRole(...COORDINATORS), team.update);
adminRouter.patch("/teams/:id/availability", requireRole(...COORDINATORS), team.setAvailability);
adminRouter.delete("/teams/:id", requireRole("ADMIN"), team.remove);
adminRouter.get("/incidents/:id/recommendations", team.recommend);
adminRouter.get("/incidents/:id/route", team.route);
adminRouter.post("/incidents/:id/assignments", requireRole(...COORDINATORS), team.assign);
adminRouter.delete("/incidents/:id/assignments/current", requireRole(...COORDINATORS), team.unassign);

adminRouter.get("/analytics", admin.analytics);

adminRouter.get("/users", auth.listUsers);
adminRouter.post("/users", requireRole("ADMIN"), auth.createUser);

api.use("/admin", adminRouter);
