import { File, Review } from "../models/index.js";

export const submitForReview = async (req, res) => {
  const { fileId } = req.params;
  const file = await File.findByPk(fileId);
  if (!file) return res.status(404).json({ message: "File not found" });
  if (file.userId !== req.user.sub)
    return res.status(403).json({ message: "Forbidden" });
  await file.update({ status: "pending" });
  res.json({ message: "Submitted for review" });
};

export const approve = async (req, res) => {
  const { fileId } = req.params;
  const review = await Review.create({
    fileId,
    reviewerId: req.user.sub,
    decision: "approved",
  });
  await (await review.getFile()).update({ status: "approved" });
  res.json({ message: "Approved" });
};

export const reject = async (req, res) => {
  const { fileId } = req.params;
  const { comments } = req.body;
  const review = await Review.create({
    fileId,
    reviewerId: req.user.sub,
    decision: "rejected",
    comments,
  });
  await (await review.getFile()).update({ status: "rejected" });
  res.json({ message: "Rejected" });
};

export const getReviews = async (req, res) => {
  const { fileId } = req.params;
  const reviews = await Review.findAll({
    where: { fileId },
    order: [["createdAt", "DESC"]],
  });
  res.json(reviews);
};
