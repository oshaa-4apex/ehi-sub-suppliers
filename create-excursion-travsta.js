/* Travsta-exact Create Excursion UI */
(() => {
  const CE_THEMES = [
    { id: "purple", label: "Purple Night", swatch: "linear-gradient(135deg,#6d28d9,#2563eb)" },
    { id: "ocean", label: "Ocean Blue", swatch: "linear-gradient(135deg,#0ea5e9,#0369a1)" },
    { id: "teal", label: "Ceylon Teal", swatch: "linear-gradient(135deg,#0f766e,#14b8a6)" },
    { id: "sunset", label: "Sunset Gold", swatch: "linear-gradient(135deg,#f59e0b,#ea580c)" },
    { id: "forest", label: "Hill Country", swatch: "linear-gradient(135deg,#166534,#65a30d)" },
    { id: "classic", label: "Classic Navy", swatch: "linear-gradient(135deg,#0b2a4a,#334155)" },
  ];

  let ceMainTab = "days";
  let ceActiveDay = 0;
  let ceSheetMode = null;
  let ceSheetEdit = null;
  let ceSheetImages = [];

  function ceUid(prefix) {
    return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  function ceEnsureDayShape(row) {
    if (!row) return row;
    if (!Array.isArray(row.destinations)) {
      row.destinations = row.place
        ? [{ id: ceUid("dest"), name: row.place, description: row.highlights || "", tags: row.city || "", image: row.customImg || row.img || "", url: "" }]
        : [];
    }
    if (!Array.isArray(row.experienceItems)) {
      const names = row.experiences && row.experiences.length ? row.experiences : [];
      row.experienceItems = names.map((name) => ({ id: ceUid("exp"), name: name, description: "", tags: "", image: "" }));
    }
    if (!Array.isArray(row.accommodations)) {
      row.accommodations = row.hotel
        ? [{ id: ceUid("acc"), hotel: row.hotel, checkIn: "", checkOut: "", rooms: row.rooms || "01 x Deluxe Double (BB)", adults: 2, children: 0, infants: 0, vat: "Included", currency: "USD", images: row.customImg ? [row.customImg] : [] }]
        : [];
    }
    if (!Array.isArray(row.transports)) {
      row.transports = [{ id: ceUid("tr"), from: row.city || "Colombo", to: row.place || row.city || "", date: "", mode: "Land", autoMileage: true, mileage: 80, vehicle: row.transport || "Private car" }];
    }
    return row;
  }

  function ceSyncLegacyFromTravsta(row) {
    ceEnsureDayShape(row);
    const d0 = row.destinations[0];
    const a0 = row.accommodations[0];
    const t0 = row.transports[0];
    row.place = (d0 && d0.name) || row.place || CE_DEST_OPTIONS[0];
    row.city = ((d0 && d0.tags) || row.city || CE_CITIES[0]).split(",")[0].trim() || row.city;
    row.hotel = (a0 && a0.hotel) || "";
    row.rooms = (a0 && a0.rooms) || row.rooms || "";
    row.transport = (t0 && t0.vehicle) || row.transport || "Private car";
    row.experiences = row.experienceItems.length > 0 ? row.experienceItems.map((x) => x.name) : row.destinations.map((x) => x.name);
    if (d0 && d0.image) { row.customImg = d0.image; row.img = d0.image; }
    else if (!row.img) row.img = ceDefaultImg(row.place);
    if (!row.highlights && d0 && d0.description) row.highlights = d0.description;
    return row;
  }

  ceBlankDay = function ceBlankDay(place, city) {
    const p = place || CE_DEST_OPTIONS[0];
    const c = city || CE_CITIES[0];
    return ceEnsureDayShape({
      city: c, place: p, hotel: "", rooms: "01 x Deluxe Double (BB)", transport: "Private car",
      experiences: [p], highlights: "", morning: "", midday: "", evening: "", night: "",
      img: ceDefaultImg(p), customImg: "", isDeparture: false,
      destinations: [], experienceItems: [], accommodations: [], transports: [],
    });
  };

  function ceTouchMeta() {
    const el = document.getElementById("ce-last-updated");
    if (el) el.textContent = "Last updated " + new Date().toLocaleString();
    const total = document.getElementById("ce-meta-total");
    const cur = (document.getElementById("ce-currency-primary") && document.getElementById("ce-currency-primary").value) || "USD";
    const base = Number((document.getElementById("ce-base-usd") && document.getElementById("ce-base-usd").value) || 185);
    const pax = Number((document.getElementById("ce-pax-count") && document.getElementById("ce-pax-count").value) || 2);
    if (total) total.textContent = "Total " + cur + " " + (base * pax).toLocaleString();
  }

  ceRenderSteps = function ceRenderSteps() {
    document.querySelectorAll("[data-ce-tab]").forEach((btn) => btn.classList.toggle("on", btn.dataset.ceTab === ceMainTab));
    document.querySelectorAll("[data-ce-tab-panel]").forEach((p) => { p.hidden = p.dataset.ceTabPanel !== ceMainTab; });
    const prev = document.getElementById("ce-prev");
    const next = document.getElementById("ce-next");
    const dl = document.getElementById("ce-download");
    if (prev) prev.hidden = true;
    if (next) next.textContent = "Save to excursion list";
    if (dl) dl.hidden = ceMainTab !== "preview";
    if (ceMainTab === "days") ceRenderDestRows();
    if (ceMainTab === "overview") { ceRenderIncludes(); ceRenderThemePicker(); }
    if (ceMainTab === "costing") { ceRenderCosting(); }
    if (ceMainTab === "preview") { ceRenderPaxTable(); ceRenderPreview(); }
    if (typeof ceRenderCosting === "function") ceRenderCosting();
    else ceTouchMeta();
  };

  function ceRenderThemePicker() {
    const box = document.getElementById("ce-theme-grid");
    if (!box) return;
    const cur = (document.getElementById("ce-theme") && document.getElementById("ce-theme").value) || "purple";
    box.innerHTML = CE_THEMES.map((t) =>
      '<button type="button" class="ce-theme-card ' + (t.id === cur ? "on" : "") + '" data-ce-theme="' + ceEsc(t.id) + '">' +
      '<span class="swatch" style="background:' + t.swatch + '"></span><span class="lbl">' + ceEsc(t.label) + "</span></button>"
    ).join("");
  }

  function ceActiveRow() {
    if (!ceDestRows.length) return null;
    if (ceActiveDay < 0 || ceActiveDay >= ceDestRows.length) ceActiveDay = 0;
    return ceEnsureDayShape(ceDestRows[ceActiveDay]);
  }

  function ceItemCard(kind, item, idx) {
    const title = kind === "dest" || kind === "exp" ? item.name : kind === "acc" ? item.hotel : ((item.from || "—") + " → " + (item.to || "—"));
    let sub = "";
    if (kind === "dest" || kind === "exp") {
      const tags = String(item.tags || "").trim();
      const desc = String(item.description || "").trim();
      sub = tags || desc || (kind === "dest" ? "Destination" : "Experience");
    } else if (kind === "acc") {
      sub = [item.rooms, (item.adults || 0) + " adults", (item.children || 0) + " child", "VAT " + (item.vat || "—")].filter(Boolean).join(" · ");
    } else {
      sub = [item.date || "Date TBD", item.mode || "Land", (item.autoMileage ? "Auto " : "") + (item.mileage || 0) + " km", item.vehicle].filter(Boolean).join(" · ");
    }
    const img = kind === "dest" || kind === "exp" ? (item.image || ceDefaultImg(item.name)) : kind === "acc" ? ((item.images && item.images[0]) || "") : "";
    const empty = kind === "tr" ? "⇄" : kind === "acc" ? "🏨" : "◇";
    return '<article class="ce-t-card" data-ce-kind="' + kind + '" data-ce-idx="' + idx + '">' +
      (img ? '<img class="ce-t-thumb" src="' + ceEsc(img) + '" alt="" />' : '<div class="ce-t-thumb ce-t-thumb-empty" aria-hidden="true">' + empty + "</div>") +
      '<div class="ce-t-body"><strong>' + ceEsc(title || "Untitled") + "</strong><span>" + ceEsc(sub) + "</span></div>" +
      '<div class="ce-t-actions"><button type="button" class="btn-secondary" data-ce-edit="' + kind + ":" + idx + '">Edit</button>' +
      '<button type="button" class="btn-secondary" data-ce-del-item="' + kind + ":" + idx + '">Remove</button></div></article>';
  }

  function ceSection(title, kind, items, addLabel) {
    return '<section class="ce-t-section"><div class="ce-t-section-head"><h5>' + ceEsc(title) + '</h5>' +
      '<button type="button" class="btn-secondary" data-ce-add="' + kind + '">' + ceEsc(addLabel) + "</button></div><div class=\"ce-t-list\">" +
      (items.length ? items.map((it, i) => ceItemCard(kind, it, i)).join("") : '<p class="ce-t-empty">No ' + ceEsc(title.toLowerCase()) + " yet — add from content library.</p>") +
      "</div></section>";
  }

  ceCollectDestRows = function ceCollectDestRows() {
    ceDestRows.forEach((row) => ceSyncLegacyFromTravsta(row));
  };

  ceRenderDestRows = function ceRenderDestRows() {
    const tabs = document.getElementById("ce-day-tabs");
    const board = document.getElementById("ce-dest-list");
    if (!board) return;

    if (!ceDestRows.length) {
      const d0 = ceBlankDay("Gangaramaya Temple", "Colombo");
      d0.destinations = [{ id: ceUid("dest"), name: "Gangaramaya Temple", description: "", tags: "Colombo, temple", image: ceDefaultImg("Gangaramaya Temple"), url: "" }];
      d0.experienceItems = [
        { id: ceUid("exp"), name: "Colombo National Museum", description: "", tags: "culture", image: "" },
        { id: ceUid("exp"), name: "Galle Face Green", description: "", tags: "city", image: "" },
      ];
      d0.accommodations = [{ id: ceUid("acc"), hotel: "Galle Face Hotel", checkIn: "14:00", checkOut: "12:00", rooms: "01 x Deluxe Double (FB)", adults: 2, children: 0, infants: 0, vat: "Included", currency: "USD", images: [] }];
      d0.transports = [{ id: ceUid("tr"), from: "Airport", to: "Colombo", date: (document.getElementById("ce-date-start") && document.getElementById("ce-date-start").value) || "", mode: "Land", autoMileage: true, mileage: 35, vehicle: "Private car" }];
      ceSyncLegacyFromTravsta(d0); ceFillDaySlots(d0, 1);

      const d1 = ceBlankDay("Sigiriya Rock Fortress", "Sigiriya");
      d1.destinations = [{ id: ceUid("dest"), name: "Sigiriya Rock Fortress", description: "", tags: "Sigiriya, UNESCO", image: ceDefaultImg("Sigiriya Rock Fortress"), url: "" }];
      d1.experienceItems = [{ id: ceUid("exp"), name: "Dambulla Cave Temple", description: "", tags: "culture", image: "" }];
      d1.accommodations = [{ id: ceUid("acc"), hotel: "Heritance Kandalama", checkIn: "14:00", checkOut: "12:00", rooms: "01 x Deluxe Double (BB)", adults: 2, children: 0, infants: 0, vat: "Included", currency: "USD", images: [] }];
      d1.transports = [{ id: ceUid("tr"), from: "Colombo", to: "Sigiriya", date: "", mode: "Land", autoMileage: true, mileage: 175, vehicle: "Private car" }];
      ceSyncLegacyFromTravsta(d1); ceFillDaySlots(d1, 2);
      ceDestRows = [d0, d1];
      ceActiveDay = 0;
    }

    ceDestRows.forEach((r) => ceEnsureDayShape(r));
    if (ceActiveDay >= ceDestRows.length) ceActiveDay = ceDestRows.length - 1;

    if (tabs) {
      tabs.innerHTML = ceDestRows.map((row, i) => {
        const label = row.isDeparture ? "Departure" : "Day " + String(i + 1).padStart(2, "0");
        return '<button type="button" class="ce-day-pill ' + (i === ceActiveDay ? "on" : "") + '" data-ce-day="' + i + '">' + ceEsc(label) + "</button>";
      }).join("") + '<button type="button" class="ce-day-pill add" id="ce-add-dest" title="Add day">+</button>';
    }

    const row = ceActiveRow();
    if (!row) { board.innerHTML = ""; return; }
    const dayNo = ceActiveDay + 1;
    board.innerHTML =
      '<div class="ce-day-board" data-ce-dest="' + ceActiveDay + '">' +
      '<div class="ce-day-board-head"><div><div class="ce-kicker">Day by Day</div><h4>' +
      (row.isDeparture ? "Departure" : "Day " + String(dayNo).padStart(2, "0")) + " · " + ceEsc(row.city || row.place || "Itinerary") +
      '</h4></div><div class="ce-day-board-actions">' +
      '<label class="ce-toggle"><input type="checkbox" data-ce-depart ' + (row.isDeparture ? "checked" : "") + "/> Departure day</label>" +
      '<button type="button" class="btn-secondary" data-ce-ai-day="' + ceActiveDay + '">✦ AI highlights</button>' +
      '<button type="button" class="btn-secondary" data-ce-dest-del="' + ceActiveDay + '">Remove</button></div></div>' +
      ceSection("Destinations", "dest", row.destinations, "+ Custom Destination") +
      ceSection("Experiences", "exp", row.experienceItems, "+ Custom Experience") +
      ceSection("Accommodation", "acc", row.accommodations, "+ Custom Accommodation") +
      ceSection("Transport", "tr", row.transports, "+ Add Transport") +
      '<section class="ce-t-section"><div class="ce-t-section-head"><h5>Day highlights · AI</h5></div>' +
      '<label class="ce-field full" style="margin:0"><textarea data-ce-highlights rows="3" placeholder="AI day highlights…">' + ceEsc(row.highlights || "") + "</textarea></label>" +
      '<div class="ce-parts" style="margin-top:10px">' +
      '<label class="ce-field"><span>Morning</span><textarea data-ce-morning rows="2">' + ceEsc(row.morning || "") + "</textarea></label>" +
      '<label class="ce-field"><span>Midday</span><textarea data-ce-midday rows="2">' + ceEsc(row.midday || "") + "</textarea></label>" +
      '<label class="ce-field"><span>Evening</span><textarea data-ce-evening rows="2">' + ceEsc(row.evening || "") + "</textarea></label>" +
      '<label class="ce-field"><span>Night</span><textarea data-ce-night rows="2">' + ceEsc(row.night || "") + "</textarea></label>" +
      "</div></section></div>";
    ceUpdateAiNote();
    ceTouchMeta();
  };

  function cePersistBoardFields() {
    const row = ceActiveRow();
    if (!row) return;
    const board = document.querySelector("#ce-dest-list [data-ce-dest]");
    if (!board) return;
    row.highlights = (board.querySelector("[data-ce-highlights]") && board.querySelector("[data-ce-highlights]").value) || "";
    row.morning = (board.querySelector("[data-ce-morning]") && board.querySelector("[data-ce-morning]").value) || "";
    row.midday = (board.querySelector("[data-ce-midday]") && board.querySelector("[data-ce-midday]").value) || "";
    row.evening = (board.querySelector("[data-ce-evening]") && board.querySelector("[data-ce-evening]").value) || "";
    row.night = (board.querySelector("[data-ce-night]") && board.querySelector("[data-ce-night]").value) || "";
    row.isDeparture = !!(board.querySelector("[data-ce-depart]") && board.querySelector("[data-ce-depart]").checked);
    ceSyncLegacyFromTravsta(row);
  }

  function ceCalcLegKm(from, to) {
    const a = CE_PLACE_KM[to] != null ? CE_PLACE_KM[to] : (CE_REGION_BASE[to] != null ? CE_REGION_BASE[to] : 90);
    const b = CE_REGION_BASE[from] != null ? CE_REGION_BASE[from] : (CE_PLACE_KM[from] != null ? CE_PLACE_KM[from] : 40);
    return Math.max(20, Math.round(Math.abs(a - b) * 0.55 + 28));
  }

  function ceQuickGenerate(kind, name, tags) {
    const n = name || "this stop";
    const t = tags ? " Highlights: " + tags + "." : "";
    if (kind === "dest") return n + " is a signature stop on this Sri Lanka route — paced for photos, local context, and a smooth transfer window." + t;
    if (kind === "exp") return "Experience " + n + " with a clear briefing, comfortable timing, and room for guest photos." + t;
    return "Stay at " + n + " with easy check-in, breakfast flow, and overnight comfort for the next touring day." + t;
  }

  function ceOpenSheet(mode, editIdx) {
    ceSheetMode = mode;
    ceSheetEdit = editIdx == null ? null : editIdx;
    const sheet = document.getElementById("ce-sheet");
    if (!sheet) return;
    sheet.hidden = false;
    const row = ceActiveRow();
    let item = null;
    if (row && editIdx != null) {
      if (mode === "dest") item = row.destinations[editIdx];
      if (mode === "exp") item = row.experienceItems[editIdx];
      if (mode === "acc") item = row.accommodations[editIdx];
      if (mode === "tr") item = row.transports[editIdx];
    }
    ceSheetImages = item && item.images ? item.images.slice() : (item && item.image ? [item.image] : []);
    const titleEl = document.getElementById("ce-sheet-title");
    const map = { dest: "Destination", exp: "Experience", acc: "Accommodation", tr: "Transport" };
    if (titleEl) titleEl.textContent = (editIdx != null ? "Edit " : "Add ") + (map[mode] || "Content");
    document.querySelectorAll("[data-ce-sheet-view]").forEach((v) => { v.hidden = v.dataset.ceSheetView !== mode; });
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val == null ? "" : val; };
    if (mode === "dest") {
      set("ce-sheet-dest-search", (item && item.name) || "");
      set("ce-sheet-dest-name", (item && item.name) || "");
      set("ce-sheet-dest-desc", (item && item.description) || "");
      set("ce-sheet-dest-tags", (item && item.tags) || "");
      set("ce-sheet-dest-url", (item && item.url) || "");
    }
    if (mode === "exp") {
      set("ce-sheet-exp-search", (item && item.name) || "");
      set("ce-sheet-exp-name", (item && item.name) || "");
      set("ce-sheet-exp-desc", (item && item.description) || "");
      set("ce-sheet-exp-tags", (item && item.tags) || "");
    }
    if (mode === "acc") {
      set("ce-sheet-acc-search", (item && item.hotel) || "");
      set("ce-sheet-acc-hotel", (item && item.hotel) || "");
      set("ce-sheet-acc-in", (item && item.checkIn) || "14:00");
      set("ce-sheet-acc-out", (item && item.checkOut) || "12:00");
      set("ce-sheet-acc-rooms", (item && item.rooms) || "01 x Deluxe Double (BB)");
      set("ce-sheet-acc-adults", item && item.adults != null ? item.adults : 2);
      set("ce-sheet-acc-children", item && item.children != null ? item.children : 0);
      set("ce-sheet-acc-infants", item && item.infants != null ? item.infants : 0);
      set("ce-sheet-acc-vat", (item && item.vat) || "Included");
      set("ce-sheet-acc-currency", (item && item.currency) || ((document.getElementById("ce-currency-primary") && document.getElementById("ce-currency-primary").value) || "USD"));
    }
    if (mode === "tr") {
      set("ce-sheet-tr-from", (item && item.from) || (row && row.city) || "Colombo");
      set("ce-sheet-tr-to", (item && item.to) || (row && row.place) || "");
      set("ce-sheet-tr-date", (item && item.date) || ((document.getElementById("ce-date-start") && document.getElementById("ce-date-start").value) || ""));
      set("ce-sheet-tr-mode", (item && item.mode) || "Land");
      set("ce-sheet-tr-vehicle", (item && item.vehicle) || ((document.getElementById("ce-transport") && document.getElementById("ce-transport").value) || "Private car"));
      const auto = document.getElementById("ce-sheet-tr-auto");
      if (auto) auto.checked = !(item && item.autoMileage === false);
      const from = document.getElementById("ce-sheet-tr-from") && document.getElementById("ce-sheet-tr-from").value;
      const to = document.getElementById("ce-sheet-tr-to") && document.getElementById("ce-sheet-tr-to").value;
      const km = !(item && item.autoMileage === false) ? ceCalcLegKm(from, to) : ((item && item.mileage) || 80);
      set("ce-sheet-tr-mileage", km);
    }
    ceRenderSheetGallery();
    ceRenderSheetSuggestions();
  }

  function ceCloseSheet() {
    const sheet = document.getElementById("ce-sheet");
    if (sheet) sheet.hidden = true;
    ceSheetMode = null; ceSheetEdit = null; ceSheetImages = [];
  }

  function ceRenderSheetGallery() {
    const gal = document.getElementById("ce-sheet-gallery");
    if (!gal) return;
    if (!ceSheetImages.length) {
      gal.innerHTML = '<div class="ce-sheet-drop-hint">Drag & drop HD images here, or browse files</div>';
      return;
    }
    gal.innerHTML = ceSheetImages.map((src, i) =>
      '<div class="ce-sheet-img"><img src="' + ceEsc(src) + '" alt="" /><button type="button" data-ce-img-del="' + i + '" aria-label="Remove">×</button></div>'
    ).join("");
  }

  function ceRenderSheetSuggestions() {
    const box = document.getElementById("ce-sheet-suggest");
    if (!box) return;
    const q = ((ceSheetMode === "dest" ? document.getElementById("ce-sheet-dest-search") : ceSheetMode === "exp" ? document.getElementById("ce-sheet-exp-search") : ceSheetMode === "acc" ? document.getElementById("ce-sheet-acc-search") : null) && (ceSheetMode === "dest" ? document.getElementById("ce-sheet-dest-search").value : ceSheetMode === "exp" ? document.getElementById("ce-sheet-exp-search").value : ceSheetMode === "acc" ? document.getElementById("ce-sheet-acc-search").value : "")) || "";
    if (ceSheetMode === "tr") { box.innerHTML = ""; return; }
    const needle = q.trim().toLowerCase();
    let pool = [];
    if (ceSheetMode === "dest" || ceSheetMode === "exp") pool = CE_DEST_OPTIONS;
    if (ceSheetMode === "acc") pool = CE_HOTELS.filter(Boolean);
    box.innerHTML = pool.filter((n) => !needle || n.toLowerCase().includes(needle)).slice(0, 8)
      .map((n) => '<button type="button" class="ce-suggest" data-ce-pick="' + ceEsc(n) + '">' + ceEsc(n) + "</button>").join("");
  }

  function ceSaveSheet() {
    const row = ceActiveRow();
    if (!row || !ceSheetMode) return;
    cePersistBoardFields();
    if (ceSheetMode === "dest") {
      const name = (document.getElementById("ce-sheet-dest-name") && document.getElementById("ce-sheet-dest-name").value || "").trim();
      if (!name) { if (typeof deToast === "function") deToast("Enter a destination name.", "warn"); return; }
      const item = { id: ceUid("dest"), name: name, description: (document.getElementById("ce-sheet-dest-desc") && document.getElementById("ce-sheet-dest-desc").value) || "", tags: (document.getElementById("ce-sheet-dest-tags") && document.getElementById("ce-sheet-dest-tags").value) || "", image: ceSheetImages[0] || "", url: (document.getElementById("ce-sheet-dest-url") && document.getElementById("ce-sheet-dest-url").value) || "" };
      if (ceSheetEdit != null) row.destinations[ceSheetEdit] = Object.assign({}, row.destinations[ceSheetEdit], item, { id: row.destinations[ceSheetEdit].id });
      else row.destinations.push(item);
    }
    if (ceSheetMode === "exp") {
      const name = (document.getElementById("ce-sheet-exp-name") && document.getElementById("ce-sheet-exp-name").value || "").trim();
      if (!name) { if (typeof deToast === "function") deToast("Enter an experience name.", "warn"); return; }
      const item = { id: ceUid("exp"), name: name, description: (document.getElementById("ce-sheet-exp-desc") && document.getElementById("ce-sheet-exp-desc").value) || "", tags: (document.getElementById("ce-sheet-exp-tags") && document.getElementById("ce-sheet-exp-tags").value) || "", image: ceSheetImages[0] || "",
        itemDate: (document.getElementById("ce-sheet-exp-date") && document.getElementById("ce-sheet-exp-date").value) || ""
      };
      if (ceSheetEdit != null) row.experienceItems[ceSheetEdit] = Object.assign({}, row.experienceItems[ceSheetEdit], item, { id: row.experienceItems[ceSheetEdit].id });
      else row.experienceItems.push(item);
    }
    if (ceSheetMode === "acc") {
      const hotel = (document.getElementById("ce-sheet-acc-hotel") && document.getElementById("ce-sheet-acc-hotel").value || "").trim();
      if (!hotel) { if (typeof deToast === "function") deToast("Enter a hotel name.", "warn"); return; }
      const item = { id: ceUid("acc"), hotel: hotel, checkIn: (document.getElementById("ce-sheet-acc-in") && document.getElementById("ce-sheet-acc-in").value) || "", checkOut: (document.getElementById("ce-sheet-acc-out") && document.getElementById("ce-sheet-acc-out").value) || "", rooms: (document.getElementById("ce-sheet-acc-rooms") && document.getElementById("ce-sheet-acc-rooms").value) || "", adults: Number((document.getElementById("ce-sheet-acc-adults") && document.getElementById("ce-sheet-acc-adults").value) || 0), children: Number((document.getElementById("ce-sheet-acc-children") && document.getElementById("ce-sheet-acc-children").value) || 0), infants: Number((document.getElementById("ce-sheet-acc-infants") && document.getElementById("ce-sheet-acc-infants").value) || 0), vat: (document.getElementById("ce-sheet-acc-vat") && document.getElementById("ce-sheet-acc-vat").value) || "Included", currency: (document.getElementById("ce-sheet-acc-currency") && document.getElementById("ce-sheet-acc-currency").value) || "USD", website: (document.getElementById("ce-sheet-acc-web") && document.getElementById("ce-sheet-acc-web").value) || "", stars: Number((document.getElementById("ce-sheet-acc-stars") && document.getElementById("ce-sheet-acc-stars").value) || 0), nightlyRate: Number((document.getElementById("ce-sheet-acc-rate") && document.getElementById("ce-sheet-acc-rate").value) || 0),
        roomCategory: (document.getElementById("ce-sheet-acc-room-cat") && document.getElementById("ce-sheet-acc-room-cat").value) || "",
        roomType: (document.getElementById("ce-sheet-acc-room-type") && document.getElementById("ce-sheet-acc-room-type").value) || "",
        mealPlan: (document.getElementById("ce-sheet-acc-meal") && document.getElementById("ce-sheet-acc-meal").value) || "",
        itemDate: (document.getElementById("ce-sheet-acc-date") && document.getElementById("ce-sheet-acc-date").value) || "",
        images: ceSheetImages.slice() };
      if (ceSheetEdit != null) row.accommodations[ceSheetEdit] = Object.assign({}, row.accommodations[ceSheetEdit], item, { id: row.accommodations[ceSheetEdit].id });
      else row.accommodations.push(item);
    }
    if (ceSheetMode === "tr") {
      const from = (document.getElementById("ce-sheet-tr-from") && document.getElementById("ce-sheet-tr-from").value || "").trim();
      const to = (document.getElementById("ce-sheet-tr-to") && document.getElementById("ce-sheet-tr-to").value || "").trim();
      if (!from || !to) { if (typeof deToast === "function") deToast("Set From and To for transport.", "warn"); return; }
      const auto = !!(document.getElementById("ce-sheet-tr-auto") && document.getElementById("ce-sheet-tr-auto").checked);
      const vehSel = (document.getElementById("ce-sheet-tr-veh-select") && document.getElementById("ce-sheet-tr-veh-select").value) || (document.getElementById("ce-sheet-tr-vehicle") && document.getElementById("ce-sheet-tr-vehicle").value) || "Private car";
      const item = {
        id: ceUid("tr"), from: from, to: to,
        date: (document.getElementById("ce-sheet-tr-date") && document.getElementById("ce-sheet-tr-date").value) || "",
        mode: (document.getElementById("ce-sheet-tr-mode") && document.getElementById("ce-sheet-tr-mode").value) || "Land",
        autoMileage: auto,
        mileage: auto ? ceCalcLegKm(from, to) : Number((document.getElementById("ce-sheet-tr-mileage") && document.getElementById("ce-sheet-tr-mileage").value) || 80),
        vehicle: vehSel,
        dayRate: Number((document.getElementById("ce-sheet-tr-day-rate") && document.getElementById("ce-sheet-tr-day-rate").value) || 85),
        includedKm: Number((document.getElementById("ce-sheet-tr-incl-km") && document.getElementById("ce-sheet-tr-incl-km").value) || 100),
        mileRate: Number((document.getElementById("ce-sheet-tr-mile-rate") && document.getElementById("ce-sheet-tr-mile-rate").value) || 0.45),
        bata: Number((document.getElementById("ce-sheet-tr-bata") && document.getElementById("ce-sheet-tr-bata").value) || 20),
        travelHours: Number((document.getElementById("ce-sheet-tr-hours") && document.getElementById("ce-sheet-tr-hours").value) || 0),
      };
      // push rates into costing defaults
      const setIf = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
      setIf("ce-cost-vehicle", vehSel);
      setIf("ce-cost-veh-day", item.dayRate);
      setIf("ce-cost-incl-km", item.includedKm);
      setIf("ce-cost-mile-rate", item.mileRate);
      setIf("ce-cost-bata", item.bata);
      if (ceSheetEdit != null) row.transports[ceSheetEdit] = Object.assign({}, row.transports[ceSheetEdit], item, { id: row.transports[ceSheetEdit].id });
      else row.transports.push(item);
    }
    ceSyncLegacyFromTravsta(row);
    ceCloseSheet();
    ceRenderDestRows();
    ceSyncMileageUi();
    ceTouchMeta();
  }

  function ceAddImageFiles(files) {
    Array.prototype.forEach.call(files || [], (file) => {
      if (!file || !String(file.type || "").startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => { ceSheetImages.push(String(reader.result || "")); ceRenderSheetGallery(); };
      reader.readAsDataURL(file);
    });
  }

  openCreateExcursion = function openCreateExcursion() {
    ceMainTab = "days"; ceActiveDay = 0; ceDestRows = []; ceMileManual = false;
    const backdrop = document.getElementById("ce-backdrop");
    if (backdrop) { backdrop.hidden = false; document.body.style.overflow = "hidden"; }
    const logoImg = document.getElementById("ce-head-logo");
    if (logoImg) logoImg.src = ceLogoUrl();
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    setVal("ce-name", ""); setVal("ce-days", "5 Days / 4 Nights"); setVal("ce-intro", ""); setVal("ce-itinerary", "");
    setVal("ce-client", ""); setVal("ce-tags", ""); setVal("ce-pax-count", "2"); setVal("ce-date-start", ""); setVal("ce-date-end", "");
    setVal("ce-remarks", ""); setVal("ce-terms", CE_TERMS_DEFAULT); setVal("ce-theme", "purple");
    setVal("ce-cost-adults", document.getElementById("ce-pax-count") && document.getElementById("ce-pax-count").value || "2");
    setVal("ce-cost-children", "0");
    setVal("ce-cost-infants", "0");
    const curP = document.getElementById("ce-currency-primary");
    const costCur = document.getElementById("ce-cost-currency");
    const cur = document.getElementById("ce-currency");
    if (costCur && curP) costCur.value = curP.value || "USD";
    if (cur && curP) cur.value = curP.value || "USD";
    ceRenderIncludes(); ceRenderDestRows(); ceRenderPaxTable(); ceRenderSteps(); ceSyncMileageUi();
    const status = document.getElementById("ce-intro-status");
    if (status) { status.textContent = "Short intro is AI-defined — fill tour name in Overview, then AI write intro."; status.style.color = "#6d28d9"; }
  };

  ceGoNext = function ceGoNext() {
    cePersistBoardFields(); ceCollectDestRows();
    if (!(document.getElementById("ce-intro") && document.getElementById("ce-intro").value || "").trim()) {
      const ta = document.getElementById("ce-intro"); if (ta) ta.value = ceDraftIntro();
    }
    if (!(document.getElementById("ce-itinerary") && document.getElementById("ce-itinerary").value || "").trim()) {
      const ta = document.getElementById("ce-itinerary"); if (ta) ta.value = ceDraftItineraryAi({ action: "draft" });
    }
    ceSaveToList();
  };
  ceGoPrev = function ceGoPrev() {};


  let ceSeasonalOn = false;

  function ceNum(id, fallback) {
    const n = Number(document.getElementById(id) && document.getElementById(id).value);
    return Number.isFinite(n) ? n : (fallback || 0);
  }

  function ceTourNights() {
    const days = ceParseDaysCount(document.getElementById("ce-days") && document.getElementById("ce-days").value);
    return Math.max(0, days - 1);
  }

  function ceSumItineraryKm() {
    let km = 0;
    (ceDestRows || []).forEach((row) => {
      ceEnsureDayShape(row);
      (row.transports || []).forEach((t) => { km += Number(t.mileage || 0); });
    });
    if (!km) km = Number(document.getElementById("ce-mileage") && document.getElementById("ce-mileage").value) || 0;
    return Math.round(km);
  }

  function ceCountItems() {
    let hotels = 0, exps = 0, hotelRateSum = 0;
    (ceDestRows || []).forEach((row) => {
      ceEnsureDayShape(row);
      (row.accommodations || []).forEach((a) => {
        hotels += 1;
        hotelRateSum += Number(a.nightlyRate || 0);
      });
      exps += (row.experienceItems || []).length;
    });
    return { hotels, exps, hotelRateSum };
  }

  function ceBuildCostModel() {
    const cur = (document.getElementById("ce-cost-currency") && document.getElementById("ce-cost-currency").value) || (document.getElementById("ce-currency-primary") && document.getElementById("ce-currency-primary").value) || "USD";
    const adults = Math.max(0, ceNum("ce-cost-adults", 2));
    const children = Math.max(0, ceNum("ce-cost-children", 0));
    const infants = Math.max(0, ceNum("ce-cost-infants", 0));
    const nights = ceTourNights();
    const bataDays = Math.max(nights || 1, ceNum("ce-cost-bata-days", nights || 1));
    const counts = ceCountItems();
    const hotelNight = ceNum("ce-cost-hotel-night", 45);
    const seasonMul = (() => {
      const s = document.getElementById("ce-cost-season") && document.getElementById("ce-cost-season").value;
      if (!ceSeasonalOn) return 1;
      if (s === "peak") return 1.25;
      if (s === "shoulder") return 1.1;
      return 1;
    })();

    const accFromHotels = counts.hotelRateSum > 0 ? counts.hotelRateSum * Math.max(1, nights) : hotelNight * Math.max(1, nights) * Math.max(1, adults);
    const accommodation = Math.round(accFromHotels * seasonMul);

    const km = ceSumItineraryKm();
    const inclPerDay = ceNum("ce-cost-incl-km", 100);
    const includedKm = Math.round(inclPerDay * Math.max(1, bataDays));
    const excessKm = Math.max(0, km - includedKm);
    const mileRate = ceNum("ce-cost-mile-rate", 0.45);
    const vehDay = ceNum("ce-cost-veh-day", 85);
    const transportVehicle = Math.round(vehDay * Math.max(1, bataDays) * seasonMul);
    const excessCost = Math.round(excessKm * mileRate);
    const transport = transportVehicle + excessCost;
    const bata = Math.round(ceNum("ce-cost-bata", 20) * Math.max(1, bataDays));
    const experiences = Math.round(ceNum("ce-cost-exp-unit", 25) * Math.max(counts.exps, 1) * Math.max(1, adults) * (ceSeasonalOn ? seasonMul : 1));
    const additional = Math.round(ceNum("ce-cost-extra", 0));
    const subtotal = accommodation + transport + bata + experiences + additional;
    const markupPct = ceNum("ce-cost-markup", 18);
    const markup = Math.round(subtotal * (markupPct / 100));
    let total = subtotal + markup;
    const customPp = document.getElementById("ce-cost-custom-pp") && document.getElementById("ce-cost-custom-pp").value;
    const paying = Math.max(1, adults + children);
    let perAdult = Math.round(total / Math.max(1, adults || paying));
    if (customPp !== "" && customPp != null && Number(customPp) > 0) {
      perAdult = Number(customPp);
      total = Math.round(perAdult * adults + perAdult * (ceNum("ce-cost-child-pct", 70) / 100) * children);
    }
    const childPct = ceNum("ce-cost-child-pct", 70) / 100;
    const infantPct = ceNum("ce-cost-infant-pct", 0) / 100;
    const perChild = Math.round(perAdult * childPct);
    const perInfant = Math.round(perAdult * infantPct);
    const groupTotal = Math.round(perAdult * adults + perChild * children + perInfant * infants);

    return {
      cur, adults, children, infants, nights, bataDays, km, includedKm, excessKm, excessCost,
      accommodation, transport, transportVehicle, bata, experiences, additional, subtotal, markup, markupPct,
      total: groupTotal || total, perAdult, perChild, perInfant, seasonMul, vehicle: (document.getElementById("ce-cost-vehicle") && document.getElementById("ce-cost-vehicle").value) || "Private car",
      mileRate, vehDay, inclPerDay,
    };
  }

  function ceMoney(n, cur) {
    return (cur || "USD") + " " + Number(n || 0).toLocaleString();
  }

  function ceRenderCosting() {
    const m = ceBuildCostModel();
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set("ce-bd-acc", ceMoney(m.accommodation, m.cur));
    set("ce-bd-tr", ceMoney(m.transport, m.cur));
    set("ce-bd-bata", ceMoney(m.bata, m.cur));
    set("ce-bd-exp", ceMoney(m.experiences, m.cur));
    set("ce-bd-extra", ceMoney(m.additional, m.cur));
    set("ce-bd-sub", ceMoney(m.subtotal, m.cur));
    set("ce-bd-mark", ceMoney(m.markup, m.cur) + " (" + m.markupPct + "%)");
    set("ce-bd-total", ceMoney(m.total, m.cur));
    set("ce-bd-pp", ceMoney(m.perAdult, m.cur));
    set("ce-bd-km", m.km + " km");
    set("ce-bd-incl", m.includedKm + " km");
    set("ce-bd-excess", m.excessKm + " km");
    set("ce-bd-excess-cost", ceMoney(m.excessCost, m.cur));
    const totalEl = document.getElementById("ce-meta-total");
    if (totalEl) totalEl.textContent = "Total " + ceMoney(m.total, m.cur);
    const tbody = document.getElementById("ce-cost-pax-rows");
    if (tbody) {
      tbody.innerHTML = [
        ["Adults × " + m.adults, m.perAdult, m.perAdult * m.adults],
        ["Children × " + m.children, m.perChild, m.perChild * m.children],
        ["Infants × " + m.infants, m.perInfant, m.perInfant * m.infants],
        ["Group total", "—", m.total],
      ].map((r) => "<tr><td>" + r[0] + "</td><td>" + (r[1] === "—" ? "—" : ceMoney(r[1], m.cur)) + "</td><td>" + ceMoney(r[2], m.cur) + "</td></tr>").join("");
    }
    // sync legacy base for old pax table
    const base = document.getElementById("ce-base-usd");
    if (base) base.value = String(m.perAdult);
    const cur = document.getElementById("ce-currency");
    if (cur) cur.value = m.cur;
    return m;
  }

  function ceWireTravsta() {
    const root = document.getElementById("ce-backdrop");
    if (!root || root.dataset.travstaWired) return;
    root.dataset.travstaWired = "1";

    root.addEventListener("click", (e) => {
      const tab = e.target.closest("[data-ce-tab]");
      if (tab && root.contains(tab)) {
        cePersistBoardFields();
        ceMainTab = tab.dataset.ceTab;
        if (ceMainTab === "overview" && !(document.getElementById("ce-intro") && document.getElementById("ce-intro").value || "").trim()) {
          const name = document.getElementById("ce-name") && document.getElementById("ce-name").value && document.getElementById("ce-name").value.trim();
          if (name) document.getElementById("ce-intro").value = ceDraftIntro();
        }
        if (ceMainTab === "preview" && !(document.getElementById("ce-itinerary") && document.getElementById("ce-itinerary").value || "").trim()) {
          document.getElementById("ce-itinerary").value = ceDraftItineraryAi({ action: "draft" });
        }
        ceRenderSteps();
        return;
      }
      const dayPill = e.target.closest("[data-ce-day]");
      if (dayPill) { cePersistBoardFields(); ceActiveDay = Number(dayPill.dataset.ceDay); ceRenderDestRows(); return; }
      if (e.target.closest("#ce-add-dest")) {
        cePersistBoardFields();
        const transport = (document.getElementById("ce-transport") && document.getElementById("ce-transport").value) || "Private car";
        const day = ceBlankDay(CE_DEST_OPTIONS[0], CE_CITIES[0]);
        day.transport = transport;
        day.transports = [{ id: ceUid("tr"), from: (ceDestRows[ceDestRows.length - 1] && ceDestRows[ceDestRows.length - 1].city) || "Colombo", to: day.city, date: "", mode: "Land", autoMileage: true, mileage: 80, vehicle: transport }];
        ceFillDaySlots(day, ceDestRows.length + 1);
        ceDestRows.push(day); ceActiveDay = ceDestRows.length - 1;
        ceRenderDestRows(); ceSyncMileageUi();
        return;
      }
      const add = e.target.closest("[data-ce-add]");
      if (add) { cePersistBoardFields(); ceOpenSheet(add.dataset.ceAdd, null); return; }
      const edit = e.target.closest("[data-ce-edit]");
      if (edit) { const parts = edit.dataset.ceEdit.split(":"); cePersistBoardFields(); ceOpenSheet(parts[0], Number(parts[1])); return; }
      const delItem = e.target.closest("[data-ce-del-item]");
      if (delItem) {
        const parts = delItem.dataset.ceDelItem.split(":"); const row = ceActiveRow(); if (!row) return;
        cePersistBoardFields(); const i = Number(parts[1]); const kind = parts[0];
        if (kind === "dest") row.destinations.splice(i, 1);
        if (kind === "exp") row.experienceItems.splice(i, 1);
        if (kind === "acc") row.accommodations.splice(i, 1);
        if (kind === "tr") row.transports.splice(i, 1);
        ceSyncLegacyFromTravsta(row); ceRenderDestRows(); return;
      }
      const aiDay = e.target.closest("[data-ce-ai-day]");
      if (aiDay) {
        cePersistBoardFields(); const i = Number(aiDay.dataset.ceAiDay);
        if (!ceDestRows[i]) return;
        ceFillDaySlots(ceDestRows[i], i + 1);
        ceDestRows[i].highlights = ceDraftDayHighlights(ceDestRows[i], i + 1);
        ceRenderDestRows(); return;
      }
      const delDay = e.target.closest("[data-ce-dest-del]");
      if (delDay) {
        cePersistBoardFields();
        ceDestRows.splice(Number(delDay.dataset.ceDestDel), 1);
        if (ceActiveDay >= ceDestRows.length) ceActiveDay = Math.max(0, ceDestRows.length - 1);
        ceRenderDestRows(); ceSyncMileageUi(); return;
      }
      const theme = e.target.closest("[data-ce-theme]");
      if (theme) { const el = document.getElementById("ce-theme"); if (el) el.value = theme.dataset.ceTheme; ceRenderThemePicker(); return; }
      if (e.target.closest("#ce-sheet-close") || e.target.closest("#ce-sheet-cancel") || e.target.id === "ce-sheet-backdrop") { ceCloseSheet(); return; }
      if (e.target.closest("#ce-sheet-save")) { ceSaveSheet(); return; }
      const pick = e.target.closest("[data-ce-pick]");
      if (pick) {
        const name = pick.dataset.cePick;
        if (ceSheetMode === "dest") { document.getElementById("ce-sheet-dest-search").value = name; document.getElementById("ce-sheet-dest-name").value = name; }
        if (ceSheetMode === "exp") { document.getElementById("ce-sheet-exp-search").value = name; document.getElementById("ce-sheet-exp-name").value = name; }
        if (ceSheetMode === "acc") { document.getElementById("ce-sheet-acc-search").value = name; document.getElementById("ce-sheet-acc-hotel").value = name; }
        return;
      }
      const imgDel = e.target.closest("[data-ce-img-del]");
      if (imgDel) { ceSheetImages.splice(Number(imgDel.dataset.ceImgDel), 1); ceRenderSheetGallery(); return; }
      if (e.target.closest("#ce-sheet-tr-veh-opts")) {
        const panel = document.getElementById("ce-sheet-tr-veh-panel");
        if (panel) panel.hidden = !panel.hidden;
        return;
      }
      if (e.target.id === "ce-seasonal-toggle") {
        ceSeasonalOn = !ceSeasonalOn;
        e.target.textContent = ceSeasonalOn ? "Using Seasonal Pricing" : "Switch Seasonal Pricing";
        ceRenderCosting();
        return;
      }
      if (e.target.closest("#ce-sheet-qg")) {
        if (ceSheetMode === "dest") {
          document.getElementById("ce-sheet-dest-desc").value = ceQuickGenerate("dest", document.getElementById("ce-sheet-dest-name").value, document.getElementById("ce-sheet-dest-tags").value);
        }
        if (ceSheetMode === "exp") {
          document.getElementById("ce-sheet-exp-desc").value = ceQuickGenerate("exp", document.getElementById("ce-sheet-exp-name").value, document.getElementById("ce-sheet-exp-tags").value);
        }
        if (typeof deToast === "function") deToast("Quick Generate filled the description.", "ok");
      }
    });

    root.addEventListener("change", (e) => {
      if (e.target.matches("[data-ce-depart]")) { cePersistBoardFields(); ceRenderDestRows(); }
      if (e.target.id === "ce-sheet-tr-auto" || e.target.id === "ce-sheet-tr-from" || e.target.id === "ce-sheet-tr-to") {
        const auto = document.getElementById("ce-sheet-tr-auto");
        if (auto && auto.checked) {
          const mile = document.getElementById("ce-sheet-tr-mileage");
          if (mile) mile.value = ceCalcLegKm(document.getElementById("ce-sheet-tr-from").value, document.getElementById("ce-sheet-tr-to").value);
        }
      }
      if (e.target.id === "ce-sheet-file") { ceAddImageFiles(e.target.files); e.target.value = ""; }
    });

    root.addEventListener("input", (e) => {
      if (e.target.id === "ce-sheet-dest-search" || e.target.id === "ce-sheet-exp-search" || e.target.id === "ce-sheet-acc-search") {
        ceRenderSheetSuggestions();
        if (e.target.id === "ce-sheet-dest-search") document.getElementById("ce-sheet-dest-name").value = e.target.value;
        if (e.target.id === "ce-sheet-exp-search") document.getElementById("ce-sheet-exp-name").value = e.target.value;
        if (e.target.id === "ce-sheet-acc-search") document.getElementById("ce-sheet-acc-hotel").value = e.target.value;
      }
      if (e.target.id === "ce-name" || e.target.id === "ce-base-usd" || e.target.id === "ce-pax-count" || String(e.target.id || "").startsWith("ce-cost-")) {
        if (e.target.id === "ce-pax-count") {
          const a = document.getElementById("ce-cost-adults");
          if (a) a.value = e.target.value;
        }
        ceRenderCosting();
      }
    });

    const gal = document.getElementById("ce-sheet-gallery");
    if (gal) {
      gal.addEventListener("dragover", (e) => { e.preventDefault(); gal.classList.add("is-drag"); });
      gal.addEventListener("dragleave", () => gal.classList.remove("is-drag"));
      gal.addEventListener("drop", (e) => { e.preventDefault(); gal.classList.remove("is-drag"); ceAddImageFiles(e.dataTransfer && e.dataTransfer.files); });
    }
  }

  function ceRebind(id, handler) {
    const el = document.getElementById(id);
    if (!el || !el.parentNode) return;
    const neo = el.cloneNode(true);
    el.parentNode.replaceChild(neo, el);
    neo.addEventListener("click", handler);
  }
  function ceBootTravsta() {
    ceWireTravsta();
    ceRebind("ops-create-excursion", openCreateExcursion);
    ceRebind("ce-next", ceGoNext);
    ceRebind("ce-prev", ceGoPrev);
    ceRebind("ce-close", closeCreateExcursion);
    ceRebind("ce-download", ceDownloadProgramme);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ceBootTravsta);
  else ceBootTravsta();
})();