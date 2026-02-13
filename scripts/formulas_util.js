/** @param {NS} ns */
export function hasFormulasAPI(ns) {
  return ns.fileExists("Formulas.exe", "home");
}

/** 
 * Calculates thread ratios based on available formulas or returns defaults.
 * @param {NS} ns
 * @param {string} target - Target server hostname
 * @param {Object} defaults - Default ratios: { hackRatio, growRatio, weakenRatio }
 * @returns {Object} - Optimized ratios or defaults
 */
export async function getOptimalRatios(ns, target, defaults) {
  if (!hasFormulasAPI(ns)) {
    ns.tprint(`Formulas API not available. Using default ratios.`);
    return defaults;
  }

  const server = ns.getServer(target);
  const player = ns.getPlayer();

  // Calculate times for each operation
  const hackTime = ns.formulas.hacking.hackTime(server, player);
  const growTime = ns.formulas.hacking.growTime(server, player);
  const weakenTime = ns.formulas.hacking.weakenTime(server, player);

  // Normalize times to get relative thread requirements
  const maxTime = Math.max(hackTime, growTime, weakenTime);
  const hackWeight = hackTime / maxTime;
  const growWeight = growTime / maxTime;
  const weakenWeight = weakenTime / maxTime;

  // Total weight
  const totalWeight = hackWeight + growWeight + weakenWeight;

  // Convert to ratios
  const ratios = {
    hackRatio: hackWeight / totalWeight,
    growRatio: growWeight / totalWeight,
    weakenRatio: weakenWeight / totalWeight
  };

  ns.tprint(`Formulas API: Calculated optimal ratios - H: ${ratios.hackRatio.toFixed(3)} | G: ${ratios.growRatio.toFixed(3)} | W: ${ratios.weakenRatio.toFixed(3)}`);
  return ratios;
}