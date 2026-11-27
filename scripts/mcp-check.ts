// Usage: MCP_URL=https://<host>/mcp/<secret> npx tsx scripts/mcp-check.ts [--create-demo]
// Connects as a real MCP client, lists the tools, and (optionally) creates a demo draft drive.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const url = process.env.MCP_URL;
if (!url) { console.error("Set MCP_URL"); process.exit(1); }
const c = new Client({ name: "mcp-check", version: "1.0.0" });
await c.connect(new StreamableHTTPClientTransport(new URL(url)));
console.log("tools:", (await c.listTools()).tools.map((t) => t.name).join(", "));
if (process.argv.includes("--create-demo")) {
  const r = await c.callTool({ name: "create_drive", arguments: {
    company: "Northwind Systems", title: "Associate Software Engineer", description: "Work on cloud-native services with a mentor-led onboarding track.",
    eligibleDepartments: ["CSE", "IT", "ECE"], graduationYear: 2027, minCgpa: 7.0, maxBacklogs: 0, ctc: "10 LPA", location: "Bengaluru",
    registrationDeadline: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10), rounds: ["Online Assessment", "Technical Interview", "HR Interview"] } });
  console.log((r.content as any)[0].text);
}
await c.close();
