const env = process.env;
export const config = {
  port: Number(env.PORT ?? 8080),
  databaseUrl: env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/placementos",
  databaseSsl: env.DATABASE_SSL ? env.DATABASE_SSL === "true" : /\.render\.com|sslmode=require/.test(env.DATABASE_URL ?? ""),
  publicBaseUrl: (env.PUBLIC_BASE_URL ?? env.RENDER_EXTERNAL_URL ?? `http://localhost:${env.PORT ?? 8080}`).replace(/\/$/, ""),
  adminEmail: env.ADMIN_EMAIL ?? "admin@placementos.app",
  adminPassword: env.ADMIN_PASSWORD ?? "",
  sessionSecret: env.SESSION_SECRET ?? "",
  mcpSecret: env.MCP_SECRET ?? "",
  corsOrigins: (env.CORS_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  isProd: env.NODE_ENV === "production",
};
export function assertProdConfig() {
  const missing = ["ADMIN_PASSWORD", "SESSION_SECRET", "MCP_SECRET", "DATABASE_URL"].filter((k) => !process.env[k]);
  if (!process.env.PUBLIC_BASE_URL && !process.env.RENDER_EXTERNAL_URL) missing.push("PUBLIC_BASE_URL");
  if (missing.length) throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  if (!/^[A-Za-z0-9_-]+$/.test(env.MCP_SECRET ?? "")) throw new Error("MCP_SECRET may only contain letters, digits, - and _ (it is used as a URL path segment)");
  if ((env.MCP_SECRET ?? "").length < 24) throw new Error("MCP_SECRET must be at least 24 characters");
}
