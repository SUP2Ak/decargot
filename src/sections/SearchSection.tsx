import { Target, useSearchContext } from "../contexts/SearchContext";
import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  ActionIcon,
  Badge,
  Button,
  Checkbox,
  Container,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
  Table,
  TagsInput,
} from "@mantine/core";
import {
  IconChevronDown,
  IconChevronRight,
  IconExternalLink,
  IconTrash,
  IconHelp,
} from "@tabler/icons-react";
import { formatSize } from "../utils";
import { DeleteProgress, ConfirmDeleteModal } from "../components";

export default function SearchSection({ currentRoots }: { currentRoots: React.MutableRefObject<string[]> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    isScanning, setIsScanning,
    progress, targets, scanDone, wasCancelled, setWasCancelled, setTargets, setProgress, setScanDone,
    selectedDisks, 
    paths, setPaths,
    //@ts-ignore
    setSelectedDisks
  } = useSearchContext();
  const [disques, setDisques] = useState<string[]>([]);
  const [hasProgress, setHasProgress] = useState(false);
  const [expanded, setExpanded] = useState<{ [root: string]: boolean }>({});
  const [selectedTargets, setSelectedTargets] = useState<{ [path: string]: boolean }>({});
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [confirmModalOpened, setConfirmModalOpened] = useState(false);
  const [confirmModalType, setConfirmModalType] = useState<"single" | "multi">("multi");
  const [confirmTargetPath, setConfirmTargetPath] = useState<string | null>(null);

  useEffect(() => {
    invoke<string[]>("get_drives").then(setDisques);
  }, []);

  const handleFindTargets = () => {
    const roots = [...disques, ...paths];
    currentRoots.current = roots;
    setIsScanning(true);
    setTargets({});
    setProgress(Object.fromEntries(roots.map(r => [r, { current: 0, total: 0, ignored: 0 }])));
    setScanDone({});
    setHasProgress(false);
    setWasCancelled(false);
    setTimeout(() => {
      invoke<any>("find_targets_with_cargo_multi_progress", {
        paths: roots,
      })
        .then((result) => {
          console.log("[SCAN RESULT]", JSON.stringify(result, null, 2));
        })
        .catch(() => {
          setIsScanning(false);
          setProgress({});
          setHasProgress(false);
        });
    }, 0);
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
        (targets[root] || []).map((t) => [t.target_path, true])
      ),
    }));
  };

  const deselectAll = (root: string) => {
    setSelectedTargets((prev) => ({
      ...prev,
      ...Object.fromEntries(
        (targets[root] || []).map((t) => [t.target_path, false])
      ),
    }));
  };

  const selectedTargetsList = Object.entries(selectedTargets)
    .filter(([_, v]) => v)
    .map(([path]) => {
      for (const root in targets) {
        const found = (targets[root] || []).find((t) => t.target_path === path);
        if (found) return found;
      }
      return null;
    })
    .filter(Boolean) as Target[];
  const totalSelectedSize = selectedTargetsList.reduce((acc, t) => acc + t.target_size, 0);
  const totalTargetsSize = Object.values(targets)
    .flat()
    .reduce((acc, t) => acc + t.target_size, 0);

  // Safe dedupe but useless..
  function dedupeTargets(targets: Target[]): Target[] {
    const seen = new Set<string>();
    return targets.filter(t => {
      if (seen.has(t.target_path)) return false;
      seen.add(t.target_path);
      return true;
    });
  }

  return (
    <Container size="lg" px="md" py="xl" style={{ background: "#18191A" }}>
      <Stack gap="lg">
        <Text fw={700} size="xl" c="orange.5">
          Recherche de projets Cargo
        </Text>
        <Group gap="md">
          <TagsInput
            data={disques}
            value={paths}
            onChange={setPaths}
            label="Disques ou dossiers"
            placeholder="Sélectionner ou saisir un chemin"
            clearable
            maxDropdownHeight={200}
            style={{ minWidth: 320 }}
            ref={inputRef}
            onPaste={(event) => {
              const paste = event.clipboardData.getData('text');
              const items = paste.split(/[\n;,]+/).map(s => s.trim()).filter(Boolean);
              if (items.length > 1) {
                event.preventDefault();
                const normalized = items.map((p) => {
                  let n = p;
                  if (window.navigator.platform.startsWith("Win")) {
                    n = n.split("/").join("\\");
                    if (/^[A-Za-z]:$/.test(n)) n += "\\";
                  }
                  return n;
                });
                setPaths((current) => [...current, ...normalized]);
              }
            }}
          />
        </Group>
        <Group gap="md">
          <Button
            onClick={handleFindTargets}
            disabled={isScanning || (!selectedDisks.length && !paths.length)}
            loading={isScanning}
            color="orange"
            variant="filled"
            radius="md"
            size="md"
            style={{ fontWeight: 600, minWidth: 180 }}
          >
            {isScanning ? "Analyse en cours..." : "Analyser ces dossiers"}
          </Button>
          <Button
            onClick={handleCancel}
            disabled={!isScanning}
            color="gray"
            variant="outline"
            radius="md"
            size="md"
            style={{ fontWeight: 600, minWidth: 120 }}
          >
            Annuler
          </Button>
          {wasCancelled && (
            <Text c="red" fw={600} ml="md">
              Analyse annulée.
            </Text>
          )}
        </Group>
        {isScanning && !hasProgress && (
          <Text fw={500} c="orange.5">
            Préparation de l'analyse...
          </Text>
        )}
        <Stack gap="lg">
          {paths.map((root) => (
            <Paper
              key={root}
              p="lg"
              radius="lg"
              shadow="sm"
              withBorder
              style={{
                background: "#232323",
                border: "1px solid #333",
                boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
              }}
            >
              <Group justify="space-between" mb="xs">
                <Group>
                  <ActionIcon
                    variant="subtle"
                    color="orange"
                    radius="xl"
                    size="lg"
                    onClick={() => toggleExpand(root)}
                    style={{ transition: "background 0.2s" }}
                  >
                    {expanded[root] ? (
                      <IconChevronDown size={18} />
                    ) : (
                      <IconChevronRight size={18} />
                    )}
                  </ActionIcon>
                  <Text fw={600} size="lg" c="orange.4">
                    {root}
                  </Text>
                </Group>
                <Badge
                  color="orange"
                  variant="filled"
                  size="md"
                  radius="md"
                  style={{ fontWeight: 700 }}
                >
                  {scanDone[root] ? "FINI" : "EN COURS"}
                </Badge>
              </Group>
              <Text size="sm" c="gray.4" mb={4}>
                {(progress[root]?.current ?? 0) + (progress[root]?.ignored ?? 0)} /{" "}
                {progress[root]?.total ?? "?"} dossiers parcourus
                <br />
                <small>
                  (dont {progress[root]?.current ?? 0} analysés,{" "}
                  {progress[root]?.ignored ?? 0} ignorés)
                </small>
              </Text>
              {expanded[root] && (
                <>
                  <Group mt="md" gap="sm">
                    <Button
                      variant="light"
                      color="orange"
                      radius="md"
                      onClick={() => selectAll(root)}
                      size="xs"
                    >
                      Tout sélectionner
                    </Button>
                    <Button
                      variant="light"
                      color="gray"
                      radius="md"
                      onClick={() => deselectAll(root)}
                      size="xs"
                    >
                      Tout désélectionner
                    </Button>
                  </Group>
                  <ScrollArea h={300} mt="md">
                    <Table highlightOnHover withTableBorder withColumnBorders>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th style={{ width: 40 }}>
                            <Checkbox
                              checked={
                                (targets[root] || []).length > 0 &&
                                (targets[root] || []).every((t) => selectedTargets[t.target_path])
                              }
                              indeterminate={
                                (targets[root] || []).some((t) => selectedTargets[t.target_path]) &&
                                !(targets[root] || []).every((t) => selectedTargets[t.target_path])
                              }
                              onChange={(e) => {
                                if (e.currentTarget.checked) selectAll(root);
                                else deselectAll(root);
                              }}
                              color="orange"
                              radius="md"
                            />
                          </Table.Th>
                          <Table.Th>Projet</Table.Th>
                          <Table.Th>Chemin</Table.Th>
                          <Table.Th style={{ width: 120 }}>Taille</Table.Th>
                          <Table.Th style={{ width: 120, textAlign: 'center' }}>Actions</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {dedupeTargets(targets[root] || []).map((t) => (
                          <Table.Tr key={t.target_path}>
                            <Table.Td>
                              <Checkbox
                                checked={!!selectedTargets[t.target_path]}
                                onChange={(e) =>
                                  setSelectedTargets((prev) => ({
                                    ...prev,
                                    [t.target_path]: e.currentTarget.checked,
                                  }))}
                                color="orange"
                                radius="md"
                              />
                            </Table.Td>
                            <Table.Td>
                              <Text fw={600} c="orange.4">
                                {t.fullname || "Projet inconnu"}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm" c="gray.4">
                                {t.project_path}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm" c="gray.4">
                                {formatSize(t.target_size)}
                              </Text>
                            </Table.Td>
                            <Table.Td style={{ textAlign: 'center' }}>
                              <Group gap="xs" justify="center" align="center" style={{ flexWrap: 'nowrap' }}>
                                <Tooltip label={t.target_path} color="gray">
                                  <ActionIcon
                                    variant="subtle"
                                    color="gray"
                                    radius="xl"
                                    size="sm"
                                  >
                                    <IconHelp size={16} />
                                  </ActionIcon>
                                </Tooltip>
                                <Tooltip label="Supprimer le target" color="red">
                                  <ActionIcon
                                    variant="subtle"
                                    color="red"
                                    radius="xl"
                                    size="sm"
                                    onClick={() => {
                                      setConfirmModalType("single");
                                      setConfirmTargetPath(t.target_path);
                                      setConfirmModalOpened(true);
                                    }}
                                  >
                                    <IconTrash size={16} />
                                  </ActionIcon>
                                </Tooltip>
                                <Tooltip label="Ouvrir dans l'explorateur" color="orange">
                                  <ActionIcon
                                    variant="subtle"
                                    color="orange"
                                    radius="xl"
                                    size="sm"
                                    onClick={() =>
                                      invoke("open_in_explorer", {
                                        path: t.project_path,
                                      })}
                                  >
                                    <IconExternalLink size={16} />
                                  </ActionIcon>
                                </Tooltip>
                              </Group>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </ScrollArea>
                </>
              )}
            </Paper>
          ))}
        </Stack>
        {Object.values(selectedTargets).some(Boolean) && (
          <>
            <Button
              color="red"
              size="lg"
              radius="xl"
              style={{
                position: "fixed",
                bottom: 32,
                right: 32,
                zIndex: 1000,
                fontWeight: 700,
                fontSize: 18,
                boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
                paddingLeft: 32,
                paddingRight: 32,
              }}
              onClick={() => {
                setConfirmModalType("multi");
                setConfirmTargetPath(null);
                setConfirmModalOpened(true);
              }}
            >
              Supprimer la sélection — {formatSize(totalSelectedSize)} / {formatSize(totalTargetsSize)} libérables
            </Button>
            <ConfirmDeleteModal
              opened={confirmModalOpened}
              onCancel={() => setConfirmModalOpened(false)}
              onConfirm={async () => {
                setConfirmModalOpened(false);
                setDeleteModalOpened(true);

                if (confirmModalType === "multi") {
                  const uniqueSelectedPaths = Array.from(new Set(
                    Object.keys(selectedTargets).filter((p) => selectedTargets[p])
                  ));
                  try {
                    await invoke("delete_targets", { paths: uniqueSelectedPaths });
                    await new Promise(resolve => setTimeout(resolve, 500));
                    setTargets((prev) => {
                      const newTargets = { ...prev };
                      for (const root in newTargets) {
                        newTargets[root] = newTargets[root].filter(
                          (t) => !uniqueSelectedPaths.includes(t.target_path)
                        );
                      }
                      return newTargets;
                    });
                    setSelectedTargets({});
                  } catch (error) {
                    console.error("Erreur lors de la suppression:", error);
                  } finally {
                    setDeleteModalOpened(false);
                  }
                } else if (confirmModalType === "single" && confirmTargetPath) {
                  try {
                    await invoke("delete_targets", { paths: [confirmTargetPath] });
                    await new Promise(resolve => setTimeout(resolve, 500));
                    setTargets((prev) => {
                      const newTargets = { ...prev };
                      for (const root in newTargets) {
                        newTargets[root] = newTargets[root].filter(
                          (t) => t.target_path !== confirmTargetPath
                        );
                      }
                      return newTargets;
                    });
                    setSelectedTargets((prev) => {
                      const newSel = { ...prev };
                      delete newSel[confirmTargetPath];
                      return newSel;
                    });
                  } catch (error) {
                    console.error("Erreur lors de la suppression:", error);
                  } finally {
                    setDeleteModalOpened(false);
                  }
                }
              }}
              message={
                confirmModalType === "multi"
                  ? "Supprimer tous les targets sélectionnés ? Cette action est irréversible."
                  : "Supprimer ce dossier target ? Cette action est irréversible."
              }
            />
            <DeleteProgress
              opened={deleteModalOpened}
              onClose={() => setDeleteModalOpened(false)}
            />
          </>
        )}
      </Stack>
    </Container>
  );
}
