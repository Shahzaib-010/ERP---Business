// One-time setup: creates the first Superadmin account.
//
//   npm run create-superadmin
//
// Reads MONGODB_URI and SESSION_SECRET from .env.local. Asks for the name, username and
// password in the terminal (the password is not shown). Refuses if a Superadmin exists.
import { createInterface } from "node:readline";
import mongoose from "mongoose";
import { createInitialSuperadmin } from "@/server/services/users";

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // Print the prompt, then swallow the typed characters.
      rl._writeToOutput = (s) => {
        if (s.includes(question)) process.stdout.write(s);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log("Create the first Superadmin account.\n");
  const name = await ask("Full name: ");
  const username = await ask("Username: ");
  const password = await ask("Password (min 8 characters): ", { hidden: true });
  const repeat = await ask("Repeat password: ", { hidden: true });
  if (password !== repeat) throw new Error("The passwords do not match.");

  const user = await createInitialSuperadmin({ name, username, password });
  console.log(`\nSuperadmin "${user.username}" created. Log in at /login.`);
}

main()
  .catch((err) => {
    const details = err.fieldErrors ? ` ${JSON.stringify(err.fieldErrors)}` : "";
    console.error(`\nNot created: ${err.message}${details}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
