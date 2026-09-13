import type { BuildingDesignProps } from "./types";

/** Shared isometric primitives. An archetype may replace this component entirely. */
export function BuildingModel({ design, building }: BuildingDesignProps) {
  const { palette: p, width: w } = design;
  const floors = design.floors + (building && building.linesOfCode > 400 ? 1 : 0);
  const h = 16 + floors * 10;
  const y = 91 - h;
  return (
    <svg viewBox="0 -12 120 132" aria-hidden="true" focusable="false">
      <path d="M8 94 60 68 112 94 60 120Z" fill="#213e39" opacity=".3" />
      <path d="M7 88 60 62 113 88 60 114Z" fill="#b9be91" stroke="#657c61" strokeWidth="2" />
      <path d={`M${60-w} ${y} 60 ${y+16} 60 105 ${60-w} 89Z`} fill={p.wall} stroke={p.side} strokeWidth="2" />
      <path d={`M60 ${y+16} ${60+w} ${y} ${60+w} 89 60 105Z`} fill={p.side} />
      <path d={`M${60-w} ${y} 60 ${y-16} ${60+w} ${y} 60 ${y+16}Z`} fill={p.roof} stroke={p.side} strokeWidth="2" />
      {design.roof === "spire" && <><path d={`M44 ${y} 60 ${y-29} 76 ${y} 60 ${y+8}Z`} fill={p.side}/><path d={`M44 ${y} 60 ${y-29} 60 ${y+8}Z`} fill={p.roof}/><path d={`M60 ${y-29}v-9h12v6H60`} fill={p.light} stroke={p.side}/></>}
      {design.roof === "dome" && <><path d={`M${60-w+5} ${y} a${w-5} 25 0 0 1 ${2*w-10} 0 Q60 ${y+18} ${60-w+5} ${y}`} fill={p.roof} stroke={p.side} strokeWidth="2"/><path d={`M60 ${y-25}v-9m-5 0h10`} stroke={p.side} strokeWidth="3"/></>}
      {design.roof === "gable" && <><path d={`M${60-w} ${y} 51 ${y-27} ${60+w} ${y} 60 ${y+16}Z`} fill={p.side}/><path d={`M${60-w} ${y} 51 ${y-27} 60 ${y+16}Z`} fill={p.roof}/></>}
      {design.roof === "sawtooth" && [0,1,2].map((n) => <path key={n} d={`M${30+n*19} ${y+1}v-16l18 9v16Z`} fill={p.roof} stroke={p.side} strokeWidth="2"/>)}
      {design.roof === "terrace" && <><path d={`M${60-w} ${y-5} 60 ${y+11} ${60+w} ${y-5}`} fill="none" stroke={p.wall} strokeWidth="5"/><path d={`M72 ${y-8}v-13l10 5v13Z`} fill={p.side}/></>}
      {Array.from({ length: floors }, (_, row) => [0,1].map((col) => <path key={`${row}-${col}`} d={`M${65+col*13} ${y+22+row*10-col*6}v6l7-3v-6Z`} fill={p.light} opacity=".9"/>))}
      <path d="M46 98V84l10 5v14Z" fill="#29434a"/>
      <text x={60-w/2} y={y+29} textAnchor="middle" fill="#18333d" fontSize="10" fontWeight="900" transform={`rotate(25 ${60-w/2} ${y+29})`}>{design.badge}</text>
    </svg>
  );
}
