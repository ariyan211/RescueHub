import { Router } from "express";
import * as admin from "../controllers/admin.controller.js";
import * as auth from "../controllers/auth.controller.js";
import * as pub from "../controllers/public.controller.js";
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
 *  delete, manage users                                    ✓
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

adminRouter.get("/analytics", admin.analytics);

adminRouter.get("/users", auth.listUsers);
adminRouter.post("/users", requireRole("ADMIN"), auth.createUser);

api.use("/admin", adminRouter);
