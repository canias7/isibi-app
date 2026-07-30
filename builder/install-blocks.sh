#!/bin/bash
# Install every layout block into its OWN folder.
#
# They cannot go in one folder: page.tsx is claimed by all 22 and
# app-sidebar.tsx by 15, so a flat install silently lands one of each.
#
# -p is the only way to separate them, and it copies the block's ui
# dependencies in alongside — but the block files import "@/components/ui/*",
# the shared ones, so those copies are dead weight and get removed.
cd /home/user/isibi-app/builder/lovable/template || exit 1
UI=$(ls src/components/ui/*.tsx | xargs -n1 basename)

install_one() {
  local name="$1" src="$2" dir="src/blocks/$1"
  rm -rf "$dir"
  yes n | timeout 300 npx shadcn@latest add "$src" -p "$dir" >/dev/null 2>&1
  if [ ! -d "$dir" ]; then echo "FAILED $name"; return; fi
  # Drop the duplicated ui components the -p flag drags along.
  local removed=0
  for f in "$dir"/*.tsx; do
    [ -e "$f" ] || continue
    if echo "$UI" | grep -qx "$(basename "$f")"; then rm "$f"; removed=$((removed+1)); fi
  done
  rmdir "$dir" 2>/dev/null
  if [ ! -d "$dir" ]; then echo "EMPTY   $name (only ui dupes)"; return; fi
  echo "ok      $name  kept=$(find "$dir" -type f | wc -l)  dropped_ui=$removed"
}

for n in dashboard-01 login-01 login-02 login-03 login-04 login-05 \
         sidebar-01 sidebar-02 sidebar-03 sidebar-04 sidebar-05 sidebar-06 \
         sidebar-07 sidebar-08 sidebar-09 sidebar-10 sidebar-11 sidebar-12 \
         sidebar-13 sidebar-14 sidebar-15 sidebar-16; do
  install_one "$n" "$n"
done
# signup-* are not published in the v3 style; they resolve only from new-york-v4.
for n in signup-01 signup-02 signup-03 signup-04 signup-05; do
  install_one "$n" "https://ui.shadcn.com/r/styles/new-york-v4/$n.json"
done
echo "---"
echo "block folders: $(find src/blocks -mindepth 1 -maxdepth 1 -type d | wc -l)"
echo "block files:   $(find src/blocks -type f | wc -l)"
