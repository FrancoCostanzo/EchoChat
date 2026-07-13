import { motion, useReducedMotion } from 'framer-motion';
import AuthBackground from '@/components/AuthBackground';
import { AuthBrandHeader } from '@/components/AppLogo';
import { EASE_OUT } from '@/lib/motion';

const STAGGER = 0.09;

/**
 * Shared shell for the public auth screens (login/register): echo-ripple
 * backdrop + centered column with a staggered entrance (brand → card → footer).
 */
export default function AuthLayout({ subtitle, footer, children }) {
  const reducedMotion = useReducedMotion();

  const item = (index) => ({
    initial: reducedMotion ? false : { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.45, ease: EASE_OUT, delay: index * STAGGER },
  });

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <AuthBackground />

      <div className="relative z-10 w-full max-w-sm">
        <motion.div {...item(0)}>
          <AuthBrandHeader subtitle={subtitle} />
        </motion.div>

        <motion.div {...item(1)}>{children}</motion.div>

        {footer ? <motion.div {...item(2)}>{footer}</motion.div> : null}
      </div>
    </div>
  );
}
