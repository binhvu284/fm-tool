import { Sequelize } from "sequelize";
import logger from "../utils/logger.js";
import { initJsonDb } from "../utils/jsonDb.js";

const useMemory = process.env.USE_INMEMORY_STORAGE === "true";

let sequelize;
let initDatabase;

if (useMemory) {
  sequelize = null;
  initDatabase = async () => {
    logger.info("DB disabled (USE_INMEMORY_STORAGE=true). Initializing JSON DB...");
    await initJsonDb();
    logger.info("JSON DB initialized.");
  };
} else {
  const {
    DB_HOST = "localhost",
    DB_PORT = "3306",
    DB_NAME = "fm_tool",
    DB_USER = "root",
    DB_PASSWORD = "",
    NODE_ENV = "development",
    DB_MAX_RETRIES = "20",
    DB_RETRY_DELAY_MS = "3000",
  } = process.env;

  sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
    host: DB_HOST,
    port: Number(DB_PORT),
    dialect: "mysql",
    logging: (msg) => NODE_ENV !== "production" && logger.debug(msg),
  });

  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

  initDatabase = async () => {
    const max = Number(DB_MAX_RETRIES);
    const delay = Number(DB_RETRY_DELAY_MS);
    for (let attempt = 1; attempt <= max; attempt++) {
      try {
        await sequelize.authenticate();
        await import("../models/index.js"); // initialize associations
        await sequelize.sync(); // for dev; use migrations in prod
        logger.info("Database connected and synced");
        return;
      } catch (error) {
        logger.error("Database connection failed", {
          attempt,
          max,
          error: error.message,
        });
        if (attempt === max) throw error;
        await sleep(delay);
      }
    }
  };
}

export { sequelize, initDatabase };
