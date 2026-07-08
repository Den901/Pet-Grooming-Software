#!/usr/bin/env sh
set -eu

INSTALL_DIR="${INSTALL_DIR:-/opt/pet-grooming-software}"
PORT="${PORT:-3017}"
CREATE_SERVICE="${CREATE_SERVICE:-1}"
SERVICE_USER="${SERVICE_USER:-${SUDO_USER:-$(id -un)}}"

SCRIPT_DIR="$(CDPATH= cd "$(dirname "$0")" && pwd)"
SOURCE_ROOT="$(CDPATH= cd "$SCRIPT_DIR/.." && pwd)"
NODE_BIN="$(command -v node || true)"

if [ -z "$NODE_BIN" ]; then
  echo "Node.js non trovato. Installa Node.js 18 o superiore prima di continuare." >&2
  exit 1
fi

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  SUDO="sudo"
fi

$SUDO mkdir -p "$INSTALL_DIR"

if command -v rsync >/dev/null 2>&1; then
  $SUDO rsync -a \
    --exclude ".git" \
    --exclude "data/db.json" \
    --exclude "data/uploads" \
    --exclude "node_modules" \
    --exclude "dist" \
    --exclude "backups" \
    "$SOURCE_ROOT/" "$INSTALL_DIR/"
else
  (cd "$SOURCE_ROOT" && tar \
    --exclude "./.git" \
    --exclude "./data/db.json" \
    --exclude "./data/uploads" \
    --exclude "./node_modules" \
    --exclude "./dist" \
    --exclude "./backups" \
    -cf - .) | (cd "$INSTALL_DIR" && $SUDO tar -xf -)
fi

$SUDO mkdir -p "$INSTALL_DIR/data/uploads"
$SUDO chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR" 2>/dev/null || true

START_SCRIPT="$INSTALL_DIR/start-pet-grooming.sh"
$SUDO sh -c "cat > '$START_SCRIPT'" <<EOF
#!/usr/bin/env sh
export PORT="$PORT"
cd "$INSTALL_DIR"
exec "$NODE_BIN" server.js
EOF
$SUDO chmod +x "$START_SCRIPT"

if [ "$CREATE_SERVICE" = "1" ] && command -v systemctl >/dev/null 2>&1; then
  SERVICE_FILE="/etc/systemd/system/pet-grooming-software.service"
  $SUDO sh -c "cat > '$SERVICE_FILE'" <<EOF
[Unit]
Description=Pet Grooming Software
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR
Environment=PORT=$PORT
ExecStart=$NODE_BIN server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
  $SUDO systemctl daemon-reload
  $SUDO systemctl enable pet-grooming-software.service
  $SUDO systemctl restart pet-grooming-software.service
  echo "Servizio systemd attivo: pet-grooming-software"
else
  echo "Avvio manuale: $START_SCRIPT"
fi

echo "Installazione completata in $INSTALL_DIR"
echo "Indirizzo locale: http://localhost:$PORT"
