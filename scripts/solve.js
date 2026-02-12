import { getRootedServers } from "scripts/network.js";

/** @param {NS} ns */
export function findBestTargets(ns, hostnames, count = 5) {
  const targets = [];

  const levelModifier = 1; // keep >= 1
  const myLevel = ns.getHackingLevel() / levelModifier;

  // Optional: ignore extremely low-value servers once you have options
  const minMoneyFloor = 1e6; // 1 million floor

  for (const host of hostnames) {
    if (host === "home" || ns.getServer(host).purchasedByPlayer) continue;

    const req = ns.getServerRequiredHackingLevel(host);
    if (req > myLevel) continue;

    const growth = ns.getServerGrowth(host);
    const { maxMoney, minSec, chance, hackTimeMs, hackPercent, usedFormulas } = getIdealHackMetrics(ns, host);

    if (maxMoney <= minMoneyFloor) continue;
    if (hackTimeMs <= 0 || !Number.isFinite(hackTimeMs)) continue;

    // Core metric: expected dollars per second per thread
    // Use level proximity instead of chance weighting when formulas are unavailable.
    const levelFactor = Math.min(1, myLevel / Math.max(req, 1));
    const expectedDollarsPerHackPerThread = maxMoney * hackPercent;
    const expectedDollarsPerSecondPerThread = expectedDollarsPerHackPerThread / (hackTimeMs / 1000);

    // Mild modifiers
    const growthFactor = Math.pow(Math.max(growth, 1) / 100, 0.35);
    const securityPenalty = 1 / (1 + (Math.max(minSec, 1) - 1) / 50);

    // capacity factor (prevents tiny-but-fast servers from dominating
    // - log10 keeps it from being “all about maxMoney”
    // - exponent tunes how strongly you care about capacity
    const capacityFactor = Math.pow(Math.log10(maxMoney + 1), 1.25);

    const score = expectedDollarsPerSecondPerThread * levelFactor * growthFactor * securityPenalty * capacityFactor;

    targets.push({
      hostname: host,
      score,
      chance,
      maxMoney,
      hackTime: hackTimeMs,
      growth,
      minSec,
      hackPercent,
      expectedDollarsPerSecondPerThread,
      usedFormulas,
    });
  }

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

/**
 * Without Formulas.exe we can't accurately compute "ideal state" metrics.
 * This returns best-effort values using standard API calls.
 * @param {NS} ns
 * @param {string} hostname
 */
function getIdealHackMetrics(ns, hostname) {
  const maxMoney = ns.getServerMaxMoney(hostname);
  const minSec = ns.getServerMinSecurityLevel(hostname);

  // These are based on the server's current state (no Formulas.exe).
  const chance = ns.hackAnalyzeChance(hostname);
  const hackTimeMs = ns.getHackTime(hostname);
  const hackPercent = ns.hackAnalyze(hostname); // fraction per thread

  return { maxMoney, minSec, chance, hackTimeMs, hackPercent, usedFormulas: false };
}