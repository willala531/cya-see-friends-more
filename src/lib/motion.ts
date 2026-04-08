// Shared framer-motion transition
export const cyaTransition = {
  type: "tween" as const,
  ease: [0.2, 0.0, 0, 1.0] as [number, number, number, number],
  duration: 0.3,
};
