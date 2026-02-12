import { min } from "@tensorflow/tfjs-node";
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
    const minSec = ns.getServerMinSecurityLevel(host);
    const growth = Math.log(ns.getServerGrowth(host));
    const hackTime = ns.getHackTime(host);
    const successChance = ns.hackAnalyzeChance(host);

    const score = 
    ((maxMoney / hackTime) * // money per second
    Math.pow(successChance, 3) * // success chance, cubed to prioritize higher chances
    (growth / minSec) * // growth potential adjusted by security
    (1 / (1 + minSec / 100))); // penalize higher security (normalized to 0-1)

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