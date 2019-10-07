const spawn = require("child_process").spawn;
const os = require("os");
const path = require("path");

const workerName = function() {
  switch (os.platform()) {
    case "win32":
      return path.resolve(__dirname, "bin/worker.windows");
    case "linux":
      return path.resolve(__dirname, "bin/worker.linux");
    case "darwin":
      return path.resolve(__dirname, "bin/worker.mac");
    default:
      return path.resolve(__dirname, "bin/worker.windows");
  }
};

const spawnWorker = function(startMsg) {
  let serverSpawnProcess = spawn(workerName(), [
    "-workerId",
    startMsg.id,
    "-port",
    startMsg.port
  ]);
  serverSpawnProcess.on("exit", function(code) {
    process.exit();
  });
  serverSpawnProcess.stdout.on("data", function(data) {
    console.log("stdout: " + data);
  });
  serverSpawnProcess.stderr.on("data", function(data) {
    if (data.includes("started")) {
      process.send(startMsg.port);
    }
    console.log("stdout: " + data);
  });
};

module.exports = function childProcess() {
  process.on("message", function(startMsg) {
    // Spawn a worker with the given config
    spawnWorker(startMsg);
  });
};
