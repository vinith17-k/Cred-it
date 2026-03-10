import { motion } from "framer-motion";

interface RiskGaugeProps {
  score: number;
  size?: number;
}

export function RiskGauge({ score, size = 200 }: RiskGaugeProps) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const angle = (clampedScore / 100) * 180;

  let color = "hsl(0, 72%, 55%)";
  if (clampedScore >= 80) color = "hsl(168, 60%, 45%)";
  else if (clampedScore >= 65) color = "hsl(210, 80%, 56%)";
  else if (clampedScore >= 40) color = "hsl(38, 92%, 55%)";

  let label = "High Risk";
  if (clampedScore >= 80) label = "Very Safe";
  else if (clampedScore >= 65) label = "Low Risk";
  else if (clampedScore >= 40) label = "Moderate";

  const radius = size / 2 - 16;
  const cx = size / 2;
  const cy = size / 2;

  const startX = cx - radius;
  const startY = cy;
  const endX = cx + radius;

  const needleRad = ((180 - angle) * Math.PI) / 180;
  const needleX = cx + (radius - 10) * Math.cos(needleRad);
  const needleY = cy - (radius - 10) * Math.sin(needleRad);

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size / 2 + 30} viewBox={`0 0 ${size} ${size / 2 + 30}`}>
        {/* Background arc */}
        <path
          d={`M ${startX} ${cy} A ${radius} ${radius} 0 0 1 ${endX} ${cy}`}
          fill="none"
          stroke="hsl(222, 15%, 90%)"
          strokeWidth="14"
          strokeLinecap="round"
        />
        {/* Colored segments */}
        <path d={`M ${startX} ${cy} A ${radius} ${radius} 0 0 1 ${cx - radius * 0.77} ${cy - radius * 0.64}`} fill="none" stroke="hsl(0, 72%, 55%)" strokeWidth="14" strokeLinecap="round" opacity={0.25} />
        <path d={`M ${cx - radius * 0.77} ${cy - radius * 0.64} A ${radius} ${radius} 0 0 1 ${cx - radius * 0.17} ${cy - radius * 0.98}`} fill="none" stroke="hsl(38, 92%, 55%)" strokeWidth="14" opacity={0.25} />
        <path d={`M ${cx - radius * 0.17} ${cy - radius * 0.98} A ${radius} ${radius} 0 0 1 ${cx + radius * 0.5} ${cy - radius * 0.87}`} fill="none" stroke="hsl(210, 80%, 56%)" strokeWidth="14" opacity={0.25} />
        <path d={`M ${cx + radius * 0.5} ${cy - radius * 0.87} A ${radius} ${radius} 0 0 1 ${endX} ${cy}`} fill="none" stroke="hsl(168, 60%, 45%)" strokeWidth="14" strokeLinecap="round" opacity={0.25} />
        {/* Needle */}
        <motion.line
          x1={cx}
          y1={cy}
          x2={needleX}
          y2={needleY}
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          initial={{ x2: startX + 10, y2: cy }}
          animate={{ x2: needleX, y2: needleY }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
        <circle cx={cx} cy={cy} r="7" fill={color} />
        <circle cx={cx} cy={cy} r="3.5" fill="hsl(var(--card))" />
      </svg>
      <div className="text-center -mt-2">
        <span className="text-3xl font-bold font-display" style={{ color }}>{clampedScore}</span>
        <span className="text-sm text-muted-foreground ml-1">/100</span>
      </div>
      <span className="text-xs font-semibold mt-1 px-3 py-1 rounded-full" style={{ color, backgroundColor: `${color}15` }}>{label}</span>
    </div>
  );
}
