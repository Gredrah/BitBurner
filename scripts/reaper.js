import { getRootedServers } from "scripts/network.js"
import { getAllOtherProcesses } from "scripts/util.js"

const master = "scripts/master_deploy.js"
const hackPattern = "scripts/hack_pattern.js";

/** @param {NS} ns */
export async function reaper(ns, targetToKill = null) {
  if (!targetToKill) {
    const targets = getAllOtherProcesses(ns, ns.getHostname());

    if (targets.length > 0) {
      targetToKill = targets[0].filename;
    } else {
      ns.tprint(`No potential targets on ${ns.getHostname()}.`);
      return;
    }
  }

  ns.tprint(`Reaping all instances of: ${targetToKill}`);

  const network = await getRootedServers(ns);
  let killCount = 0;

  for (const host of network.rooted) {
    const hostProcesses = ns.ps(host);
    for (const proc of hostProcesses) {
      if (proc.filename === targetToKill) {
        ns.scriptKill(proc.filename, host);
        killCount++;
      }
    }
  }

  ns.tprint(`Reaper Results:`);
  ns.tprint(`Terminated ${killCount} instances of ${targetToKill} across rooted network.`)
}

/** @Param {NS} ns */
export async function reaperMaster(ns) {
  /**
  const processes = ns.ps();

  ns.tprint(`Master reaped on main if present.`);
  for (let script of processes) {
    if (script.filename === master){
      ns.scriptKill(master, "home");
    }
  }
  */
  
  await reaper(ns, hackPattern);
  await reaper(ns, master);

  ns.tprint(`Master Reaper: Cleaned ${master} and all ${hackPattern} from the network.`);
}

/** @Param {NS} ns */
export async function main(ns) {
  if (ns.args[0] === "master") {
    await reaperMaster(ns);
  } else if (ns.args[0] === "hack") {
    await reaper(ns, hackPattern);
  } else {
    await reaper(ns, ns.args[0]);
  }
}