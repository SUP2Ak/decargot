import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MantineProvider, createTheme } from "@mantine/core";
import { SearchProvider } from "./contexts/SearchContext";
import App from "./App";
import "@mantine/core/styles.css";
import "./index.scss";

const theme = createTheme({
  primaryColor: 'orange',
  colors: {
    orange: [
      '#2d1e12', // 0 - Dark
      '#56351e',
      '#6e2a00',
      '#8b3a00',
      '#b54d00',
      '#e86c00',
      '#ff7f11',
      '#ffa952',
      '#ffc78a',
      '#ffe3c2',
      '#fff7e0', // 9 - Light
    ],
  },
});

const root = createRoot(document.getElementById("root")!);
root.render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <SearchProvider>
        <App />
      </SearchProvider>
    </MantineProvider>
  </StrictMode>
);