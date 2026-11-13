/**
 * Apple Fluid Interface Physics & Motion Utilities
 * Translated from Apple WWDC "Designing Fluid Interfaces" & "The Details of UI Typography"
 * via Emil Kowalski's `apple-design` skill (.agents/skills/apple-design/SKILL.md).
 */

export const APPLE_SPRINGS = {
  /**
   * Default UI Spring (§4): Critically damped (damping 1.0, response 0.36s).
   * Graceful, interruptible, zero overshoot — use for segmented controls, tabs, and state transitions.
   */
  default: {
    type: 'spring' as const,
    bounce: 0,
    duration: 0.36,
  },
  /**
   * Move / Reposition Spring (§4): Critically damped (damping 1.0, response 0.4s).
   * Use for Kanban card layout reordering, list sorting, and spatial repositioning.
   */
  reposition: {
    type: 'spring' as const,
    bounce: 0,
    duration: 0.4,
  },
  /**
   * Sheet / Drawer Spring (§4): Slightly under-damped (damping 0.8, response 0.3s).
   * Use for floating sheets, drawers, and bottom-anchored panels with physical momentum.
   */
  sheet: {
    type: 'spring' as const,
    bounce: 0.2,
    duration: 0.3,
  },
  /**
   * Momentum / Flick Spring (§4): Under-damped (damping 0.8, response 0.4s).
   * Reserve ONLY when the gesture itself carried velocity/momentum.
   */
  momentum: {
    type: 'spring' as const,
    bounce: 0.2,
    duration: 0.4,
  },
} as const;

/**
 * §6. Momentum Projection — animate to where the gesture is going.
 * Apple's exact exponential-decay projection function from Designing Fluid Interfaces:
 *   (initialVelocity / 1000) * decelerationRate / (1 - decelerationRate)
 *
 * @param initialVelocity Pointer release velocity in px/s
 * @param decelerationRate 0.998 for normal scroll feel; 0.99 for snappier sheet snap
 */
export function projectMomentum(initialVelocity: number, decelerationRate = 0.998): number {
  return ((initialVelocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/**
 * §9. Rubber-banding — progressive soft boundary resistance.
 * The further past the boundary the user drags, the more resistance increases:
 *   (overshoot * dimension * constant) / (dimension + constant * |overshoot|)
 *
 * @param overshoot Distance dragged past the boundary in px
 * @param dimension Total size of the draggable container in px
 * @param constant Resistance constant (Apple default = 0.55)
 */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  if (dimension <= 0 || overshoot === 0) return 0;
  const sign = overshoot < 0 ? -1 : 1;
  const absOvershoot = Math.abs(overshoot);
  return (
    sign *
    ((absOvershoot * dimension * constant) / (dimension + constant * absOvershoot))
  );
}

/**
 * §5. Velocity Handoff — normalize pointer release velocity by remaining distance.
 *   relativeVelocity = gestureVelocity / (targetValue - currentValue)
 */
export function normalizeRelativeVelocity(
  gestureVelocity: number,
  currentValue: number,
  targetValue: number
): number {
  const remaining = targetValue - currentValue;
  if (Math.abs(remaining) < 1) return 0;
  return gestureVelocity / remaining;
}

/**
 * §13. Multimodal Feedback — Causality, Harmony, Utility.
 * Fires subtle tactile vibration on the exact same frame as a causal UI commit
 * (toggle switch, cart snap, stock approval) on supported mobile browsers.
 */
export function triggerCausalHaptic(durationMs: number | number[] = 8): void {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate(durationMs);
    }
  } catch {
    // Ignore on desktop or restricted contexts
  }
}

