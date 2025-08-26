import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import * as ReviewController from "../controllers/review.controller.js";

const router = Router();

router.post("/:fileId/submit", authenticate, ReviewController.submitForReview);
router.post(
  "/:fileId/approve",
  authenticate,
  authorize("approver", "admin"),
  ReviewController.approve
);
router.post(
  "/:fileId/reject",
  authenticate,
  authorize("approver", "admin"),
  ReviewController.reject
);
router.get("/:fileId", authenticate, ReviewController.getReviews);

export default router;
