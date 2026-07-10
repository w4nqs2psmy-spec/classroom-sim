import { useEffect, useRef, useState } from "react";
import { STUDENTS } from "./data";
import { AMBIENT_POOL, MEANINGFUL_POOL, type AmbientTick, type MeaningfulMoment } from "./downtime";

const ALL_PEOPLE = ["Teacher", ...STUDENTS];
const AMBIENT_INTERVAL_MS = 2400;
const AMBIENT_VISIBLE_MS = 2300;

export interface ActiveMoment extends MeaningfulMoment {
  key: number;
}

/**
 * Drives ambient "always alive" idle animation (pure client-side, no cost)
 * plus occasional meaningful moments (simulated single Haiku call each,
 * cadence controlled by paceMs) while `active` is true.
 */
export function useDowntimeClock(
  active: boolean,
  paceMs: number,
  onMeaningful: (moment: MeaningfulMoment, costUSD: number) => void,
) {
  const [ambient, setAmbient] = useState<Record<string, AmbientTick>>({});
  const [activeMoment, setActiveMoment] = useState<ActiveMoment | null>(null);

  const paceRef = useRef(paceMs);
  paceRef.current = paceMs;
  const onMeaningfulRef = useRef(onMeaningful);
  onMeaningfulRef.current = onMeaningful;

  const moveIdxRef = useRef(0);
  const keyRef = useRef(0);
  const lastAmbientPersonRef = useRef<string | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let ambientTimer: ReturnType<typeof setTimeout>;
    let meaningfulTimer: ReturnType<typeof setTimeout>;

    function scheduleAmbient() {
      const jitter = Math.random() * 900 - 450;
      ambientTimer = setTimeout(() => {
        if (cancelled) return;
        const candidates = ALL_PEOPLE.filter((p) => p !== lastAmbientPersonRef.current);
        const person = candidates[Math.floor(Math.random() * candidates.length)];
        lastAmbientPersonRef.current = person;
        const pool = AMBIENT_POOL[person];
        const tick = pool[Math.floor(Math.random() * pool.length)];
        setAmbient((prev) => ({ ...prev, [person]: tick }));
        setTimeout(() => {
          if (cancelled) return;
          setAmbient((prev) => {
            if (prev[person] !== tick) return prev;
            const next = { ...prev };
            delete next[person];
            return next;
          });
        }, AMBIENT_VISIBLE_MS);
        scheduleAmbient();
      }, AMBIENT_INTERVAL_MS + jitter);
    }

    function scheduleMeaningful(initial = false) {
      const delay = initial ? Math.min(3500, paceRef.current) : paceRef.current;
      meaningfulTimer = setTimeout(() => {
        if (cancelled) return;
        const moment = MEANINGFUL_POOL[moveIdxRef.current % MEANINGFUL_POOL.length];
        moveIdxRef.current += 1;
        keyRef.current += 1;
        const key = keyRef.current;

        // Clear any ambient caption for this person so it doesn't overlap the bubble.
        setAmbient((prev) => {
          if (!(moment.speaker in prev)) return prev;
          const next = { ...prev };
          delete next[moment.speaker];
          return next;
        });
        setActiveMoment({ ...moment, key });

        const costUSD = 0.004 + Math.random() * 0.005;
        onMeaningfulRef.current(moment, costUSD);

        const visibleFor = Math.max(2500, Math.min(paceRef.current - 1500, 6000));
        setTimeout(() => {
          if (cancelled) return;
          setActiveMoment((prev) => (prev?.key === key ? null : prev));
        }, visibleFor);

        scheduleMeaningful();
      }, delay);
    }

    scheduleAmbient();
    scheduleMeaningful(true);

    return () => {
      cancelled = true;
      clearTimeout(ambientTimer);
      clearTimeout(meaningfulTimer);
    };
  }, [active]);

  return { ambient, activeMoment };
}
