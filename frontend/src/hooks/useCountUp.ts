import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

type CountUpOptions = {
  /** Number to count up to */
  target: number;
  /** Duration in seconds (default: 1.5) */
  duration?: number;
  /** Delay in seconds before starting (default: 0) */
  delay?: number;
  /** Decimal places (default: 0) */
  decimals?: number;
  /** Prefix (e.g. "$") */
  prefix?: string;
  /** Suffix (e.g. "%") */
  suffix?: string;
};

/**
 * useCountUp — animate a number from 0 to target.
 *
 * Usage:
 *   const { ref, display } = useCountUp({ target: 1234.56, prefix: "$", decimals: 2 });
 *   return <span ref={ref}>{display}</span>
 *
 * The number animates from 0 → target with GSAP easing.
 */
export function useCountUp({
  target,
  duration = 1.5,
  delay = 0,
  decimals = 0,
  prefix = "",
  suffix = "",
}: CountUpOptions) {
  const ref = useRef<HTMLElement>(null);
  const [display, setDisplay] = useState(
    `${prefix}${(0).toFixed(decimals)}${suffix}`,
  );

  useEffect(() => {
    if (target === 0) {
      setDisplay(`${prefix}${(0).toFixed(decimals)}${suffix}`);
      return;
    }

    const obj = { value: 0 };
    const tween = gsap.to(obj, {
      value: target,
      duration,
      delay,
      ease: "power2.out",
      onUpdate: () => {
        const formatted = obj.value.toLocaleString("en-US", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        });
        setDisplay(`${prefix}${formatted}${suffix}`);
      },
    });

    return () => {
      tween.kill();
    };
  }, [target, duration, delay, decimals, prefix, suffix]);

  return { ref, display };
}
