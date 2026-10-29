// Runs an import Edge Function once against the local Supabase.
//   npm run db:import            → import-regie (prices; otherwise every 15 min by pg_cron)
//   npm run db:import-vehicles   → import-nrcan (vehicle models; a few times a year)
import { execFileSync } from "node:child_process";

const FUNCTIONS = ["import-regie", "import-nrcan"];
const name = process.argv[2] ?? "import-regie";
if (!FUNCTIONS.includes(name)) throw new Error(`Unknown function "${name}": ${FUNCTIONS.join(", ")}`);

// `supabase status -o env` prints KEY="value" lines for the running local stack.
const status = execFileSync("npx", ["supabase", "status", "-o", "env"], { encoding: "utf8" });
const env = Object.fromEntries(
  status
    .split("\n")
    .map((line) => line.match(/^([A-Z_]+)="(.*)"$/))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map(([, key, value]) => [key, value]),
);
if (!env.API_URL || !env.SERVICE_ROLE_KEY) {
  throw new Error("Local Supabase is not running: npm run db:start");
}

const response = await fetch(`${env.API_URL}/functions/v1/${name}`, {
  method: "POST",
  headers: { Authorization: `Bearer ${env.SERVICE_ROLE_KEY}` },
});
console.log(`HTTP ${response.status}`, JSON.stringify(await response.json(), null, 2));
if (!response.ok) process.exitCode = 1;
