import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import MultiPathInput from "./components/MultiPathInput";
import "./App.scss";

interface CargoProject {
  path: string;
  name: string;
  targetSize?: number;
  createdAt?: Date;
  lastModified?: Date;
  isGitRepo: boolean;
  isSelected: boolean;
}

interface Progress {
  current: number;
  total: number;
  ignored?: number;
}

interface Target {
  project_name: string;
  project_path: string;
  target_path: string;
  target_size: number;
}

interface Update {
  version: string;
  url: string;
}

interface VersionInfo {
  current: string;
  latest?: string;
  update?: Update;
}

function App() {
  //@ts-ignore
  const [projects, setProjects] = useState<CargoProject[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  //@ts-ignore
  const [scanProgress, setScanProgress] = useState(0);
  //@ts-ignore
  const [drives, setDrives] = useState<string[]>([]);
  const [targets, setTargets] = useState<{ [root: string]: Target[] }>({});
  const [progress, setProgress] = useState<{ [root: string]: Progress }>({});
  const [hasProgress, setHasProgress] = useState(false);
  const [paths, setPaths] = useState<string[]>([]);
  const [wasCancelled, setWasCancelled] = useState(false);
  const [expanded, setExpanded] = useState<{ [root: string]: boolean }>({});
  const [selectedTargets, setSelectedTargets] = useState<
    { [path: string]: boolean }
  >({});
  const [scanDone, setScanDone] = useState<{ [root: string]: boolean }>({});
  const [versionInfo, setVersionInfo] = useState<VersionInfo>({
    current: "",
  });

  useEffect(() => {
    invoke<string>("get_app_version").then((v) =>
      setVersionInfo((prev) => ({ ...prev, current: v }))
    );
  }, []);

  useEffect(() => {
    const unlistenProgress = listen("scan_progress", (event: any) => {
      if (event.payload === -1) {
        alert(
          "Impossible de scanner ce disque en mode NTFS (accès refusé ou non supporté).",
        );
        setIsScanning(false);
        return;
      }
      if (
        typeof event.payload === "object" && event.payload !== null &&
        "percent" in event.payload
      ) {
        setScanProgress(event.payload.percent);
      } else {
        setScanProgress(event.payload as number);
      }
    });
    const unlistenDone = listen("scan_done", async () => {
      const result = await invoke("get_last_scan_results");
      setProjects(result as CargoProject[]);
      setIsScanning(false);
    });
    const unlisten = listen("cargo_scan_progress", (event: any) => {
      setHasProgress(true);
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
      const t = event.payload as Target;
      const root = paths.find((p) => t.project_path.startsWith(p)) || "Autre";
      setTargets((prev) => ({
        ...prev,
        [root]: [...(prev[root] || []), t],
      }));
    });
    const unlistenScanDone = listen("cargo_scan_done", (event: any) => {
      const root = event.payload as string;
      setScanDone((prev) => ({ ...prev, [root]: true }));
      setProgress((prev) => {
        const p = prev[root];
        if (!p) return prev;
        // Fige le total à current + ignored
        return {
          ...prev,
          [root]: {
            ...p,
            total: (p.current ?? 0) + (p.ignored ?? 0),
          },
        };
      });
    });
    const unlistenUpdate = listen("update-available", (event: any) => {
      setVersionInfo((prev) => ({
        ...prev,
        latest: event.payload.version,
        update: event.payload,
      }));
    });
    return () => {
      unlistenProgress.then((f: any) => f());
      unlistenDone.then((f: any) => f());
      unlisten.then((f: any) => f());
      unlistenProject.then((f: any) => f());
      unlistenScanDone.then((f: any) => f());
      unlistenUpdate.then((f: any) => f());
    };
  }, [paths]);

  useEffect(() => {
    invoke<string[]>("get_drives").then(setDrives);
  }, []);

  const handleFindTargets = () => {
    setIsScanning(true);
    setTargets({});
    setProgress({});
    setHasProgress(false);
    invoke<any[]>("find_targets_with_cargo_multi_progress", { paths })
      .then((res: Target[]) => {
        // Regroupe les targets par racine
        const grouped: { [root: string]: Target[] } = {};
        res.forEach((t) => {
          const root = paths.find((p) => t.project_path.startsWith(p)) ||
            "Autre";
          if (!grouped[root]) grouped[root] = [];
          grouped[root].push(t);
        });
        setTargets(grouped);
        setIsScanning(false);
      })
      .catch(() => {
        setIsScanning(false);
        setProgress({});
        setHasProgress(false);
      });
  };

  const handleDeleteTarget = async (targetPath: string, root: string) => {
    if (window.confirm("Supprimer le dossier target ?")) {
      await invoke("delete_project", { path: targetPath, deleteGit: false });
      setTargets((prev) => ({
        ...prev,
        [root]: prev[root].filter((t) => t.target_path !== targetPath),
      }));
    }
  };

  const handleCancel = () => {
    invoke("cancel_scan");
    setWasCancelled(true);
  };

  const toggleExpand = (root: string) => {
    setExpanded((prev) => ({ ...prev, [root]: !prev[root] }));
  };

  const selectAll = (root: string) => {
    setSelectedTargets((prev) => ({
      ...prev,
      ...Object.fromEntries(
        (targets[root] || []).map((t) => [t.target_path, true]),
      ),
    }));
  };

  const deselectAll = (root: string) => {
    setSelectedTargets((prev) => ({
      ...prev,
      ...Object.fromEntries(
        (targets[root] || []).map((t) => [t.target_path, false]),
      ),
    }));
  };

  const checkForUpdates = async () => {
    try {
      await invoke("check_update");
    } catch (error) {
      console.error("Erreur lors de la vérification des mises à jour:", error);
    }
  };

  const installUpdate = async () => {
    if (versionInfo.update?.url) {
      try {
        console.log("Installation de la mise à jour...");
        console.log(versionInfo.update.url);
        await invoke("install_update", { url: versionInfo.update.url });
      } catch (error) {
        console.error(
          "Erreur lors de l'installation de la mise à jour:",
          error,
        );
      }
    }
  };

  return (
    <div className="container">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <h1>Recherche de projets Cargo</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.9rem", color: "#666" }}>
            v{versionInfo.current}
            {versionInfo.latest && versionInfo.latest !== versionInfo.current &&
              (
                <span style={{ color: "#ff7f11", marginLeft: "0.5rem" }}>
                  → v{versionInfo.latest} disponible
                </span>
              )}
          </span>
          {versionInfo.update
            ? (
              <button
                onClick={installUpdate}
                style={{
                  padding: "0.4rem 0.8rem",
                  fontSize: "0.9rem",
                  background: "#ff7f11",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                Installer la mise à jour
              </button>
            )
            : (
              <button
                onClick={checkForUpdates}
                style={{
                  padding: "0.4rem 0.8rem",
                  fontSize: "0.9rem",
                  background: "#6e4b2a",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                Vérifier les mises à jour
              </button>
            )}
        </div>
      </div>
      <MultiPathInput paths={paths} setPaths={setPaths} disabled={isScanning} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <button
          onClick={handleFindTargets}
          disabled={isScanning || !paths.length}
        >
          {isScanning ? "Analyse en cours..." : "Analyser ces dossiers"}
        </button>
        <button
          onClick={handleCancel}
          disabled={!isScanning}
          style={{ background: "#ff4444", color: "white" }}
        >
          Annuler
        </button>
        {wasCancelled && (
          <span style={{ color: "#ff4444", marginLeft: 16 }}>
            Analyse annulée.
          </span>
        )}
      </div>
      {isScanning && !hasProgress && <div>Préparation de l'analyse...</div>}
      <div className="progress-section">
        {paths.map((root) => (
          <div className="progress-card" key={root}>
            <div className="progress-title" onClick={() => toggleExpand(root)}>
              <span className="chevron">{expanded[root] ? "▼" : "▶"}</span>
              <b>{root}</b>
              <span style={{ flex: 1 }}></span>
              <span
                style={{
                  float: "right",
                  fontWeight: 600,
                  color: scanDone[root] ? "#4CAF50" : "#ff7f11",
                  marginLeft: 12,
                }}
              >
                {scanDone[root] ? "Fini" : "En cours"}
              </span>
            </div>
            <div className="progress-bar" style={{ position: "relative" }}>
              <div
                className="progress-ignored"
                style={{
                  width: progress[root]?.total
                    ? `${
                      Math.min(
                        ((progress[root].ignored ?? 0) +
                          (progress[root].current ?? 0)) /
                          progress[root].total * 100,
                        100,
                      )
                    }%`
                    : "0%",
                  background: "#ff4444",
                  zIndex: 1,
                }}
              />
              <div
                className="progress-fill"
                style={{
                  width: progress[root]?.total
                    ? `${
                      Math.min(
                        (progress[root].current / progress[root].total) * 100,
                        100,
                      )
                    }%`
                    : "0%",
                  background: "#ff7f11",
                  zIndex: 2,
                }}
              />
            </div>
            <span>
              {(progress[root]?.current ?? 0) + (progress[root]?.ignored ?? 0)}
              {" "}
              / {progress[root]?.total ?? "?"} dossiers parcourus
              <br />
              <small>
                (dont {progress[root]?.current ?? 0} analysés,{" "}
                {progress[root]?.ignored ?? 0} ignorés)
              </small>
              <br />
              <small>
                Certains dossiers sont ignorés (node_modules, .git, etc.), la
                progression peut ne pas atteindre 100%.
              </small>
            </span>
            {expanded[root] && (
              <>
                <div
                  className="select-actions"
                  style={{
                    display: "flex",
                    gap: 8,
                    margin: "0.5rem 0 0.2rem 0",
                  }}
                >
                  <button
                    type="button"
                    style={{ padding: "0.3rem 1rem", fontSize: "0.95rem" }}
                    onClick={() => selectAll(root)}
                  >
                    Tout sélectionner
                  </button>
                  <button
                    type="button"
                    style={{ padding: "0.3rem 1rem", fontSize: "0.95rem" }}
                    onClick={() => deselectAll(root)}
                  >
                    Tout désélectionner
                  </button>
                </div>
                <div className="cards scrollable-cards">
                  {(targets[root] || []).map((t) => (
                    <div key={t.target_path} className="card">
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={!!selectedTargets[t.target_path]}
                        onChange={(e) =>
                          setSelectedTargets((prev) => ({
                            ...prev,
                            [t.target_path]: e.target.checked,
                          }))}
                      />
                      <div style={{ flex: 1 }}>
                        <h3>{t.project_name || "Projet inconnu"}</h3>
                        <p>
                          <b>Chemin :</b> {t.project_path}
                        </p>
                        <p>
                          <b>Dossier target :</b> {t.target_path}
                        </p>
                        <p>
                          <b>Taille du target :</b> {formatSize(t.target_size)}
                        </p>
                        <div className="card-actions">
                          <button
                            onClick={() =>
                              handleDeleteTarget(t.target_path, root)}
                            className="delete-btn"
                          >
                            Supprimer le target
                          </button>
                          <button
                            type="button"
                            style={{
                              background: "#6e4b2a",
                              color: "#fff",
                              fontWeight: 600,
                              border: "none",
                              borderRadius: 8,
                              padding: "0.4rem 1rem",
                            }}
                            onClick={() =>
                              invoke("open_in_explorer", {
                                path: t.project_path,
                              })}
                          >
                            Ouvrir dans l'explorateur
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      {Object.values(selectedTargets).some(Boolean) && (
        <button
          className="delete-selection-btn"
          onClick={async () => {
            if (window.confirm("Supprimer tous les targets sélectionnés ?")) {
              for (
                const path of Object.keys(selectedTargets).filter((p) =>
                  selectedTargets[p]
                )
              ) {
                await invoke("delete_project", { path, deleteGit: false });
              }
              setTargets((prev) => {
                const newTargets = { ...prev };
                for (const root in newTargets) {
                  newTargets[root] = newTargets[root].filter((t) =>
                    !selectedTargets[t.target_path]
                  );
                }
                return newTargets;
              });
              setSelectedTargets({});
            }
          }}
        >
          Supprimer la sélection
        </button>
      )}
    </div>
  );
}

function formatSize(size: number): string {
  if (size >= 1024 ** 3) return (size / 1024 ** 3).toFixed(2) + " GB";
  if (size >= 1024 ** 2) return (size / 1024 ** 2).toFixed(2) + " MB";
  if (size >= 1024) return (size / 1024).toFixed(2) + " KB";
  return size + " B";
}

export default App;
