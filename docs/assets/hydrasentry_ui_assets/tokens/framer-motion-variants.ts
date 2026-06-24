export const fadeUp = {
  hidden: { opacity: 0, y: 14, filter: 'blur(6px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } }
};

export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.08 } }
};

export const panelHover = {
  rest: { scale: 1, borderColor: 'rgba(255,255,255,0.10)' },
  hover: { scale: 1.012, borderColor: 'rgba(255,255,255,0.22)', transition: { duration: 0.25 } }
};

export const softReveal = {
  hidden: { opacity: 0, scale: 0.985 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] } }
};
