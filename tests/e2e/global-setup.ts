import { execFileSync } from "node:child_process";

export default async function globalSetup() {
  execFileSync("npm", ["run", "seed:noir1"], {
    stdio: "inherit",
    env: process.env,
  });
}
