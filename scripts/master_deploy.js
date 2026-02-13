import { getRootedServers } from "scripts/network.js";
import { findBestTarget } from "scripts/solve.js";
import { reaper } from "scripts/reaper.js";
import { getOptimalRatios } from "scripts/formulas_util.js";

/** 
 * Master Deployment Script: Orchestrates network-wide hacking, growing, and weakening.
 * @param {NS} ns 
 */
export async function main(ns) {
  // Amount of RAM to keep free on the 'home' server for other scripts.
  const homeReserve = ns.getServerMaxRam("home") * 0.125;

  // Default resource allocation percentages for H/G/W operations (fallback).
  const defaultRatios = {
    hackRatio: 0.04,
    growRatio: 0.79,
    weakenRatio: 0.17
  };

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
  ns.tprint(`Home RAM Reserved: ${homeReserve.toFixed(2)} GB`);

  // Cleanup old masters
  await reaper(ns, ns.getScriptName(), ns.pid);

  // Validation: Ensure worker scripts exist.
  if (hackRam === 0 || growRam === 0 || weakenRam === 0) {
    ns.tprint(`ERROR: One or more scripts not found.`);
    return;
  }

  let currentTarget = "";
  let currentRatios = defaultRatios;

  // Continuous deployment loop.
  while (true) {
    ns.tprint(`\n--- MONITORING NETWORK ---`);
    
    // Refresh the list of rooted servers.
    const network = await getRootedServers(ns);
    const rooted = network.rooted;
    
    // Determine the most profitable target server based on current stats.
    const targetData = await findBestTarget(ns, rooted);
    const target = targetData.hostname;

    // Only redeploy if the target has changed.
    if (target !== currentTarget) {
      // Get optimal ratios for new target (uses Formulas if available, else defaults)
      currentRatios = await getOptimalRatios(ns, target, defaultRatios);
      
      ns.tprint(`!!! MASTER: Switching Target -> ${target}`);
      ns.tprint(`Ratios - Hack: ${currentRatios.hackRatio.toFixed(3)} | Grow: ${currentRatios.growRatio.toFixed(3)} | Weaken: ${currentRatios.weakenRatio.toFixed(3)}`);
      
      // Cleanup: Kill old scripts across the network and wait for it to finish.
      await reaper(ns, hackScript);
      await reaper(ns, growScript);
      await reaper(ns, weakenScript);
      ns.tprint(`Terminated old scripts to prepare for deployment.`);

      let deployCount = 0;
      for (const host of rooted) {
        let availableRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
        if (host === "home") availableRam = ns.getServerMaxRam(host) - homeReserve;
        else await ns.scp([hackScript, growScript, weakenScript], host, "home");

        const weakenThreads = Math.floor((availableRam * currentRatios.weakenRatio) / weakenRam);
        const growThreads = Math.floor((availableRam * currentRatios.growRatio) / growRam);
        const hackThreads = Math.floor((availableRam * currentRatios.hackRatio) / hackRam);

        if (weakenThreads > 0 || growThreads > 0 || hackThreads > 0) {
          if (weakenThreads > 0) ns.exec(weakenScript, host, weakenThreads, target);
          if (growThreads > 0) ns.exec(growScript, host, growThreads, target);
          if (hackThreads > 0) ns.exec(hackScript, host, hackThreads, target);
          deployCount++;
        }
      }
      ns.tprint(`Deployed on ${deployCount} servers targeting ${target}.`);
      currentTarget = target;
    } else {
      ns.tprint(`Target remains ${target}. No redeployment needed.`);
    }
    
    // Wait for 1 minute before checking for a better target or higher RAM limits.
    await ns.sleep(60000);
  }
}