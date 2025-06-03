import { useEffect, useRef, MutableRefObject } from "react";
import { listen } from "@tauri-apps/api/event";
import { useSearchContext } from "./SearchContext";

export default function SearchListener(
  { selectedDisks, paths, currentRoots }: { selectedDisks: string[]; paths: string[]; currentRoots: MutableRefObject<string[]> },
) {
  const {
    setIsScanning,
    setProgress,
    setTargets,
    setScanDone,
    //@ts-ignore
    setWasCancelled,
  } = useSearchContext();

  const disquesRef = useRef(selectedDisks);
  const pathsRef = useRef(paths);
  useEffect(() => { disquesRef.current = selectedDisks; }, [selectedDisks]);
  useEffect(() => { pathsRef.current = paths; }, [paths]);

  useEffect(() => {
    const unlistenDone = listen("scan_done", async () => {
      setIsScanning(false);
    });
    const unlisten = listen("cargo_scan_progress", (event: any) => {
      const { root, current, total, ignored } = event.payload;
      setProgress((prev) => {
        const old = prev[root]?.current ?? 0;
        return {
          ...prev,
          [root]: {
            current: Math.max(old, current),
            total,
            ignored,
          },
        };
      });
    });
    const unlistenProject = listen("cargo_project_found", (event: any) => {
      const t = event.payload;
      const roots = [...disquesRef.current, ...pathsRef.current];
      const root = roots.find((p) =>
        t.project_path === p || t.project_path.startsWith(p.endsWith("\\") ? p : p + "\\")
      ) || "Other";
      setTargets((prev) => {
        const exists = (prev[root] || []).some((proj) => proj.target_path === t.target_path);
        if (exists) return prev;
        return {
          ...prev,
          [root]: [...(prev[root] || []), t],
        };
      });
    });
    const unlistenScanDone = listen("cargo_scan_done", (event: any) => {
      const roots = event.payload as string[];
      setScanDone((prev) => {
        const done = { ...prev };
        for (const r of roots) done[r] = true;
        return done;
      });
      setIsScanning(false);
      setTargets((prev) => {
        const newTargets: typeof prev = {};
        for (const r of currentRoots.current) {
          if (prev[r]) newTargets[r] = prev[r];
        }
        const totalProjects = Object.values(newTargets).flat().length;
        console.log("[cargo_scan_done] Roots:", Object.keys(newTargets).length, "Total projets:", totalProjects);
        return newTargets;
      });
    });
    return () => {
      unlistenDone.then((f: any) => f());
      unlisten.then((f: any) => f());
      unlistenProject.then((f: any) => f());
      unlistenScanDone.then((f: any) => f());
    };
  }, []);

  return null;
}
