import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import os from "node:os";
import { logger } from "../lib/logger.js";

export type DbType = "postgres" | "mariadb" | "mysql" | "mongodb";

export interface DbCredentials {
  type: DbType;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  connectionString: string;
}

interface ParsedUrl {
  protocol: string;
  username: string;
  password: string;
  host: string;
  port: number;
  database: string;
}

// --- .env loader ---

function loadEnvFile(): Record<string, string> {
  const envPaths = [
    path.join(process.env.HOME || "", ".openclaw", "setfarm-repo", "scripts", ".env"),
    path.join(process.env.HOME || "", ".openclaw", "workspace", "scripts", ".env"),
  ];

  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, "utf-8").split("\n");
      const vars: Record<string, string> = {};
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        vars[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
      }
      return vars;
    }
  }
  return {};
}

// --- URL parser ---

function parseDbUrl(url: string): ParsedUrl {
  // postgresql://user:pass@host:port/db
  // mariadb://user:pass@host:port/db
  // mysql://user:pass@host:port/db
  // mongodb://user:pass@host:port
  const m = url.match(/^(\w+):\/\/([^:]+?):(.+)@([^:\/]+):(\d+)(?:\/(.*))?$/);
  if (!m) throw new Error(`Invalid DB URL format (check scripts/.env)`);
  return {
    protocol: m[1],
    username: m[2],
    password: m[3],
    host: m[4],
    port: parseInt(m[5], 10),
    database: m[6] || "",
  };
}

// --- Name sanitizer ---

function sanitizeDbName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 50);
}

// --- Master URL resolver ---

function getMasterUrl(dbType: DbType): string {
  const env = loadEnvFile();
  const envKeys: Record<DbType, string> = {
    postgres: "MASTER_POSTGRES_URL",
    mariadb: "MASTER_MARIADB_URL",
    mysql: "MASTER_MYSQL_URL",
    mongodb: "MASTER_MONGODB_URL",
  };

  // Also check process.env
  const key = envKeys[dbType];
  const url = env[key] || process.env[key];
  if (!url) throw new Error(`Master ${dbType} URL not found. Set ${key} in scripts/.env`);
  return url;
}

// --- Detect DB type from context ---

export function resolveDbType(dbRequired: string): DbType {
  if (!dbRequired || typeof dbRequired !== "string" || dbRequired.trim() === "") return "postgres";
  const lower = dbRequired.toLowerCase().trim();
  if (lower === "mariadb" || lower === "maria") return "mariadb";
  if (lower === "mysql") return "mysql";
  if (lower === "mongodb" || lower === "mongo") return "mongodb";
  // Default: postgres for "true", "yes", "postgres", "postgresql"
  return "postgres";
}

// --- PostgreSQL provisioning ---

function provisionPostgres(master: ParsedUrl, dbName: string, dbUser: string, dbPass: string): void {
  // Use PGPASSWORD env var instead of embedding master password in connection string
  // Security: prevents credential exposure via /proc/*/cmdline
  const pgEnv = { ...process.env, PGPASSWORD: master.password };
  const connArgs = ["-h", master.host, "-p", String(master.port), "-U", master.username, "-d", master.database || "postgres"];

  // Escape single quotes in password for SQL string literals
  const escapedPass = dbPass.replace(/'/g, "''");

  // Create role if not exists, update password if exists
  execFileSync("psql", [...connArgs, "-c",
    `DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${dbUser}') THEN CREATE ROLE "${dbUser}" WITH LOGIN PASSWORD '${escapedPass}'; ELSE ALTER ROLE "${dbUser}" WITH PASSWORD '${escapedPass}'; END IF; END $$;`
  ], { timeout: 15000, stdio: "pipe", env: pgEnv });

  // Create database if not exists
  execFileSync("psql", [...connArgs, "-c",
    `DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_database WHERE datname = '${dbName}') THEN EXECUTE 'CREATE DATABASE "${dbName}" OWNER "${dbUser}"'; END IF; END $$;`
  ], { timeout: 15000, stdio: "pipe", env: pgEnv });

  // Grant privileges
  execFileSync("psql", [...connArgs, "-c",
    `GRANT ALL PRIVILEGES ON DATABASE "${dbName}" TO "${dbUser}";`
  ], { timeout: 10000, stdio: "pipe", env: pgEnv });
}

// --- MySQL/MariaDB provisioning ---

function provisionMysql(master: ParsedUrl, dbName: string, dbUser: string, dbPass: string): void {
  const args = [
    `-h`, master.host,
    `-P`, String(master.port),
    `-u`, master.username,
    // MYSQL_PWD env var used instead of --password= (security: prevents /proc/*/cmdline exposure)
    `-e`,
    `CREATE DATABASE IF NOT EXISTS \`${dbName}\`; ` +
    `CREATE USER IF NOT EXISTS '${dbUser}'@'%' IDENTIFIED BY '${dbPass}'; ` +
    `GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${dbUser}'@'%'; ` +
    `FLUSH PRIVILEGES;`
  ];

  execFileSync("mysql", args, { timeout: 15000, stdio: "pipe", env: { ...process.env, MYSQL_PWD: master.password } });
}

// --- MongoDB provisioning ---

function provisionMongodb(master: ParsedUrl, dbName: string, dbUser: string, dbPass: string): void {
  const connStr = `mongodb://${master.username}:${master.password}@${master.host}:${master.port}`;

  const script = `
    db = db.getSiblingDB('${dbName}');
    if (db.getUsers({filter: {user: '${dbUser}'}}).users.length === 0) {
      db.createUser({
        user: '${dbUser}',
        pwd: '${dbPass}',
        roles: [{role: 'readWrite', db: '${dbName}'}]
      });
    }
  `;

  // Write to temp file instead of --eval to prevent JS injection
  const tmpFile = path.join(os.tmpdir(), `mongo-provision-${Date.now()}.js`);
  fs.writeFileSync(tmpFile, script, "utf-8");
  try {
    execFileSync("mongosh", [connStr, "--file", tmpFile], { timeout: 15000, stdio: "pipe" });
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* cleanup best effort */ }
  }
}

// --- Main provisioning function ---

export function provisionDatabase(projectName: string, dbType?: DbType): DbCredentials {
  const type = dbType || "postgres";
  const masterUrl = getMasterUrl(type);
  const master = parseDbUrl(masterUrl);

  const baseName = sanitizeDbName(projectName);
  const dbName = baseName + "_dev";
  const dbUser = baseName + "_user";
  const dbPass = crypto.randomBytes(24).toString("base64url");

  logger.info(`[db-provision] Provisioning ${type} DB: ${dbName} @ ${master.host}:${master.port}`);

  switch (type) {
    case "postgres":
      provisionPostgres(master, dbName, dbUser, dbPass);
      break;
    case "mariadb":
    case "mysql":
      provisionMysql(master, dbName, dbUser, dbPass);
      break;
    case "mongodb":
      provisionMongodb(master, dbName, dbUser, dbPass);
      break;
  }

  // Build connection string
  let connectionString: string;
  switch (type) {
    case "postgres":
      connectionString = `postgresql://${dbUser}:${dbPass}@${master.host}:${master.port}/${dbName}`;
      break;
    case "mariadb":
      connectionString = `mariadb://${dbUser}:${dbPass}@${master.host}:${master.port}/${dbName}`;
      break;
    case "mysql":
      connectionString = `mysql://${dbUser}:${dbPass}@${master.host}:${master.port}/${dbName}`;
      break;
    case "mongodb":
      connectionString = `mongodb://${dbUser}:${dbPass}@${master.host}:${master.port}/${dbName}?authSource=${dbName}`;
      break;
  }

  const creds: DbCredentials = {
    type,
    host: master.host,
    port: master.port,
    database: dbName,
    username: dbUser,
    password: dbPass,
    connectionString,
  };

  logger.info(`[db-provision] Done: ${type}://${dbUser}@${master.host}:${master.port}/${dbName}`);
  return creds;
}
