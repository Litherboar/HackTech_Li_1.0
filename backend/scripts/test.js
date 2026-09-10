const { spawn } = require("child_process");
const env = require("../src/config/env");

const baseUrl = process.env.API_BASE_URL || `http://localhost:${env.port}`;
const healthUrl = `${baseUrl}/api/health`;

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function isServerRunning() {
  try {
    const response = await fetch(healthUrl);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer(child) {
  const timeoutAt = Date.now() + 10000;

  while (Date.now() < timeoutAt) {
    if (child.exitCode !== null) {
      throw new Error(`Backend exited before becoming ready (code ${child.exitCode})`);
    }

    if (await isServerRunning()) {
      return;
    }

    await delay(200);
  }

  throw new Error(`Backend did not become ready at ${healthUrl}`);
}

function stopServer(child) {
  if (child && child.exitCode === null) {
    child.kill();
  }
}

async function main() {
  let server = null;

  if (!(await isServerRunning())) {
    server = spawn(process.execPath, ["src/server.js"], {
      stdio: "inherit",
      env: process.env
    });

    await waitForServer(server);
  }

  const test = spawn(process.execPath, [
    "--test",
    "--test-concurrency=1",
    "tests/smoke.api.test.js"
  ], {
    stdio: "inherit",
    env: process.env
  });

  const exitCode = await new Promise((resolve, reject) => {
    test.on("error", reject);
    test.on("exit", (code, signal) => {
      resolve(code ?? (signal ? 1 : 0));
    });
  });

  stopServer(server);
  process.exitCode = exitCode;
}

main().catch((error) => {
  console.error(`[test] ${error.message}`);
  process.exitCode = 1;
});