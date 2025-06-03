import {
  createContext,
  Dispatch,
  SetStateAction,
  useContext,
  useState,
} from "react";

export interface Target {
  project_name: string;
  project_path: string;
  target_path: string;
  target_size: number;
  fullname: string;
  errors: number;
}
export interface ProgressInfo {
  current: number;
  total: number;
  ignored?: number;
}
export interface SearchContextType {
  isScanning: boolean;
  setIsScanning: (v: boolean) => void;
  progress: { [root: string]: ProgressInfo };
  setProgress: Dispatch<SetStateAction<{ [root: string]: ProgressInfo }>>;
  targets: { [root: string]: Target[] };
  setTargets: Dispatch<SetStateAction<{ [root: string]: Target[] }>>;
  scanDone: { [root: string]: boolean };
  setScanDone: Dispatch<SetStateAction<{ [root: string]: boolean }>>;
  wasCancelled: boolean;
  setWasCancelled: (v: boolean) => void;
  selectedDisks: string[];
  setSelectedDisks: Dispatch<SetStateAction<string[]>>;
  paths: string[];
  setPaths: Dispatch<SetStateAction<string[]>>;
}

const SearchContext = createContext<SearchContextType | undefined>(
  undefined,
);

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<{ [root: string]: ProgressInfo }>(
    {},
  );
  const [targets, setTargets] = useState<{ [root: string]: Target[] }>({});
  const [scanDone, setScanDone] = useState<{ [root: string]: boolean }>({});
  const [wasCancelled, setWasCancelled] = useState(false);
  const [selectedDisks, setSelectedDisks] = useState<string[]>([]);
  const [paths, setPaths] = useState<string[]>([]);

  return (
    <SearchContext.Provider
      value={{
        isScanning,
        setIsScanning,
        progress,
        setProgress,
        targets,
        setTargets,
        scanDone,
        setScanDone,
        wasCancelled,
        setWasCancelled,
        selectedDisks,
        setSelectedDisks,
        paths,
        setPaths,
      }}
    >
      {children}
    </SearchContext.Provider>
  );
}

export function useSearchContext() {
  const ctx = useContext(SearchContext);
  if (!ctx) {
    throw new Error(
      "useSearchContext must be used within SearchProvider",
    );
  }
  return ctx;
}
