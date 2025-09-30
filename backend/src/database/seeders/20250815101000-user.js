/** @type {import('sequelize-cli').Seeder} */
const bcrypt = require("bcryptjs");

module.exports = {
  async up(queryInterface) {
    const hash = await bcrypt.hash("password123", 10);
    await queryInterface.bulkInsert("Users", [
        {
          email: "agent@example.com",
          passwordHash: hash,
          role: "agent",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
          email: "admin@example.com",
          passwordHash: hash,
          role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("Users", null, {});
  },
};
