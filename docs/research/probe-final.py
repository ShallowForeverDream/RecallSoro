import json, subprocess, time

repos = [
    "karakeep-app/karakeep", "monicahq/monica", "linkwarden/linkwarden",
    "hay-kot/homebox", "grocy/grocy", "wallabag/wallabag", "go-shiori/shiori",
    "TriliumNext/Trilium", "inventree/InvenTree", "siyuan-note/siyuan",
    "shaarli/Shaarli", "Part-DB/Part-DB-server", "kenforthewin/atomic",
    "Kovah/LinkAce", "outline/outline", "snipe/snipe-it", "docmost/docmost",
    "actualbudget/actual", "firefly-iii/firefly-iii", "bookstackapp/bookstack",
    "homebox-org/homebox", "zadam/trilium",
]

out = []
for r in repos:
    p = subprocess.run(
        ["gh", "api", "repos/" + r,
         "--jq", '{full_name,stargazers_count,language,license:(.license.spdx_id // "-"),description,homepage,archived,topics,updated_at}'],
        capture_output=True, text=True, encoding="utf-8"
    )
    if p.returncode != 0 or not p.stdout.strip():
        out.append({"query": r, "error": (p.stderr or "empty")[:200]})
    else:
        try:
            out.append(json.loads(p.stdout.strip()))
        except Exception as e:
            out.append({"query": r, "error": "json:" + str(e), "raw": p.stdout[:200]})
    time.sleep(0.2)

with open("repo_data.json", "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=1)

print("wrote", len(out), "records")
