/* RosenCreator エディタ */
(() => {
  "use strict";

  const STORAGE_KEY = "rosencreator-data-v1";
  const uid = (prefix) => `${prefix}${Math.random().toString(36).slice(2, 9)}`;
  const $ = (id) => document.getElementById(id);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const sampleData = () => {
    const stationDefs = [
      ["国分寺", 70, 290], ["三鷹", 180, 300], ["吉祥寺", 255, 275], ["中野", 355, 320], ["新宿", 415, 360],
      ["池袋", 515, 220], ["大久保", 415, 315], ["御茶ノ水", 625, 365], ["秋葉原", 725, 375], ["原宿", 460, 465],
      ["品川", 670, 520], ["大宮", 535, 40], ["南浦和", 635, 120], ["王子", 695, 210], ["蒲田", 595, 625],
      ["川崎", 565, 675], ["関内（馬車道）", 475, 720], ["下北沢", 260, 450], ["三軒茶屋", 400, 510],
      ["中目黒", 445, 555], ["自由が丘", 390, 610], ["武蔵小杉", 300, 640],
    ];
    const byName = new Map(stationDefs.map(([name, x, y]) => [name, { id: uid("s"), name, x, y }]));
    const nodesOf = (names) => names.map((name) => ({ type: "station", id: byName.get(name).id }));
    const makeLine = (name, color, width, closed, stationNames) => ({
      id: uid("l"), name, color, width, closed,
      shape: "smooth", smoothness: 50, style: "solid",
      nodes: nodesOf(stationNames),
      stationIds: stationNames.map((n) => byName.get(n).id),
    });
    return {
      width: 1000, height: 760, background: "#f7f3e8",
      stations: [...byName.values()],
      lines: [
        makeLine("山手線", "#80c241", 11, true, ["池袋", "新宿", "原宿", "品川", "秋葉原"]),
        makeLine("中央線", "#e67e22", 10, false, ["国分寺", "三鷹", "吉祥寺", "中野", "新宿", "御茶ノ水", "秋葉原"]),
        makeLine("京浜東北線", "#5bb2e0", 10, false, ["大宮", "南浦和", "王子", "秋葉原", "品川", "蒲田", "川崎", "関内（馬車道）"]),
        makeLine("南西方面", "#c0396b", 9, false, ["下北沢", "三軒茶屋", "中目黒", "自由が丘", "武蔵小杉"]),
      ],
      images: [],
    };
  };

  const loadData = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? sampleData();
    } catch {
      return sampleData();
    }
  };

  let data = loadData();
  if (!data.stations || !data.lines) data = sampleData();

  let selected = { type: null, id: null };
  let picking = false;
  let pendingImagePos = null;
  let mapMenu = null;
  let pendingConnect = null;
  let statusTimer = null;
  let mapMenuClosedAt = 0;

  const setStatus = (message) => {
    const el = $("connectStatus");
    if (!el) return;
    el.textContent = message;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => { el.textContent = ""; }, 5000);
  };

  const stage = $("stage");
  const save = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* 保存できなくても編集は続ける */ }
  };
  const findStation = (id) => data.stations.find((s) => s.id === id);
  const findLine = (id) => data.lines.find((l) => l.id === id);
  const findImage = (id) => data.images.find((i) => i.id === id);

  const syncLine = (line) => {
    line.stationIds = RosenCreator.lineNodes(line)
      .filter((node) => node.type === "station")
      .map((node) => node.id);
  };
  const ensureLine = (line) => {
    line.nodes ??= (line.stationIds ?? []).map((id) => ({ type: "station", id }));
    line.smoothness ??= 50;
    line.shape ??= "smooth";
    line.style ??= "solid";
    syncLine(line);
  };
  data.lines.forEach(ensureLine);

  const select = (type, id) => {
    selected = { type, id };
    if (type !== "line") picking = false;
  };

  /* ---------- 描画 ---------- */
  const render = () => {
    RosenCreator.render(stage, data);

    stage.querySelectorAll(".rosen-line-path").forEach((path) => {
      const hit = document.createElementNS("http://www.w3.org/2000/svg", "path");
      hit.setAttribute("class", "rosen-line-hit");
      hit.setAttribute("d", path.getAttribute("d"));
      hit.dataset.lineId = path.dataset.lineId;
      hit.setAttribute("stroke", "rgba(0, 0, 0, 0)");
      hit.setAttribute("stroke-width", (Number(path.getAttribute("stroke-width")) || 10) + 18);
      hit.setAttribute("fill", "none");
      hit.setAttribute("stroke-linecap", "round");
      path.parentNode.appendChild(hit);
      hit.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (Date.now() - mapMenuClosedAt < 400) return;
        closeMapMenu();
        select("line", hit.dataset.lineId);
        render();
      });
    });
    stage.querySelectorAll(".rosen-station").forEach((el) => {
      const { stationId: id } = el.dataset;
      if (selected.type === "station" && selected.id === id) el.classList.add("selected");
      el.addEventListener("pointerdown", (ev) => onStationPointer(ev, id, el));
    });
    stage.querySelectorAll(".rosen-image").forEach((el) => {
      const { imageId: id } = el.dataset;
      if (selected.type === "image" && selected.id === id) el.classList.add("selected");
      el.addEventListener("pointerdown", (ev) => {
        const image = findImage(id);
        if (image) dragPoint(ev, image, el, () => select("image", id));
      });
    });

    renderStationPorts();
    renderBendHandles();
    renderLineLabel();
    renderLists();
    renderEditors();
  };

  const renderStationPorts = () => {
    stage.querySelectorAll(".rosen-station").forEach((el) => {
      const { stationId } = el.dataset;
      for (const side of ["left", "right"]) {
        const port = document.createElement("span");
        port.className = `station-port port-${side}`;
        port.dataset.stationId = stationId;
        port.title = "ドラッグ（またはクリック→クリック）で別の駅と接続";
        if (pendingConnect?.stationId === stationId) port.classList.add("port-pending");
        port.addEventListener("pointerdown", (ev) => onPortPointerDown(ev, stationId));
        el.appendChild(port);
      }
    });
  };

  const lineMidPoint = (line) => {
    const points = RosenCreator.resolveLinePoints(data, line);
    if (points.length === 0) return null;
    const segCount = line.closed ? points.length : points.length - 1;
    if (segCount < 1) return points[0];
    const lengths = [];
    let total = 0;
    for (let i = 0; i < segCount; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      lengths.push(len);
      total += len;
    }
    let rest = total / 2;
    for (let i = 0; i < segCount; i++) {
      if (rest <= lengths[i]) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        const t = lengths[i] === 0 ? 0 : rest / lengths[i];
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      }
      rest -= lengths[i];
    }
    return points.at(-1);
  };

  const renderLineLabel = () => {
    if (selected.type !== "line") return;
    const line = findLine(selected.id);
    if (!line) return;
    const mid = lineMidPoint(line);
    if (!mid) return;
    const label = document.createElement("div");
    label.className = "line-label";
    label.textContent = line.name;
    label.style.left = `${(mid.x / data.width) * 100}%`;
    label.style.top = `${(mid.y / data.height) * 100}%`;
    label.style.background = line.color;
    stage.appendChild(label);
  };

  const renderBendHandles = () => {
    if (selected.type !== "line") return;
    const line = findLine(selected.id);
    if (!line) return;
    ensureLine(line);

    const points = RosenCreator.resolveLinePoints(data, line);
    const segCount = line.closed ? points.length : points.length - 1;
    for (let i = 0; i < segCount; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      if (!a || !b) continue;
      if (Math.hypot(b.x - a.x, b.y - a.y) < 120) continue; // 短い区間では＋を出さない (駅に重なって邪魔になるため)
      const handle = document.createElement("div");
      handle.className = "seg-add";
      handle.textContent = "+";
      handle.title = "ここに曲げ点を追加";
      handle.style.left = `${(((a.x + b.x) / 2) / data.width) * 100}%`;
      handle.style.top = `${(((a.y + b.y) / 2) / data.height) * 100}%`;
      handle.addEventListener("pointerdown", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        line.nodes.splice(i + 1, 0, { type: "point", x: Math.round((a.x + b.x) / 2), y: Math.round((a.y + b.y) / 2) });
        syncLine(line);
        save();
        render();
      });
      stage.appendChild(handle);
    }

    line.nodes.forEach((node, index) => {
      if (node.type !== "point") return;
      const handle = document.createElement("div");
      handle.className = "bend-handle";
      handle.title = "曲げ点（ドラッグで移動／ダブルクリックで削除）";
      handle.style.left = `${(node.x / data.width) * 100}%`;
      handle.style.top = `${(node.y / data.height) * 100}%`;
      handle.style.borderColor = line.color;
      handle.addEventListener("pointerdown", (ev) => dragPoint(ev, node, handle));
      handle.addEventListener("dblclick", () => {
        line.nodes.splice(index, 1);
        syncLine(line);
        save();
        render();
      });
      stage.appendChild(handle);
    });
  };

  /* ---------- ドラッグ ---------- */
  const dragPoint = (ev, target, el, onStart) => {
    ev.preventDefault();
    ev.stopPropagation();
    onStart?.();
    const mapEl = stage.classList.contains("rosen-map") ? stage : stage.querySelector(".rosen-map");
    const rect = mapEl.getBoundingClientRect();

    const move = (e) => {
      target.x = Math.round(clamp(((e.clientX - rect.left) / rect.width) * data.width, 0, data.width));
      target.y = Math.round(clamp(((e.clientY - rect.top) / rect.height) * data.height, 0, data.height));
      el.style.left = `${(target.x / data.width) * 100}%`;
      el.style.top = `${(target.y / data.height) * 100}%`;
      stage.querySelectorAll(".rosen-line-path, .rosen-line-hit").forEach((path) => {
        const line = findLine(path.dataset.lineId);
        if (line) path.setAttribute("d", RosenCreator.linePathD(data, line));
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      save();
      render();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const onStationPointer = (ev, id, el) => {
    if (picking && selected.type === "line") {
      ev.preventDefault();
      const line = findLine(selected.id);
      if (!line) return;
      ensureLine(line);
      const last = line.nodes.at(-1);
      if (!(last?.type === "station" && last.id === id)) {
        line.nodes.push({ type: "station", id });
        syncLine(line);
        save();
        render();
      }
      return;
    }
    const station = findStation(id);
    if (station) dragPoint(ev, station, el, () => select("station", id));
  };

  /* ---------- ブループリント風の駅接続 ---------- */
  const LINE_COLORS = ["#e67e22", "#80c241", "#5bb2e0", "#c0396b", "#8e44ad", "#16a085"];

  const createLineForConnection = () => {
    const line = {
      id: uid("l"),
      name: `路線${data.lines.length + 1}`,
      color: LINE_COLORS[data.lines.length % LINE_COLORS.length],
      width: 10, closed: false,
      shape: "smooth", smoothness: 50, style: "solid",
      nodes: [], stationIds: [],
    };
    data.lines.push(line);
    return line;
  };

  const stationNodeIndex = (line, stationId) =>
    RosenCreator.lineNodes(line).findIndex((node) => node.type === "station" && node.id === stationId);

  const connectStations = (fromId, toId) => {
    if (fromId === toId) return;
    const fromName = findStation(fromId)?.name ?? "?";
    const toName = findStation(toId)?.name ?? "?";
    let line = selected.type === "line" ? findLine(selected.id) : null;
    if (line) ensureLine(line);

    const needsNewLine = () => {
      line = createLineForConnection();
      line.nodes.push({ type: "station", id: fromId }, { type: "station", id: toId });
      return line;
    };

    if (!line) {
      needsNewLine();
    } else {
      const nodes = line.nodes;
      const fi = stationNodeIndex(line, fromId);
      const ti = stationNodeIndex(line, toId);
      if (fi >= 0 && ti >= 0) {
        setStatus(Math.abs(fi - ti) === 1
          ? `${line.name}では ${fromName} と ${toName} はすでに接続されています`
          : `${line.name}内では離れた駅同士を直接はつなげません（分岐は未対応です）`);
        return;
      }
      if (fi < 0 && ti < 0) {
        if (nodes.length >= 2) needsNewLine();
        else nodes.push({ type: "station", id: fromId }, { type: "station", id: toId });
      } else if (fi >= 0) {
        if (fi === 0 && nodes.length > 1) nodes.unshift({ type: "station", id: toId });
        else if (fi === nodes.length - 1) nodes.push({ type: "station", id: toId });
        else needsNewLine();
      } else {
        if (ti === 0 && nodes.length > 1) nodes.unshift({ type: "station", id: fromId });
        else if (ti === nodes.length - 1) nodes.push({ type: "station", id: fromId });
        else needsNewLine();
      }
    }

    syncLine(line);
    select("line", line.id);
    picking = false;
    pendingConnect = null;
    save();
    render();
    setStatus(`${line.name}に ${fromName} → ${toName} を接続しました`);
  };

  const connectStationToPoint = (fromId, pos) => {
    let line = selected.type === "line" ? findLine(selected.id) : null;
    if (line) ensureLine(line);
    const pointNode = { type: "point", x: pos.x, y: pos.y };
    const startNewLine = () => {
      line = createLineForConnection();
      line.nodes.push({ type: "station", id: fromId }, pointNode);
    };
    if (!line) {
      startNewLine();
    } else {
      const nodes = line.nodes;
      const fi = stationNodeIndex(line, fromId);
      if (fi < 0) {
        if (nodes.length >= 2) startNewLine();
        else if (nodes.length === 0) nodes.push({ type: "station", id: fromId }, pointNode);
        else nodes.push({ type: "station", id: fromId }, pointNode);
      } else if (fi === 0 && nodes.length > 1) {
        nodes.unshift(pointNode);
      } else if (fi === nodes.length - 1) {
        nodes.push(pointNode);
      } else {
        startNewLine();
      }
    }
    syncLine(line);
    select("line", line.id);
    picking = false;
    pendingConnect = null;
    save();
    render();
    setStatus(`${line.name}に曲げ点を追加して接続しました`);
  };

  const showConnectChoice = (clientX, clientY, fromId, pos) => {
    closeMapMenu();
    const fromName = findStation(fromId)?.name ?? "駅";
    mapMenu = document.createElement("div");
    mapMenu.className = "map-menu";

    const title = document.createElement("h4");
    title.textContent = `${fromName} から伸ばした線の先端（${pos.x}, ${pos.y}）`;
    mapMenu.appendChild(title);

    const row = document.createElement("div");
    row.className = "row";
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "新しい駅名";
    const addStationButton = document.createElement("button");
    addStationButton.type = "button";
    addStationButton.className = "primary";
    addStationButton.textContent = "駅を作る";
    addStationButton.addEventListener("click", () => {
      const station = { id: uid("s"), name: nameInput.value.trim() || "新しい駅", x: pos.x, y: pos.y };
      data.stations.push(station);
      closeMapMenu();
      connectStations(fromId, station.id);
    });
    nameInput.addEventListener("keydown", (ev) => { if (ev.key === "Enter") addStationButton.click(); });
    row.append(nameInput, addStationButton);
    mapMenu.appendChild(row);

    const bendButton = document.createElement("button");
    bendButton.type = "button";
    bendButton.textContent = "駅は作らず、曲げ点として接続";
    bendButton.addEventListener("click", () => {
      closeMapMenu();
      connectStationToPoint(fromId, pos);
    });
    mapMenu.appendChild(bendButton);

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.textContent = "キャンセル";
    cancelButton.addEventListener("click", closeMapMenu);
    mapMenu.appendChild(cancelButton);

    mapMenu.style.left = `${Math.min(clientX, window.innerWidth - 250)}px`;
    mapMenu.style.top = `${Math.min(clientY, window.innerHeight - 260)}px`;
    document.body.appendChild(mapMenu);
    // 離した直後に発火する click で、別のメニューや選択に化けないようにする
    mapMenuClosedAt = Date.now();
    nameInput.focus();
  };

  const onPortPointerDown = (ev, stationId) => {
    ev.preventDefault();
    ev.stopPropagation();

    if (pendingConnect && pendingConnect.stationId !== stationId) {
      const fromId = pendingConnect.stationId;
      pendingConnect = null;
      connectStations(fromId, stationId);
      return;
    }
    if (pendingConnect?.stationId === stationId) {
      pendingConnect = null;
      setStatus("接続をキャンセルしました");
      render();
      return;
    }

    const station = findStation(stationId);
    if (!station) return;
    const start = { x: station.x, y: station.y };
    const line = selected.type === "line" ? findLine(selected.id) : null;

    const overlay = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    overlay.setAttribute("class", "connect-overlay");
    overlay.setAttribute("viewBox", `0 0 ${data.width} ${data.height}`);
    overlay.setAttribute("preserveAspectRatio", "none");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("class", "connect-wire");
    path.setAttribute("stroke", line?.color || "#e8833a");
    overlay.appendChild(path);
    stage.appendChild(overlay);

    let hoveredPort = null;
    let moved = false;
    const startClient = { x: ev.clientX, y: ev.clientY };
    const drawWire = (clientX, clientY) => {
      const pos = toMapCoords(clientX, clientY);
      const bend = Math.max(40, Math.abs(pos.x - start.x) * 0.5);
      path.setAttribute("d", `M ${start.x} ${start.y} C ${start.x + bend} ${start.y}, ${pos.x - bend} ${pos.y}, ${pos.x} ${pos.y}`);
    };
    drawWire(ev.clientX, ev.clientY);

    const move = (e) => {
      if (Math.hypot(e.clientX - startClient.x, e.clientY - startClient.y) > 6) moved = true;
      drawWire(e.clientX, e.clientY);
      const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest?.(".station-port");
      const target = hit && hit.dataset.stationId !== stationId ? hit : null;
      if (hoveredPort && hoveredPort !== target) hoveredPort.classList.remove("port-hover");
      hoveredPort = target;
      hoveredPort?.classList.add("port-hover");
    };
    const up = (e) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      overlay.remove();
      if (hoveredPort) {
        connectStations(stationId, hoveredPort.dataset.stationId);
        return;
      }
      const hitStation = document.elementFromPoint(e.clientX, e.clientY)?.closest?.(".rosen-station");
      if (hitStation && hitStation.dataset.stationId !== stationId) {
        connectStations(stationId, hitStation.dataset.stationId);
        return;
      }
      if (!moved) {
        pendingConnect = { stationId };
        setStatus(`${station.name} を接続元にしました。接続先の駅のポートをクリックしてください（Escで取消）`);
        render();
        return;
      }
      showConnectChoice(e.clientX, e.clientY, stationId, toMapCoords(e.clientX, e.clientY));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /* ---------- 一覧 ---------- */
  const makeListItem = ({ label, isSelected, swatch, onClick }) => {
    const li = document.createElement("li");
    if (isSelected) li.className = "selected";
    if (swatch) {
      const span = document.createElement("span");
      span.className = "swatch";
      span.style.background = swatch;
      li.appendChild(span);
    }
    const grow = document.createElement("span");
    grow.className = "grow";
    grow.textContent = label;
    li.appendChild(grow);
    li.addEventListener("click", onClick);
    return li;
  };

  const renderLists = () => {
    $("stationList").replaceChildren(...data.stations.map((station) =>
      makeListItem({
        label: station.name,
        isSelected: selected.type === "station" && selected.id === station.id,
        onClick: () => { select("station", station.id); render(); },
      })));

    $("lineList").replaceChildren(...data.lines.map((line) => {
      const stationCount = RosenCreator.lineNodes(line).filter((n) => n.type === "station").length;
      return makeListItem({
        label: `${line.name}（${stationCount}駅）`,
        isSelected: selected.type === "line" && selected.id === line.id,
        swatch: line.color,
        onClick: () => { select("line", line.id); render(); },
      });
    }));

    $("imageList").replaceChildren(...data.images.map((image, index) =>
      makeListItem({
        label: image.alt || `画像 ${index + 1}`,
        isSelected: selected.type === "image" && selected.id === image.id,
        onClick: () => { select("image", image.id); render(); },
      })));
  };

  /* ---------- 編集パネル ---------- */
  const renderEditors = () => {
    const station = selected.type === "station" ? findStation(selected.id) : null;
    $("stationEditor").hidden = !station;
    if (station) {
      $("editStationName").value = station.name;
      $("editStationX").value = station.x;
      $("editStationY").value = station.y;
    }

    const line = selected.type === "line" ? findLine(selected.id) : null;
    $("lineEditor").hidden = !line;
    if (line) {
      ensureLine(line);
      $("editLineName").value = line.name;
      $("editLineColor").value = line.color;
      $("editLineWidth").value = line.width || 10;
      $("editLineClosed").checked = Boolean(line.closed);
      $("editLineShape").value = line.shape;
      $("editLineSmooth").value = line.smoothness;
      $("editLineStyle").value = line.style;
      $("btnPickStations").textContent = `駅をクリックして追加する： ${picking ? "ON" : "OFF"}`;
      $("btnPickStations").classList.toggle("active", picking);

      $("lineStations").replaceChildren(...line.nodes.map((node, index) => {
        const li = document.createElement("li");
        const grow = document.createElement("span");
        grow.className = "grow";
        grow.textContent = node.type === "station"
          ? (findStation(node.id)?.name ?? "(削除済み)")
          : `曲げ点（${node.x}, ${node.y}）`;
        li.appendChild(grow);

        for (const [label, delta] of [["↑", -1], ["↓", 1]]) {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = label;
          button.addEventListener("click", () => {
            const j = index + delta;
            if (j < 0 || j >= line.nodes.length) return;
            [line.nodes[index], line.nodes[j]] = [line.nodes[j], line.nodes[index]];
            syncLine(line);
            save();
            render();
          });
          li.appendChild(button);
        }
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "外す";
        remove.addEventListener("click", () => {
          line.nodes.splice(index, 1);
          syncLine(line);
          save();
          render();
        });
        li.appendChild(remove);
        return li;
      }));
    }

    const image = selected.type === "image" ? findImage(selected.id) : null;
    $("imageEditor").hidden = !image;
    if (image) $("editImageWidth").value = image.width;
  };

  /* ---------- 左パネルの折りたたみ ---------- */
  const PANEL_KEY = "rosenCreatorPanelCollapsed";
  let collapsedSections = [];
  try { collapsedSections = JSON.parse(localStorage.getItem(PANEL_KEY) || "[]"); } catch { collapsedSections = []; }
  document.querySelectorAll(".panel section").forEach((section) => {
    const h2 = section.querySelector(":scope > h2");
    if (!h2) return;
    const key = h2.textContent.trim();
    section.classList.add("collapsible");
    if (collapsedSections.includes(key)) section.classList.add("collapsed");
    h2.title = "クリックで開いたり閉じたりできます";
    h2.addEventListener("click", () => {
      section.classList.toggle("collapsed");
      const now = [...document.querySelectorAll(".panel section.collapsed")]
        .map((s) => s.querySelector(":scope > h2")?.textContent.trim())
        .filter(Boolean);
      localStorage.setItem(PANEL_KEY, JSON.stringify(now));
    });
  });

  /* ---------- イベント: マップ / 駅 ---------- */
  $("mapBg").value = data.background || "#f7f3e8";
  $("mapBg").addEventListener("input", (ev) => { data.background = ev.target.value; save(); render(); });

  $("btnAddStation").addEventListener("click", () => {
    const name = $("stationName").value.trim();
    if (!name) return;
    const station = {
      id: uid("s"), name,
      x: 120 + Math.round(Math.random() * 120),
      y: 120 + Math.round(Math.random() * 120),
    };
    data.stations.push(station);
    $("stationName").value = "";
    select("station", station.id);
    save();
    render();
  });
  $("stationName").addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") $("btnAddStation").click();
  });
  $("editStationName").addEventListener("input", (ev) => {
    const station = findStation(selected.id);
    if (!station) return;
    station.name = ev.target.value;
    save();
    renderLists();
    stage.querySelectorAll(".rosen-station").forEach((el) => {
      if (el.dataset.stationId === station.id) el.textContent = station.name;
    });
  });
  const applyStationCoords = () => {
    const station = findStation(selected.id);
    if (!station) return;
    station.x = Number($("editStationX").value) || 0;
    station.y = Number($("editStationY").value) || 0;
    save();
    render();
  };
  $("editStationX").addEventListener("change", applyStationCoords);
  $("editStationY").addEventListener("change", applyStationCoords);
  $("btnDeleteStation").addEventListener("click", () => {
    const station = findStation(selected.id);
    if (!station) return;
    data.stations = data.stations.filter((s) => s.id !== station.id);
    data.lines.forEach((line) => {
      ensureLine(line);
      line.nodes = line.nodes.filter((node) => !(node.type === "station" && node.id === station.id));
      syncLine(line);
    });
    select(null, null);
    save();
    render();
  });

  /* ---------- イベント: 路線 ---------- */
  $("btnAddLine").addEventListener("click", () => {
    const line = {
      id: uid("l"),
      name: $("lineName").value.trim() || "新しい路線",
      color: $("lineColor").value,
      width: 10, closed: false,
      shape: "smooth", smoothness: 50, style: "solid",
      nodes: [], stationIds: [],
    };
    data.lines.push(line);
    $("lineName").value = "";
    select("line", line.id);
    picking = true;
    save();
    render();
  });
  const currentLine = () => findLine(selected.id);
  $("editLineName").addEventListener("input", (ev) => { const l = currentLine(); if (l) { l.name = ev.target.value; save(); renderLists(); } });
  $("editLineColor").addEventListener("input", (ev) => { const l = currentLine(); if (l) { l.color = ev.target.value; save(); render(); } });
  $("editLineWidth").addEventListener("input", (ev) => { const l = currentLine(); if (l) { l.width = Number(ev.target.value); save(); render(); } });
  $("editLineClosed").addEventListener("change", (ev) => { const l = currentLine(); if (l) { l.closed = ev.target.checked; save(); render(); } });
  $("editLineShape").addEventListener("change", (ev) => { const l = currentLine(); if (l) { l.shape = ev.target.value; save(); render(); } });
  $("editLineSmooth").addEventListener("input", (ev) => { const l = currentLine(); if (l) { l.smoothness = Number(ev.target.value); save(); render(); } });
  $("editLineStyle").addEventListener("change", (ev) => { const l = currentLine(); if (l) { l.style = ev.target.value; save(); render(); } });
  $("btnPickStations").addEventListener("click", () => { picking = !picking; render(); });
  $("btnDeleteLine").addEventListener("click", () => {
    data.lines = data.lines.filter((l) => l.id !== selected.id);
    select(null, null);
    save();
    render();
  });

  /* ---------- イベント: 画像 ---------- */
  $("btnAddImageUrl").addEventListener("click", () => {
    const url = $("imageUrl").value.trim();
    if (!url) return;
    const image = { id: uid("i"), src: url, x: pendingImagePos?.x ?? 800, y: pendingImagePos?.y ?? 160, width: 150, alt: "画像" };
    pendingImagePos = null;
    data.images.push(image);
    $("imageUrl").value = "";
    select("image", image.id);
    save();
    render();
  });
  $("fileImage").addEventListener("change", (ev) => {
    const [file] = ev.target.files;
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const image = { id: uid("i"), src: reader.result, x: pendingImagePos?.x ?? 800, y: pendingImagePos?.y ?? 160, width: 180, alt: file.name };
      pendingImagePos = null;
      data.images.push(image);
      select("image", image.id);
      save();
      render();
    });
    reader.readAsDataURL(file);
    ev.target.value = "";
  });
  $("editImageWidth").addEventListener("input", (ev) => {
    const image = findImage(selected.id);
    if (image) { image.width = Number(ev.target.value); save(); render(); }
  });
  $("btnDeleteImage").addEventListener("click", () => {
    data.images = data.images.filter((i) => i.id !== selected.id);
    select(null, null);
    save();
    render();
  });

  /* ---------- イベント: データ ---------- */
  $("btnSample").addEventListener("click", () => {
    data = sampleData();
    select(null, null);
    $("mapBg").value = data.background;
    save();
    render();
  });
  $("btnExportJson").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = "rosen-data.json";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(anchor.href), 2000);
  });
  $("fileImportJson").addEventListener("change", async (ev) => {
    const [file] = ev.target.files;
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      if (!imported.stations || !imported.lines) throw new Error("形式が違います");
      data = imported;
      data.lines.forEach(ensureLine);
      select(null, null);
      save();
      render();
    } catch (error) {
      alert(`JSONを読み込めませんでした: ${error.message}`);
    }
    ev.target.value = "";
  });

  /* ---------- マップの何もない所をクリック -> 挿入メニュー ---------- */
  const closeMapMenu = () => {
    mapMenu?.remove();
    mapMenu = null;
  };

  const toMapCoords = (clientX, clientY) => {
    const mapEl = stage.classList.contains("rosen-map") ? stage : stage.querySelector(".rosen-map");
    const rect = mapEl.getBoundingClientRect();
    return {
      x: Math.round(clamp(((clientX - rect.left) / rect.width) * data.width, 0, data.width)),
      y: Math.round(clamp(((clientY - rect.top) / rect.height) * data.height, 0, data.height)),
    };
  };

  const showMapMenu = (clientX, clientY) => {
    closeMapMenu();
    const pos = toMapCoords(clientX, clientY);
    const line = selected.type === "line" ? findLine(selected.id) : null;

    mapMenu = document.createElement("div");
    mapMenu.className = "map-menu";

    const title = document.createElement("h4");
    title.textContent = `この場所に追加（${pos.x}, ${pos.y}）`;
    mapMenu.appendChild(title);

    const stationRow = document.createElement("div");
    stationRow.className = "row";
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "駅名";
    const addStationButton = document.createElement("button");
    addStationButton.type = "button";
    addStationButton.className = "primary";
    addStationButton.textContent = "駅を追加";
    const addStation = () => {
      const station = { id: uid("s"), name: nameInput.value.trim() || "新しい駅", x: pos.x, y: pos.y };
      data.stations.push(station);
      select("station", station.id);
      closeMapMenu();
      save();
      render();
    };
    addStationButton.addEventListener("click", addStation);
    nameInput.addEventListener("keydown", (ev) => { if (ev.key === "Enter") addStation(); });
    stationRow.append(nameInput, addStationButton);
    mapMenu.appendChild(stationRow);

    const addMenuButton = (label, handler) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.addEventListener("click", handler);
      mapMenu.appendChild(button);
      return button;
    };

    addMenuButton(
      line ? `曲げ点として「${line.name}」に追加` : "曲げ点として路線に追加（路線を選択中のみ）",
      () => {
        if (!line) return;
        ensureLine(line);
        const points = RosenCreator.resolveLinePoints(data, line);
        const segIndex = points.length >= 2
          ? RosenCreator.nearestSegmentIndex(points, Boolean(line.closed), pos)
          : line.nodes.length - 1;
        line.nodes.splice(segIndex + 1, 0, { type: "point", x: pos.x, y: pos.y });
        syncLine(line);
        closeMapMenu();
        save();
        render();
      },
    ).disabled = !line;

    addMenuButton("ここから新しい路線を開始", () => {
      const newLine = {
        id: uid("l"),
        name: $("lineName").value.trim() || "新しい路線",
        color: $("lineColor").value,
        width: 10, closed: false,
        shape: "smooth", smoothness: 50, style: "solid",
        nodes: [{ type: "point", x: pos.x, y: pos.y }],
        stationIds: [],
      };
      data.lines.push(newLine);
      select("line", newLine.id);
      picking = true;
      closeMapMenu();
      save();
      render();
    });

    addMenuButton("ここに画像を挿入（次に追加する画像の位置）", () => {
      pendingImagePos = pos;
      closeMapMenu();
      $("imageUrl").placeholder = `画像URL（${pos.x}, ${pos.y}）に配置します`;
      $("imageUrl").focus();
    });

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.textContent = "閉じる";
    closeButton.addEventListener("click", closeMapMenu);
    mapMenu.appendChild(closeButton);

    mapMenu.style.left = `${Math.min(clientX, window.innerWidth - 250)}px`;
    mapMenu.style.top = `${Math.min(clientY, window.innerHeight - 320)}px`;
    document.body.appendChild(mapMenu);
    nameInput.focus();
  };

  const isInteractiveTarget = (target) =>
    target.closest(".rosen-station, .rosen-image, .bend-handle, .seg-add, .map-menu");

  stage.addEventListener("click", (ev) => {
    if (Date.now() - mapMenuClosedAt < 400) return;
    if (isInteractiveTarget(ev.target)) return;
    showMapMenu(ev.clientX, ev.clientY);
  });
  stage.addEventListener("contextmenu", (ev) => {
    if (Date.now() - mapMenuClosedAt < 400) return;
    if (isInteractiveTarget(ev.target)) return;
    ev.preventDefault();
    showMapMenu(ev.clientX, ev.clientY);
  });
  // メニューが開いている間は、メニュー外のクリックで閉じる (そのクリックで開き直さない)
  document.addEventListener("pointerdown", (ev) => {
    if (mapMenu && !mapMenu.contains(ev.target)) {
      closeMapMenu();
      mapMenuClosedAt = Date.now();
    }
  }, true);
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      closeMapMenu();
      if (pendingConnect) {
        pendingConnect = null;
        setStatus("接続をキャンセルしました");
        render();
      }
    }
  });

  /* ---------- 埋め込みコード (iframeなし・自己完結) ---------- */
  const buildEmbed = (cssText, jsText) => {
    const id = "rosen-embed-1";
    return [
      `<div id="${id}"></div>`,
      cssText ? `<style>\n${cssText}\n</style>` : '<link rel="stylesheet" href="rosen.css">',
      jsText ? `<script>\n${jsText}\n<\/script>` : '<script src="rosen.js"><\/script>',
      `<script>\nRosenCreator.render(document.getElementById('${id}'), ${JSON.stringify(data)});\n<\/script>`,
    ].join("\n");
  };

  $("btnEmbed").addEventListener("click", async () => {
    $("embedBox").hidden = false;
    if (window.__ROSEN_CSS__ && window.__ROSEN_JS__) {
      $("embedCode").value = buildEmbed(window.__ROSEN_CSS__, window.__ROSEN_JS__);
    } else {
      const fetchText = async (url) => {
        try { return await (await fetch(url)).text(); } catch { return null; }
      };
      const [cssText, jsText] = await Promise.all([fetchText("rosen.css"), fetchText("rosen.js")]);
      $("embedCode").value = buildEmbed(cssText, jsText);
    }
    $("embedBox").scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
  $("btnCopyEmbed").addEventListener("click", async () => {
    $("embedCode").select();
    try {
      await navigator.clipboard.writeText($("embedCode").value);
    } catch {
      document.execCommand("copy");
    }
    $("copyResult").textContent = "コピーしました。表示したいページのHTMLに貼ってください。";
  });
  $("btnDownloadEmbed").addEventListener("click", () => {
    const html = `<!DOCTYPE html>\n<html lang="ja"><head><meta charset="UTF-8"><title>Rosen Embed</title></head><body>\n${$("embedCode").value}\n</body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = "embed.html";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(anchor.href), 2000);
  });
  $("btnCloseEmbed").addEventListener("click", () => { $("embedBox").hidden = true; });

  render();
})();
