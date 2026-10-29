// Open/closed logic in Asia/Kolkata. IST has no DST (fixed +05:30), so plain offset arithmetic is exact and
// independent of the server's own timezone. Times are "HH:mm" strings; closeTime <= openTime means "closes after midnight"
// (equal = open 24h from openTime).
const IST_OFFSET_MS = 330 * 60 * 1000;
export const WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']; // getUTCDay() order
const pad = (n) => String(n).padStart(2, '0');

/** {day, prevDay, hhmm} for `now` as seen in Asia/Kolkata. */
export function istNow(now = new Date()) {
  const d = new Date(now.getTime() + IST_OFFSET_MS);
  const i = d.getUTCDay();
  return { dayIdx: i, day: WEEK[i], prevDay: WEEK[(i + 6) % 7], hhmm: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` };
}

const usable = (t) => t && !t.isClosed && t.openTime && t.closeTime;

/** @returns {{isOpen:boolean, hasTimings:boolean, opensAt:string|null, closesAt:string|null, nextOpenDay:string|null}} */
export function openStatus(timings, now = new Date()) {
  const list = Array.isArray(timings) ? timings : [];
  if (!list.length) return { isOpen: false, hasTimings: false, opensAt: null, closesAt: null, nextOpenDay: null };
  const by = Object.fromEntries(list.map((t) => [t.day, t]));
  const { dayIdx, day, prevDay, hhmm } = istNow(now);
  const t = by[day];
  const y = by[prevDay];

  if (usable(y) && y.openTime >= y.closeTime && hhmm < y.closeTime) {
    return { isOpen: true, hasTimings: true, opensAt: y.openTime, closesAt: y.closeTime, nextOpenDay: null }; // still inside yesterday's late shift
  }
  if (usable(t)) {
    const open = t.openTime < t.closeTime ? hhmm >= t.openTime && hhmm < t.closeTime : hhmm >= t.openTime;
    if (open) return { isOpen: true, hasTimings: true, opensAt: t.openTime, closesAt: t.closeTime, nextOpenDay: null };
  }
  for (let off = 0; off < 8; off++) {
    const name = WEEK[(dayIdx + off) % 7];
    const n = by[name];
    if (usable(n) && (off > 0 || n.openTime > hhmm)) {
      return { isOpen: false, hasTimings: true, opensAt: n.openTime, closesAt: null, nextOpenDay: name };
    }
  }
  return { isOpen: false, hasTimings: true, opensAt: null, closesAt: null, nextOpenDay: null }; // closed every day
}

/** Mongo $expr equivalent of openStatus(...).isOpen, for filtering inside a pipeline. */
export function openNowExpr(now = new Date()) {
  const { day, prevDay, hhmm } = istNow(now);
  return {
    $expr: {
      $anyElementTrue: {
        $map: {
          input: { $ifNull: ['$timings', []] },
          as: 't',
          in: {
            $and: [
              { $ne: ['$$t.isClosed', true] },
              {
                $or: [
                  {
                    $and: [
                      { $eq: ['$$t.day', day] },
                      {
                        $or: [
                          { $and: [{ $lt: ['$$t.openTime', '$$t.closeTime'] }, { $lte: ['$$t.openTime', hhmm] }, { $lt: [hhmm, '$$t.closeTime'] }] },
                          { $and: [{ $gte: ['$$t.openTime', '$$t.closeTime'] }, { $lte: ['$$t.openTime', hhmm] }] },
                        ],
                      },
                    ],
                  },
                  { $and: [{ $eq: ['$$t.day', prevDay] }, { $gte: ['$$t.openTime', '$$t.closeTime'] }, { $lt: [hhmm, '$$t.closeTime'] }] },
                ],
              },
            ],
          },
        },
      },
    },
  };
}
