/* RosenCreator - 埋め込み用レンダラー (依存ライブラリなし / iframe不使用)
   使い方:
     <link rel="stylesheet" href="rosen.css">
     <div id="my-rosen"></div>
     <script src="rosen.js"></script>
     <script>RosenCreator.render(document.getElementById('my-rosen'), data);</script>
   data形式:
     { width:1000, height:760, background:"#f7f3e8",
       stations:[{id:"s1", name:"新宿", x:410, y:360}],
       lines:[{id:"l1", name:"中央線", color:"#e67e22", width:10, closed:false, stationIds:["s1","s2"]}],
       images:[{id:"i1", src:"https://.../a.png", x:800, y:200, width:140, alt:""}] }
   座標は width x height の仮想キャンバス上の値です。 */
(function (global) {
  "use strict";

  function smoothPath(points, closed) {
    if (!points.length) return "";
    if (points.length === 1) {
      var p = points[0];
      return "M " + p.x + " " + p.y + " L " + (p.x + 0.1) + " " + p.y;
    }
    if (points.length === 2 || !closed && points.length === 2) {
      return "M " + points.map(function (q) { return q.x + " " + q.y; }).join(" L ");
    }
    var pts = points.slice();
    if (closed) { pts = [points[points.length - 1]].concat(points, [points[0], points[1]]); }
    else { pts = [points[0]].concat(points, [points[points.length - 1]]); }
    var d = "M " + pts[1].x + " " + pts[1].y;
    for (var i = 1; i < pts.length - 2; i++) {
      var p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2];
      var c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
      var c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
      d += " C " + c1x.toFixed(1) + " " + c1y.toFixed(1) + ", " + c2x.toFixed(1) + " " + c2y.toFixed(1) + ", " + p2.x + " " + p2.y;
    }
    if (closed) d += " Z";
    return d;
  }

  function stationById(data, id) {
    for (var i = 0; i < (data.stations || []).length; i++) {
      if (data.stations[i].id === id) return data.stations[i];
    }
    return null;
  }

  function linePathD(data, line) {
    var pts = (line.stationIds || []).map(function (id) { return stationById(data, id); }).filter(Boolean);
    return smoothPath(pts, !!line.closed);
  }

  function render(el, data) {
    if (!el || !data) return;
    var W = data.width || 1000, H = data.height || 760;
    el.classList.add("rosen-map");
    el.style.background = data.background || "#f7f3e8";
    el.style.aspectRatio = W + " / " + H;
    el.innerHTML = "";

    var svgNS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "rosen-lines");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("preserveAspectRatio", "none");
    (data.lines || []).forEach(function (line) {
      if (!line.stationIds || line.stationIds.length < 2) return;
      var path = document.createElementNS(svgNS, "path");
      path.setAttribute("class", "rosen-line-path");
      path.setAttribute("data-line-id", line.id);
      path.setAttribute("d", linePathD(data, line));
      path.setAttribute("stroke", line.color || "#888");
      path.setAttribute("stroke-width", line.width || 10);
      svg.appendChild(path);
    });
    el.appendChild(svg);

    (data.images || []).forEach(function (im) {
      var wrap = document.createElement("div");
      wrap.className = "rosen-image";
      wrap.setAttribute("data-image-id", im.id);
      wrap.style.left = (im.x / W * 100) + "%";
      wrap.style.top = (im.y / H * 100) + "%";
      wrap.style.width = (im.width / W * 100) + "%";
      var img = document.createElement("img");
      img.src = im.src; img.alt = im.alt || "";
      wrap.appendChild(img);
      el.appendChild(wrap);
    });

    (data.stations || []).forEach(function (st) {
      var d = document.createElement("div");
      d.className = "rosen-station";
      d.setAttribute("data-station-id", st.id);
      d.style.left = (st.x / W * 100) + "%";
      d.style.top = (st.y / H * 100) + "%";
      d.textContent = st.name;
      el.appendChild(d);
    });
    el._rosenData = data;
    return el;
  }

  global.RosenCreator = {
    render: render,
    smoothPath: smoothPath,
    linePathD: linePathD,
    stationById: stationById
  };
})(typeof window !== "undefined" ? window : this);
