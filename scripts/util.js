/** @param {NS} ns */
export function getAllOtherProcesses(ns, target, ignoreScript = null) {
  const processes = ns.ps(target);

  const self = ignoreScript || ns.getScriptName();
  const otherProcesses = processes.filter(p => p.filename !== self);

  otherProcesses.sort((a, b) =>{
    const ramA = ns.getScriptRam(a.filename) * a.threads;
    const ramB = ns.getScriptRam(b.filename) * b.threads;
    return ramB - ramA;
  });

  return otherProcesses;
}