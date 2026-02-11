import { getRootedServers } from "scripts/network.js";
import { findBestTarget } from "scripts/solve.js";
import { reaperMaster } from "scripts/reaper.js"

/** @param {NS} ns */
export async function main(ns) {
  const virus = "scripts/hack_pattern.js";
  const virusRam = ns.getScriptRam(virus);
  const homeReserve = 64;

  ns.tprint(`=== MASTER DEPLOY STARTING ===`);
  ns.tprint(`Virus Script: ${virus}`);
  ns.tprint(`Virus RAM: ${virusRam.toFixed(2)} GB`);
  ns.tprint(`Home Reserved RAM: ${homeReserve} GB`);

  if (virusRam === 0) {
    ns.tprint(`ERROR:${virus} not found.`);
    return;
  } else {
    ns.tprint(`Cleaning network before deployment...`);
    await reaperMaster(ns);
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
    
    let deployCount = 0;
    let skipCount = 0;
    let killCount = 0;

    for (const host of rooted) {
      const processes = ns.ps(host);
      let needRestart = true;

      for (const proc of processes) {
        if (proc.filename === virus) {
          if (proc.args[0] === target) {
            needRestart = false;
          } else {
            ns.tprint(`  ${host}: Killing outdated hack targeting ${proc.args[0]}`);
            ns.kill(proc.pid);
            killCount++;
          }
        }
      }

      if (needRestart) {
        let freeRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);

        if (host === "home") {
          freeRam -= homeReserve;
        }

        const threads = Math.floor(freeRam / virusRam);

        if (threads > 0) {
          ns.scp(virus, host, "home");
          ns.exec(virus, host, threads, target);
          ns.tprint(`  ${host}: Deployed ${threads} threads (${(threads * virusRam).toFixed(2)} GB)`);
          deployCount++;
        } else {
          ns.tprint(`  ${host}: Insufficient RAM (${freeRam.toFixed(2)} GB available)`);
        }
      } else {
        skipCount++;
      }
    }
    
    ns.tprint(`--- CYCLE COMPLETE ---`);
    ns.tprint(`Deployed: ${deployCount} servers | Skipped: ${skipCount} servers | Killed: ${killCount} processes`);
    ns.tprint(`Next cycle in 6 minutes...\n`);
    await ns.sleep(360000)
  }
}