import { execFileSync } from "node:child_process";

export default async function globalSetup() {
  for (const script of ["seed:noir1", "seed:food1"]) {
    execFileSync("npm", ["run", script], {
      stdio: "inherit",
      env: process.env,
    });
  }
}
