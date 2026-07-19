import { useEffect, useState } from "react";

let renderSequence = 0;

interface Props {
  source: string;
}

export function MermaidPreview({ source }: Props) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSvg(null);
    setError(null);

    const render = async () => {
      try {
        const { default: mermaid } = await import("mermaid");
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          themeVariables: {
            background: "#0d2c26",
            primaryColor: "#173f35",
            primaryTextColor: "#f3f7f5",
            primaryBorderColor: "#f0783a",
            lineColor: "#88a89e",
            secondaryColor: "#124c40",
            tertiaryColor: "#10362f",
            edgeLabelBackground: "#102f29",
            clusterBkg: "#123d34",
            clusterBorder: "#3e7467",
            noteBkgColor: "#4d4420",
            noteTextColor: "#fff6bf",
            noteBorderColor: "#d8aa23",
            fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
          },
          flowchart: { curve: "stepAfter", htmlLabels: false },
        });
        const id = `mermaid-export-preview-${Date.now()}-${renderSequence++}`;
        const rendered = await mermaid.render(id, source);
        if (!cancelled) setSvg(rendered.svg);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Não foi possível renderizar o diagrama.");
        }
      }
    };

    void render();
    return () => {
      cancelled = true;
    };
  }, [source]);

  if (error) {
    return (
      <div className="rounded-md border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm
                      text-red-200">
        Não foi possível renderizar esta prévia. O código Mermaid continua disponível abaixo.
        <span className="mt-1 block font-mono text-xs text-red-200/70">{error}</span>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="flex min-h-72 items-center justify-center rounded-md border border-white/10
                      bg-card text-xs text-ink/50" aria-busy="true">
        renderizando diagrama Mermaid…
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label="Pré-visualização renderizada do diagrama Mermaid"
      className="panel-scroll max-h-[60vh] min-h-72 overflow-auto rounded-md border
                 border-white/10 bg-card p-4 [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
