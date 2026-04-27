import express, { type Express } from "express";
import cors from "cors";
import compression from "compression";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
const isProduction = process.env.NODE_ENV === "production";
if (isProduction) {
  app.set("trust proxy", 1);
}

const SESSION_SECRET = process.env.SESSION_SECRET;
if (isProduction && !SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required in production");
}

if (process.env.DATABASE_URL) {
  const bootstrapPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  bootstrapPool
    .query(
      `CREATE TABLE IF NOT EXISTS "user_sessions" (
         "sid" varchar NOT NULL COLLATE "default",
         "sess" json NOT NULL,
         "expire" timestamp(6) NOT NULL,
         CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("sid")
       );
       CREATE INDEX IF NOT EXISTS "IDX_user_sessions_expire" ON "user_sessions" ("expire");`,
    )
    .then(() => bootstrapPool.end())
    .catch((err) => {
      logger.error({ err }, "Failed to ensure user_sessions table");
      bootstrapPool.end().catch(() => {});
    });
}
app.use(compression());

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ extended: true, limit: "200mb" }));

const PgSession = connectPgSimple(session);
const sessionStore = process.env.DATABASE_URL
  ? new PgSession({
      conObject: { connectionString: process.env.DATABASE_URL },
      tableName: "user_sessions",
      createTableIfMissing: false,
    })
  : undefined;

if (!sessionStore) {
  logger.warn(
    "DATABASE_URL not set — falling back to in-memory session store (sessions will be lost on restart).",
  );
}

app.use(
  session({
    store: sessionStore,
    secret: SESSION_SECRET ?? "vida-refrigeracao-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProduction,
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

app.use("/api", router);

export default app;
