/* Advanced itinerary features for Create Excursion — templates, day ops, contracts, share, status, security */
(function () {
  const CE_TPL_KEY = "ehi-ce-templates-v1";
  const CE_CONTRACT_KEY = "ehi-ce-hotel-contracts-v1";
  const CE_LOCK_KEY = "ehi-ce-edit-lock-v1";
  const CE_STATUS_FLOW = ["Draft", "Sent", "Follow Up", "Confirmed", "Invoice Sent", "Paid", "Lost", "Cancelled"];

  let ceEditSessionId = "sess-" + Date.now().toString(36);
  let ceItineraryId = null;
  let ceStatusLog = [];
  let ceShare = {
    enabled: true,
    link: "",
    expiryOn: false,
    expiryDate: "",
    b2bEditable: false,
    publicLink: false,
    allowAgentForward: true,
    viewCount: 0,
    lastViewed: "",
    notifyOnView: true,
  };
  let ceSecurity = {
    hideCosting: true,
    hideSupplierRates: true,
    hideMarkup: true,
    hideProfit: true,
    disableShare: false,
    disableForward: false,
  };
  let ceMapOpts = {
    show: true,
    position: "top",
    autoRoute: true,
    coloredTags: true,
    routeStyle: "line",
  };
  let ceGallery = [];
  let ceContentLang = "English";

  function ceLoadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function ceSaveJson(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  function ceEnsureAdvDay(row) {
    if (!row) return row;
    if (typeof ceEnsureDayShape === "function") ceEnsureDayShape(row);
    if (row.isLeisure == null) row.isLeisure = /leisure/i.test(row.place || "");
    if (!Array.isArray(row.dayIncludes)) row.dayIncludes = [];
    if (!Array.isArray(row.dayExcludes)) row.dayExcludes = [];
    if (row.dayExtraCost == null) row.dayExtraCost = 0;
    if (!row.mergedWith) row.mergedWith = null;
    if (!row.customRoomCategory) row.customRoomCategory = "";
    if (!row.customRoomType) row.customRoomType = "";
    if (!row.customMealPlan) row.customMealPlan = "";
    return row;
  }

  /* ---------- Day management ---------- */
  function ceMoveDay(from, to) {
    if (from < 0 || to < 0 || from >= ceDestRows.length || to >= ceDestRows.length) return;
    const [row] = ceDestRows.splice(from, 1);
    ceDestRows.splice(to, 0, row);
    ceActiveDay = to;
    ceRenderDestRows();
  }
  function ceSwitchDays(a, b) {
    if (a === b || a < 0 || b < 0 || a >= ceDestRows.length || b >= ceDestRows.length) return;
    const t = ceDestRows[a];
    ceDestRows[a] = ceDestRows[b];
    ceDestRows[b] = t;
    ceActiveDay = b;
    ceRenderDestRows();
  }
  function ceCopyDay(i) {
    if (!ceDestRows[i]) return;
    const clone = JSON.parse(JSON.stringify(ceDestRows[i]));
    clone.id = "day-" + Date.now();
    if (Array.isArray(clone.destinations)) clone.destinations.forEach((d) => (d.id = "dest-" + Math.random().toString(36).slice(2, 7)));
    if (Array.isArray(clone.experienceItems)) clone.experienceItems.forEach((d) => (d.id = "exp-" + Math.random().toString(36).slice(2, 7)));
    if (Array.isArray(clone.accommodations)) clone.accommodations.forEach((d) => (d.id = "acc-" + Math.random().toString(36).slice(2, 7)));
    if (Array.isArray(clone.transports)) clone.transports.forEach((d) => (d.id = "tr-" + Math.random().toString(36).slice(2, 7)));
    ceDestRows.splice(i + 1, 0, clone);
    ceActiveDay = i + 1;
    ceRenderDestRows();
    if (typeof deToast === "function") deToast("Day copied.", "ok");
  }
  function ceMergeDays(i) {
    if (i < 0 || i >= ceDestRows.length - 1) return;
    const a = ceEnsureAdvDay(ceDestRows[i]);
    const b = ceEnsureAdvDay(ceDestRows[i + 1]);
    const destA = (a.destinations[0] && a.destinations[0].name) || a.place;
    const destB = (b.destinations[0] && b.destinations[0].name) || b.place;
    if (String(destA).toLowerCase() !== String(destB).toLowerCase() && String(a.city).toLowerCase() !== String(b.city).toLowerCase()) {
      if (typeof deToast === "function") deToast("Merge only when destination/city matches.", "warn");
      return;
    }
    a.experienceItems = (a.experienceItems || []).concat(b.experienceItems || []);
    a.accommodations = (a.accommodations || []).concat(b.accommodations || []);
    a.transports = (a.transports || []).concat(b.transports || []);
    a.dayIncludes = (a.dayIncludes || []).concat(b.dayIncludes || []);
    a.dayExcludes = (a.dayExcludes || []).concat(b.dayExcludes || []);
    a.dayExtraCost = Number(a.dayExtraCost || 0) + Number(b.dayExtraCost || 0);
    a.highlights = [a.highlights, b.highlights].filter(Boolean).join("\n");
    a.mergedWith = (a.mergedWith || 1) + 1;
    ceDestRows.splice(i + 1, 1);
    ceActiveDay = i;
    ceRenderDestRows();
    if (typeof deToast === "function") deToast("Days merged.", "ok");
  }
  function ceUnmergeDay(i) {
    const a = ceDestRows[i];
    if (!a || !a.mergedWith) {
      if (typeof deToast === "function") deToast("This day is not merged.", "warn");
      return;
    }
    const half = Math.ceil((a.experienceItems || []).length / 2);
    const b = typeof ceBlankDay === "function" ? ceBlankDay(a.place, a.city) : JSON.parse(JSON.stringify(a));
    ceEnsureAdvDay(b);
    b.experienceItems = (a.experienceItems || []).splice(half);
    b.accommodations = (a.accommodations || []).splice(Math.ceil((a.accommodations || []).length / 2));
    b.transports = (a.transports || []).splice(Math.ceil((a.transports || []).length / 2));
    a.mergedWith = null;
    b.mergedWith = null;
    ceDestRows.splice(i + 1, 0, b);
    ceActiveDay = i;
    ceRenderDestRows();
    if (typeof deToast === "function") deToast("Day unmerged.", "ok");
  }
  function ceAutofillFromPrev(i) {
    if (i <= 0 || !ceDestRows[i - 1] || !ceDestRows[i]) return;
    const prev = ceEnsureAdvDay(ceDestRows[i - 1]);
    const cur = ceEnsureAdvDay(ceDestRows[i]);
    if (!cur.accommodations.length && prev.accommodations.length) {
      cur.accommodations = JSON.parse(JSON.stringify(prev.accommodations)).map((x) => {
        x.id = "acc-" + Math.random().toString(36).slice(2, 7);
        return x;
      });
    }
    if (!cur.transports.length && prev.transports.length) {
      const t = JSON.parse(JSON.stringify(prev.transports[0]));
      t.id = "tr-" + Math.random().toString(36).slice(2, 7);
      t.from = prev.city || t.to;
      t.to = cur.city || cur.place;
      cur.transports = [t];
    }
    cur.dayIncludes = cur.dayIncludes.length ? cur.dayIncludes : (prev.dayIncludes || []).slice();
    cur.dayExcludes = cur.dayExcludes.length ? cur.dayExcludes : (prev.dayExcludes || []).slice();
    if (typeof ceSyncLegacyFromTravsta === "function") ceSyncLegacyFromTravsta(cur);
    ceRenderDestRows();
    if (typeof deToast === "function") deToast("Filled from previous day.", "ok");
  }

  /* ---------- Templates ---------- */
  function ceTemplates() {
    return ceLoadJson(CE_TPL_KEY, []);
  }
  function ceSaveTemplates(list) {
    ceSaveJson(CE_TPL_KEY, list);
  }
  function ceRenderTemplates() {
    const box = document.getElementById("ce-tpl-list");
    if (!box) return;
    const q = (document.getElementById("ce-tpl-search") && document.getElementById("ce-tpl-search").value || "").toLowerCase();
    const cat = (document.getElementById("ce-tpl-cat-filter") && document.getElementById("ce-tpl-cat-filter").value) || "All";
    let list = ceTemplates();
    if (cat !== "All") list = list.filter((t) => t.category === cat);
    if (q) list = list.filter((t) => (t.name + " " + (t.category || "") + " " + (t.tags || "")).toLowerCase().includes(q));
    if (!list.length) {
      box.innerHTML = '<p class="ce-t-empty">No templates yet — create one or save the current itinerary as a template.</p>';
      return;
    }
    box.innerHTML = list
      .map(
        (t) =>
          '<article class="ce-tpl-card" data-tpl-id="' +
          ceEsc(t.id) +
          '"><div><strong>' +
          ceEsc(t.name) +
          '</strong><span>' +
          ceEsc(t.category || "General") +
          " · " +
          (t.days || []).length +
          " days</span></div><div class=\"ce-t-actions\">" +
          '<button type="button" class="btn-secondary" data-tpl-use="' +
          ceEsc(t.id) +
          '">Use</button>' +
          '<button type="button" class="btn-secondary" data-tpl-dup="' +
          ceEsc(t.id) +
          '">Duplicate</button>' +
          '<button type="button" class="btn-secondary" data-tpl-edit="' +
          ceEsc(t.id) +
          '">Edit</button>' +
          '<button type="button" class="btn-secondary" data-tpl-del="' +
          ceEsc(t.id) +
          '">Delete</button></div></article>'
      )
      .join("");
  }
  function ceSaveAsTemplate() {
    const name = (document.getElementById("ce-name") && document.getElementById("ce-name").value.trim()) || "Untitled template";
    const category = (document.getElementById("ce-tpl-category") && document.getElementById("ce-tpl-category").value) || "General";
    if (typeof cePersistBoardFields === "function") cePersistBoardFields();
    if (typeof ceCollectDestRows === "function") ceCollectDestRows();
    const list = ceTemplates();
    const tpl = {
      id: "tpl-" + Date.now(),
      name,
      category,
      tags: (document.getElementById("ce-tags") && document.getElementById("ce-tags").value) || "",
      days: JSON.parse(JSON.stringify(ceDestRows || [])),
      setup: ceCollectSetupSnapshot(),
      updated: new Date().toISOString(),
    };
    list.unshift(tpl);
    ceSaveTemplates(list);
    ceRenderTemplates();
    if (typeof deToast === "function") deToast("Saved as template.", "ok");
  }
  function ceUseTemplate(id) {
    const tpl = ceTemplates().find((t) => t.id === id);
    if (!tpl) return;
    ceDestRows = JSON.parse(JSON.stringify(tpl.days || []));
    ceActiveDay = 0;
    if (tpl.setup) ceApplySetupSnapshot(tpl.setup);
    if (tpl.name && document.getElementById("ce-name")) document.getElementById("ce-name").value = tpl.name;
    ceRenderDestRows();
    if (typeof deToast === "function") deToast("Template applied.", "ok");
  }
  function ceDuplicateTemplate(id) {
    const list = ceTemplates();
    const tpl = list.find((t) => t.id === id);
    if (!tpl) return;
    const copy = JSON.parse(JSON.stringify(tpl));
    copy.id = "tpl-" + Date.now();
    copy.name = tpl.name + " (copy)";
    list.unshift(copy);
    ceSaveTemplates(list);
    ceRenderTemplates();
  }

  function ceCollectSetupSnapshot() {
    const g = (id) => (document.getElementById(id) && document.getElementById(id).value) || "";
    return {
      language: g("ce-language"),
      category: g("ce-category"),
      tags: g("ce-tags"),
      season: g("ce-season-category"),
      channel: g("ce-channel"),
      type: g("ce-type"),
      client: g("ce-client"),
      region: g("ce-region"),
    };
  }
  function ceApplySetupSnapshot(s) {
    if (!s) return;
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el && v != null) el.value = v;
    };
    set("ce-language", s.language);
    set("ce-category", s.category);
    set("ce-tags", s.tags);
    set("ce-season-category", s.season);
    set("ce-channel", s.channel);
    set("ce-type", s.type);
    set("ce-client", s.client);
    set("ce-region", s.region);
  }

  /* ---------- Hotel contracts ---------- */
  function ceContracts() {
    return ceLoadJson(CE_CONTRACT_KEY, []);
  }
  function ceSaveContracts(list) {
    ceSaveJson(CE_CONTRACT_KEY, list);
  }
  function ceMatchContractRates(hotel, stayStart, stayEnd, roomCat, roomType, meal, market, season) {
    const list = ceContracts().filter((c) => c.status === "Approved" || c.status === "Active");
    return list.filter((c) => {
      if (hotel && c.hotel && c.hotel.toLowerCase() !== hotel.toLowerCase()) return false;
      if (roomCat && c.roomCategory && c.roomCategory !== roomCat) return false;
      if (roomType && c.roomType && c.roomType !== roomType) return false;
      if (meal && c.mealPlan && c.mealPlan !== meal) return false;
      if (market && c.market && c.market !== market) return false;
      if (season && c.season && c.season !== season) return false;
      if (c.validFrom && stayEnd && stayEnd < c.validFrom) return false;
      if (c.validTo && stayStart && stayStart > c.validTo) return false;
      if (c.stopSales) return false;
      if (c.blackouts && stayStart && (c.blackouts || []).some((b) => stayStart >= b.from && stayStart <= b.to)) return false;
      return true;
    });
  }
  function ceRenderContracts() {
    const box = document.getElementById("ce-contract-list");
    if (!box) return;
    const list = ceContracts();
    box.innerHTML = list.length
      ? list
          .map(
            (c) =>
              '<article class="ce-tpl-card"><div><strong>' +
              ceEsc(c.hotel) +
              "</strong><span>" +
              ceEsc(c.roomCategory + " / " + c.roomType + " / " + c.mealPlan) +
              " · " +
              ceEsc(c.market) +
              " · " +
              ceEsc(c.season) +
              " · " +
              ceEsc(c.status) +
              " · " +
              ceEsc(String(c.rate)) +
              " " +
              ceEsc(c.currency || "USD") +
              "</span></div><div class=\"ce-t-actions\">" +
              '<button type="button" class="btn-secondary" data-ctr-approve="' +
              ceEsc(c.id) +
              '">Approve</button>' +
              '<button type="button" class="btn-secondary" data-ctr-edit="' +
              ceEsc(c.id) +
              '">Edit</button>' +
              '<button type="button" class="btn-secondary" data-ctr-del="' +
              ceEsc(c.id) +
              '">Remove</button></div></article>'
          )
          .join("")
      : '<p class="ce-t-empty">No contracts yet — upload, AI-extract, or enter manually.</p>';
  }
  function ceAddManualContract() {
    const g = (id) => (document.getElementById(id) && document.getElementById(id).value) || "";
    const c = {
      id: "ctr-" + Date.now(),
      hotel: g("ce-ctr-hotel") || "Hotel",
      roomCategory: g("ce-ctr-room-cat") || "Deluxe",
      roomType: g("ce-ctr-room-type") || "Double",
      mealPlan: g("ce-ctr-meal") || "BB",
      market: g("ce-ctr-market") || "All",
      season: g("ce-ctr-season") || "Standard",
      rate: Number(g("ce-ctr-rate") || 0),
      currency: g("ce-ctr-currency") || "USD",
      validFrom: g("ce-ctr-from"),
      validTo: g("ce-ctr-to"),
      supplements: g("ce-ctr-supp"),
      blackouts: [],
      stopSales: !!(document.getElementById("ce-ctr-stop") && document.getElementById("ce-ctr-stop").checked),
      marketRestrictions: g("ce-ctr-restrict"),
      status: "Review",
    };
    const list = ceContracts();
    list.unshift(c);
    ceSaveContracts(list);
    ceRenderContracts();
    if (typeof deToast === "function") deToast("Contract saved for review.", "ok");
  }
  function ceAiExtractContract() {
    const hotel = (document.getElementById("ce-ctr-hotel") && document.getElementById("ce-ctr-hotel").value) || "Sample Hotel";
    const list = ceContracts();
    ["BB", "HB", "FB"].forEach((meal, i) => {
      list.unshift({
        id: "ctr-ai-" + Date.now() + "-" + i,
        hotel,
        roomCategory: "Deluxe",
        roomType: i === 0 ? "Double" : i === 1 ? "Twin" : "Suite",
        mealPlan: meal,
        market: "Europe",
        season: "Peak",
        rate: 95 + i * 20,
        currency: "USD",
        validFrom: "2026-01-01",
        validTo: "2026-12-31",
        supplements: "Extra bed +25",
        blackouts: [{ from: "2026-12-20", to: "2026-12-27" }],
        stopSales: false,
        marketRestrictions: "",
        status: "Review",
        aiExtracted: true,
      });
    });
    ceSaveContracts(list);
    ceRenderContracts();
    if (typeof deToast === "function") deToast("AI extracted sample rates — review & approve.", "ok");
  }

  /* ---------- Status ---------- */
  function ceSetStatus(next, remark) {
    const pill = document.querySelector(".ce-status-pill");
    const prev = (pill && pill.textContent.trim()) || "Draft";
    if (pill) pill.textContent = next;
    const entry = {
      previous: prev,
      next,
      by: "Staff",
      at: new Date().toISOString(),
      remarks: remark || "",
    };
    ceStatusLog.unshift(entry);
    ceRenderStatusLog();
    if (typeof deToast === "function") deToast("Status → " + next, "ok");
  }
  function ceRenderStatusLog() {
    const box = document.getElementById("ce-status-log");
    if (!box) return;
    box.innerHTML = ceStatusLog.length
      ? ceStatusLog
          .map(
            (e) =>
              "<div class=\"ce-status-row\"><strong>" +
              ceEsc(e.previous) +
              " → " +
              ceEsc(e.next) +
              "</strong><span>" +
              ceEsc(e.by) +
              " · " +
              ceEsc(new Date(e.at).toLocaleString()) +
              (e.remarks ? " · " + ceEsc(e.remarks) : "") +
              "</span></div>"
          )
          .join("")
      : '<p class="ce-t-empty">No status changes yet.</p>';
  }

  /* ---------- Share ---------- */
  function ceEnsureShareLink() {
    if (!ceShare.link) {
      ceItineraryId = ceItineraryId || "itin-" + Date.now().toString(36);
      ceShare.link = location.origin + location.pathname + "#share/" + ceItineraryId;
    }
    return ceShare.link;
  }
  function ceRenderShare() {
    const linkEl = document.getElementById("ce-share-link");
    if (linkEl) linkEl.value = ceEnsureShareLink();
    const setChk = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.checked = !!v;
    };
    setChk("ce-share-enabled", ceShare.enabled && !ceSecurity.disableShare);
    setChk("ce-share-public", ceShare.publicLink);
    setChk("ce-share-expiry-on", ceShare.expiryOn);
    setChk("ce-share-b2b", ceShare.b2bEditable);
    setChk("ce-share-forward", ceShare.allowAgentForward && !ceSecurity.disableForward);
    const forwardEl = document.getElementById("ce-share-forward");
    if (forwardEl) {
      forwardEl.disabled = !!ceShare.publicLink;
      forwardEl.closest("label")?.classList.toggle("is-disabled", !!ceShare.publicLink);
    }
    setChk("ce-share-notify", ceShare.notifyOnView);
    const exp = document.getElementById("ce-share-expiry-date");
    if (exp) exp.value = ceShare.expiryDate || "";
    const vc = document.getElementById("ce-share-views");
    if (vc) vc.textContent = String(ceShare.viewCount || 0);
    const lv = document.getElementById("ce-share-last");
    if (lv) lv.textContent = ceShare.lastViewed ? new Date(ceShare.lastViewed).toLocaleString() : "—";
  }
  function ceCopyShare() {
    const link = ceEnsureShareLink();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(
        () => typeof deToast === "function" && deToast("Share link copied.", "ok"),
        () => typeof deToast === "function" && deToast("Copy failed — select the share link manually.", "warn")
      );
      return;
    }
    const input = document.getElementById("ce-share-link");
    if (input) {
      input.focus();
      input.select();
      try {
        document.execCommand("copy");
        if (typeof deToast === "function") deToast("Share link copied.", "ok");
        return;
      } catch (e) {
        // Fall through to the explicit manual-copy message.
      }
    }
    if (typeof deToast === "function") deToast("Copy failed — select the share link manually.", "warn");
  }
  function ceOpenShare() {
    window.open(ceEnsureShareLink(), "_blank", "noopener,noreferrer");
  }

  /* ---------- Multi-user lock ---------- */
  function ceClaimLock() {
    ceItineraryId = ceItineraryId || "itin-draft";
    const locks = ceLoadJson(CE_LOCK_KEY, {});
    const existing = locks[ceItineraryId];
    const now = Date.now();
    if (existing && existing.sessionId !== ceEditSessionId && now - existing.at < 120000) {
      const banner = document.getElementById("ce-lock-banner");
      if (banner) {
        banner.hidden = false;
        banner.textContent = "Another user is currently editing this itinerary. (" + (existing.by || "Staff") + ")";
      }
      return false;
    }
    locks[ceItineraryId] = { sessionId: ceEditSessionId, by: "Staff", at: now };
    ceSaveJson(CE_LOCK_KEY, locks);
    const banner = document.getElementById("ce-lock-banner");
    if (banner) banner.hidden = true;
    return true;
  }
  function ceReleaseLock() {
    const locks = ceLoadJson(CE_LOCK_KEY, {});
    if (locks[ceItineraryId] && locks[ceItineraryId].sessionId === ceEditSessionId) {
      delete locks[ceItineraryId];
      ceSaveJson(CE_LOCK_KEY, locks);
    }
  }

  /* ---------- Day board toolbar inject ---------- */
  function ceDayOpsHtml(row, i) {
    return (
      '<div class="ce-day-ops">' +
      '<button type="button" class="btn-secondary" data-ce-day-op="up" data-i="' + i + '">↑ Move</button>' +
      '<button type="button" class="btn-secondary" data-ce-day-op="down" data-i="' + i + '">↓ Move</button>' +
      '<button type="button" class="btn-secondary" data-ce-day-op="switch" data-i="' + i + '">Switch</button>' +
      '<button type="button" class="btn-secondary" data-ce-day-op="copy" data-i="' + i + '">Copy day</button>' +
      '<button type="button" class="btn-secondary" data-ce-day-op="merge" data-i="' + i + '">Merge next</button>' +
      '<button type="button" class="btn-secondary" data-ce-day-op="unmerge" data-i="' + i + '">Unmerge</button>' +
      '<button type="button" class="btn-secondary" data-ce-day-op="autofill" data-i="' + i + '">Auto-fill prev</button>' +
      '<label class="ce-toggle"><input type="checkbox" data-ce-leisure ' + (row.isLeisure ? "checked" : "") + "/> Leisure day</label>" +
      "</div>" +
      '<section class="ce-t-section"><div class="ce-t-section-head"><h5>Day-wise inclusions / exclusions / extra cost</h5></div>' +
      '<div class="ce-grid">' +
      '<label class="ce-field"><span>Day inclusions</span><input data-ce-day-inc value="' +
      ceEsc((row.dayIncludes || []).join(", ")) +
      '" placeholder="Breakfast, entrance…" /></label>' +
      '<label class="ce-field"><span>Day exclusions</span><input data-ce-day-exc value="' +
      ceEsc((row.dayExcludes || []).join(", ")) +
      '" placeholder="Lunch, tips…" /></label>' +
      '<label class="ce-field"><span>Additional costing</span><input data-ce-day-extra type="number" min="0" step="1" value="' +
      ceEsc(row.dayExtraCost || 0) +
      '" /></label>' +
      '<label class="ce-field"><span>Custom room category</span><input data-ce-room-cat value="' +
      ceEsc(row.customRoomCategory || "") +
      '" placeholder="Deluxe / Superior…" /></label>' +
      '<label class="ce-field"><span>Custom room type</span><input data-ce-room-type value="' +
      ceEsc(row.customRoomType || "") +
      '" placeholder="Double / Twin…" /></label>' +
      '<label class="ce-field"><span>Custom meal plan</span><input data-ce-meal value="' +
      ceEsc(row.customMealPlan || "") +
      '" placeholder="BB / HB / FB…" /></label>' +
      "</div></section>"
    );
  }

  // Patch render to inject day ops after board head
  const _ceRenderDestRows = typeof ceRenderDestRows === "function" ? ceRenderDestRows : null;
  if (_ceRenderDestRows) {
    ceRenderDestRows = function () {
      _ceRenderDestRows();
      const board = document.querySelector("#ce-dest-list .ce-day-board");
      const row = ceDestRows[ceActiveDay];
      if (!board || !row) return;
      ceEnsureAdvDay(row);
      if (!board.querySelector(".ce-day-ops")) {
        const head = board.querySelector(".ce-day-board-head");
        if (head) head.insertAdjacentHTML("afterend", ceDayOpsHtml(row, ceActiveDay));
      }
    };
  }

  const _cePersist = typeof cePersistBoardFields === "function" ? cePersistBoardFields : null;
  if (_cePersist) {
    cePersistBoardFields = function () {
      _cePersist();
      const row = ceDestRows[ceActiveDay];
      if (!row) return;
      ceEnsureAdvDay(row);
      const board = document.querySelector("#ce-dest-list [data-ce-dest]");
      if (!board) return;
      row.isLeisure = !!(board.querySelector("[data-ce-leisure]") && board.querySelector("[data-ce-leisure]").checked);
      const inc = board.querySelector("[data-ce-day-inc]");
      const exc = board.querySelector("[data-ce-day-exc]");
      const extra = board.querySelector("[data-ce-day-extra]");
      if (inc) row.dayIncludes = String(inc.value || "").split(",").map((s) => s.trim()).filter(Boolean);
      if (exc) row.dayExcludes = String(exc.value || "").split(",").map((s) => s.trim()).filter(Boolean);
      if (extra) row.dayExtraCost = Number(extra.value || 0);
      const rc = board.querySelector("[data-ce-room-cat]");
      const rt = board.querySelector("[data-ce-room-type]");
      const mp = board.querySelector("[data-ce-meal]");
      if (rc) row.customRoomCategory = rc.value;
      if (rt) row.customRoomType = rt.value;
      if (mp) row.customMealPlan = mp.value;
      if (row.isLeisure && !row.place) row.place = "Leisure day (hotel / free)";
    };
  }

  function ceCollectAdvancedPayload() {
    return {
      channel: (document.getElementById("ce-channel") && document.getElementById("ce-channel").value) || "B2C",
      seasonCategory: (document.getElementById("ce-season-category") && document.getElementById("ce-season-category").value) || "",
      status: (document.querySelector(".ce-status-pill") && document.querySelector(".ce-status-pill").textContent.trim()) || "Draft",
      statusLog: ceStatusLog.slice(),
      share: Object.assign({}, ceShare, { link: ceEnsureShareLink() }),
      security: Object.assign({}, ceSecurity),
      map: Object.assign({}, ceMapOpts),
      gallery: ceGallery.slice(),
      contentLanguage: ceContentLang,
      archived: !!(document.getElementById("ce-archived") && document.getElementById("ce-archived").checked),
    };
  }

  // Expose for save
  window.ceCollectAdvancedPayload = ceCollectAdvancedPayload;
  window.ceBuildCostModel = typeof ceBuildCostModel === "function" ? ceBuildCostModel : window.ceBuildCostModel;

  function ceRenderAdvPanels() {
    ceRenderTemplates();
    ceRenderContracts();
    ceRenderStatusLog();
    ceRenderShare();
    ceRenderGallery();
    ceRenderMapPreview();
    ceRenderSecurity();
    ceRenderMatchedRates();
  }

  function ceRenderGallery() {
    const box = document.getElementById("ce-gallery");
    if (!box) return;
    if (!ceGallery.length) {
      box.innerHTML = '<div class="ce-sheet-drop-hint">Bulk upload images — set cover / default / main</div>';
      return;
    }
    box.innerHTML = ceGallery
      .map(
        (img, i) =>
          '<div class="ce-gal-item' +
          (img.role === "cover" ? " is-cover" : "") +
          '" draggable="true" data-gal-i="' +
          i +
          '"><img src="' +
          ceEsc(img.src) +
          '" alt="" /><div class="ce-gal-meta">' +
          ceEsc(img.role || "gallery") +
          '</div><div class="ce-t-actions">' +
          '<button type="button" data-gal-role="cover:' + i + '">Cover</button>' +
          '<button type="button" data-gal-role="main:' + i + '">Main</button>' +
          '<button type="button" data-gal-role="default:' + i + '">Default</button>' +
          '<button type="button" data-gal-del="' + i + '">Remove</button></div></div>'
      )
      .join("");
  }

  function ceRenderMapPreview() {
    const box = document.getElementById("ce-map-preview");
    if (!box) return;
    if (!ceMapOpts.show) {
      box.innerHTML = '<p class="ce-t-empty">Map hidden</p>';
      return;
    }
    const stops = (ceDestRows || []).map((d, i) => (d.city || d.place || "Stop " + (i + 1)));
    box.innerHTML =
      '<div class="ce-map-fake"><div class="ce-map-route"></div></div><div class="ce-map-tags">' +
      stops
        .map((s, i) => '<span class="ce-map-tag" style="--i:' + i + '">' + (i + 1) + " · " + ceEsc(s) + "</span>")
        .join("") +
      "</div>";
  }

  function ceRenderSecurity() {
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.checked = !!v;
    };
    set("ce-sec-hide-cost", ceSecurity.hideCosting);
    set("ce-sec-hide-rates", ceSecurity.hideSupplierRates);
    set("ce-sec-hide-markup", ceSecurity.hideMarkup);
    set("ce-sec-hide-profit", ceSecurity.hideProfit);
    set("ce-sec-disable-share", ceSecurity.disableShare);
    set("ce-sec-disable-forward", ceSecurity.disableForward);
  }

  function ceRenderMatchedRates() {
    const box = document.getElementById("ce-matched-rates");
    if (!box) return;
    const row = ceDestRows[ceActiveDay];
    const hotel = row && row.accommodations && row.accommodations[0] && row.accommodations[0].hotel;
    const season = (document.getElementById("ce-season-category") && document.getElementById("ce-season-category").value) || "";
    const market = (document.getElementById("ce-ctr-market") && document.getElementById("ce-ctr-market").value) || "All";
    const start = (document.getElementById("ce-date-start") && document.getElementById("ce-date-start").value) || "";
    const end = (document.getElementById("ce-date-end") && document.getElementById("ce-date-end").value) || "";
    const roomCat = (row && row.customRoomCategory) || "";
    const roomType = (row && row.customRoomType) || "";
    const meal = (row && row.customMealPlan) || "";
    const hits = hotel ? ceMatchContractRates(hotel, start, end, roomCat, roomType, meal, market === "All" ? "" : market, season) : [];
    box.innerHTML = hits.length
      ? hits
          .map(
            (c) =>
              "<div class=\"ce-cost-row\"><span>" +
              ceEsc(c.hotel + " · " + c.roomCategory + "/" + c.roomType + "/" + c.mealPlan) +
              "</span><strong>" +
              ceEsc(c.currency + " " + c.rate) +
              "</strong></div>"
          )
          .join("")
      : '<p class="ce-t-empty">No valid contracted rates for current hotel + dates + room + meal + market + season.</p>';
  }

  function ceWireAdvanced() {
    const root = document.getElementById("ce-backdrop");
    if (!root || root.dataset.ceAdvWired) return;
    root.dataset.ceAdvWired = "1";

    const _steps = ceRenderSteps;
    ceRenderSteps = function () {
      _steps();
      if (["templates", "contracts", "share", "overview", "preview"].includes(ceMainTab)) ceRenderAdvPanels();
      if (ceMainTab === "days") ceClaimLock();
    };

    root.addEventListener("click", (e) => {
      const op = e.target.closest("[data-ce-day-op]");
      if (op) {
        if (typeof cePersistBoardFields === "function") cePersistBoardFields();
        const i = Number(op.dataset.i);
        const kind = op.dataset.ceDayOp;
        if (kind === "up") ceMoveDay(i, Math.max(0, i - 1));
        if (kind === "down") ceMoveDay(i, Math.min(ceDestRows.length - 1, i + 1));
        if (kind === "switch") {
          const other = prompt("Switch with day number (1-based)", String(i === 0 ? 2 : 1));
          if (other) ceSwitchDays(i, Number(other) - 1);
        }
        if (kind === "copy") ceCopyDay(i);
        if (kind === "merge") ceMergeDays(i);
        if (kind === "unmerge") ceUnmergeDay(i);
        if (kind === "autofill") ceAutofillFromPrev(i);
        return;
      }
      if (e.target.closest("#ce-tpl-save")) {
        ceSaveAsTemplate();
        return;
      }
      if (e.target.closest("#ce-tpl-new")) {
        document.getElementById("ce-name").value = "New template itinerary";
        ceDestRows = [];
        ceActiveDay = 0;
        ceRenderDestRows();
        ceMainTab = "days";
        ceRenderSteps();
        return;
      }
      const use = e.target.closest("[data-tpl-use]");
      if (use) {
        ceUseTemplate(use.dataset.tplUse);
        return;
      }
      const dup = e.target.closest("[data-tpl-dup]");
      if (dup) {
        ceDuplicateTemplate(dup.dataset.tplDup);
        return;
      }
      const del = e.target.closest("[data-tpl-del]");
      if (del) {
        ceSaveTemplates(ceTemplates().filter((t) => t.id !== del.dataset.tplDel));
        ceRenderTemplates();
        return;
      }
      const edit = e.target.closest("[data-tpl-edit]");
      if (edit) {
        ceUseTemplate(edit.dataset.tplEdit);
        ceMainTab = "days";
        ceRenderSteps();
        return;
      }
      if (e.target.closest("#ce-ctr-add")) {
        ceAddManualContract();
        return;
      }
      if (e.target.closest("#ce-ctr-ai")) {
        ceAiExtractContract();
        return;
      }
      const ap = e.target.closest("[data-ctr-approve]");
      if (ap) {
        const list = ceContracts();
        const c = list.find((x) => x.id === ap.dataset.ctrApprove);
        if (c) {
          c.status = "Approved";
          ceSaveContracts(list);
          ceRenderContracts();
        }
        return;
      }
      const cd = e.target.closest("[data-ctr-del]");
      if (cd) {
        ceSaveContracts(ceContracts().filter((x) => x.id !== cd.dataset.ctrDel));
        ceRenderContracts();
        return;
      }
      if (e.target.closest("#ce-share-copy")) {
        ceCopyShare();
        return;
      }
      if (e.target.closest("#ce-share-open")) {
        ceOpenShare();
        return;
      }
      if (e.target.closest("#ce-share-disable")) {
        ceShare.enabled = false;
        ceRenderShare();
        return;
      }
      if (e.target.closest("#ce-share-enable")) {
        ceShare.enabled = true;
        ceSecurity.disableShare = false;
        ceRenderShare();
        return;
      }
      if (e.target.closest("#ce-status-apply")) {
        const st = document.getElementById("ce-status-select") && document.getElementById("ce-status-select").value;
        const rm = document.getElementById("ce-status-remark") && document.getElementById("ce-status-remark").value;
        if (st) ceSetStatus(st, rm);
        return;
      }
      if (e.target.closest("#ce-export-pdf")) {
        (document.getElementById("ce-download") && document.getElementById("ce-download").click());
        return;
      }
      if (e.target.closest("#ce-export-word")) {
        ceExportWord();
        return;
      }
      if (e.target.closest("#ce-export-email")) {
        ceEmailItinerary();
        return;
      }
      if (e.target.closest("#ce-export-invoice")) {
        ceSetStatus("Invoice Sent", "Invoice sent to client/agent");
        if (typeof deToast === "function") deToast("Invoice marked sent.", "ok");
        return;
      }
      if (e.target.closest("#ce-export-print")) {
        window.print();
        return;
      }
      const galRole = e.target.closest("[data-gal-role]");
      if (galRole) {
        const [role, idx] = galRole.dataset.galRole.split(":");
        const i = Number(idx);
        if (ceGallery[i]) {
          ceGallery.forEach((g) => {
            if (g.role === role) g.role = "gallery";
          });
          ceGallery[i].role = role;
          ceRenderGallery();
        }
        return;
      }
      const galDel = e.target.closest("[data-gal-del]");
      if (galDel) {
        ceGallery.splice(Number(galDel.dataset.galDel), 1);
        ceRenderGallery();
        return;
      }
    });

    root.addEventListener("change", (e) => {
      if (e.target.id === "ce-share-enabled") ceShare.enabled = e.target.checked;
      if (e.target.id === "ce-share-public") {
        ceShare.publicLink = e.target.checked;
        if (e.target.checked) {
          ceShare.enabled = true;
          ceShare.allowAgentForward = true;
          ceSecurity.disableShare = false;
          ceSecurity.disableForward = false;
        }
        ceRenderShare();
        ceRenderSecurity();
      }
      if (e.target.id === "ce-share-expiry-on") ceShare.expiryOn = e.target.checked;
      if (e.target.id === "ce-share-expiry-date") ceShare.expiryDate = e.target.value;
      if (e.target.id === "ce-share-b2b") ceShare.b2bEditable = e.target.checked;
      if (e.target.id === "ce-share-forward") ceShare.allowAgentForward = e.target.checked;
      if (e.target.id === "ce-share-notify") ceShare.notifyOnView = e.target.checked;
      if (e.target.id === "ce-sec-hide-cost") ceSecurity.hideCosting = e.target.checked;
      if (e.target.id === "ce-sec-hide-rates") ceSecurity.hideSupplierRates = e.target.checked;
      if (e.target.id === "ce-sec-hide-markup") ceSecurity.hideMarkup = e.target.checked;
      if (e.target.id === "ce-sec-hide-profit") ceSecurity.hideProfit = e.target.checked;
      if (e.target.id === "ce-sec-disable-share") {
        ceSecurity.disableShare = e.target.checked;
        if (e.target.checked) ceShare.enabled = false;
      }
      if (e.target.id === "ce-sec-disable-forward") ceSecurity.disableForward = e.target.checked;
      if (e.target.id === "ce-map-show") ceMapOpts.show = e.target.checked;
      if (e.target.id === "ce-map-pos") ceMapOpts.position = e.target.value;
      if (e.target.id === "ce-map-auto") ceMapOpts.autoRoute = e.target.checked;
      if (e.target.id === "ce-map-tags") ceMapOpts.coloredTags = e.target.checked;
      if (e.target.id === "ce-map-route") ceMapOpts.routeStyle = e.target.value;
      if (e.target.id === "ce-content-lang") ceContentLang = e.target.value;
      if (e.target.id === "ce-gal-files") {
        [...(e.target.files || [])].forEach((file) => {
          if (!String(file.type || "").startsWith("image/")) return;
          const reader = new FileReader();
          reader.onload = () => {
            ceGallery.push({ src: String(reader.result || ""), role: ceGallery.length ? "gallery" : "cover" });
            ceRenderGallery();
          };
          reader.readAsDataURL(file);
        });
        e.target.value = "";
      }
      if (e.target.id === "ce-tpl-cat-filter" || e.target.id === "ce-tpl-search") ceRenderTemplates();
      if (String(e.target.id || "").startsWith("ce-ctr-") || e.target.id === "ce-season-category") ceRenderMatchedRates();
      if (["ce-map-show", "ce-map-pos", "ce-map-auto", "ce-map-tags", "ce-map-route"].includes(e.target.id)) ceRenderMapPreview();
    });

    window.addEventListener("beforeunload", ceReleaseLock);
  }

  function ceExportWord() {
    if (typeof ceBuildPreviewModel !== "function") return;
    const m = ceBuildPreviewModel();
    const html =
      "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'><head><meta charset='utf-8'><title>" +
      (m.name || "Itinerary") +
      "</title></head><body>" +
      (typeof cePreviewMarkup === "function" ? cePreviewMarkup(m) : "<h1>" + (m.name || "") + "</h1>") +
      "</body></html>";
    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = ((m.name || "itinerary") + ".doc").replace(/[^\w.\-]+/g, "-");
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function ceEmailItinerary() {
    const name = (document.getElementById("ce-name") && document.getElementById("ce-name").value) || "Itinerary";
    const link = ceEnsureShareLink();
    const to = (document.getElementById("ce-client") && document.getElementById("ce-client").value) || "";
    const body = encodeURIComponent("Please find your itinerary:\n\n" + link + "\n\n(PDF can be attached from Download programme.)");
    location.href = "mailto:" + encodeURIComponent(to) + "?subject=" + encodeURIComponent(name) + "&body=" + body;
    ceSetStatus("Sent", "Emailed share link");
  }

  // Enhance custom add labels already custom via free text sheets
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ceWireAdvanced);
  else ceWireAdvanced();

  // Hook open
  const _open = openCreateExcursion;
  openCreateExcursion = function () {
    ceStatusLog = [];
    ceGallery = [];
    ceShare = {
      enabled: true,
      link: "",
      expiryOn: false,
      expiryDate: "",
      b2bEditable: false,
      publicLink: false,
      allowAgentForward: true,
      viewCount: 0,
      lastViewed: "",
      notifyOnView: true,
    };
    ceItineraryId = "itin-" + Date.now().toString(36);
    _open();
    const pill = document.querySelector(".ce-status-pill");
    if (pill) pill.textContent = "Draft";
    ceClaimLock();
    ceRenderAdvPanels();
  };

  const _close = closeCreateExcursion;
  closeCreateExcursion = function () {
    ceReleaseLock();
    _close();
  };
})();
