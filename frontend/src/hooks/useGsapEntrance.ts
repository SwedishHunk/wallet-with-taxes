import { useEffect, useRef } from "react";
import gsap from "gsap";

type EntranceOptions = {
  /** Starting Y offset in pixels (default: 30) */
  y?: number;
  /** Starting opacity (default: 0) */
  opacity?: number;
  /** Starting scale (default: 1) */
  scale?: number;
  /** Animation duration in seconds (default: 0.7) */
  duration?: number;
  /** Delay in seconds (default: 0) */
  delay?: number;
  /** Easing function (default: "power3.out") */
  ease?: string;
};

/**
 * useGsapEntrance — animate an element in on mount.
 *
 * Usage:
 *   const ref = useGsapEntrance<HTMLDivElement>({ y: 40, scale: 0.95 });
 *   return <div ref={ref}>I slide up and scale in!</div>
 */
export function useGsapEntrance<T extends HTMLElement>(
  options: EntranceOptions = {},
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const {
      y = 30,
      opacity = 0,
      scale = 1,
      duration = 0.7,
      delay = 0,
      ease = "power3.out",
    } = options;

    gsap.fromTo(
      el,
      { y, opacity, scale },
      { y: 0, opacity: 1, scale: 1, duration, delay, ease },
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return ref;
}

/**
 * useGsapStagger — animate a group of children in with stagger.
 *
 * Usage:
 *   const ref = useGsapStagger<HTMLDivElement>({ stagger: 0.1 });
 *   return <div ref={ref}><Card/><Card/><Card/></div>
 */
export function useGsapStagger<T extends HTMLElement>(
  options: EntranceOptions & { stagger?: number; childSelector?: string } = {},
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const {
      y = 30,
      opacity = 0,
      scale = 0.97,
      duration = 0.6,
      delay = 0.1,
      ease = "power3.out",
      stagger = 0.08,
      childSelector = ":scope > *",
    } = options;

    const children = el.querySelectorAll(childSelector);
    if (children.length === 0) return;

    gsap.fromTo(
      children,
      { y, opacity, scale },
      { y: 0, opacity: 1, scale: 1, duration, delay, ease, stagger },
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return ref;
}
