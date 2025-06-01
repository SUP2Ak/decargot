import { useState } from "react";

interface MultiPathInputProps {
  paths: string[];
  setPaths: (paths: string[]) => void;
  disabled?: boolean;
}

export default function MultiPathInput(
  { paths, setPaths, disabled }: MultiPathInputProps,
) {
  const [input, setInput] = useState("");

  const addPath = () => {
    const trimmed = input.trim();
    if (trimmed && !paths.includes(trimmed)) {
      setPaths([...paths, trimmed]);
      setInput("");
    }
  };

  const removePath = (idx: number) => {
    setPaths(paths.filter((_, i) => i !== idx));
  };

  return (
    <div className="multi-path-input">
      <div className="chips-list">
        {paths.map((p, i) => (
          <span className="chip" key={p}>
            {p}
            <button type="button" onClick={() => removePath(i)} disabled={disabled} aria-label="Supprimer">
              <span style={{fontWeight: 700, fontSize: '1.1em', lineHeight: 1}}>×</span>
            </button>
          </span>
        ))}
      </div>
      <div className="input-row">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addPath(); }}
          placeholder="Ajouter un chemin (Entrée pour valider)"
          disabled={disabled}
        />
        <button onClick={addPath} disabled={disabled || !input.trim()} aria-label="Ajouter">
          <span style={{fontWeight: 900, fontSize: '1.3em', lineHeight: 1}}>+</span>
        </button>
      </div>
    </div>
  );
}
