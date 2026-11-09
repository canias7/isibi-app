#!/bin/bash
# THE ADMIN SANDBOX'S FIRST PROCESS (owner, 2026-11-07: "finish this": Claude Code's
# commands run as full admin; coder-sandbox.mjs). It runs as the sandbox's admin, in
# the sandbox's own user, mount and process namespaces and in the room's network. It
# builds the sandbox's system, enters it for good, says "ready", and then only waits:
# Coder's service runs each command in it, and ends it (and all in it) with the job.
set -eu
R="$SBX_ROOT"

# ITS SYSTEM: the machine image, shown read-only, under the sandbox's own layer.
# (userxattr: in a user namespace, without it renaming a folder fails, and dpkg does that.)
mount -t overlay overlay -o "lowerdir=$SBX_LOWER,upperdir=$SBX_UPPER,workdir=$SBX_WORK,userxattr" "$R"

# Its own processes, devices, and the temporary folders that last one job (/dev/shm, /run).
mount -t proc -o nosuid,nodev,noexec proc "$R/proc"
mount -t tmpfs -o mode=755,nosuid tmpfs "$R/dev"
for n in null zero full random urandom tty; do touch "$R/dev/$n"; mount --bind "/dev/$n" "$R/dev/$n"; done
mkdir -p "$R/dev/net" "$R/dev/pts" "$R/dev/shm"
if [ -e /dev/net/tun ]; then touch "$R/dev/net/tun"; mount --bind /dev/net/tun "$R/dev/net/tun"; fi
if [ -e /dev/fuse ]; then touch "$R/dev/fuse"; mount --bind /dev/fuse "$R/dev/fuse"; fi
mount -t devpts -o newinstance,ptmxmode=0666,mode=620 devpts "$R/dev/pts"
ln -sf pts/ptmx "$R/dev/ptmx"
ln -sf /proc/self/fd "$R/dev/fd"
ln -sf /proc/self/fd/0 "$R/dev/stdin"; ln -sf /proc/self/fd/1 "$R/dev/stdout"; ln -sf /proc/self/fd/2 "$R/dev/stderr"
mount -t tmpfs -o nosuid,nodev tmpfs "$R/dev/shm"
if mount --rbind /sys "$R/sys" 2>/dev/null; then mount -o remount,bind,ro "$R/sys" 2>/dev/null || true; fi
# /tmp IS THE SANDBOX'S OWN LAYER'S (the owner, 2026-11-08: "Fix that too"): kept from one message to the next,
# as Claude Code keeps /tmp for its session (tried side by side: a picture made in /tmp in one message was gone by
# the next in Coder, when each sandbox had a fresh, empty /tmp of its own). A new Coder version starts it fresh, with
# the rest of the layer, as a new machine would.
chmod 1777 "$R/tmp" 2>/dev/null || true
mount -t tmpfs -o mode=755,nosuid,nodev tmpfs "$R/run"

# The machine's name lookups, as they are (a link in the image is replaced, in the sandbox's own layer).
for f in "$SBX_RESOLV" "$SBX_HOSTS"; do
  if [ -f "$f" ]; then
    if [ -L "$R$f" ]; then rm -f "$R$f"; fi
    [ -e "$R$f" ] || touch "$R$f"
    mount --bind "$f" "$R$f"
  fi
done

# ADMIN FOR ANYTHING, HERE ONLY: dev (user 1001) may use sudo for every command in the sandbox (in its
# own layer; the machine's own sudo for dev stays limited to the master key's jobs).
# The network gate's settings go along, so admin's downloads follow the network setting too.
mkdir -p "$R/etc/sudoers.d"
cat > "$R/etc/sudoers.d/coder-sandbox" <<'RULES'
#1001 ALL=(ALL:ALL) NOPASSWD: ALL
Defaults:#1001 env_keep += "http_proxy https_proxy HTTP_PROXY HTTPS_PROXY no_proxy NO_PROXY SSL_CERT_FILE NODE_EXTRA_CA_CERTS CURL_CA_BUNDLE REQUESTS_CA_BUNDLE GIT_SSL_CAINFO"
RULES
chmod 0440 "$R/etc/sudoers.d/coder-sandbox"
# How Coder's commands (and tools/apt-get, tools/service, tools/sudo) know they are in the sandbox:
# only there is this file, and dev cannot make it anywhere else.
echo "Coder's admin sandbox: sudo works for any command here." > "$R/etc/coder-sandbox"
chmod 0644 "$R/etc/coder-sandbox"

# WHAT OF THE MACHINE IT SEES (prepared by Coder's service, already shown as they
# should be): "<prepared>\t<path>\t<rw|ro>" lines, each seen at <path>.
while IFS=$'\t' read -r from path mode; do
  [ -n "$from" ] || continue
  mkdir -p "$R$path"
  mount --bind "$from" "$R$path"
  if [ "$mode" = ro ]; then mount -o remount,bind,ro "$R$path"; fi
done <<< "${SBX_BINDS:-}"

# IN FOR GOOD: the machine's own root is let go, so nothing else of it can be reached.
cd "$R"
mkdir -p .coder-outside
pivot_root . .coder-outside
cd /
umount -l /.coder-outside
rmdir /.coder-outside

echo ready
# ITS FIRST PROCESS COLLECTS WHAT ENDS IN IT (the live test after deploy 75): a process a command leaves behind becomes this
# one's child when that command ends, and with `sleep infinity` here it stayed a zombie for good when it ended (a zombie
# keeps its process group looking alive). Bash collects every child of its own that ends, one handed to it too.
# NEVER ENDS (the retest after deploy 76): with `set -e`, the pause ending its sleep made `wait` fail and this script
# exit; the sandbox's first process ending ends everything in it, the background command too.
set +e
while :; do sleep 3600 & wait $! || true; done
