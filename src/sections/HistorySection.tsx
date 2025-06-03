import { Container, Text } from "@mantine/core";
export default function HistorySection() {
  return (
    <Container size="lg" px="md" py="xl" style={{ background: "#18191A" }}>
      <Text c="dimmed" ta="center" mt="xl" size="lg">
        Historique à venir…
      </Text>
    </Container>
  );
}
