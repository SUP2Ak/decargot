import { useEffect, useState } from "react";
import { ActionIcon, Loader, Tooltip } from "@mantine/core";
import { IconCheck, IconDownload, IconRefresh } from "@tabler/icons-react";
import { checkForUpdates, installUpdate } from "../utils/updater";
import type { UpdateCheckResult, State } from "../types/updater";

function HeaderUpdater() {
  const [state, setState] = useState<State>("idle");
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult>({ available: false, version: "", current: "" });

  useEffect(() => {
    const checkUpdate = async () => {
      setState("loading");
      const result = await checkForUpdates();
      setUpdateInfo(result);
      setState(result.available ? "updateAvailable" : "upToDate");
    };
    checkUpdate();
  }, []);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    if (state === "upToDate") {
      timeout = setTimeout(() => setState("idle"), 10000);
    }
    return () => { if (timeout) clearTimeout(timeout); };
  }, [state]);

  const handleClick = async () => {
    if (state === "updateAvailable") {
      setState("loading");
      await installUpdate();
      setState("idle");
    } else if (state === "idle") {
      setState("loading");
      const result = await checkForUpdates();
      setUpdateInfo(result);
      setState(result.available ? "updateAvailable" : "upToDate");
    }
  };

  let icon, tooltip, color;
  if (state === "loading") {
    icon = <Loader size={20} color="orange" />;
    tooltip = "Vérification ou installation en cours...";
    color = "orange";
  } else if (state === "upToDate") {
    icon = <IconCheck size={22} color="#4caf50" />;
    tooltip = "L'application est à jour !";
    color = "green";
  } else if (state === "updateAvailable") {
    icon = <IconDownload size={22} />;
    tooltip = `Nouvelle version disponible : v${updateInfo.version} (cliquer pour installer)`;
    color = "orange";
  } else {
    icon = <IconRefresh size={22} />;
    tooltip = `Version actuelle : v${updateInfo.current} (cliquer pour vérifier les mises à jour)`;
    color = "gray";
  }

  return (
    <Tooltip label={tooltip} color={color} withArrow position="bottom">
      <ActionIcon
        variant="outline"
        color={color}
        size="lg"
        radius="xl"
        onClick={handleClick}
        style={{ marginLeft: 8 }}
        disabled={state === "loading"}
      >
        {icon}
      </ActionIcon>
    </Tooltip>
  );
}

export default HeaderUpdater;
