import { getRootedServers } from "scripts/network.js";
import { findBestTarget } from "scripts/solve.js";
import { reaper } from "scripts/reaper.js"

/** 
 * Master Deployment Script: Orchestrates network-wide hacking, growing, and weakening.
 * @param {NS} ns 
 */
export async function main(ns) {
  // Amount of RAM to keep free on the 'home' server for other scripts.
  const homeReserve = 64;

  // Resource allocation percentages for H/G/W operations.
  let hackRatio = 0.08;
  let growRatio = 0.76;
  let weakenRatio = 0.16;

  // Paths to the worker scripts.
  const hackScript = "scripts/hack.js";
  const growScript = "scripts/grow.js";
  const weakenScript = "scripts/weaken.js";

  // Cache RAM requirements for each script to optimize thread calculations.
  const hackRam = ns.getScriptRam(hackScript);
  const growRam = ns.getScriptRam(growScript);
  const weakenRam = ns.getScriptRam(weakenScript);

  ns.tprint(`=== MASTER DEPLOY STARTING ===`);
  ns.tprint(`Hacking Ram / Thread: ${hackRam.toFixed(2)} GB | Growing Ram / Thread: ${growRam.toFixed(2)} GB | Weakening Ram / Thread: ${weakenRam.toFixed(2)} GB`);
  ns.tprint(`Home RAM Reserved: ${homeReserve} GB`);

  // Validation: Ensure worker scripts exist.
  if (hackRam === 0 || growRam === 0 || weakenRam === 0) {
    ns.tprint(`ERROR:One or more scripts not found.`);
    return;
  }

  // Continuous deployment loop.
  while (true) {
    ns.tprint(`\n--- DEPLOYMENT CYCLE STARTING ---`);
    
    // Refresh the list of rooted servers.
    const network = await getRootedServers(ns);
    const rooted = network.rooted;
    ns.tprint(`Network scan complete: ${rooted.length} rooted servers available`);
    
    // Determine the most profitable target server based on current stats.
    const targetData = await findBestTarget(ns, rooted);
    const target = targetData.hostname;

    ns.tprint(`!!! MASTER: Targeting ${target}`);

    // Cleanup: Kill old scripts across the network and wait for it to finish.
    await reaper(ns, hackScript);
    await reaper(ns, growScript);
    await reaper(ns, weakenScript);
    ns.tprint(`Terminated old scripts to prepare for deployment.`);

    let deployCount = 0;
    
    // Loop through all servers we have access to.
    for (const host of rooted) {
      // Calculate available resources on the current host.
      let availableRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
      
      if (host === "home") {
        // Enforce the RAM reserve on home.
        availableRam -= homeReserve;
      } else {
        // Ensure the host has the latest worker scripts.
        await ns.scp([hackScript, growScript, weakenScript], host, "home");
      }

      // Calculate how many threads of each type can fit into the remaining RAM.
      const weakenThreads = Math.floor((availableRam * weakenRatio) / weakenRam);
      const growThreads = Math.floor((availableRam * growRatio) / growRam);
      const hackThreads = Math.floor((availableRam * hackRatio) / hackRam);

      // Deploy scripts if there is enough room for at least one thread.
      if (weakenThreads > 0 || growThreads > 0 || hackThreads > 0) {
        if (weakenThreads > 0) ns.exec(weakenScript, host, weakenThreads, target);
        if (growThreads > 0) ns.exec(growScript, host, growThreads, target);
        if (hackThreads > 0) ns.exec(hackScript, host, hackThreads, target);
        deployCount++;

        ns.tprint(`Deployed on ${host}: Hack Threads: ${hackThreads}, Grow Threads: ${growThreads}, Weaken Threads: ${weakenThreads}`);
      }
    }

    ns.tprint(`Deployment cycle complete: Deployed on ${deployCount} servers targeting ${target}`);
    
    // Wait for 1 minute before checking for a better target or higher RAM limits.
    await ns.sleep(60000);
  }
}