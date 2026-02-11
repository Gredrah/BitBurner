/** 
 * Monitor Script: Provides real-time stats for a target server.
 * Usage: run scripts/monitor.js [target]
 * @param {NS} ns 
 */
export async function main(ns) {
  const target = ns.args[0];

  if (!target) {
    ns.tprint("ERROR: Please provide a target hostname.");
    ns.tprint("Usage: run scripts/monitor.js [target]");
    return;
  }

  ns.disableLog("ALL");
  ns.ui.openTail(); // Open the script's log window automatically
  ns.tail();

  let lastMoney = ns.getServerMoneyAvailable(target);
  let totalStolen = 0;
  const startTime = Date.now();

  while (true) {
    const moneyCurrent = ns.getServerMoneyAvailable(target);
    const moneyMax = ns.getServerMaxMoney(target);
    const moneyPercent = (moneyCurrent / moneyMax) * 100;

    // Track total stolen: If money decreased, it was a hack.
    // If it increased, it was a grow/natural regen (ignore).
    if (moneyCurrent < lastMoney) {
      totalStolen += (lastMoney - moneyCurrent);
    }
    lastMoney = moneyCurrent;

    const runtime = (Date.now() - startTime) / 1000;
    // Fix: Ensure we don't divide by zero or result in NaN
    const avgProfit = runtime > 0 ? totalStolen / runtime : 0;

    const secCurrent = ns.getServerSecurityLevel(target);
    const secMin = ns.getServerMinSecurityLevel(target);
    const secDiff = secCurrent - secMin;

    const hackTime = ns.getHackTime(target);
    const growTime = ns.getGrowTime(target);
    const weakenTime = ns.getWeakenTime(target);

    ns.clearLog();
    ns.print(`--- MONITORING: ${target} ---`);
    ns.print(`Money    : $${ns.formatNumber(moneyCurrent)} / $${ns.formatNumber(moneyMax)} (${moneyPercent.toFixed(2)}%)`);
    ns.print(`Security : ${secCurrent.toFixed(3)} (Min: ${secMin.toFixed(3)} | +${secDiff.toFixed(3)})`);
    ns.print(`----------------------------`);
    ns.print(`Est. Profit : $${ns.formatNumber(avgProfit)}/sec`);
    ns.print(`Total Extr. : $${ns.formatNumber(totalStolen)}`);
    ns.print(`Session Time: ${ns.tFormat(Date.now() - startTime)}`);
    ns.print(`----------------------------`);
    ns.print(`Hack Time  : ${ns.tFormat(hackTime)}`);
    ns.print(`Grow Time  : ${ns.tFormat(growTime)}`);
    ns.print(`Weaken Time: ${ns.tFormat(weakenTime)}`);
    ns.print(`----------------------------`);
    ns.print(`Cycle Time : ${ns.tFormat(weakenTime)}`); // Weaken is always the longest
    
    await ns.sleep(1000);
  }
}
