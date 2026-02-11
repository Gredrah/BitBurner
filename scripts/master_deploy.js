import { getRootedServers } from "scripts/network.js";
import { findBestTarget } from "scripts/solve.js";
import { reaperMaster } from "scripts/reaper.js"

/** @param {NS} ns */
export async function main(ns) {
  const homeReserve = 64;

  let hackRatio = 0.08;
  let growRatio = 0.76;
  let weakenRatio = 0.16;

  const hackScript = "scripts/hack.js";
  const growScript = "scripts/grow.js";
  const weakenScript = "scripts/weaken.js";

  const hackRam = ns.getScriptRam(hackScript);
  const growRam = ns.getScriptRam(growScript);
  const weakenRam = ns.getScriptRam(weakenScript);

  ns.tprint(`=== MASTER DEPLOY STARTING ===`);
  ns.tprint(`Hacking Ram / Thread: ${hackRam.toFixed(2)} GB | Growing Ram / Thread: ${growRam.toFixed(2)} GB | Weakening Ram / Thread: ${weakenRam.toFixed(2)} GB`);
  ns.tprint(`Home RAM Reserved: ${homeReserve} GB`);

  if (hackRam === 0 || growRam === 0 || weakenRam === 0) {
    ns.tprint(`ERROR:One or more scripts not found.`);
    return;
  } else {
    ns.tprint(`Cleaning network before deployment...`);
    await reaperMaster(ns, ns.pid);
    ns.tprint(`Network cleaned successfully.`);
  }

  while (true) {
    ns.tprint(`\n--- DEPLOYMENT CYCLE STARTING ---`);
    const network = await getRootedServers(ns);
    const rooted = network.rooted;
    ns.tprint(`Network scan complete: ${rooted.length} rooted servers available`);
    
    const targetData = await findBestTarget(ns, rooted);
    const target = targetData.hostname;

    ns.tprint(`!!! MASTER: Targeting ${target}`);

    for (const host of rooted) {
      const processes = ns.ps(host);
      for (const proc of processes) {
        if ([hackScript, growScript, weakenScript].includes(proc.filename)) {
          reaper(ns, proc.filename);
        }
      }
    }

    let deployCount = 0;
    for (const host of rooted) {
      if (host === "home") {
        const homeRam = ns.getServerMaxRam("home");
        const availableHomeRam = homeRam - homeReserve;

      } else {
        const availableRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);

        // Allocate threads based on available RAM and script requirements
        const weakenThreads = Math.floor((availableRam * weakenRatio) / weakenRam);
        const growThreads = Math.floor((availableRam * growRatio) / growRam);
        const hackThreads = Math.floor((availableRam * hackRatio) / hackRam);

        if (weakenThreads > 0 && growThreads > 0 && hackThreads > 0) {
          ns.exec(weakenScript, host, weakenThreads, target);
          ns.exec(growScript, host, growThreads, target);
          ns.exec(hackScript, host, hackThreads, target);
          deployCount++;

          ns.tprint(`Deployed on ${host}: Hack Threads: ${hackThreads}, Grow Threads: ${growThreads}, Weaken Threads: ${weakenThreads}`);
        }
      }
    }

    ns.tprint(`Deployment cycle complete: Deployed on ${deployCount} servers targeting ${target}`);
    await ns.sleep(120000);
  }
}