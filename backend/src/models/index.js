import { DataTypes } from "sequelize";
import { sequelize } from "../database/index.js";

// In-memory stores for testing when DB is disabled
export const memory = {
  files: [],
  nextFileId: 1,
  users: [{ id: 1, email: "dev@example.com", role: "admin" }],
  reviews: [],
  signatures: [],
};

let User, File, Signature, Review;

if (sequelize) {
  User = sequelize.define("User", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    passwordHash: { type: DataTypes.STRING, allowNull: false },
    role: {
      type: DataTypes.ENUM("agent", "admin"),
      defaultValue: "agent",
    },
  });

  File = sequelize.define("File", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    originalName: { type: DataTypes.STRING, allowNull: false },
    storedName: { type: DataTypes.STRING, allowNull: false },
    size: { type: DataTypes.INTEGER, allowNull: false },
    mimeType: { type: DataTypes.STRING, allowNull: false },
    status: {
      type: DataTypes.ENUM("pending", "approved", "rejected", "processed"),
      defaultValue: "pending",
    },
    watermarkApplied: { type: DataTypes.BOOLEAN, defaultValue: false },
    signatureApplied: { type: DataTypes.BOOLEAN, defaultValue: false },
  });

  Signature = sequelize.define("Signature", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    type: { type: DataTypes.ENUM("digital", "watermark"), allowNull: false },
    details: { type: DataTypes.JSON, allowNull: false },
  });

  Review = sequelize.define("Review", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    decision: {
      type: DataTypes.ENUM("approved", "rejected"),
      allowNull: false,
    },
    comments: { type: DataTypes.TEXT },
  });

  // Associations
  User.hasMany(File, { foreignKey: "userId" });
  File.belongsTo(User, { foreignKey: "userId" });

  User.hasMany(Review, { foreignKey: "reviewerId" });
  Review.belongsTo(User, { as: "reviewer", foreignKey: "reviewerId" });

  File.hasMany(Review, { foreignKey: "fileId" });
  Review.belongsTo(File, { foreignKey: "fileId" });

  File.hasMany(Signature, { foreignKey: "fileId" });
  Signature.belongsTo(File, { foreignKey: "fileId" });
}

export { User, File, Signature, Review };
