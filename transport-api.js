/**
 * Transport Operations API client — talks to /api/transport (SQLite-backed).
 * Falls back to null when server is offline so UI can show a clear error.
 */
(function (global) {
  const BASE = "";
  const USER_KEY = "ehi_transport_user_id";

  function userId() {
    return localStorage.getItem(USER_KEY) || "user_admin";
  }

  async function api(path, opts = {}) {
    const res = await fetch(BASE + path, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": userId(),
        ...(opts.headers || {}),
      },
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      const err = new Error(data?.error || data?.message || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  global.TransportAPI = {
    userId,
    setUserId(id) {
      localStorage.setItem(USER_KEY, id);
    },
    health: () => api("/api/transport/health"),
    me: () => api("/api/transport/me"),
    rules: () => api("/api/transport/rules"),
    dashboard: (date) => api("/api/transport/dashboard" + (date ? `?date=${encodeURIComponent(date)}` : "")),
    bookings: (params = {}) => {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v != null && v !== "") q.set(k, v);
      });
      return api("/api/transport/bookings?" + q.toString());
    },
    patchBooking: (id, body) =>
      api(`/api/transport/bookings/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) }),
    suggestions: (date) =>
      api("/api/transport/suggestions" + (date ? `?date=${encodeURIComponent(date)}` : "")),
    recommend: (body) => api("/api/transport/recommend", { method: "POST", body: JSON.stringify(body) }),
    jobs: (params = {}) => {
      const q = new URLSearchParams(params);
      return api("/api/transport/jobs?" + q.toString());
    },
    createJob: (body) => api("/api/transport/jobs", { method: "POST", body: JSON.stringify(body) }),
    allocate: (jobId, body) =>
      api(`/api/transport/jobs/${encodeURIComponent(jobId)}/allocate`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    combinePreview: (body) =>
      api("/api/transport/combine/preview", { method: "POST", body: JSON.stringify(body) }),
    combine: (body) => api("/api/transport/combine", { method: "POST", body: JSON.stringify(body) }),
    dissolve: (combId, reason) =>
      api(`/api/transport/combinations/${encodeURIComponent(combId)}/dissolve`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    dispatch: (jobId, resend) =>
      api(`/api/transport/jobs/${encodeURIComponent(jobId)}/dispatch`, {
        method: "POST",
        body: JSON.stringify({ resend: !!resend }),
      }),
    notify: (jobId, channel, recipient) =>
      api(`/api/transport/jobs/${encodeURIComponent(jobId)}/notify`, {
        method: "POST",
        body: JSON.stringify({ channel, recipient }),
      }),
    complete: (jobId, body) =>
      api(`/api/transport/jobs/${encodeURIComponent(jobId)}/complete`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    payment: (jobId, body) =>
      api(`/api/transport/jobs/${encodeURIComponent(jobId)}/payment`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    advance: (jobId, amount, reason) =>
      api(`/api/transport/jobs/${encodeURIComponent(jobId)}/advance`, {
        method: "POST",
        body: JSON.stringify({ amount, reason }),
      }),
    approvePayment: (jobId) =>
      api(`/api/transport/jobs/${encodeURIComponent(jobId)}/payment/approve`, {
        method: "POST",
        body: "{}",
      }),
    vehicles: () => api("/api/transport/vehicles"),
    drivers: () => api("/api/transport/drivers"),
    audit: (limit) => api("/api/transport/audit?limit=" + (limit || 100)),
    exportUrl: (params = {}) => {
      const q = new URLSearchParams(params);
      return `/api/transport/export?${q.toString()}`;
    },
    routeEvent: (body) =>
      api("/api/transport/route-events", { method: "POST", body: JSON.stringify(body) }),
    createShuttle: (body) =>
      api("/api/transport/shuttles", { method: "POST", body: JSON.stringify(body) }),
  };
})(window);
