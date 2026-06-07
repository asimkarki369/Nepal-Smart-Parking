import React, { useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, PanResponder,
} from 'react-native';
import Svg, { Circle, Path, Line, Text as SvgText, G, Defs, RadialGradient, Stop } from 'react-native-svg';
import { Colors, BorderRadius, Spacing } from '@/utils/theme';

// ── constants ─────────────────────────────────────────────────────────────────
const SIZE        = 260;
const CX          = SIZE / 2;
const CY          = SIZE / 2;
const FACE_R      = 122;   // full clock face radius
const TRACK_R     = 98;    // arc ring radius
const TRACK_SW    = 11;
const HANDLE_R    = 11;

// Tick geometry — spans across the face
const TICK_MAJOR_OUT = 118;  // hour tick outer
const TICK_MAJOR_IN  = 104;  // hour tick inner
const TICK_MINOR_OUT = 118;  // 30-min tick outer
const TICK_MINOR_IN  = 110;  // 30-min tick inner

// Label ring
const LABEL_R     = 80;

const MAX_HOURS   = 24;
const SNAP_MINS   = 15;
const TOUCH_INNER = 52;
const TOUCH_OUTER = 130;

// All 24h labels every 2h evenly around the face
const HOUR_LABELS = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24];

// ── math ──────────────────────────────────────────────────────────────────────
function minsToAngle(mins: number) {
  return (mins / (MAX_HOURS * 60)) * 360;
}
function polarToXY(angleDeg: number, r: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}
function touchToMins(dx: number, dy: number): number | null {
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < TOUCH_INNER || dist > TOUCH_OUTER) return null;
  let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
  if (angle < 0) angle += 360;
  if (angle >= 360) angle -= 360;
  const snapped = Math.round((angle / 360) * MAX_HOURS * 60 / SNAP_MINS) * SNAP_MINS;
  return Math.max(SNAP_MINS, Math.min(MAX_HOURS * 60, snapped));
}
function arcPath(angleDeg: number): string {
  if (angleDeg <= 0) return '';
  if (angleDeg >= 359.9) {
    const p1 = polarToXY(0, TRACK_R);
    const p2 = polarToXY(180, TRACK_R);
    return `M ${p1.x} ${p1.y} A ${TRACK_R} ${TRACK_R} 0 0 1 ${p2.x} ${p2.y} A ${TRACK_R} ${TRACK_R} 0 0 1 ${p1.x} ${p1.y}`;
  }
  const start = polarToXY(0, TRACK_R);
  const end   = polarToXY(angleDeg, TRACK_R);
  return `M ${start.x} ${start.y} A ${TRACK_R} ${TRACK_R} 0 ${angleDeg > 180 ? 1 : 0} 1 ${end.x} ${end.y}`;
}

// ── component ─────────────────────────────────────────────────────────────────
interface Props {
  selectedMins: number | null;
  onSelect: (mins: number | null) => void;
  hourlyRate: number;
  maxMins?: number;   // hard cap (e.g. 120 for BLA zones)
}

export default function ClockTimePicker({ selectedMins, onSelect, hourlyRate, maxMins }: Props) {
  const isDragging = useRef(false);

  const clamp = (mins: number) => maxMins ? Math.min(mins, maxMins) : mins;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (e) => {
        const { locationX: lx, locationY: ly } = e.nativeEvent;
        const d = Math.sqrt((lx - CX) ** 2 + (ly - CY) ** 2);
        return d >= TOUCH_INNER && d <= TOUCH_OUTER;
      },
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        isDragging.current = true;
        const r = touchToMins(e.nativeEvent.locationX - CX, e.nativeEvent.locationY - CY);
        if (r !== null) onSelect(clamp(r));
      },
      onPanResponderMove: (e) => {
        if (!isDragging.current) return;
        const r = touchToMins(e.nativeEvent.locationX - CX, e.nativeEvent.locationY - CY);
        if (r !== null) onSelect(clamp(r));
      },
      onPanResponderRelease: (e) => {
        isDragging.current = false;
        const r = touchToMins(e.nativeEvent.locationX - CX, e.nativeEvent.locationY - CY);
        if (r !== null) onSelect(clamp(r));
      },
      onPanResponderTerminate: () => { isDragging.current = false; },
    }),
  ).current;

  const angleDeg  = selectedMins != null ? minsToAngle(selectedMins) : 0;
  const handlePos = selectedMins != null ? polarToXY(angleDeg, TRACK_R) : polarToXY(0, TRACK_R);
  const estCost   = selectedMins != null ? Math.round(hourlyRate * selectedMins / 60 * 1.1) : null;

  const durLabel = selectedMins == null    ? 'Open'
    : selectedMins >= 43200               ? '1 month'
    : selectedMins >= 20160               ? '2 weeks'
    : selectedMins >= 10080               ? '1 week'
    : selectedMins % (24 * 60) === 0      ? `${selectedMins / (24 * 60)}d`
    : selectedMins < 60                   ? `${selectedMins}m`
    : selectedMins % 60 === 0             ? `${selectedMins / 60}h`
    : `${Math.floor(selectedMins / 60)}h ${selectedMins % 60}m`;

  // Total tick count: every 30 min = 48 ticks over 24h
  const tickCount = MAX_HOURS * 2; // 48

  return (
    <View style={styles.wrap}>
      <View style={styles.clockWrap} {...panResponder.panHandlers}>
        <Svg width={SIZE} height={SIZE}>
          <Defs>
            {/* Subtle radial gradient for premium face */}
            <RadialGradient id="faceGrad" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
              <Stop offset="100%" stopColor="#F0F4FA" stopOpacity="1" />
            </RadialGradient>
          </Defs>

          {/* Clock face background */}
          <Circle cx={CX} cy={CY} r={FACE_R} fill="url(#faceGrad)" />

          {/* Subtle inner rings for depth */}
          <Circle cx={CX} cy={CY} r={FACE_R - 1} stroke="#E8EDF5" strokeWidth={1} fill="none" />
          <Circle cx={CX} cy={CY} r={FACE_R - 8} stroke="#EEF2F8" strokeWidth={0.5} fill="none" />

          {/* ── Tick marks spanning outer edge ── */}
          {Array.from({ length: tickCount }, (_, i) => {
            const angle    = (i / tickCount) * 360;
            const isHour   = i % 2 === 0;  // every 2 ticks = 1 hour
            const outerR   = isHour ? TICK_MAJOR_OUT : TICK_MINOR_OUT;
            const innerR   = isHour ? TICK_MAJOR_IN  : TICK_MINOR_IN;
            const outer    = polarToXY(angle, outerR);
            const inner    = polarToXY(angle, innerR);
            // Highlight ticks that are "covered" by the arc
            const tickMins = (i / tickCount) * MAX_HOURS * 60;
            const covered  = selectedMins != null && tickMins <= selectedMins;
            return (
              <Line
                key={i}
                x1={inner.x} y1={inner.y}
                x2={outer.x} y2={outer.y}
                stroke={covered ? Colors.primary : isHour ? '#C8D0E0' : '#DDE3EE'}
                strokeWidth={isHour ? 2.5 : 1.2}
                strokeLinecap="round"
              />
            );
          })}

          {/* Inner decorative ring */}
          <Circle cx={CX} cy={CY} r={TRACK_R - TRACK_SW / 2 - 2} stroke="#EEF2F8" strokeWidth={0.5} fill="none" />

          {/* Grey track arc */}
          <Circle
            cx={CX} cy={CY} r={TRACK_R}
            stroke="#E4E8F0"
            strokeWidth={TRACK_SW}
            fill="none"
          />

          {/* Filled progress arc */}
          {selectedMins != null && selectedMins > 0 && (
            <Path
              d={arcPath(angleDeg)}
              stroke={Colors.primary}
              strokeWidth={TRACK_SW}
              fill="none"
              strokeLinecap="round"
            />
          )}

          {/* 12 o'clock origin dot */}
          <Circle
            cx={polarToXY(0, TRACK_R).x}
            cy={polarToXY(0, TRACK_R).y}
            r={5} fill={Colors.primary}
          />

          {/* Draggable handle */}
          {selectedMins != null && selectedMins > 0 && (
            <G>
              <Circle cx={handlePos.x} cy={handlePos.y} r={HANDLE_R + 7} fill="rgba(0,110,230,0.12)" />
              <Circle cx={handlePos.x} cy={handlePos.y} r={HANDLE_R + 3} fill={Colors.white} stroke={Colors.primary} strokeWidth={2.5} />
              <Circle cx={handlePos.x} cy={handlePos.y} r={HANDLE_R - 3} fill={Colors.primary} />
            </G>
          )}

          {/* 24h labels every 2h evenly around the full face */}
          {HOUR_LABELS.map(h => {
            const angle  = minsToAngle(h * 60);
            const pos    = polarToXY(angle, LABEL_R);
            const active = selectedMins != null && selectedMins >= h * 60;
            return (
              <SvgText
                key={h}
                x={pos.x} y={pos.y + 4}
                textAnchor="middle"
                fontSize={9}
                fontWeight="800"
                fill={active ? Colors.primary : '#B0BDD0'}
              >
                {h}
              </SvgText>
            );
          })}

          {/* Center: duration */}
          <SvgText
            x={CX} y={CY - 12}
            textAnchor="middle"
            fontSize={26}
            fontWeight="800"
            fill={selectedMins != null ? Colors.text : '#AABBCC'}
          >
            {durLabel}
          </SvgText>

          {/* Center: cost or hint */}
          {estCost != null ? (
            <SvgText x={CX} y={CY + 14} textAnchor="middle" fontSize={15} fontWeight="700" fill={Colors.primary}>
              ≈ Rs {estCost}
            </SvgText>
          ) : (
            <SvgText x={CX} y={CY + 14} textAnchor="middle" fontSize={11} fill="#AABBCC">
              drag to set time
            </SvgText>
          )}
        </Svg>
      </View>

      {/* HOURS chips — filtered by maxMins */}
      <View style={styles.chipSection}>
        <Text style={styles.chipSectionLabel}>HOURS</Text>
        <View style={styles.chipRow}>
          {!maxMins && (
            <TouchableOpacity style={[styles.chip, selectedMins === null && styles.chipActive]} onPress={() => onSelect(null)}>
              <Text style={[styles.chipText, selectedMins === null && styles.chipTextActive]}>Open</Text>
            </TouchableOpacity>
          )}
          {[30, 60, 120, 240, 480, 1440].filter(m => !maxMins || m <= maxMins).map(m => (
            <TouchableOpacity key={m} style={[styles.chip, selectedMins === m && styles.chipActive]} onPress={() => onSelect(m)}>
              <Text style={[styles.chipText, selectedMins === m && styles.chipTextActive]}>
                {m < 60 ? `${m}m` : m === 1440 ? '24h' : `${m / 60}h`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {maxMins && (
          <Text style={styles.maxLabel}>Max {maxMins < 60 ? `${maxMins}m` : `${maxMins / 60}h`} for this zone</Text>
        )}
      </View>

      {/* DAYS chips — hidden when maxMins is set */}
      {!maxMins && (
        <View style={styles.chipSection}>
          <Text style={styles.chipSectionLabel}>DAYS</Text>
          <View style={styles.chipRow}>
            {[2, 3, 5, 7, 14, 30].map(days => {
              const mins = days * 24 * 60;
              return (
                <TouchableOpacity key={days} style={[styles.chip, styles.chipDashed, selectedMins === mins && styles.chipActive]} onPress={() => onSelect(mins)}>
                  <Text style={[styles.chipText, selectedMins === mins && styles.chipTextActive]}>
                    {days === 7 ? '1 week' : days === 14 ? '2 weeks' : days === 30 ? '1 month' : `${days} days`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },

  clockWrap: {
    backgroundColor: Colors.white,
    borderRadius: SIZE / 2,
    shadowColor: '#1A3A6B',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
    marginBottom: 16,
  },

  chipSection:      { width: '100%', marginBottom: 8 },
  chipSectionLabel: { fontSize: 10, fontWeight: '800', color: Colors.muted, letterSpacing: 1, marginBottom: 6, marginLeft: 2 },
  chipRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  chip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 16, borderWidth: 1.5,
    borderColor: Colors.border, backgroundColor: Colors.light,
  },
  chipDashed:     { borderStyle: 'dashed' },
  chipActive:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText:       { fontSize: 12, fontWeight: '700', color: Colors.muted },
  chipTextActive: { color: Colors.white },
  maxLabel:       { fontSize: 11, color: '#0055AA', marginTop: 6, fontWeight: '600' },
});
