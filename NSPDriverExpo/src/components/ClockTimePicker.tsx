/**
 * ClockTimePicker — EasyPark-style infinite spinning ring.
 *
 * Visual:
 *   • Very thick colored ring (80 px) — partial arc shows progress in current hour.
 *   • Gray background ring shows the remaining "gap".
 *   • 24 tick marks on the inner white area, rotating with the disc.
 *   • No handle, no chips — pure spinning dial.
 *
 * Time model:
 *   • 1 full revolution = 60 minutes.
 *   • Spin infinitely clockwise for more hours.
 *   • Snaps to nearest 5-minute increment on release.
 *
 * The parent screen is responsible for displaying the duration text,
 * "Ends HH:MM" pill, fee line, and Continue button.
 */
import React, { useRef, useState } from 'react';
import { View, StyleSheet, PanResponder } from 'react-native';
import Svg, { Circle, Path, Line, G } from 'react-native-svg';
import { Colors } from '@/utils/theme';

// ── Geometry ──────────────────────────────────────────────────────────────────
const DIAL       = 270;
const CX         = DIAL / 2;   // 135
const CY         = DIAL / 2;   // 135

// Ring must fit inside the canvas: RING_OUT < CX
const RING_OUT   = CX - 8;     // 127 — outer edge
const RING_HW    = 16;          // half-width → ring is 32 px wide (thin, EasyPark-like)
const RING_MID   = RING_OUT - RING_HW;   // 111 — midline
const RING_IN    = RING_OUT - RING_HW * 2; //  95 — inner edge

// Tick marks: inside the white centre, touching the inner ring edge
const TICK_OUT_R   = RING_IN - 3;   //  92
const TICK_N       = 24;            //  one per 15°
const TICK_MAJ_LEN = 14;            //  major (every 6th = every quarter-hour)
const TICK_MIN_LEN =  8;            //  minor

// Touch target: wide band covering the ring + comfortable margin
const HIT_IN  = RING_IN  - 28;   //  67
const HIT_OUT = RING_OUT + 14;   // 141

// ── Time model ────────────────────────────────────────────────────────────────
const MINS_PER_REV = 60;      // 1 full revolution = 60 minutes
const SNAP_MINS    = 5;       // snap to 5-min increments
const MIN_MINS     = 5;            // minimum selectable duration
const MAX_MINS     = 3 * 24 * 60;  // 3 days upper ceiling (4320 min)

// ── Physics ───────────────────────────────────────────────────────────────────
const FRICTION   = 0.88;   // velocity decay per frame
const STOP_VEL   = 0.20;   // deg/frame — below this: stop and snap

// ── Helpers ───────────────────────────────────────────────────────────────────
function polar(angleDeg: number, r: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

/** SVG arc path clockwise from startDeg to endDeg at radius r. */
function arcPath(startDeg: number, endDeg: number, r: number): string {
  // Clamp to avoid degenerate full-circle (SVG arc is undefined at 360)
  const span = Math.min(endDeg - startDeg, 359.99);
  if (span <= 0) return '';
  const s = polar(startDeg, r);
  const e = polar(startDeg + span, r);
  const large = span > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

/** Touch position → angle 0..360 (0 = 12-o-clock, clockwise). */
function touchAngleDeg(lx: number, ly: number): number {
  let a = Math.atan2(ly - CY, lx - CX) * (180 / Math.PI) + 90;
  return ((a % 360) + 360) % 360;
}

/** Accumulated degrees → snapped minutes. */
function degToMins(totalDeg: number, cap: number): number {
  const raw     = (totalDeg / 360) * MINS_PER_REV;
  const snapped = Math.round(raw / SNAP_MINS) * SNAP_MINS;
  return Math.max(MIN_MINS, Math.min(cap, snapped));
}

// Pre-build tick descriptors — fixed relative to disc origin.
const TICKS = Array.from({ length: TICK_N }, (_, i) => {
  const angle = (i / TICK_N) * 360;
  const major = i % 6 === 0;
  const len   = major ? TICK_MAJ_LEN : TICK_MIN_LEN;
  const rad   = ((angle - 90) * Math.PI) / 180;
  return {
    key: i,
    x1: CX + TICK_OUT_R * Math.cos(rad),
    y1: CY + TICK_OUT_R * Math.sin(rad),
    x2: CX + (TICK_OUT_R - len) * Math.cos(rad),
    y2: CY + (TICK_OUT_R - len) * Math.sin(rad),
    major,
  };
});

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  selectedMins: number | null;
  onSelect:     (mins: number | null) => void;
  hourlyRate:   number;   // not used in the dial itself (parent shows cost)
  maxMins?:     number;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ClockTimePicker({ selectedMins, onSelect, maxMins }: Props) {
  const cap = Math.min(maxMins ?? MAX_MINS, MAX_MINS);

  // ── Physics refs (no re-render) ───────────────────────────────────────────
  // totalDeg: accumulated rotation in degrees (unbounded, e.g. 720 = 2 h)
  const totalDeg    = useRef(selectedMins ? (selectedMins / MINS_PER_REV) * 360 : 0);
  const lastAngle   = useRef(0);
  const velDeg      = useRef(0);
  const rafId       = useRef<ReturnType<typeof requestAnimationFrame>>();

  // Stable ref to onSelect so RAF closures never go stale
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const capRef      = useRef(cap);
  capRef.current    = cap;

  // ── Visual state — only the arc angle drives re-renders ──────────────────
  // arcDeg: 0..360, position within the current revolution
  const [arcDeg, setArcDeg] = useState(
    selectedMins ? ((selectedMins / MINS_PER_REV) * 360) % 360 : 0,
  );

  // ── Core helpers ──────────────────────────────────────────────────────────
  function applyDeg(deg: number) {
    // Clamp: can't go below 0 or above the cap
    const maxDeg  = (capRef.current / MINS_PER_REV) * 360;
    const clamped = Math.max(0, Math.min(maxDeg, deg));
    totalDeg.current = clamped;
    setArcDeg(clamped % 360);
    const mins = clamped < (SNAP_MINS / 2 / MINS_PER_REV * 360)
      ? null
      : degToMins(clamped, capRef.current);
    onSelectRef.current(mins);
  }

  function snapNearest() {
    const raw     = (totalDeg.current / 360) * MINS_PER_REV;
    if (raw < MIN_MINS / 2) {
      totalDeg.current = 0;
      setArcDeg(0);
      onSelectRef.current(null);
      return;
    }
    const snapped    = Math.max(MIN_MINS, Math.min(capRef.current, Math.round(raw / SNAP_MINS) * SNAP_MINS));
    const snappedDeg = (snapped / MINS_PER_REV) * 360;
    totalDeg.current = snappedDeg;
    setArcDeg(snappedDeg % 360);
    onSelectRef.current(snapped);
  }

  function startMomentum() {
    cancelAnimationFrame(rafId.current!);
    function step() {
      velDeg.current *= FRICTION;
      if (Math.abs(velDeg.current) < STOP_VEL) {
        snapNearest();
        return;
      }
      applyDeg(totalDeg.current + velDeg.current);
      rafId.current = requestAnimationFrame(step);
    }
    rafId.current = requestAnimationFrame(step);
  }

  // ── PanResponder ──────────────────────────────────────────────────────────
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (e) => {
        const { locationX: lx, locationY: ly } = e.nativeEvent;
        const d = Math.hypot(lx - CX, ly - CY);
        return d >= HIT_IN && d <= HIT_OUT;
      },
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (e) => {
        cancelAnimationFrame(rafId.current!);
        velDeg.current  = 0;
        lastAngle.current = touchAngleDeg(e.nativeEvent.locationX, e.nativeEvent.locationY);
      },

      onPanResponderMove: (e) => {
        const curr  = touchAngleDeg(e.nativeEvent.locationX, e.nativeEvent.locationY);
        let   delta = curr - lastAngle.current;
        // Choose the shorter arc direction
        if (delta >  180) delta -= 360;
        if (delta < -180) delta += 360;
        lastAngle.current = curr;
        velDeg.current    = delta;
        applyDeg(totalDeg.current + delta);
      },

      onPanResponderRelease: () => {
        if (Math.abs(velDeg.current) > STOP_VEL) {
          startMomentum();
        } else {
          snapNearest();
        }
      },

      onPanResponderTerminate: () => {
        cancelAnimationFrame(rafId.current!);
        snapNearest();
      },
    }),
  ).current;

  // ── Render ────────────────────────────────────────────────────────────────
  const hasTime  = arcDeg > 0.5 || totalDeg.current >= (MIN_MINS / MINS_PER_REV) * 360;
  const discRot  = arcDeg;   // ticks rotate by the same angle as the arc

  const bgArcPath   = arcPath(arcDeg, 360, RING_MID);  // gray remainder
  const fillArcPath = arcPath(0, arcDeg, RING_MID);     // colored progress

  return (
    <View style={styles.wrap} {...pan.panHandlers}>
      <Svg width={DIAL} height={DIAL}>

        {/* ── Full gray background ring ── */}
        <Circle
          cx={CX} cy={CY}
          r={RING_MID}
          stroke="#DDDFE8"
          strokeWidth={RING_HW * 2}
          fill="none"
        />

        {/* ── Colored progress arc (on top of gray) ── */}
        {hasTime && fillArcPath !== '' && (
          <Path
            d={fillArcPath}
            stroke={Colors.primary}
            strokeWidth={RING_HW * 2}
            fill="none"
            strokeLinecap="round"
          />
        )}

        {/* ── White centre disc — covers inner half of the stroked ring ── */}
        <Circle
          cx={CX} cy={CY}
          r={RING_IN}
          fill="white"
        />

        {/* ── Rotating tick disc ── */}
        <G transform={`rotate(${discRot}, ${CX}, ${CY})`}>
          {TICKS.map(t => (
            <Line
              key={t.key}
              x1={t.x1} y1={t.y1}
              x2={t.x2} y2={t.y2}
              stroke={t.major ? '#1A1C2C' : '#888BA0'}
              strokeWidth={t.major ? 2.0 : 1.2}
              strokeLinecap="round"
            />
          ))}
        </G>

        {/* ── Fixed 12-o-clock pointer dot ── */}
        <Circle
          cx={CX}
          cy={RING_IN - 8}
          r={4}
          fill={hasTime ? Colors.primary : '#B0B3C6'}
        />

      </Svg>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  wrap: {
    alignSelf:  'center',
    borderRadius: DIAL / 2,
    backgroundColor: 'white',
    // Floating shadow
    shadowColor:   '#000',
    shadowOpacity: 0.08,
    shadowRadius:  20,
    shadowOffset:  { width: 0, height: 6 },
    elevation:     6,
  },
});
