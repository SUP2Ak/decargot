import { invoke } from "@tauri-apps/api/core";
import type { UpdateCheckResult } from "../types/updater";

export const checkForUpdates = async (): Promise<UpdateCheckResult> => {
  try {
    const [available, version, current] = await invoke<[boolean, string, string]>("check_update");
    return { available, version, current };
  } catch (error) {
    console.error("Erreur lors de la vérification des mises à jour:", error);
    return { available: false, version: "", current: "" };
  }
};

export const installUpdate = async (): Promise<void> => {
  try {
    await invoke("install_update");
  } catch (error) {
    console.error("Erreur lors de l'installation de la mise à jour:", error);
  }
};