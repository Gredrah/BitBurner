// Watcher Test.

/** @Param {NS} ns */
export async function breach(ns, hostname) {
  if (ns.hasRootAccess(hostname)) return true;

  const breachers = [
    { name: "BruteSSH.exe", run: ns.brutessh },
    { name: "FTPCrack.exe", run: ns.ftpcrack },
    { name: "relaySMTP.exe", run: ns.relaysmtp },
    { name: "HTTPWorm.exe", run: ns.httpworm },
    { name: "SQLInject.exe", run: ns.sqlinject },
  ];

  let openPorts = 0;
  let desiredPorts = ns.getServerNumPortsRequired(hostname);

  for (const breacher of breachers) {
    if (openPorts >= desiredPorts) break;
    if (ns.fileExists(breacher.name, "home")) {
      await breacher.run(hostname);
      openPorts++;
    }
  }

  if (openPorts >= desiredPorts) {
    ns.nuke(hostname);
    return true;
  } else {
    return false;
  }
}

/** @Param {NS} ns */
export async function traverse(ns, start, hostnames) {
  hostnames.add(start);

  const neighbors = ns.scan(start);
  for (const next of neighbors) {
    if (!hostnames.has(next)) {
      await traverse(ns, next, hostnames);
    }
  }
}

/** @param {NS} ns */
export async function backdoor(ns, hostname) {
  if (isOwned(ns, hostname)) return false;

  const server = ns.getServer(hostname);

  if (!server.hasAdminRights || server.backdoorInstalled) return false;
  if (ns.getServerRequiredHackingLevel(hostname) > ns.getHackingLevel()) return false;

  const path = findPath(ns, hostname);
  if (!path) return false;

  ns.tprint(`Traveling to ${hostname}`);

  for (const host of path) {
    ns.singularity.connect(host);
  }

  ns.tprint(`Installing backdoor on ${hostname}`);
  await (ns.singularity.installBackdoor());

  ns.singularity.connect("home");
  return true;
}

/** @Param {NS} ns */
export function findPath(ns, target) {
  let queue = [["home"]];
  let neighbours = new Set(["home"]);

  while (queue.length > 0) {
    let path = queue.shift();
    let node = path.at(-1);

    if (node === target) return path;

    for (let neighbour of ns.scan(node)) {
      if (!neighbours.has(neighbour)) {
        neighbours.add(neighbour);
        queue.push([...path, neighbour]);
      }
    }
  }
  return null;
}

/** @Param {NS} ns */
export function isOwned(ns, hostname) {
  return (hostname === "home" || ns.getServer(hostname).purchasedByPlayer);
}

/** Returns an object containing [0] all servers and [1] rooted ones.
 * @Param {NS} ns
 */
export async function getRootedServers(ns) {
  let visited = new Set();
  await traverse(ns, "home", visited);

  const all = Array.from(visited);
  const rooted = [];

  for (const host of all) {
    if (await breach(ns, host)) {
      rooted.push(host);
    }
  }

  return { all, rooted }
}

/** @param {NS} ns */
export async function main(ns) {
  ns.tprint(`Starting network-depth breach...`);

  const allServers = await getRootedServers(ns);

  ns.tprint(`---REPORT---`);
  ns.tprint(`Total Network Size: ${allServers.all.length}`);
  ns.tprint(`Rooted Servers:  ${allServers.rooted.length}`);
  ns.tprint(`Targets Locked:  ${allServers.rooted.filter(s => !isOwned(ns, s)).join(", ")}`);
}