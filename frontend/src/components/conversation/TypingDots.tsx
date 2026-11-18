import { motion } from 'framer-motion';

export default function TypingDots() {
  return (
    <div className="flex items-center gap-0.5 text-ink-100">
      {[0, 1, 2].map((index) => (
        <motion.span
          key={index}
          animate={{ y: [0, -3, 0], opacity: [0.35, 1, 0.35] }}
          transition={{
            duration: 1.2,
            ease: 'easeInOut',
            repeat: Number.POSITIVE_INFINITY,
            delay: index * 0.15,
          }}
          className="inline-block h-1.5 w-1.5 rounded-full bg-current"
        />
      ))}
    </div>
  );
}
