import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import * as ReviewController from "../controllers/review.controller.js";

const router = Router();

router.post("/:fileId/submit", authenticate, ReviewController.submitForReview);
router.post(
  "/:fileId/approve",
  authenticate,
  authorize("admin"),
  ReviewController.approve
);
router.post(
  "/:fileId/reject",
  authenticate,
  authorize("admin"),
  ReviewController.reject
);
router.get("/:fileId", authenticate, ReviewController.getReviews);

export default router;
