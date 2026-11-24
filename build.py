"""Construit le tableau de bord statique et son backend Worker."""
import json
from pathlib import Path

root = Path(__file__).resolve().parent
src = root / "src"
public = root / "public"
public.mkdir(exist_ok=True)
html = (src / "index.html").read_text(encoding="utf-8")
app = (src / "app.js").read_text(encoding="utf-8")
events = (src / "events.js").read_text(encoding="utf-8")
tracking = (src / "source-tracking.js").read_text(encoding="utf-8")
bulletins = (src / "bulletins.js").read_text(encoding="utf-8")
guidance = (src / "guidance.js").read_text(encoding="utf-8")
marker = "let ctx=radar"
if app.count(marker) != 1:
    raise ValueError("Point d'insertion des événements introuvable ou ambigu")
app = app.replace(marker, "\n".join((bulletins, events, tracking, guidance, marker)))
assets = {"index.html": html, "app.js": app}
for name, content in assets.items():
    (public / name).write_text(content, encoding="utf-8")
worker = root / "dist/server"
worker.mkdir(parents=True, exist_ok=True)
(worker / "index.js").write_text("const assets=" + json.dumps(assets) + ";\n" + bulletins + "\n" + (src / "archive.js").read_text(encoding="utf-8"), encoding="utf-8")
