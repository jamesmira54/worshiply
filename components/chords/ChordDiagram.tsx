import { getGuitarDiagram, getPianoDiagram } from "@/lib/chord-diagrams";

export function GuitarChordDiagram({ chord }: { chord: string }) {
  const diagram = getGuitarDiagram(chord);
  if (!diagram)
    return <span className="diagram-unavailable">Voicing unavailable</span>;
  const { frets, baseFret } = diagram;
  return (
    <svg
      viewBox="0 0 90 94"
      role="img"
      aria-label={`${chord} guitar chord: ${frets.map((n) => (n < 0 ? "muted" : n === 0 ? "open" : `fret ${n}`)).join(", ")}`}
    >
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <line
          key={`s${i}`}
          x1={22 + i * 10}
          y1="20"
          x2={22 + i * 10}
          y2="76"
          stroke="#87989e"
          strokeWidth="1"
        />
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <line
          key={`f${i}`}
          x1="22"
          y1={20 + i * 14}
          x2="72"
          y2={20 + i * 14}
          stroke="#62787f"
          strokeWidth={i === 0 && baseFret === 1 ? 3 : 1}
        />
      ))}
      {baseFret > 1 && (
        <text x="8" y="31" fontSize="10" fill="#62787f">
          {baseFret}
        </text>
      )}
      {frets.map((fret, i) =>
        fret > 0 ? (
          <circle
            key={i}
            cx={22 + i * 10}
            cy={27 + (fret - baseFret) * 14}
            r="4"
            fill="#22577a"
          />
        ) : (
          <text
            key={i}
            x={22 + i * 10}
            y="13"
            textAnchor="middle"
            fontSize="11"
            fill="#62787f"
          >
            {fret < 0 ? "×" : "○"}
          </text>
        ),
      )}
      {["E", "A", "D", "G", "B", "e"].map((n, i) => (
        <text
          key={i}
          x={22 + i * 10}
          y="89"
          textAnchor="middle"
          fontSize="8"
          fill="#87989e"
        >
          {n}
        </text>
      ))}
    </svg>
  );
}

export function PianoChordDiagram({ chord }: { chord: string }) {
  const diagram = getPianoDiagram(chord);
  if (!diagram)
    return <span className="diagram-unavailable">Voicing unavailable</span>;
  const whites = [0, 2, 4, 5, 7, 9, 11];
  const blacks = [
    { n: 1, x: 12 },
    { n: 3, x: 28 },
    { n: 6, x: 60 },
    { n: 8, x: 76 },
    { n: 10, x: 92 },
  ];
  return (
    <svg
      viewBox="0 0 114 64"
      role="img"
      aria-label={`${chord} piano chord; highlighted notes ${diagram.notes.join(", ")}`}
    >
      {whites.map((n, i) => (
        <g key={n}>
          <rect
            x={i * 16 + 1}
            y="1"
            width="16"
            height="55"
            rx="1"
            fill={diagram.notes.includes(n) ? "#c7f9cc" : "white"}
            stroke="#87989e"
            strokeWidth=".8"
          />
          {diagram.notes.includes(n) && (
            <circle cx={i * 16 + 9} cy="46" r="3" fill="#22577a" />
          )}
        </g>
      ))}
      {blacks.map(({ n, x }) => (
        <g key={n}>
          <rect
            x={x}
            y="1"
            width="10"
            height="34"
            rx="1"
            fill={diagram.notes.includes(n) ? "#22577a" : "#283d46"}
          />
          {diagram.notes.includes(n) && (
            <circle cx={x + 5} cy="27" r="2.5" fill="#80ed99" />
          )}
        </g>
      ))}
    </svg>
  );
}
