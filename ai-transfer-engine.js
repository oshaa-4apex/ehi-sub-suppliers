/**
 * AI Smart Transfer Vehicle Allocation & Combination Engine
 * Exotic Holidays International — Sri Lanka DMC
 *
 * Chain optimizer: never blindly combines. Hard rules block;
 * soft rules score. Ops confirm / lock / override.
 */
(function (global) {
  "use strict";

  const COMBINE_TYPES = {
    ARR_ARR: "ARR_ARR",
    DEP_DEP: "DEP_DEP",
    DEP_ARR: "DEP_ARR",
    ARR_DEP: "ARR_DEP",
    INTERNAL_RETURN: "INTERNAL_RETURN",
    MAIN_FEEDER: "MAIN_FEEDER",
    MAIN_LAST_MILE: "MAIN_LAST_MILE",
    MULTI_HOTEL_PICKUP: "MULTI_HOTEL_PICKUP",
    MULTI_HOTEL_DROPOFF: "MULTI_HOTEL_DROPOFF",
    BACK_TO_BACK: "BACK_TO_BACK",
    NONE: "NONE",
  };

  const REASON = {
    TIME_MATCH: "TIME_MATCH",
    FLIGHT_MATCH: "FLIGHT_MATCH",
    ROUTE_MATCH: "ROUTE_MATCH",
    REGION_MATCH: "REGION_MATCH",
    CAPACITY_MATCH: "CAPACITY_MATCH",
    BACK_TO_BACK_MATCH: "BACK_TO_BACK_MATCH",
    LOW_EMPTY_KM: "LOW_EMPTY_KM",
    VEHICLE_NEARBY: "VEHICLE_NEARBY",
    MAX_WAIT_OK: "MAX_WAIT_OK",
    FEEDER_REQUIRED: "FEEDER_REQUIRED",
    SHUTTLE_REQUIRED: "SHUTTLE_REQUIRED",
    CLIENT_REQUESTED_VEHICLE: "CLIENT_REQUESTED_VEHICLE",
    DRIVER_AVAILABLE: "DRIVER_AVAILABLE",
    NO_MATCH_TIME: "NO_MATCH_TIME",
    NO_MATCH_CAPACITY: "NO_MATCH_CAPACITY",
    NO_MATCH_ROUTE: "NO_MATCH_ROUTE",
    MAX_WAIT_EXCEEDED: "MAX_WAIT_EXCEEDED",
    VEHICLE_CONFLICT: "VEHICLE_CONFLICT",
    DRIVER_CONFLICT: "DRIVER_CONFLICT",
    MANUAL_OVERRIDE: "MANUAL_OVERRIDE",
  };

  const XFER_STATUS = [
    "UNALLOCATED",
    "AI_SEARCHING",
    "AI_MATCH_FOUND",
    "PROPOSED",
    "CONFIRMED",
    "LOCKED",
    "DRIVER_ASSIGNED",
    "DISPATCHED",
    "ON_THE_WAY",
    "ARRIVED_PICK_UP",
    "GUEST_ONBOARD",
    "IN_TRANSFER",
    "ARRIVED_DESTINATION",
    "COMPLETED",
    "DELAYED",
    "CANCELLED",
    "NO_SHOW",
  ];

  const COMBINE_STATUS = [
    "NOT_COMBINED",
    "COMBINATION_POSSIBLE",
    "AI_PROPOSED",
    "COMBINED",
    "PARTIALLY_COMBINED",
    "FEEDER_REQUIRED",
    "MANUAL_REVIEW",
    "COMBINATION_CONFLICT",
    "COMBINATION_LOCKED",
  ];

  const DEFAULT_CONFIG = {
    STANDARD_AIRPORT_BUFFER: 180,
    COMBINED_DEPARTURE_BUFFER: 150,
    DEPARTURE_FLIGHT_GROUPING_WINDOW: 60,
    ARRIVAL_FLIGHT_GROUPING_WINDOW: 30,
    ARRIVAL_READY_BUFFER: 60,
    MAX_BACK_TO_BACK_WAIT: 540,
    SCORE_SAME_ROUTE: 40,
    SCORE_SAME_REGION: 25,
    SCORE_NEARBY_REGION: 15,
    SCORE_BACK_TO_BACK_AIRPORT: 30,
    SCORE_LOW_EMPTY_KM: 25,
    SCORE_HIGH_DETOUR: -30,
    SCORE_TIMING_RISK: -50,
    THRESHOLD_EXCELLENT: 90,
    THRESHOLD_GOOD: 80,
    THRESHOLD_REVIEW: 65,
    THRESHOLD_AUTO: 80,
    UNAWATUNA_SHUTTLE_PAX: 8,
    vehicleCapacity: [
      { type: "Car", min: 1, max: 2 },
      { type: "Micro Van", min: 3, max: 8 },
      { type: "Mini Coach", min: 9, max: 14 },
      { type: "Large Coach", min: 15, max: 45 },
    ],
    regionPriority: [
      { dep: ["Yala"], arr: ["Colombo", "Yala"], vehicle: "Tangalle" },
      { dep: ["Mirissa", "Weligama", "Unawatuna"], arr: ["Colombo", "Yala"], vehicle: "Unawatuna" },
      { dep: ["Unawatuna", "Hikkaduwa", "Ambalangoda"], arr: ["Colombo", "Yala"], vehicle: "Hikkaduwa" },
      { dep: ["Ahungalla", "Panadura"], arr: ["Yala"], vehicle: "Bentota" },
      { dep: ["Colombo"], arr: ["Colombo", "Yala"], vehicle: "Colombo" },
    ],
    nearbyRegions: {
      Unawatuna: ["Hikkaduwa", "Galle", "Weligama", "Mirissa"],
      Hikkaduwa: ["Unawatuna", "Ambalangoda", "Bentota", "Galle"],
      Bentota: ["Kalutara", "Hikkaduwa", "Ahungalla"],
      Kalutara: ["Bentota", "Panadura", "Colombo"],
      Colombo: ["Negombo", "Panadura", "Kalutara"],
      Tangalle: ["Yala", "Mirissa", "Hambantota"],
      Yala: ["Tangalle", "Tissamaharama"],
      Mirissa: ["Weligama", "Unawatuna", "Tangalle"],
      Weligama: ["Mirissa", "Unawatuna", "Galle"],
    },
    interchanges: [
      { id: "baddegama", name: "Baddegama Interchange", regions: ["Hikkaduwa", "Unawatuna", "Tangalle"] },
      { id: "galanigama", name: "Galanigama Interchange", regions: ["Kalutara", "Hikkaduwa", "Unawatuna"] },
      { id: "dodangoda", name: "Dodangoda Interchange", regions: ["Kalutara", "Bentota", "Hikkaduwa"] },
    ],
    southCorridor: ["Unawatuna", "Hikkaduwa", "Ambalangoda", "Bentota", "Kalutara", "Galle", "Weligama", "Mirissa", "Tangalle", "Yala"],
  };

  const DEMO_FLEET = [
    { id: "veh_kdh023", plate: "KDH-023", type: "Micro Van", capacity: 8, region: "Hikkaduwa", status: "Available", driver: "Kasun Perera" },
    { id: "veh_kdh041", plate: "KDH-041", type: "Micro Van", capacity: 8, region: "Unawatuna", status: "Available", driver: "Thilina Perera" },
    { id: "veh_cab1101", plate: "CAB-1101", type: "Car", capacity: 2, region: "Colombo", status: "Available", driver: "Nimal Fernando" },
    { id: "veh_cab4404", plate: "CAB-4404", type: "Mini Coach", capacity: 14, region: "Hikkaduwa", status: "Available", driver: "Sajith Fernando" },
    { id: "veh_cab5505", plate: "CAB-5505", type: "Large Coach", capacity: 45, region: "Colombo", status: "Available", driver: "Dinesh Rathnayake" },
    { id: "veh_cab6606", plate: "CAB-6606", type: "Car", capacity: 2, region: "Tangalle", status: "Available", driver: "Ruwan Silva" },
    { id: "veh_cab7707", plate: "CAB-7707", type: "Mini Coach", capacity: 14, region: "Unawatuna", status: "Available", driver: "Nimali Fernando" },
    { id: "veh_vito01", plate: "WP-VITO-1", type: "Benz VITO", capacity: 7, region: "Colombo", status: "Available", driver: "VIP Desk" },
  ];

  function mergeConfig(overrides) {
    return Object.assign({}, DEFAULT_CONFIG, overrides || {});
  }

  function minutesFromHhmm(hhmm) {
    const m = String(hhmm || "").match(/(\d{1,2}):(\d{2})/);
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  }

  function fmtMinutes(total) {
    let t = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
    const h = Math.floor(t / 60);
    const m = t % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  function waitMinutes(fromMin, toMin) {
    if (fromMin == null || toMin == null) return null;
    if (toMin >= fromMin) return toMin - fromMin;
    return toMin + 24 * 60 - fromMin;
  }

  function regionMatch(a, b) {
    return String(a || "").toLowerCase() === String(b || "").toLowerCase();
  }

  function regionIncludes(list, region) {
    const r = String(region || "").toLowerCase();
    return (list || []).some((x) => r.includes(String(x).toLowerCase()) || String(x).toLowerCase().includes(r));
  }

  function isNearby(cfg, a, b) {
    if (!a || !b) return false;
    if (regionMatch(a, b)) return true;
    const near = cfg.nearbyRegions[a] || [];
    return near.some((x) => regionMatch(x, b));
  }

  function sameCorridor(cfg, a, b) {
    const south = cfg.southCorridor || [];
    return regionIncludes(south, a) && regionIncludes(south, b);
  }

  function suggestCoachType(pax, capacityRules) {
    const n = Number(pax) || 0;
    const rules = capacityRules || DEFAULT_CONFIG.vehicleCapacity;
    const hit = rules.find((v) => n >= v.min && n <= v.max);
    return hit ? hit.type : n > 45 ? "Large Coach" : "Car";
  }

  function coachCapacity(type, capacityRules) {
    const rules = capacityRules || DEFAULT_CONFIG.vehicleCapacity;
    const hit = rules.find((v) => v.type === type);
    if (hit) return hit.max;
    if (/vito/i.test(type)) return 7;
    if (/premium|standard car/i.test(type)) return 2;
    return 8;
  }

  function isAllocatable(b) {
    if (!b) return false;
    if (b.service === "Hotel" || b.service === "NoTRF") return false;
    if (b.locked || b.allocStatus === "LOCKED") return false;
    return true;
  }

  function dirOf(b) {
    if (b.dir) return b.dir;
    if (b.trfType === "A-H") return "Arrival";
    if (b.trfType === "H-A") return "Departure";
    if (b.trfType === "H-H") return "Internal";
    if (b.trfType === "A-T") return "RoundTour";
    return "Transfer";
  }

  function preferredVehicleRegion(cfg, depRegion, arrRegion) {
    const hit = (cfg.regionPriority || []).find(
      (r) => regionIncludes(r.dep, depRegion) && regionIncludes(r.arr, arrRegion)
    );
    return hit ? hit.vehicle : depRegion || arrRegion || "";
  }

  function scoreLabel(score, cfg) {
    const s = Math.round(score);
    if (s >= cfg.THRESHOLD_EXCELLENT) return { label: "EXCELLENT MATCH", tone: "excellent" };
    if (s >= cfg.THRESHOLD_GOOD) return { label: "GOOD MATCH", tone: "good" };
    if (s >= cfg.THRESHOLD_REVIEW) return { label: "REVIEW REQUIRED", tone: "review" };
    return { label: "DO NOT AUTO-COMBINE", tone: "reject" };
  }

  function maxPaxOf(books) {
    return Math.max(0, ...books.map((b) => Number(b.pax || 0)));
  }

  function combinedPax(books) {
    return books.reduce((n, b) => n + Number(b.pax || 0), 0);
  }

  function routeScore(cfg, a, b, kind) {
    let score = 0;
    const codes = [];
    const ra = a.region || "";
    const rb = b.region || "";
    if (regionMatch(ra, rb)) {
      score += cfg.SCORE_SAME_REGION;
      codes.push(REASON.REGION_MATCH);
    } else if (isNearby(cfg, ra, rb)) {
      score += cfg.SCORE_NEARBY_REGION;
      codes.push(REASON.ROUTE_MATCH);
    } else if (sameCorridor(cfg, ra, rb)) {
      score += Math.round(cfg.SCORE_NEARBY_REGION * 0.7);
      codes.push(REASON.ROUTE_MATCH);
    } else {
      score += cfg.SCORE_HIGH_DETOUR;
      codes.push(REASON.NO_MATCH_ROUTE);
    }
    if (kind === COMBINE_TYPES.DEP_ARR || kind === COMBINE_TYPES.ARR_DEP || kind === COMBINE_TYPES.BACK_TO_BACK) {
      score += cfg.SCORE_BACK_TO_BACK_AIRPORT;
      codes.push(REASON.BACK_TO_BACK_MATCH);
    }
    if (regionMatch(ra, rb) || isNearby(cfg, ra, rb)) {
      score += cfg.SCORE_LOW_EMPTY_KM;
      codes.push(REASON.LOW_EMPTY_KM);
    }
    return { score, codes };
  }

  function hardBlockIndividualShare(a, b) {
    if (a.service === "Individual" || b.service === "Individual") {
      return "Individual / Private transfer cannot be shared with unrelated groups.";
    }
    return null;
  }

  /** Arrival + Arrival within window, same corridor */
  function evalArrArr(a, b, cfg) {
    const rejections = [];
    const reasons = [];
    const codes = [];
    const ind = hardBlockIndividualShare(a, b);
    if (ind) rejections.push(ind);

    const ta = minutesFromHhmm(a.time);
    const tb = minutesFromHhmm(b.time);
    if (ta == null || tb == null) rejections.push("Missing flight times.");
    const gap = ta != null && tb != null ? Math.abs(tb - ta) : 9999;
    if (gap > cfg.ARRIVAL_FLIGHT_GROUPING_WINDOW) {
      rejections.push(`Flight gap ${gap}m exceeds ARRIVAL window ${cfg.ARRIVAL_FLIGHT_GROUPING_WINDOW}m.`);
      codes.push(REASON.NO_MATCH_TIME);
    } else {
      reasons.push(`Flights within ${gap}m (≤${cfg.ARRIVAL_FLIGHT_GROUPING_WINDOW}m).`);
      codes.push(REASON.FLIGHT_MATCH, REASON.TIME_MATCH);
    }

    if (!regionMatch(a.region, b.region) && !isNearby(cfg, a.region, b.region) && !sameCorridor(cfg, a.region, b.region)) {
      rejections.push("Destination regions not compatible for shared arrival.");
      codes.push(REASON.NO_MATCH_ROUTE);
    } else {
      reasons.push(`Same destination corridor: ${a.region} / ${b.region}.`);
    }

    const books = [a, b];
    const pax = combinedPax(books);
    const coach = suggestCoachType(pax, cfg.vehicleCapacity);
    const req = [a.requested, b.requested].filter(Boolean)[0] || "";
    if (req && req !== coach) {
      reasons.push(`Vehicle Change Recommendation: client asked ${req}, AI suggests ${coach} for ${pax} pax — Ops approval required.`);
      codes.push(REASON.CLIENT_REQUESTED_VEHICLE);
    } else {
      codes.push(REASON.CAPACITY_MATCH);
    }

    const rs = routeScore(cfg, a, b, COMBINE_TYPES.ARR_ARR);
    let score = 55 + rs.score;
    if (gap <= 15) score += 10;
    if (rejections.length) score = Math.min(score, cfg.THRESHOLD_REVIEW - 1);

    const first = ta <= tb ? a : b;
    const second = first === a ? b : a;
    return {
      ok: rejections.length === 0,
      type: COMBINE_TYPES.ARR_ARR,
      bookingIds: [a.id, b.id],
      books,
      score: Math.max(0, Math.min(100, score)),
      coach: req || coach,
      maxPax: Math.max(Number(a.pax || 0), Number(b.pax || 0)),
      combinedPax: pax,
      waitMin: gap,
      reasons,
      rejections,
      codes: [...new Set([...codes, ...rs.codes])],
      chain: [
        { t: first.time, place: "Airport", label: `ARR ${first.flight}`, pax: first.pax, hotel: first.hotel },
        { t: second.time, place: "Airport", label: `ARR ${second.flight}`, pax: second.pax, hotel: second.hotel },
        { t: "", place: first.region, label: `→ ${first.hotel}`, pax: "", hotel: "" },
        { t: "", place: second.region, label: `→ ${second.hotel}`, pax: "", hotel: "" },
      ],
      summary: `Arrival + Arrival · ${a.flight}/${b.flight} · ${pax} pax · ${a.region}`,
    };
  }

  /** Departure + Departure within 60m */
  function evalDepDep(a, b, cfg) {
    const rejections = [];
    const reasons = [];
    const codes = [];
    const ind = hardBlockIndividualShare(a, b);
    if (ind) rejections.push(ind);

    const ta = minutesFromHhmm(a.time);
    const tb = minutesFromHhmm(b.time);
    const gap = ta != null && tb != null ? Math.abs(tb - ta) : 9999;
    if (gap > cfg.DEPARTURE_FLIGHT_GROUPING_WINDOW) {
      rejections.push(`Flight gap ${gap}m exceeds DEPARTURE window ${cfg.DEPARTURE_FLIGHT_GROUPING_WINDOW}m.`);
      codes.push(REASON.NO_MATCH_TIME);
    } else {
      reasons.push(`Departures within ${gap}m — use earliest flight as controlling.`);
      codes.push(REASON.FLIGHT_MATCH, REASON.TIME_MATCH);
    }

    if (!regionMatch(a.region, b.region) && !isNearby(cfg, a.region, b.region) && !sameCorridor(cfg, a.region, b.region)) {
      rejections.push("Pick-up regions not compatible.");
      codes.push(REASON.NO_MATCH_ROUTE);
    }

    const earliest = ta <= tb ? a : b;
    const buffer = gap > 0 ? cfg.COMBINED_DEPARTURE_BUFFER : cfg.STANDARD_AIRPORT_BUFFER;
    reasons.push(`Target airport ~${buffer} min before first flight ${earliest.flight} ${earliest.time}.`);

    const books = [a, b];
    const pax = combinedPax(books);
    const maxP = maxPaxOf(books);
    const coach = suggestCoachType(Math.max(pax, maxP), cfg.vehicleCapacity);
    const rs = routeScore(cfg, a, b, COMBINE_TYPES.DEP_DEP);
    let score = 52 + rs.score;
    if (rejections.length) score = Math.min(score, cfg.THRESHOLD_REVIEW - 1);

    return {
      ok: rejections.length === 0,
      type: COMBINE_TYPES.DEP_DEP,
      bookingIds: [a.id, b.id],
      books,
      score: Math.max(0, Math.min(100, score)),
      coach,
      maxPax: maxP,
      combinedPax: pax,
      controllingFlight: earliest,
      airportBufferMin: buffer,
      reasons,
      rejections,
      codes: [...new Set([...codes, ...rs.codes, REASON.CAPACITY_MATCH])],
      chain: [
        { t: "", place: a.hotel, label: `DEP ${a.flight}`, pax: a.pax, hotel: a.region },
        { t: "", place: b.hotel, label: `DEP ${b.flight}`, pax: b.pax, hotel: b.region },
        { t: earliest.time, place: "Airport", label: `Drop ~${buffer}m before ${earliest.flight}`, pax: "", hotel: "" },
      ],
      summary: `Departure + Departure · control ${earliest.flight} · ${pax} pax`,
    };
  }

  /** Departure → Arrival back-to-back */
  function evalDepArr(dep, arr, cfg) {
    const rejections = [];
    const reasons = [];
    const codes = [];
    const ind = hardBlockIndividualShare(dep, arr);
    if (ind) rejections.push(ind);

    const depT = minutesFromHhmm(dep.time);
    const arrT = minutesFromHhmm(arr.time);
    const wait = waitMinutes(depT, arrT);
    if (wait == null) rejections.push("Missing flight times.");
    else if (wait > cfg.MAX_BACK_TO_BACK_WAIT) {
      rejections.push(`Combination outside allowed waiting window (${Math.round(wait / 60)}h > ${cfg.MAX_BACK_TO_BACK_WAIT / 60}h).`);
      codes.push(REASON.MAX_WAIT_EXCEEDED);
    } else {
      reasons.push(`Waiting ${Math.round(wait / 60)}h ${wait % 60}m within ${cfg.MAX_BACK_TO_BACK_WAIT / 60}h max.`);
      codes.push(REASON.MAX_WAIT_OK, REASON.BACK_TO_BACK_MATCH);
    }

    reasons.push(`Vehicle must be at airport ≥${cfg.ARRIVAL_READY_BUFFER}m before arrival ${arr.flight}.`);
    if (wait != null && wait < cfg.ARRIVAL_READY_BUFFER) {
      rejections.push(`Impossible connection — need ${cfg.ARRIVAL_READY_BUFFER}m ready buffer before arrival.`);
      codes.push(REASON.NO_MATCH_TIME);
    }

    const maxP = Math.max(Number(dep.pax || 0), Number(arr.pax || 0));
    const coach = suggestCoachType(maxP, cfg.vehicleCapacity);
    reasons.push(`Capacity uses higher pax (Dep ${dep.pax} / Arr ${arr.pax}) → ${coach}.`);
    codes.push(REASON.CAPACITY_MATCH);

    const prefer = preferredVehicleRegion(cfg, dep.region, arr.region);
    reasons.push(`Regional priority → prefer ${prefer || dep.region} vehicles (departure-first).`);
    codes.push(REASON.REGION_MATCH);

    const rs = routeScore(cfg, dep, arr, COMBINE_TYPES.DEP_ARR);
    let score = 50 + rs.score;
    if (wait != null && wait <= 180) score += 12;
    else if (wait != null && wait <= 360) score += 6;
    if (wait != null && wait > 420) score += cfg.SCORE_TIMING_RISK / 2;
    if (rejections.length) score = Math.min(score, cfg.THRESHOLD_REVIEW - 1);

    return {
      ok: rejections.length === 0,
      type: COMBINE_TYPES.DEP_ARR,
      bookingIds: [dep.id, arr.id],
      books: [dep, arr],
      score: Math.max(0, Math.min(100, score)),
      coach,
      maxPax: maxP,
      combinedPax: Number(dep.pax || 0) + Number(arr.pax || 0),
      waitMin: wait,
      preferredRegion: prefer,
      reasons,
      rejections,
      codes: [...new Set([...codes, ...rs.codes])],
      chain: [
        { t: "", place: dep.hotel || dep.region, label: `DEP #${dep.id} ${dep.flight}`, pax: dep.pax, hotel: dep.region },
        { t: dep.time, place: "Airport", label: "Drop departure", pax: "", hotel: "" },
        { t: arr.time, place: "Airport", label: `ARR #${arr.id} ${arr.flight}`, pax: arr.pax, hotel: "" },
        { t: "", place: arr.hotel || arr.region, label: "Drop arrival", pax: "", hotel: arr.region },
      ],
      summary: `Dep→Arr · ${dep.region} → Airport → ${arr.region} · wait ${wait != null ? Math.round(wait / 60) + "h" : "—"}`,
    };
  }

  /** Arrival → Departure (continue chain) */
  function evalArrDep(arr, dep, cfg) {
    const rejections = [];
    const reasons = [];
    const codes = [];
    const ind = hardBlockIndividualShare(arr, dep);
    if (ind) rejections.push(ind);

    const arrT = minutesFromHhmm(arr.time);
    const depT = minutesFromHhmm(dep.time);
    const travel = Math.round(Number(arr.travelHrs || dep.travelHrs || 2.5) * 60);
    if (arrT == null || depT == null) rejections.push("Missing times.");
    else if (arr.date === dep.date && depT <= arrT) {
      rejections.push("Departure is before arrival on the same day — cannot chain Arr→Dep.");
      codes.push(REASON.NO_MATCH_TIME);
    } else {
      const gap = waitMinutes(arrT, depT);
      if (gap < travel + 60) {
        rejections.push(`Impossible travel time after arrival drop (need ~${Math.round((travel + 60) / 60)}h).`);
        codes.push(REASON.NO_MATCH_TIME);
      } else {
        reasons.push(`Arrival then next departure feasible with ${Math.round(gap / 60)}h window.`);
        codes.push(REASON.TIME_MATCH, REASON.BACK_TO_BACK_MATCH);
      }
    }

    if (!regionMatch(arr.region, dep.region) && !isNearby(cfg, arr.region, dep.region)) {
      rejections.push("Arrival drop region far from next departure pick-up.");
      codes.push(REASON.NO_MATCH_ROUTE);
    }

    const maxP = Math.max(Number(arr.pax || 0), Number(dep.pax || 0));
    const coach = suggestCoachType(maxP, cfg.vehicleCapacity);
    const prefer = preferredVehicleRegion(cfg, dep.region, arr.region);
    const rs = routeScore(cfg, arr, dep, COMBINE_TYPES.ARR_DEP);
    let score = 48 + rs.score;
    if (rejections.length) score = Math.min(score, cfg.THRESHOLD_REVIEW - 1);

    return {
      ok: rejections.length === 0,
      type: COMBINE_TYPES.ARR_DEP,
      bookingIds: [arr.id, dep.id],
      books: [arr, dep],
      score: Math.max(0, Math.min(100, score)),
      coach,
      maxPax: maxP,
      preferredRegion: prefer,
      reasons,
      rejections,
      codes: [...new Set([...codes, ...rs.codes, REASON.CAPACITY_MATCH])],
      chain: [
        { t: arr.time, place: "Airport", label: `ARR ${arr.flight}`, pax: arr.pax, hotel: "" },
        { t: "", place: arr.hotel || arr.region, label: "Drop", pax: "", hotel: arr.region },
        { t: "", place: dep.hotel || dep.region, label: `DEP ${dep.flight}`, pax: dep.pax, hotel: dep.region },
        { t: dep.time, place: "Airport", label: "Airport drop", pax: "", hotel: "" },
      ],
      summary: `Arr→Dep · ${arr.region} → ${dep.region} → Airport`,
    };
  }

  function evalInternalReturn(a, b, cfg) {
    const rejections = [];
    const reasons = [];
    if (dirOf(a) !== "Internal" && a.trfType !== "H-H") rejections.push("Not an internal transfer.");
    if (dirOf(b) !== "Internal" && b.trfType !== "H-H") rejections.push("Return leg not internal.");
    // Opposite direction heuristic via hotel strings
    reasons.push("Return transfer available — avoid empty reposition.");
    const maxP = Math.max(Number(a.pax || 0), Number(b.pax || 0));
    const coach = suggestCoachType(maxP, cfg.vehicleCapacity);
    let score = 70 + (regionMatch(a.region, b.region) ? 10 : 0);
    if (rejections.length) score = 40;
    return {
      ok: rejections.length === 0,
      type: COMBINE_TYPES.INTERNAL_RETURN,
      bookingIds: [a.id, b.id],
      books: [a, b],
      score,
      coach,
      maxPax: maxP,
      reasons: reasons.concat(rejections.length ? [] : ["LOW empty km on return leg."]),
      rejections,
      codes: [REASON.LOW_EMPTY_KM, REASON.ROUTE_MATCH, REASON.CAPACITY_MATCH],
      chain: [
        { t: a.time, place: a.hotel, label: "Outbound internal", pax: a.pax, hotel: a.region },
        { t: b.time, place: b.hotel, label: "RETURN TRANSFER", pax: b.pax, hotel: b.region },
      ],
      summary: `Internal + Return · ${a.region}`,
    };
  }

  function evalFeeder(mainBooks, feederBooks, cfg) {
    const mainPax = combinedPax(mainBooks);
    const feedPax = combinedPax(feederBooks);
    const mainRegion = mainBooks[0]?.region || "";
    const feedRegion = feederBooks[0]?.region || "";
    const inter =
      (cfg.interchanges || []).find((i) =>
        i.regions.some((r) => regionIncludes([r], mainRegion) || regionIncludes([r], feedRegion))
      ) || cfg.interchanges?.[0];
    const reasons = [
      `MAIN vehicle corridor ${mainRegion} (${mainPax} pax)`,
      `FEEDER from ${feedRegion} (${feedPax} pax)`,
      `Meeting point: ${inter?.name || "Highway interchange"}`,
      "Feeder must reach interchange before main coach.",
    ];
    return {
      ok: true,
      type: COMBINE_TYPES.MAIN_FEEDER,
      bookingIds: [...mainBooks.map((b) => b.id), ...feederBooks.map((b) => b.id)],
      books: [...mainBooks, ...feederBooks],
      score: 78,
      coach: suggestCoachType(mainPax, cfg.vehicleCapacity),
      feederCoach: suggestCoachType(feedPax, cfg.vehicleCapacity),
      interchange: inter,
      mainPax,
      feedPax,
      reasons,
      rejections: [],
      codes: [REASON.FEEDER_REQUIRED, REASON.ROUTE_MATCH, REASON.CAPACITY_MATCH],
      chain: [
        { t: "", place: feedRegion, label: "FEEDER pick-up", pax: feedPax, hotel: "" },
        { t: "", place: inter?.name || "Interchange", label: "MEETING POINT", pax: "", hotel: "" },
        { t: "", place: mainRegion, label: "MAIN coach join", pax: mainPax, hotel: "" },
        { t: "", place: "Airport", label: "Continue", pax: mainPax + feedPax, hotel: "" },
      ],
      summary: `Main + Feeder · ${inter?.name || "interchange"} · +${feedPax} pax`,
      feederRequired: true,
    };
  }

  function evalLastMile(mainBooks, minorityBooks, cfg) {
    const mainPax = combinedPax(mainBooks);
    const minPax = combinedPax(minorityBooks);
    const inter =
      (cfg.interchanges || []).find((i) =>
        minorityBooks.some((b) => i.regions.some((r) => regionIncludes([r], b.region)))
      ) || { name: "Highway Junction" };
    return {
      ok: true,
      type: COMBINE_TYPES.MAIN_LAST_MILE,
      bookingIds: [...mainBooks.map((b) => b.id), ...minorityBooks.map((b) => b.id)],
      books: [...mainBooks, ...minorityBooks],
      score: 76,
      coach: suggestCoachType(mainPax + minPax, cfg.vehicleCapacity),
      shuttleCoach: suggestCoachType(minPax, cfg.vehicleCapacity),
      interchange: inter,
      reasons: [
        `MAIN COACH to ${mainBooks[0]?.region} corridor (${mainPax} pax)`,
        `LAST-MILE SHUTTLE ${inter.name || "junction"} → ${minorityBooks[0]?.region} (${minPax} pax)`,
        "Avoids sending large coach far for small party — mileage advantage.",
      ],
      rejections: [],
      codes: [REASON.SHUTTLE_REQUIRED, REASON.LOW_EMPTY_KM],
      chain: [
        { t: "", place: "Airport", label: "MAIN COACH", pax: mainPax + minPax, hotel: "" },
        { t: "", place: inter.name || "Junction", label: "Split", pax: "", hotel: "" },
        { t: "", place: minorityBooks[0]?.region, label: "LAST-MILE SHUTTLE", pax: minPax, hotel: minorityBooks[0]?.hotel },
      ],
      summary: `Main + Last-mile · ${minPax} pax continue to ${minorityBooks[0]?.region}`,
      shuttleRequired: true,
    };
  }

  function findCombinations(bookings, config) {
    const cfg = mergeConfig(config);
    const list = (bookings || []).filter(isAllocatable);
    const deps = list.filter((b) => dirOf(b) === "Departure");
    const arrs = list.filter((b) => dirOf(b) === "Arrival");
    const internals = list.filter((b) => dirOf(b) === "Internal" || b.trfType === "H-H");
    const proposals = [];
    const usedPairs = new Set();

    function add(p) {
      if (!p) return;
      const key = p.bookingIds.slice().sort().join("|") + ":" + p.type;
      if (usedPairs.has(key)) return;
      usedPairs.add(key);
      proposals.push(p);
    }

    for (let i = 0; i < arrs.length; i++) {
      for (let j = i + 1; j < arrs.length; j++) {
        if (arrs[i].date !== arrs[j].date) continue;
        add(evalArrArr(arrs[i], arrs[j], cfg));
      }
    }
    for (let i = 0; i < deps.length; i++) {
      for (let j = i + 1; j < deps.length; j++) {
        if (deps[i].date !== deps[j].date) continue;
        add(evalDepDep(deps[i], deps[j], cfg));
      }
    }
    deps.forEach((dep) => {
      arrs.forEach((arr) => {
        if (dep.date !== arr.date && Math.abs(new Date(dep.date) - new Date(arr.date)) > 86400000) return;
        add(evalDepArr(dep, arr, cfg));
      });
    });
    arrs.forEach((arr) => {
      deps.forEach((dep) => {
        if (arr.date !== dep.date) return;
        add(evalArrDep(arr, dep, cfg));
      });
    });
    for (let i = 0; i < internals.length; i++) {
      for (let j = i + 1; j < internals.length; j++) {
        add(evalInternalReturn(internals[i], internals[j], cfg));
      }
    }

    // Feeder: south main mass + upper minority same date/direction
    const byDateDir = new Map();
    list
      .filter((b) => dirOf(b) === "Departure" || dirOf(b) === "Arrival")
      .forEach((b) => {
        const k = `${b.date}|${dirOf(b)}`;
        if (!byDateDir.has(k)) byDateDir.set(k, []);
        byDateDir.get(k).push(b);
      });
    byDateDir.forEach((group) => {
      const south = group.filter((b) => regionIncludes(cfg.southCorridor.slice(0, 6), b.region));
      const upper = group.filter((b) => /kalutara|panadura|colombo|negombo|bentota/i.test(b.region));
      if (south.length >= 2 && upper.length >= 1 && combinedPax(south) >= 6) {
        add(evalFeeder(south, upper, cfg));
      }
      // Last-mile: majority one region, minority far south
      const byReg = new Map();
      group.forEach((b) => {
        const r = b.region || "?";
        if (!byReg.has(r)) byReg.set(r, []);
        byReg.get(r).push(b);
      });
      let main = [];
      let mainR = "";
      byReg.forEach((books, r) => {
        if (books.length > main.length) {
          main = books;
          mainR = r;
        }
      });
      const minority = [];
      byReg.forEach((books, r) => {
        if (r !== mainR && /tangalle|yala|hambantota/i.test(r)) minority.push(...books);
      });
      if (main.length >= 2 && minority.length && combinedPax(minority) <= 4) {
        add(evalLastMile(main, minority, cfg));
      }
    });

    // Duty chains: Dep→Arr→Dep
    const depArrOk = proposals.filter((p) => p.ok && p.type === COMBINE_TYPES.DEP_ARR);
    depArrOk.forEach((da) => {
      const arrId = da.bookingIds[1];
      const arr = arrs.find((x) => x.id === arrId);
      if (!arr) return;
      deps.forEach((nextDep) => {
        if (da.bookingIds.includes(nextDep.id)) return;
        const ad = evalArrDep(arr, nextDep, cfg);
        if (!ad.ok) return;
        const chainScore = Math.round((da.score + ad.score) / 2) + 5;
        add({
          ok: true,
          type: COMBINE_TYPES.BACK_TO_BACK,
          bookingIds: [...da.bookingIds, nextDep.id],
          books: [...da.books, nextDep],
          score: Math.min(100, chainScore),
          coach: suggestCoachType(Math.max(da.maxPax, Number(nextDep.pax || 0)), cfg.vehicleCapacity),
          maxPax: Math.max(da.maxPax, Number(nextDep.pax || 0)),
          reasons: [
            "VEHICLE DUTY CHAIN evaluated as whole (not pairwise only).",
            ...da.reasons.slice(0, 3),
            ...ad.reasons.slice(0, 2),
          ],
          rejections: [],
          codes: [REASON.BACK_TO_BACK_MATCH, REASON.TIME_MATCH, REASON.ROUTE_MATCH],
          chain: [...(da.chain || []), ...(ad.chain || []).slice(2)],
          summary: `Duty chain · Dep→Arr→Dep · ${da.books[0]?.region} → ${arr.region} → Airport`,
          isChain: true,
        });
      });
    });

    return proposals
      .map((p) => ({ ...p, ...scoreLabel(p.score, cfg), canAuto: p.ok && p.score >= cfg.THRESHOLD_AUTO }))
      .sort((a, b) => b.score - a.score);
  }

  function rankVehicles({ booking, books, proposal, vehicles, config }) {
    const cfg = mergeConfig(config);
    const fleet = vehicles && vehicles.length ? vehicles : DEMO_FLEET;
    const set = books || (booking ? [booking] : proposal?.books || []);
    const maxP = proposal?.maxPax != null ? proposal.maxPax : maxPaxOf(set);
    const requested = set.map((b) => b.requested).filter(Boolean)[0] || proposal?.coach || "";
    const coach = requested || proposal?.coach || suggestCoachType(maxP, cfg.vehicleCapacity);
    const prefer =
      proposal?.preferredRegion ||
      preferredVehicleRegion(cfg, set.find((b) => dirOf(b) === "Departure")?.region, set.find((b) => dirOf(b) === "Arrival")?.region) ||
      set[0]?.region ||
      "";

    const reasonsBase = [];
    reasonsBase.push(`Required capacity ≥ ${maxP} pax → ${coach}`);
    if (requested) reasonsBase.push(`Client requested ${requested}`);
    if (prefer) reasonsBase.push(`Prefer region ${prefer}`);

    const scored = fleet
      .map((v) => {
        const why = [];
        const codes = [];
        let score = 0;
        const cap = Number(v.capacity || coachCapacity(v.type, cfg.vehicleCapacity));
        if (cap < maxP) {
          return null;
        }
        score += 30;
        why.push(`✓ Capacity suitable for ${maxP} PAX (${cap})`);
        codes.push(REASON.CAPACITY_MATCH);

        if (requested && (v.type === requested || String(v.type).includes(requested))) {
          score += 25;
          why.push(`✓ Matches requested ${requested}`);
          codes.push(REASON.CLIENT_REQUESTED_VEHICLE);
        } else if (v.type === coach || String(v.type).includes(String(coach).split(" ")[0])) {
          score += 18;
          why.push(`✓ Type match ${v.type}`);
        } else {
          score += 5;
          why.push(`○ Type ${v.type} (AI suggests ${coach})`);
        }

        if (prefer && regionMatch(v.region, prefer)) {
          score += 40;
          why.push(`✓ Vehicle currently in ${v.region} (preferred)`);
          codes.push(REASON.VEHICLE_NEARBY, REASON.REGION_MATCH);
        } else if (set.some((b) => regionMatch(v.region, b.region))) {
          score += 25;
          why.push(`✓ In operating region ${v.region}`);
          codes.push(REASON.VEHICLE_NEARBY);
        } else if (set.some((b) => isNearby(cfg, v.region, b.region))) {
          score += 15;
          why.push(`○ Nearby region ${v.region}`);
        } else {
          score += 2;
          why.push(`○ Positioned in ${v.region}`);
        }

        if (String(v.status || "Available") === "Available") {
          score += 10;
          why.push("✓ Available — no schedule conflict");
        } else {
          score -= 40;
          why.push(`✗ Status ${v.status}`);
          codes.push(REASON.VEHICLE_CONFLICT);
        }

        if (v.driver) {
          score += 5;
          why.push(`✓ Driver ${v.driver}`);
          codes.push(REASON.DRIVER_AVAILABLE);
        }

        if (proposal?.type === COMBINE_TYPES.DEP_ARR || proposal?.isChain) {
          score += 8;
          why.push("✓ Suitable for back-to-back / duty chain");
          codes.push(REASON.BACK_TO_BACK_MATCH);
        }

        const pct = Math.max(0, Math.min(100, Math.round(score)));
        return {
          ...v,
          score: pct,
          why,
          codes: [...new Set(codes)],
          changeRecommendation: requested && v.type !== requested ? `Vehicle Change Recommendation: ${requested} → ${v.type}` : null,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    return {
      coach,
      maxPax: maxP,
      preferredRegion: prefer,
      reasonsBase,
      candidates: scored,
      best: scored[0] || null,
      alternatives: scored.slice(1, 3),
    };
  }

  function buildAllocationPlan(bookings, vehicles, config) {
    const cfg = mergeConfig(config);
    const list = (bookings || []).filter((b) => b.service !== "Hotel" && b.service !== "NoTRF");
    const combinations = findCombinations(list, cfg);
    const assigned = new Set();
    const rows = [];
    const chains = [];
    const conflicts = [];
    let vehiclesSaved = 0;
    let combinedCount = 0;
    let feederCount = 0;
    let b2bCount = 0;
    let reviewCount = 0;

    // Accept top non-overlapping OK proposals first
    combinations
      .filter((p) => p.ok)
      .forEach((p) => {
        if (p.bookingIds.some((id) => assigned.has(id))) return;
        if (p.score < cfg.THRESHOLD_REVIEW) return;
        p.bookingIds.forEach((id) => assigned.add(id));
        const rank = rankVehicles({ books: p.books, proposal: p, vehicles, config: cfg });
        const entry = {
          ...p,
          vehicle: rank.best,
          alternatives: rank.alternatives,
          rank,
          allocStatus: p.canAuto ? "AI_MATCH_FOUND" : "PROPOSED",
          combineStatus: p.canAuto ? "AI_PROPOSED" : "MANUAL_REVIEW",
        };
        chains.push(entry);
        combinedCount += 1;
        if (p.feederRequired || p.type === COMBINE_TYPES.MAIN_FEEDER) feederCount += 1;
        if (p.type === COMBINE_TYPES.DEP_ARR || p.type === COMBINE_TYPES.BACK_TO_BACK || p.isChain) b2bCount += 1;
        if (!p.canAuto) reviewCount += 1;
        vehiclesSaved += Math.max(0, p.bookingIds.length - 1);
        p.books.forEach((b) => {
          rows.push(makeBoardRow(b, entry, cfg, rank));
        });
      });

    list.forEach((b) => {
      if (assigned.has(b.id)) return;
      if (b.locked || b.allocStatus === "LOCKED") {
        rows.push(makeBoardRow(b, null, cfg, null));
        return;
      }
      const rank = rankVehicles({ booking: b, vehicles, config: cfg });
      const solo = {
        ok: !!rank.best,
        type: COMBINE_TYPES.NONE,
        bookingIds: [b.id],
        books: [b],
        score: rank.best?.score || 0,
        coach: rank.coach,
        reasons: rank.reasonsBase.concat(rank.best?.why || []),
        rejections: rank.best ? [] : ["No suitable vehicle"],
        codes: rank.best?.codes || [REASON.NO_MATCH_CAPACITY],
        vehicle: rank.best,
        alternatives: rank.alternatives,
        rank,
        allocStatus: rank.best ? "AI_MATCH_FOUND" : "UNALLOCATED",
        combineStatus: "NOT_COMBINED",
        summary: `Solo · ${dirOf(b)} · ${b.region}`,
        chain: [
          {
            t: b.time,
            place: dirOf(b) === "Arrival" ? "Airport" : b.hotel || b.region,
            label: `${dirOf(b)} ${b.flight || ""}`.trim(),
            pax: b.pax,
            hotel: b.hotel,
          },
          {
            t: "",
            place: dirOf(b) === "Arrival" ? b.hotel || b.region : "Airport",
            label: "Drop",
            pax: "",
            hotel: "",
          },
        ],
      };
      Object.assign(solo, scoreLabel(solo.score, cfg));
      if (!rank.best) {
        conflicts.push({ bookingId: b.id, message: "Missing vehicle", severity: "error" });
        reviewCount += 1;
      }
      // Unawatuna shuttle flag
      if (/unawatuna/i.test(b.region || "") && Number(b.pax || 0) > cfg.UNAWATUNA_SHUTTLE_PAX) {
        solo.shuttleRequired = true;
        solo.reasons = (solo.reasons || []).concat([
          `Internal Shuttle Required — Unawatuna >${cfg.UNAWATUNA_SHUTTLE_PAX} pax on Mini/Large Coach.`,
        ]);
        solo.codes = [...(solo.codes || []), REASON.SHUTTLE_REQUIRED];
      }
      rows.push(makeBoardRow(b, solo, cfg, rank));
      chains.push(solo);
    });

    const unallocated = rows.filter((r) => r.allocStatus === "UNALLOCATED" || !r.assignedVehicle).length;
    const aiAllocated = rows.filter((r) => r.assignedVehicle && r.allocStatus !== "UNALLOCATED").length;
    const vehiclesRequired = new Set(rows.map((r) => r.assignedVehicle).filter(Boolean)).size || chains.filter((c) => c.vehicle).length;

    return {
      config: cfg,
      combinations,
      chains: chains.sort((a, b) => (b.score || 0) - (a.score || 0)),
      rows: rows.sort((a, b) => (minutesFromHhmm(a.time) || 0) - (minutesFromHhmm(b.time) || 0)),
      conflicts,
      summary: {
        totalTransfers: list.length,
        unallocated,
        aiAllocated,
        combinedTransfers: combinedCount,
        vehiclesRequired,
        vehiclesSaved,
        feederTransfers: feederCount,
        backToBack: b2bCount,
        conflicts: conflicts.length,
        manualReview: reviewCount,
        emptyKmAvoidedEst: vehiclesSaved * 45,
        combinedPax: rows.filter((r) => r.combineType && r.combineType !== "NONE").reduce((n, r) => n + Number(r.pax || 0), 0),
      },
    };
  }

  function makeBoardRow(b, plan, cfg, rank) {
    const v = plan?.vehicle || rank?.best || null;
    const score = plan?.score != null ? plan.score : v?.score || 0;
    const lbl = scoreLabel(score, cfg || DEFAULT_CONFIG);
    return {
      id: b.id,
      date: b.date,
      time: b.time,
      booking: b.ref || b.trNum || b.id,
      guest: b.guest || b.hotel || "",
      type: dirOf(b),
      trfType: b.trfType,
      flight: b.flight,
      pax: b.pax,
      from: dirOf(b) === "Arrival" ? "Airport" : b.hotel || b.region,
      to: dirOf(b) === "Arrival" ? b.hotel || b.region : "Airport",
      region: b.region,
      vehicleType: plan?.coach || rank?.coach || xferSafeCoach(b),
      assignedVehicle: v ? v.plate || v.id : "",
      vehicleId: v?.id || "",
      driver: v?.driver || "",
      combineType: plan?.type || COMBINE_TYPES.NONE,
      combineStatus: plan?.combineStatus || "NOT_COMBINED",
      aiScore: score,
      scoreLabel: lbl.label,
      scoreTone: lbl.tone,
      allocStatus: b.allocStatus || plan?.allocStatus || (v ? "AI_MATCH_FOUND" : "UNALLOCATED"),
      locked: !!b.locked,
      reasons: plan?.reasons || v?.why || [],
      codes: plan?.codes || v?.codes || [],
      rejections: plan?.rejections || [],
      chain: plan?.chain || null,
      planId: plan?.bookingIds?.join("|") || b.id,
      shuttleRequired: !!plan?.shuttleRequired || !!plan?.feederRequired,
      changeRecommendation: v?.changeRecommendation || null,
      raw: b,
    };
  }

  function xferSafeCoach(b) {
    return b.requested || suggestCoachType(b.pax, DEFAULT_CONFIG.vehicleCapacity);
  }

  function explainAllocation(rowOrPlan) {
    const reasons = rowOrPlan.reasons || rowOrPlan.why || [];
    const codes = rowOrPlan.codes || [];
    const vehicle = rowOrPlan.assignedVehicle || rowOrPlan.vehicle?.plate || rowOrPlan.plate || "—";
    return {
      title: `AI ALLOCATION REASON · ${vehicle}`,
      score: rowOrPlan.aiScore || rowOrPlan.score,
      label: rowOrPlan.scoreLabel || scoreLabel(rowOrPlan.score || 0, DEFAULT_CONFIG).label,
      reasons,
      codes,
      rejections: rowOrPlan.rejections || [],
      chain: rowOrPlan.chain || null,
    };
  }

  global.AiTransferEngine = {
    COMBINE_TYPES,
    REASON,
    XFER_STATUS,
    COMBINE_STATUS,
    DEFAULT_CONFIG,
    DEMO_FLEET,
    mergeConfig,
    minutesFromHhmm,
    fmtMinutes,
    suggestCoachType,
    findCombinations,
    rankVehicles,
    buildAllocationPlan,
    explainAllocation,
    scoreLabel,
    preferredVehicleRegion,
    dirOf,
  };
})(typeof window !== "undefined" ? window : globalThis);
