interface ValuesPanelProps {
  substitutedYaml: string | null;
  diagramCode: string | null;
  backendSvg: string | null;
}


export function ValuesPanel({
  substitutedYaml,
  diagramCode,
  backendSvg,
}: ValuesPanelProps) {

return (
  <div
    style={{
      whiteSpace: "pre-wrap",
      fontFamily: "monospace",
      fontSize: "0.85rem",
    }}
  >
    <h5>Substituted YAML</h5>
    <pre>{typeof substitutedYaml === "string"
      ? substitutedYaml
      : JSON.stringify(substitutedYaml, null, 2)
    }</pre>

    <h5>Backend SVG Output</h5>
    <pre>{backendSvg ?? "[none]"}</pre>
  </div>
);

}