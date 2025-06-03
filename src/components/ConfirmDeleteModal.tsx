import { Button, Group, Modal, Stack, Text } from "@mantine/core";

function ConfirmDeleteModal({
  opened,
  onCancel,
  onConfirm,
  message = "Supprimer la sélection ? Cette action est irréversible.",
  confirmLabel = "Supprimer",
  confirmColor = "red",
}: {
  opened: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  message?: string;
  confirmLabel?: string;
  confirmColor?: string;
}) {
  return (
    <Modal
      opened={opened}
      onClose={onCancel}
      title="Confirmation"
      centered
      withCloseButton={false}
    >
      <Stack>
        <Text size="md">{message}</Text>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onCancel}>
            Annuler
          </Button>
          <Button color={confirmColor} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export default ConfirmDeleteModal;