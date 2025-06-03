import { useState, useRef } from "react";
import {
  AppShell,
  Group,
  Title,
  Burger,
  NavLink,
  Stack,
  useMantineTheme,
  Image
} from "@mantine/core";
import { IconSearch, IconHistory, IconSettings } from "@tabler/icons-react";
import { SearchSection, HistorySection, SettingsSection } from "./sections";
import logo from "./assets/decargot.png";
import { useSearchContext } from "./contexts/SearchContext";
import SearchListener from "./contexts/SearchListener";
import HeaderUpdater from "./components/HeaderUpdater";

function App() {
  const currentRoots = useRef<string[]>([]);
  const theme = useMantineTheme();
  const [opened, setOpened] = useState(false);
  const [page, setPage] = useState<"search" | "history" | "settings">("search");
  const { selectedDisks, paths } = useSearchContext();

  return (
    <>
      <SearchListener selectedDisks={selectedDisks} paths={paths} currentRoots={currentRoots} />
      <AppShell
        padding="md"
        navbar={{
          width: 220,
          breakpoint: "xs",
          collapsed: { mobile: !opened, desktop: !opened },
        }}
        header={{ height: 60 }}
        styles={{
          main: { background: "#18191A", minHeight: "100vh" },
        }}
      >
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between">
            <Group>
              <Burger opened={opened} onClick={() => setOpened((o) => !o)} size="sm" />
              <Group gap={8} align="center">
                <Image src={logo} w={64} h={64} />
                <Title order={2} c="orange.7" style={{ letterSpacing: 1 }}>decargot</Title>
              </Group>
            </Group>
            <HeaderUpdater />
          </Group>
        </AppShell.Header>

        <AppShell.Navbar>
          <Stack gap={2} w="auto-fill" mt="md" style={{ background: "#232323", borderRight: "1px solid #333" }}>
            <NavLink
              label="Recherche"
              leftSection={<IconSearch size={18} />}
              active={page === "search"}
              onClick={() => setPage("search")}
              style={{ borderRadius: 8, fontWeight: 500, color: page === "search" ? theme.colors.orange[5] : theme.colors.gray[4], background: page === "search" ? theme.colors.orange[0] : "transparent" }}
            />
            <NavLink
              label="Historique"
              leftSection={<IconHistory size={18} />}
              active={page === "history"}
              onClick={() => setPage("history")}
              style={{ borderRadius: 8, fontWeight: 500 }}
              color={page === "history" ? "orange.5" : "gray.4"}
            />
            <NavLink
              label="Paramètres"
              leftSection={<IconSettings size={18} />}
              active={page === "settings"}
              onClick={() => setPage("settings")}
              style={{ borderRadius: 8, fontWeight: 500 }}
              color={page === "settings" ? "orange.5" : "gray.4"}
            />
          </Stack>
        </AppShell.Navbar>

        <AppShell.Main
          style={{
            background: '#18191A',
            overflowY: 'auto',
            flex: '1 1 auto',
            minHeight: 0,
            maxHeight: '100vh',
          }}
        >
          {page === "search" && <SearchSection currentRoots={currentRoots} />}
          {page === "history" && <HistorySection />}
          {page === "settings" && <SettingsSection />}
        </AppShell.Main>
      </AppShell>
    </>
  );
}

export default App;
