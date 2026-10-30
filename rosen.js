/* RosenCreator - 埋め込み用レンダラー (依存ライブラリなし / iframe不使用)
   使い方: 表示先のHTMLに rosen.css を読み込む link タグと空の div を置き、
   rosen.js を読み込んだあとで
     RosenCreator.render(document.getElementById('my-rosen'), data);
   を呼んでください。具体的なコード例は README を見てください。
   data形式:
     { width:1000, height:760, background:"#f7f3e8",
       stations:[{id:"s1", name:"新宿", x:410, y:360}],
       lines:[{id:"l1", name:"中央線", color:"#e67e22", width:10, closed:false,
               shape:"smooth", smoothness:50, style:"solid",
               nodes:[{type:"station", id:"s1"}, {type:"point", x:500, y:300}, {type:"station", id:"s2"}]}],
       images:[{id:"i1", src:"https://.../a.png", x:800, y:200, width:140, alt:""}] }
   nodes は駅 (type:"station") と曲げ点 (type:"point") の並びです。
   古い stationIds 形式もそのまま使えます。
   座標は width x height の仮想キャンバス上の値です。 */
(() => {
  "use strict";

  const smoothPath = (points, closed = false, factor = 1 / 6) => {
    if (points.length === 0) return "";
    if (points.length === 1) {
      const [p] = points;
      return `M ${p.x} ${p.y} L ${p.x + 0.1} ${p.y}`;
    }
    if (points.length === 2) {
      return `M ${points.map(({ x, y }) => `${x} ${y}`).join(" L ")}`;
    }
    const pts = closed
      ? [points.at(-1), ...points, points[0], points[1]]
      : [points[0], ...points, points.at(-1)];
    let d = `M ${pts[1].x} ${pts[1].y}`;
    for (let i = 1; i < pts.length - 2; i++) {
      const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2];
      const c1 = { x: p1.x + (p2.x - p0.x) * factor, y: p1.y + (p2.y - p0.y) * factor };
      const c2 = { x: p2.x - (p3.x - p1.x) * factor, y: p2.y - (p3.y - p1.y) * factor };
      d += ` C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)}, ${c2.x.toFixed(1)} ${c2.y.toFixed(1)}, ${p2.x} ${p2.y}`;
    }
    return closed ? `${d} Z` : d;
  };

  const stationById = (data, id) => (data.stations ?? []).find((s) => s.id === id) ?? null;

  const lineNodes = (line) =>
    line.nodes?.length
      ? line.nodes
      : (line.stationIds ?? []).map((id) => ({ type: "station", id }));

  const resolveLinePoints = (data, line) =>
    lineNodes(line)
      .map((node) => {
        if (node.type === "point") return { x: node.x, y: node.y };
        const station = stationById(data, node.id);
        return station ? { x: station.x, y: station.y } : null;
      })
      .filter(Boolean);

  const linePathD = (data, line) => {
    const pts = resolveLinePoints(data, line);
    if (pts.length < 2) return "";
    if (line.shape === "straight") {
      const d = `M ${pts.map(({ x, y }) => `${x} ${y}`).join(" L ")}`;
      return line.closed ? `${d} Z` : d;
    }
    const smoothness = typeof line.smoothness === "number" ? line.smoothness : 50;
    return smoothPath(pts, Boolean(line.closed), smoothness / 300);
  };

  // target に最も近い区間 (始点のインデックス) を返す。曲げ点の挿入位置決め用。
  const nearestSegmentIndex = (points, closed, target) => {
    const segCount = closed ? points.length : points.length - 1;
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < segCount; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const lenSq = dx * dx + dy * dy;
      const t = lenSq === 0 ? 0 : clamp01(((target.x - a.x) * dx + (target.y - a.y) * dy) / lenSq);
      const px = a.x + dx * t;
      const py = a.y + dy * t;
      const dist = Math.hypot(target.x - px, target.y - py);
      if (dist < bestDist) { bestDist = dist; best = i; }
    }
    return best;
  };
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  const render = (el, data) => {
    if (!el || !data) return el;
    const W = data.width || 1000;
    const H = data.height || 760;
    el.classList.add("rosen-map");
    el.style.background = data.background || "#f7f3e8";
    el.style.aspectRatio = `${W} / ${H}`;
    el.innerHTML = "";

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "rosen-lines");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("preserveAspectRatio", "none");

    for (const line of data.lines ?? []) {
      if (resolveLinePoints(data, line).length < 2) continue;
      const path = document.createElementNS(svgNS, "path");
      path.setAttribute("class", "rosen-line-path");
      path.dataset.lineId = line.id;
      path.setAttribute("d", linePathD(data, line));
      path.setAttribute("stroke", line.color || "#888");
      path.setAttribute("stroke-width", line.width || 10);
      const w = line.width || 10;
      if (line.style === "dashed") path.setAttribute("stroke-dasharray", `${w * 2.2} ${w * 1.4}`);
      if (line.style === "dotted") path.setAttribute("stroke-dasharray", `0.1 ${w * 1.9}`);
      if (line.name) {
        const title = document.createElementNS(svgNS, "title");
        title.textContent = line.name;
        path.appendChild(title);
      }
      svg.appendChild(path);
    }
    el.appendChild(svg);

    for (const image of data.images ?? []) {
      const wrap = document.createElement("div");
      wrap.className = "rosen-image";
      wrap.dataset.imageId = image.id;
      wrap.style.left = `${(image.x / W) * 100}%`;
      wrap.style.top = `${(image.y / H) * 100}%`;
      wrap.style.width = `${(image.width / W) * 100}%`;
      const img = document.createElement("img");
      img.src = image.src;
      img.alt = image.alt || "";
      wrap.appendChild(img);
      el.appendChild(wrap);
    }

    for (const station of data.stations ?? []) {
      const div = document.createElement("div");
      div.className = "rosen-station";
      div.dataset.stationId = station.id;
      div.style.left = `${(station.x / W) * 100}%`;
      div.style.top = `${(station.y / H) * 100}%`;
      div.textContent = station.name;
      el.appendChild(div);
    }

    el._rosenData = data;
    return el;
  };

  globalThis.RosenCreator = { render, smoothPath, linePathD, lineNodes, resolveLinePoints, stationById, nearestSegmentIndex };
})();
