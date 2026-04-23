import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

// Palette pulled from the app's CSS variables
const COLORS = [
  "hsl(217, 91%, 60%)",  // primary blue
  "hsl(180, 100%, 45%)", // accent cyan
  "hsl(340, 82%, 62%)",  // pink
  "hsl(45, 100%, 60%)",  // yellow
  "hsl(145, 60%, 55%)",  // green
];

interface Piece {
  id: number;
  left: number;  // vw %
  color: string;
  size: number;  // px
  delay: number; // s
  duration: number; // s
  rotate: number; // deg
}

function makeConfetti(count: number): Piece[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: 6 + Math.random() * 8,
    delay: Math.random() * 1.2,
    duration: 2 + Math.random() * 1.5,
    rotate: Math.random() * 720 - 360,
  }));
}

interface ConfettiOverlayProps {
  onDone: () => void;
}

const ConfettiOverlay = ({ onDone }: ConfettiOverlayProps) => {
  const pieces = useRef(makeConfetti(60)).current;

  useEffect(() => {
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden z-50"
      aria-hidden
    >
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          initial={{ y: -20, x: 0, opacity: 1, rotate: 0 }}
          animate={{
            y: "105vh",
            x: (Math.random() - 0.5) * 120,
            opacity: [1, 1, 0],
            rotate: p.rotate,
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: "easeIn",
          }}
          style={{
            position: "absolute",
            left: `${p.left}%`,
            top: 0,
            width: p.size,
            height: p.size * 0.4,
            borderRadius: 2,
            backgroundColor: p.color,
          }}
        />
      ))}
    </div>
  );
};

export default ConfettiOverlay;
