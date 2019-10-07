const cluster = require("cluster");
const numCPUs = require("os").cpus().length;
const axios = require("axios");
const fs = require("fs");

let workers = {};
let sampleToGather = 150;
let samples = [];
if (cluster.isMaster) {
  masterProcess();
} else {
  require("./spawn")();
}

function masterProcess() {
  console.log(`Master ${process.pid} is running`);
  let start = new Date().getTime();
  let port = 3000;
  // Fork workers. One per CPU for maximum effectiveness
  for (var i = 0; i < Math.max(numCPUs * 4, 16); i++) {
    port += 1;
    const worker = cluster.fork();
    workers[worker.process.pid] = {
      port,
      worker,
      id: i + 1,
      deathCount: 0
    };
    worker.send({
      port,
      id: i + 1
    });
  }

  cluster.on("exit", function(deadWorker) {
    // Restart the worker
    const worker = cluster.fork();

    // Note the process IDs
    const oldPID = deadWorker.process.pid;
    const newPID = worker.process.pid;

    // Note the old workers port and ID
    const oldPort = workers[oldPID].port;
    const oldId = workers[oldPID].id;
    const deathCount = workers[oldPID].deathCount + 1;

    // Delete the old worker object
    delete workers[oldPID];

    // Add the new worker object
    workers[newPID] = {
      port: oldPort,
      worker,
      id: oldId,
      deathCount
    };

    worker.send({
      port: oldPort,
      id: oldId
    });

    // Log the event
    console.group("WORKER DIED");
    let details = [
      {
        OldPID: oldPID,
        NewPID: newPID,
        PORT: oldPort,
        ID: oldId,
        DeathCount: deathCount
      }
    ];
    console.table(details);
    console.groupEnd();
  });

  cluster.on("message", (_worker, port) => {
    setTimeout(async () => {
      // console.log(port);
      let response = await axios({
        method: "get",
        responseType: "stream",
        url: `http://localhost:${port}/rnd?n=5`
      });
      response.data.on("data", function(data) {
        samples.push(data.toString());
        if (samples.length >= sampleToGather) {
          fs.writeFileSync("random.txt", samples.join(""));
          let end = new Date().getTime();
          console.group("WORKERS FINAL STATS");
          console.table(
            Object.keys(workers)
              .map(key => {
                let w = workers[key];
                return {
                  PORT: w.port,
                  ID: w.id,
                  DeathCount: w.deathCount
                };
              })
              .sort((a, b) => a.PORT - b.PORT)
          );
          console.log(`Time Taken: ${end - start}ms.`);
          console.groupEnd();
          process.exit();
        }
      });
    }, 0);
  });
}
