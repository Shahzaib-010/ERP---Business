// One-time setup: creates the first Superadmin account.
//
//   npm run create-superadmin          (local database, reads .env.local)
//   npm run create-superadmin:prod     (live database, reads .env.prod)
//
// Reads MONGODB_URI and SESSION_SECRET from that env file. Asks for the name, username and
// password in the terminal (the password is not shown). Refuses if a Superadmin exists.
import { createInterface } from "node:readline";
import mongoose from "mongoose";
import { createInitialSuperadmin } from "@/server/services/users";

// In a terminal, keys are read one at a time (raw mode): passwords show "*" per character,
// Backspace works and Ctrl+C cancels. Piped input (tests, scripts) is read line by line.
// (Earlier readline-based versions echoed or swallowed input in PowerShell.)
function askTty(question, { mask }) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    let value = "";
    process.stdout.write(question);
    const finish = () => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write("\n");
    };
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          finish();
          return resolve(value.trim());
        }
        if (ch === "\u0003") {
          finish();
          return reject(new Error("Cancelled."));
        }
        if (ch === "\b" || ch === "\u007f") {
          if (value) {
            value = value.slice(0, -1);
            process.stdout.write("\b \b");
          }
          continue;
        }
        if (ch < " ") continue; // ignore other control keys (arrows etc.)
        value += ch;
        process.stdout.write(mask ? "*" : ch);
      }
    };
    stdin.setEncoding("utf8");
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

let pipedLines;
async function askPiped(question) {
  process.stdout.write(question);
  pipedLines ??= createInterface({ input: process.stdin, terminal: false })[Symbol.asyncIterator]();
  const { value, done } = await pipedLines.next();
  process.stdout.write("\n");
  if (done) throw new Error("No answer given.");
  return value.trim();
}

function ask(question, { hidden = false } = {}) {
  return process.stdin.isTTY ? askTty(question, { mask: hidden }) : askPiped(question);
}

async function main() {
  console.log("Create the first Superadmin account.\n");
  const name = await ask("Full name: ");
  const username = await ask("Username: ");
  const password = await ask("Password (min 8 characters): ", { hidden: true });
  const repeat = await ask("Repeat password: ", { hidden: true });
  process.stdin.destroy();
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
