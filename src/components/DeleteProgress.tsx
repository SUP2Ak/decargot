import { Group, Modal, Progress, Stack, Text } from "@mantine/core";
import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { formatSize } from "../utils";

type DeleteProgressEvent = [number, number, number]; // [progress, deleted, total]

function DeleteProgress(
  { opened, onClose }: { opened: boolean; onClose: () => void },
) {
  const [progress, setProgress] = useState({
    progress: 0,
    deleted: 0,
    total: 0,
  });
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) return;

    console.log("DeleteProgress: Listening for events");
    const unlistenProgress = listen<DeleteProgressEvent>("delete-progress", (event) => {
      console.log("DeleteProgress: Received event", event.payload);
      const [progressValue, deleted, total] = event.payload;
      setProgress({
        progress: progressValue,
        deleted,
        total,
      });
      setPendingPath(null);
    });

    const unlistenPending = listen<string>("delete-pending", (event) => {
      setPendingPath(event.payload);
    });

    const unlistenFinished = listen("delete-finished", () => {
      onClose();
    });

    return () => {
      console.log("DeleteProgress: Cleaning up listener");
      unlistenProgress.then(fn => fn());
      unlistenPending.then(fn => fn());
      unlistenFinished.then(fn => fn());
    };
  }, [opened, onClose]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Suppression en cours"
      centered
    >
      <Stack>
        <Progress value={progress.progress} size="xl" radius="xl" />
        <Group justify="space-between">
          <Text size="sm">
            {formatSize(progress.deleted)} / {formatSize(progress.total)}
          </Text>
          <Text size="sm">{progress.progress.toFixed(1)}%</Text>
        </Group>
        {pendingPath && (
          <Text size="sm" c="orange">
            Finalisation de la suppression…<br />
            <span style={{ fontSize: 12, color: "#aaa" }}>{pendingPath}</span>
          </Text>
        )}
      </Stack>
    </Modal>
  );
}

export default DeleteProgress;