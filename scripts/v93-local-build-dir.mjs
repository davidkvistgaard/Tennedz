// An isolated default for each local invocation avoids reusing OneDrive's
// stale Next build metadata. An explicit dist dir remains caller-owned.
import { access, lstat, rm } from "node:fs/promises";
import { resolve, sep } from "node:path";

export async function v93LocalBuildDirectory(cwd) {
  const requested = process.env.PELOTONIA_V93_LOCAL_DIST_DIR;
  const distDir = requested ?? `.next-v93-local-${process.pid}-${Date.now()}`;
  if (!/^\.next-v93-[a-z0-9-]+$/.test(distDir))
    throw new Error("Choose a local .next-v93-* build directory name.");
  const target = resolve(cwd, distDir);
  if (!target.startsWith(`${cwd}${sep}`))
    throw new Error("The v93 local build must stay inside the project.");
  if (!requested) {
    try {
      await access(target);
      throw new Error("The generated v93 local build directory already exists.");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  const cleanup = requested ? async () => {} : async () => {
    let entry;
    try {
      entry = await lstat(target);
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    if (!entry.isDirectory() || entry.isSymbolicLink())
      throw new Error("The generated v93 build path is no longer a directory.");
    await rm(target, { recursive: true, force: true, maxRetries: 4, retryDelay: 250 });
  };
  return { distDir, cleanup };
}
