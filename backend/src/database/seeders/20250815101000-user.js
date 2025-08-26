/** @type {import('sequelize-cli').Seeder} */
const bcrypt = require("bcryptjs");

module.exports = {
  async up(queryInterface) {
    const hash = await bcrypt.hash("password123", 10);
    await queryInterface.bulkInsert("Users", [
      {
        email: "uploader@example.com",
        passwordHash: hash,
        role: "uploader",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        email: "approver@example.com",
        passwordHash: hash,
        role: "approver",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("Users", null, {});
  },
};
