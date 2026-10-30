#!/usr/bin/env python3
"""RosenCreator.html (サーバー不要の単体版) を index.html + 各ファイルから生成する。

使い方: python3 build-single-file.py
注意点 (過去の不具合の再発防止):
  - 埋め込み用定数 (__ROSEN_CSS__ / __ROSEN_JS__) は JSON 文字列にする際、
    '<' を \\u003c にエスケープする。ソース中の '</script>' がそのまま入ると
    HTMLパーサが script ブロックを途中で閉じてしまい、残りが本文として表示される。
  - インラインの script 本体では '</script' を '<\\/script' に、
    '<script' を '<scr"+"ipt' に置換する (実行時の文字列の値は変わらない)。
"""
import json
import pathlib

base = pathlib.Path(__file__).parent
html = (base / "index.html").read_text(encoding="utf-8")
rosen_css = (base / "rosen.css").read_text(encoding="utf-8")
editor_css = (base / "editor.css").read_text(encoding="utf-8")
rosen_js = (base / "rosen.js").read_text(encoding="utf-8")
editor_js = (base / "editor.js").read_text(encoding="utf-8")


def js_constant(text: str) -> str:
    return json.dumps(text).replace("<", "\\u003c")


def inline_js(text: str) -> str:
    return text.replace("</script", "<\\/script").replace("<script", '<scr"+"ipt')


html = html.replace(
    '<link rel="stylesheet" href="rosen.css">',
    "<style>\n" + rosen_css + "\n</style>",
)
html = html.replace(
    '<link rel="stylesheet" href="editor.css">',
    "<style>\n" + editor_css + "\n</style>",
)
inject = (
    "<script>\n"
    "window.__ROSEN_CSS__ = " + js_constant(rosen_css) + ";\n"
    "window.__ROSEN_JS__ = " + js_constant(rosen_js) + ";\n"
    "</script>"
)
html = html.replace(
    '<script src="rosen.js"></script>',
    inject + "\n<script>\n" + inline_js(rosen_js) + "\n</script>",
)
html = html.replace(
    '<script src="editor.js"></script>',
    "<script>\n" + inline_js(editor_js) + "\n</script>",
)

head = html.split("</head>")[0]
assert "href=" not in head, "head に外部CSS参照が残っています"
assert "<style>" in html and "__ROSEN_CSS__" in html

out = base / "RosenCreator.html"
out.write_text(html, encoding="utf-8")
print(f"wrote {out.name}: {out.stat().st_size} bytes")
