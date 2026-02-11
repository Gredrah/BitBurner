import { getRootedServers } from "scripts/network.js";

/** @param {NS} ns */
export function findBestTarget(ns, hostnames) {
  let best = {
    hostname: "n00dles",
    score: 0,
    chance: 0,
  };

  const levelModifier = 1; // A divisive modifier to your level to improve success chance. Do not reduce below 1.
  const myLevel = ns.getHackingLevel() / levelModifier;

  for (const host of hostnames) {
    const maxMoney = ns.getServerMaxMoney(host);
    if (maxMoney <= 0) continue;
    if (ns.getServerRequiredHackingLevel(host) > myLevel) continue;
    if (host === "home" || ns.getServer(host).purchasedByPlayer) continue;

    //TODO: Implement Formulas API
    let minSec = ns.getServerMinSecurityLevel(host);
    let growth = Math.log(ns.getServerGrowth(host));
    let hackTime = ns.getHackTime(host);
    let successChance = ns.hackAnalyzeChance(host);

    const score = 
    ((maxMoney * growth)
    / (minSec * hackTime)
    * successChance);

    if (score > best.score) {
      best = {
        hostname: host,
        score: score,
        chance: successChance,
      };
    }
  }
  return best;
}

/** @Param {NS} ns */
export async function main(ns) {
  const network = await getRootedServers(ns);
  const target = findBestTarget(ns, network.rooted);
  
  ns.tprint(`--- Target Analysis ---`);
    ns.tprint(`Best Host: ${target.hostname}`);
    ns.tprint(`Score:     ${ns.formatNumber(target.score)}`);
    ns.tprint(`Chance:    ${(target.chance * 100).toFixed(2)}%`);
}