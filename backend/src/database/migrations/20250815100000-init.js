/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Users", {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      email: { type: Sequelize.STRING, allowNull: false, unique: true },
      passwordHash: { type: Sequelize.STRING, allowNull: false },
      role: {
        type: Sequelize.ENUM("agent", "admin"),
        defaultValue: "agent",
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
    });

    await queryInterface.createTable("Files", {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      originalName: { type: Sequelize.STRING, allowNull: false },
      storedName: { type: Sequelize.STRING, allowNull: false },
      size: { type: Sequelize.INTEGER, allowNull: false },
      mimeType: { type: Sequelize.STRING, allowNull: false },
      status: {
        type: Sequelize.ENUM("pending", "approved", "rejected", "processed"),
        defaultValue: "pending",
      },
      userId: {
        type: Sequelize.INTEGER,
        references: { model: "Users", key: "id" },
        onDelete: "CASCADE",
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
    });

    await queryInterface.createTable("Signatures", {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      type: { type: Sequelize.ENUM("digital", "watermark"), allowNull: false },
      details: { type: Sequelize.JSON, allowNull: false },
      fileId: {
        type: Sequelize.INTEGER,
        references: { model: "Files", key: "id" },
        onDelete: "CASCADE",
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
    });

    await queryInterface.createTable("Reviews", {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      decision: {
        type: Sequelize.ENUM("approved", "rejected"),
        allowNull: false,
      },
      comments: { type: Sequelize.TEXT },
      fileId: {
        type: Sequelize.INTEGER,
        references: { model: "Files", key: "id" },
        onDelete: "CASCADE",
      },
      reviewerId: {
        type: Sequelize.INTEGER,
        references: { model: "Users", key: "id" },
        onDelete: "SET NULL",
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("Reviews");
    await queryInterface.dropTable("Signatures");
    await queryInterface.dropTable("Files");
    await queryInterface.dropTable("Users");
  },
};
