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
  let hackRatio = 0.1;
  let growRatio = 0.65;
  let weakenRatio = 0.25;

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

  // Cleanup old masters
  await reaper(ns, ns.getScriptName(), ns.pid);

  // Validation: Ensure worker scripts exist.
  if (hackRam === 0 || growRam === 0 || weakenRam === 0) {
    ns.tprint(`ERROR:One or more scripts not found.`);
    return;
  }

  let currentTarget = "";
  let lastState = "";

  // Continuous deployment loop.
  while (true) {
    ns.tprint(`\n--- MONITORING NETWORK ---`);
    
    // Refresh the list of rooted servers.
    const network = await getRootedServers(ns);
    const rooted = network.rooted;
    
    // Determine the most profitable target server based on current stats.
    const targetData = await findBestTarget(ns, rooted);
    const target = targetData.hostname;

    // Growth threshold check: is the server ready to be hacked?
    const moneyMax = ns.getServerMaxMoney(target);
    const moneyCurr = ns.getServerMoneyAvailable(target);
    const secMin = ns.getServerMinSecurityLevel(target);
    const secCurr = ns.getServerSecurityLevel(target);

    // If money is low (< 90%) or security is high (+2 above min), prioritize growing/weakening.
    const needsPriming = (moneyCurr < moneyMax * 0.65) || (secCurr > secMin * 2.5);

    // Only redeploy if the target has changed OR if we need to switch between Priming and Hacking modes.
    // We'll use a simple state string to track this.
    const currentState = needsPriming ? "PRIMING" : "HACKING";

    if (target !== currentTarget || currentState !== lastState) {
      ns.tprint(`!!! MASTER: Mode Switch [${currentState}] - Target: ${target}`);
      
      // Cleanup: Kill old scripts across the network and wait for it to finish.
      await reaper(ns, hackScript);
      await reaper(ns, growScript);
      await reaper(ns, weakenScript);
      ns.tprint(`Terminated old scripts to prepare for deployment.`);

      const activeHackRatio = needsPriming ? 0 : hackRatio;
      const activeGrowRatio = needsPriming ? 0.5 : growRatio;
      const activeWeakenRatio = needsPriming ? 0.5 : weakenRatio;

      let deployCount = 0;
      for (const host of rooted) {
        let availableRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
        if (host === "home") availableRam -= homeReserve;
        else await ns.scp([hackScript, growScript, weakenScript], host, "home");

        const weakenThreads = Math.floor((availableRam * activeWeakenRatio) / weakenRam);
        const growThreads = Math.floor((availableRam * activeGrowRatio) / growRam);
        const hackThreads = Math.floor((availableRam * activeHackRatio) / hackRam);

        if (weakenThreads > 0 || growThreads > 0 || hackThreads > 0) {
          if (weakenThreads > 0) ns.exec(weakenScript, host, weakenThreads, target);
          if (growThreads > 0) ns.exec(growScript, host, growThreads, target);
          if (hackThreads > 0) ns.exec(hackScript, host, hackThreads, target);
          deployCount++;
        }
      }
      ns.tprint(`Mode [${currentState}] deployed on ${deployCount} servers.`);
      currentTarget = target;
      lastState = currentState;
    } else {
      ns.tprint(`Target remains ${target} in ${currentState} mode. No reset required.`);
    }
    
    // Wait for 1 minute before checking for a better target or higher RAM limits.
    await ns.sleep(60000);
  }
}