/** @param {NS} ns */
export async function main(ns) {
    const target = ns.args[0] || ns.getHostname();
    while (true) {
        await ns.grow(target);
    }
}