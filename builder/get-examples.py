# Fetch every registry:example and write it into src/examples/.
#
# Not via the CLI: an item missing from a style aborts the whole batch (v3 has no
# button-group-demo), and 239 sequential invocations is 40 minutes. The CLI's only
# transform on these files is rewriting the registry import path to the project's
# alias, which is one substitution and is done here.
import json, os, re, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

TPL = "/home/user/isibi-app/builder/lovable/template"
OUT = os.path.join(TPL, "src/examples")
S = "/tmp/claude-0/-home-user-isibi-app/c933ead0-9d38-537e-939a-35bb7198070d/scratchpad"
names = [l.strip() for l in open(f"{S}/examples.txt") if l.strip()]
os.makedirs(OUT, exist_ok=True)

def fetch(n):
    for style in ("new-york-v4", "new-york"):
        try:
            raw = subprocess.run(
                ["curl", "-sS", "--max-time", "45",
                 f"https://ui.shadcn.com/r/styles/{style}/{n}.json"],
                capture_output=True, text=True).stdout
            d = json.loads(raw)
            fs = d.get("files") or []
            if not fs:
                continue
            return n, fs
        except Exception:
            continue
    return n, None

written, missing, extra = [], [], []
with ThreadPoolExecutor(max_workers=12) as ex:
    for n, fs in ex.map(fetch, names):
        if not fs:
            missing.append(n); continue
        for i, f in enumerate(fs):
            content = f.get("content") or ""
            # The one transform the CLI applies: registry paths -> the project alias.
            content = re.sub(r'@/registry/[a-z0-9-]+/ui/', '@/components/ui/', content)
            content = re.sub(r'@/registry/[a-z0-9-]+/hooks/', '@/hooks/', content)
            content = re.sub(r'@/registry/[a-z0-9-]+/lib/', '@/lib/', content)
            content = re.sub(r'@/registry/[a-z0-9-]+/(?:examples|blocks)/', '@/examples/', content)
            base = os.path.basename(f.get("path") or f"{n}.tsx")
            if i > 0:
                extra.append(f"{n} -> {base}")
            open(os.path.join(OUT, base), "w").write(content)
        written.append(n)

print(f"written {len(written)}  missing {len(missing)}  multi-file extras {len(extra)}")
if missing:
    print("MISSING:", ", ".join(missing[:20]))
leftover = subprocess.run(["grep", "-rl", "@/registry/", OUT], capture_output=True, text=True).stdout.split()
print("files still referencing @/registry:", len(leftover))
print("files on disk:", len(os.listdir(OUT)))
