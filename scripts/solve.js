import { getRootedServers } from "scripts/network.js";

/** @param {NS} ns */
export function findBestTargets(ns, hostnames, count = 5) {
  const targets = [];
  
  const levelModifier = 1; // A divisive modifier to your level to improve success chance. Do not reduce below 1.
  const myLevel = ns.getHackingLevel() / levelModifier;

  for (const host of hostnames) {
    const maxMoney = ns.getServerMaxMoney(host);
    if (maxMoney <= 0) continue;
    if (ns.getServerRequiredHackingLevel(host) > myLevel) continue;
    if (host === "home" || ns.getServer(host).purchasedByPlayer) continue;

    //TODO: Implement Formulas API
    const minSec = ns.getServerMinSecurityLevel(host);
    const growth = ns.getServerGrowth(host);
    const hackTime = ns.getHackTime(host);
    const successChance = ns.hackAnalyzeChance(host);

    // Heavily weight max money and success chance
    const score = 
      Math.pow(maxMoney, 0.8) *         // High money capacity is king
      (maxMoney / hackTime) *           // Money per second
      (growth / minSec) *               // Growth matters but less
      (1 / (1 + minSec / 100));         // penalize higher security 

    targets.push({
      hostname: host,
      score: score,
      chance: successChance,
      maxMoney: maxMoney,
      hackTime: hackTime,
      growth: growth,
      minSec: minSec,
    });
  }
  
  // Sort by score descending and return top N
  return targets.toSorted((a, b) => b.score - a.score).slice(0, count);
}

/** @param {NS} ns */
export function findBestTarget(ns, hostnames) {
  const targets = findBestTargets(ns, hostnames, 1);
  return targets.length > 0 ? targets[0] : {
    hostname: "n00dles",
    score: 0,
    chance: 0,
  };
}

/** @Param {NS} ns */
export async function main(ns) {
  const network = await getRootedServers(ns);
  const topTargets = findBestTargets(ns, network.rooted, 5);
  
  ns.tprint(`--- Top 5 Target Analysis ---`);
  topTargets.forEach((target, index) => {
    ns.tprint(`\n#${index + 1}: ${target.hostname}`);
    ns.tprint(`  Score:     ${ns.formatNumber(target.score)}`);
    ns.tprint(`  Chance:    ${(target.chance * 100).toFixed(2)}%`);
    ns.tprint(`  Max Money: ${ns.formatNumber(target.maxMoney)}`);
    ns.tprint(`  Hack Time: ${ns.tFormat(target.hackTime)}`);
    ns.tprint(`  Growth:    ${target.growth}`);
    ns.tprint(`  Min Sec:   ${target.minSec}`);
  });
}