/* RosenCreator エディタ */
(function () {
  "use strict";
  var STORAGE_KEY = "rosencreator-data-v1";
  var uid = function (p) { return p + Math.random().toString(36).slice(2, 9); };

  function sampleData() {
    function S(name, x, y) { return { id: uid("s"), name: name, x: x, y: y }; }
    var st = {};
    [["国分寺",70,290],["三鷹",180,300],["吉祥寺",255,275],["中野",355,320],["新宿",415,360],
     ["池袋",515,220],["大久保",415,315],["御茶ノ水",625,365],["秋葉原",725,375],["原宿",460,465],
     ["品川",670,520],["大宮",535,40],["南浦和",635,120],["王子",695,210],["蒲田",595,625],
     ["川崎",565,675],["関内（馬車道）",475,720],["下北沢",260,450],["三軒茶屋",400,510],
     ["中目黒",445,555],["自由が丘",390,610],["武蔵小杉",300,640]
    ].forEach(function (a) { st[a[0]] = S(a[0], a[1], a[2]); });
    function ids(names) { return names.map(function (n) { return st[n].id; }); }
    return {
      width: 1000, height: 760, background: "#f7f3e8",
      stations: Object.values(st),
      lines: [
        { id: uid("l"), name: "山手線", color: "#80c241", width: 11, closed: true, stationIds: ids(["池袋","新宿","原宿","品川","秋葉原"]) },
        { id: uid("l"), name: "中央線", color: "#e67e22", width: 10, closed: false, stationIds: ids(["国分寺","三鷹","吉祥寺","中野","新宿","御茶ノ水","秋葉原"]) },
        { id: uid("l"), name: "京浜東北線", color: "#5bb2e0", width: 10, closed: false, stationIds: ids(["大宮","南浦和","王子","秋葉原","品川","蒲田","川崎","関内（馬車道）"]) },
        { id: uid("l"), name: "南西方面", color: "#c0396b", width: 9, closed: false, stationIds: ids(["下北沢","三軒茶屋","中目黒","自由が丘","武蔵小杉"]) }
      ],
      images: []
    };
  }

  var data;
  try { data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || sampleData(); }
  catch (e) { data = sampleData(); }
  if (!data.stations) data = sampleData();

  var selected = { type: null, id: null }; // type: station|line|image
  var picking = false;

  var $ = function (id) { return document.getElementById(id); };
  var stage = $("stage");

  function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {} }
  function findStation(id) { return data.stations.find(function (s) { return s.id === id; }); }
  function findLine(id) { return data.lines.find(function (l) { return l.id === id; }); }
  function findImage(id) { return data.images.find(function (i) { return i.id === id; }); }

  /* ---------- 描画 ---------- */
  function render() {
    RosenCreator.render(stage, data);
    stage.querySelectorAll(".rosen-station").forEach(function (el) {
      var id = el.getAttribute("data-station-id");
      if (selected.type === "station" && selected.id === id) el.classList.add("selected");
      el.addEventListener("pointerdown", function (ev) { onStationPointer(ev, id, el); });
    });
    stage.querySelectorAll(".rosen-image").forEach(function (el) {
      var id = el.getAttribute("data-image-id");
      if (selected.type === "image" && selected.id === id) el.classList.add("selected");
      el.addEventListener("pointerdown", function (ev) { onImagePointer(ev, id, el); });
    });
    renderLists();
    renderEditors();
  }

  function dragHandler(ev, obj, el, kind) {
    ev.preventDefault();
    select(kind, obj.id);
    var mapEl = stage.classList.contains("rosen-map") ? stage : stage.querySelector(".rosen-map");
    var rect = mapEl.getBoundingClientRect();
    var moved = false;
    function move(e) {
      moved = true;
      var x = (e.clientX - rect.left) / rect.width * data.width;
      var y = (e.clientY - rect.top) / rect.height * data.height;
      obj.x = Math.round(Math.max(0, Math.min(data.width, x)));
      obj.y = Math.round(Math.max(0, Math.min(data.height, y)));
      el.style.left = (obj.x / data.width * 100) + "%";
      el.style.top = (obj.y / data.height * 100) + "%";
      if (kind === "station") {
        stage.querySelectorAll(".rosen-line-path").forEach(function (p) {
          var line = findLine(p.getAttribute("data-line-id"));
          if (line) p.setAttribute("d", RosenCreator.linePathD(data, line));
        });
      }
    }
    function up() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      save(); render();
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }
  function onStationPointer(ev, id, el) {
    if (picking && selected.type === "line") {
      ev.preventDefault();
      var line = findLine(selected.id);
      if (line && line.stationIds[line.stationIds.length - 1] !== id) {
        line.stationIds.push(id); save(); render();
      }
      return;
    }
    var s = findStation(id); if (s) dragHandler(ev, s, el, "station");
  }
  function onImagePointer(ev, id, el) { var im = findImage(id); if (im) dragHandler(ev, im, el, "image"); }

  function select(type, id) { selected = { type: type, id: id }; if (type !== "line") picking = false; }

  /* ---------- 一覧 ---------- */
  function renderLists() {
    var sl = $("stationList"); sl.innerHTML = "";
    data.stations.forEach(function (s) {
      var li = document.createElement("li");
      if (selected.type === "station" && selected.id === s.id) li.className = "selected";
      li.innerHTML = "<span class='grow'></span>";
      li.querySelector(".grow").textContent = s.name;
      li.addEventListener("click", function () { select("station", s.id); render(); });
      sl.appendChild(li);
    });
    var ll = $("lineList"); ll.innerHTML = "";
    data.lines.forEach(function (l) {
      var li = document.createElement("li");
      if (selected.type === "line" && selected.id === l.id) li.className = "selected";
      li.innerHTML = "<span class='swatch'></span><span class='grow'></span>";
      li.querySelector(".swatch").style.background = l.color;
      li.querySelector(".grow").textContent = l.name + "（" + l.stationIds.length + "駅）";
      li.addEventListener("click", function () { select("line", l.id); render(); });
      ll.appendChild(li);
    });
    var il = $("imageList"); il.innerHTML = "";
    data.images.forEach(function (im, idx) {
      var li = document.createElement("li");
      if (selected.type === "image" && selected.id === im.id) li.className = "selected";
      li.innerHTML = "<span class='grow'></span>";
      li.querySelector(".grow").textContent = im.alt || ("画像 " + (idx + 1));
      li.addEventListener("click", function () { select("image", im.id); render(); });
      il.appendChild(li);
    });
  }

  /* ---------- 編集パネル ---------- */
  function renderEditors() {
    var s = selected.type === "station" ? findStation(selected.id) : null;
    $("stationEditor").hidden = !s;
    if (s) { $("editStationName").value = s.name; $("editStationX").value = s.x; $("editStationY").value = s.y; }

    var l = selected.type === "line" ? findLine(selected.id) : null;
    $("lineEditor").hidden = !l;
    if (l) {
      $("editLineName").value = l.name; $("editLineColor").value = l.color;
      $("editLineWidth").value = l.width || 10; $("editLineClosed").checked = !!l.closed;
      $("btnPickStations").textContent = "駅をクリックして追加する： " + (picking ? "ON" : "OFF");
      $("btnPickStations").classList.toggle("active", picking);
      var ol = $("lineStations"); ol.innerHTML = "";
      l.stationIds.forEach(function (sid, i) {
        var stn = findStation(sid);
        var li = document.createElement("li");
        li.innerHTML = "<span class='grow'></span>";
        li.querySelector(".grow").textContent = stn ? stn.name : "(削除済み)";
        [["↑", -1], ["↓", 1]].forEach(function (mv) {
          var b = document.createElement("button"); b.type = "button"; b.textContent = mv[0];
          b.addEventListener("click", function () {
            var j = i + mv[1]; if (j < 0 || j >= l.stationIds.length) return;
            var t = l.stationIds[i]; l.stationIds[i] = l.stationIds[j]; l.stationIds[j] = t; save(); render();
          });
          li.appendChild(b);
        });
        var del = document.createElement("button"); del.type = "button"; del.textContent = "外す";
        del.addEventListener("click", function () { l.stationIds.splice(i, 1); save(); render(); });
        li.appendChild(del);
        ol.appendChild(li);
      });
    }

    var im = selected.type === "image" ? findImage(selected.id) : null;
    $("imageEditor").hidden = !im;
    if (im) $("editImageWidth").value = im.width;
  }

  /* ---------- イベント ---------- */
  $("mapBg").value = data.background || "#f7f3e8";
  $("mapBg").addEventListener("input", function () { data.background = this.value; save(); render(); });

  $("btnAddStation").addEventListener("click", function () {
    var name = $("stationName").value.trim(); if (!name) return;
    var s = { id: uid("s"), name: name, x: 120 + Math.round(Math.random() * 120), y: 120 + Math.round(Math.random() * 120) };
    data.stations.push(s); $("stationName").value = ""; select("station", s.id); save(); render();
  });
  $("stationName").addEventListener("keydown", function (e) { if (e.key === "Enter") $("btnAddStation").click(); });
  $("editStationName").addEventListener("input", function () { var s = findStation(selected.id); if (s) { s.name = this.value; save(); renderLists(); stage.querySelectorAll(".rosen-station").forEach(function (el) { if (el.getAttribute("data-station-id") === s.id) el.textContent = s.name; }); } });
  ["editStationX", "editStationY"].forEach(function (id) {
    $(id).addEventListener("change", function () {
      var s = findStation(selected.id); if (!s) return;
      s.x = Number($("editStationX").value) || 0; s.y = Number($("editStationY").value) || 0; save(); render();
    });
  });
  $("btnDeleteStation").addEventListener("click", function () {
    var s = findStation(selected.id); if (!s) return;
    data.stations = data.stations.filter(function (x) { return x.id !== s.id; });
    data.lines.forEach(function (l) { l.stationIds = l.stationIds.filter(function (id) { return id !== s.id; }); });
    select(null, null); save(); render();
  });

  $("btnAddLine").addEventListener("click", function () {
    var name = $("lineName").value.trim() || "新しい路線";
    var l = { id: uid("l"), name: name, color: $("lineColor").value, width: 10, closed: false, stationIds: [] };
    data.lines.push(l); $("lineName").value = ""; select("line", l.id); picking = true; save(); render();
  });
  $("editLineName").addEventListener("input", function () { var l = findLine(selected.id); if (l) { l.name = this.value; save(); renderLists(); } });
  $("editLineColor").addEventListener("input", function () { var l = findLine(selected.id); if (l) { l.color = this.value; save(); render(); } });
  $("editLineWidth").addEventListener("input", function () { var l = findLine(selected.id); if (l) { l.width = Number(this.value); save(); render(); } });
  $("editLineClosed").addEventListener("change", function () { var l = findLine(selected.id); if (l) { l.closed = this.checked; save(); render(); } });
  $("btnPickStations").addEventListener("click", function () { picking = !picking; render(); });
  $("btnDeleteLine").addEventListener("click", function () {
    data.lines = data.lines.filter(function (x) { return x.id !== selected.id; });
    select(null, null); save(); render();
  });

  $("btnAddImageUrl").addEventListener("click", function () {
    var url = $("imageUrl").value.trim(); if (!url) return;
    var im = { id: uid("i"), src: url, x: 800, y: 160, width: 150, alt: "画像" };
    data.images.push(im); $("imageUrl").value = ""; select("image", im.id); save(); render();
  });
  $("fileImage").addEventListener("change", function () {
    var f = this.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      var im = { id: uid("i"), src: r.result, x: 800, y: 160, width: 180, alt: f.name };
      data.images.push(im); select("image", im.id); save(); render();
    };
    r.readAsDataURL(f); this.value = "";
  });
  $("editImageWidth").addEventListener("input", function () { var im = findImage(selected.id); if (im) { im.width = Number(this.value); save(); render(); } });
  $("btnDeleteImage").addEventListener("click", function () {
    data.images = data.images.filter(function (x) { return x.id !== selected.id; });
    select(null, null); save(); render();
  });

  $("btnSample").addEventListener("click", function () { data = sampleData(); select(null, null); $("mapBg").value = data.background; save(); render(); });
  $("btnExportJson").addEventListener("click", function () {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "rosen-data.json"; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  });
  $("fileImportJson").addEventListener("change", function () {
    var f = this.files[0]; if (!f) return;
    f.text().then(function (t) {
      try { var d = JSON.parse(t); if (!d.stations || !d.lines) throw new Error("形式が違います"); data = d; select(null, null); save(); render(); }
      catch (e) { alert("JSONを読み込めませんでした: " + e.message); }
    });
    this.value = "";
  });

  /* ---------- 埋め込みコード (iframeなし・自己完結) ---------- */
  function buildEmbed(cssText, jsText) {
    var id = "rosen-embed-1";
    var parts = [];
    parts.push('<div id="' + id + '"></div>');
    if (cssText) parts.push("<style>\n" + cssText + "\n</style>");
    else parts.push('<link rel="stylesheet" href="rosen.css">');
    if (jsText) parts.push("<script>\n" + jsText + "\n<\/script>");
    else parts.push('<script src="rosen.js"><\/script>');
    parts.push("<script>\nRosenCreator.render(document.getElementById('" + id + "'), " + JSON.stringify(data) + ");\n<\/script>");
    return parts.join("\n");
  }
  $("btnEmbed").addEventListener("click", function () {
    $("embedBox").hidden = false;
    if (window.__ROSEN_CSS__ && window.__ROSEN_JS__) {
      $("embedCode").value = buildEmbed(window.__ROSEN_CSS__, window.__ROSEN_JS__);
      $("embedBox").scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }
    Promise.all([
      fetch("rosen.css").then(function (r) { return r.text(); }).catch(function () { return null; }),
      fetch("rosen.js").then(function (r) { return r.text(); }).catch(function () { return null; })
    ]).then(function (res) {
      $("embedCode").value = buildEmbed(res[0], res[1]);
      $("embedBox").scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  });
  $("btnCopyEmbed").addEventListener("click", function () {
    $("embedCode").select();
    var done = function () { $("copyResult").textContent = "コピーしました。表示したいページのHTMLに貼ってください。"; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText($("embedCode").value).then(done, function () { document.execCommand("copy"); done(); });
    else { document.execCommand("copy"); done(); }
  });
  $("btnDownloadEmbed").addEventListener("click", function () {
    var html = "<!DOCTYPE html>\n<html lang=\"ja\"><head><meta charset=\"UTF-8\"><title>Rosen Embed</title></head><body>\n" + $("embedCode").value + "\n</body></html>";
    var blob = new Blob([html], { type: "text/html" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "embed.html"; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  });
  $("btnCloseEmbed").addEventListener("click", function () { $("embedBox").hidden = true; });

  render();
})();
