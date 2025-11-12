#!/usr/bin/env bash

# VolSpike DigitalOcean Deployment Script
# ========================================
# Safely deploy Python scripts to remote servers with:
# - Automatic backup before deployment
# - Python syntax verification
# - Atomic file replacement
# - Systemd service management
# - Instant rollback on failure
#
# Default target: /home/trader/volume-spike-bot/hourly_volume_alert.py
# Default service: volspike

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# =====================
# Configuration
# =====================
# Override these via environment variables before running this script

# Required: SSH connection string (user@host)
export VS_REMOTE="root@167.71.196.5"

# Optional: Remote server paths and settings
: "${VS_REMOTE_DIR:=/home/trader/volume-spike-bot}"
: "${VS_REMOTE_OWNER:=trader:trader}"
: "${VS_SERVICE_NAME:=volspike}"
: "${VS_SSH_OPTS:=-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null}"
: "${VS_REMOTE_SUDO:=sudo}"

# Services on the remote server:
# discord-dashboard-haven.service loaded active running Discord message dashboard Haven
# discord-dashboard.service       loaded active running Discord dashboard bot
# volspike-dashboard.service      loaded active running Binance volume dashboard (Streamlit)
# volspike.service                loaded active running Binance hourly-volume spike bot

# Derived paths
VS_BACKUPS_DIR="${VS_REMOTE_DIR}/backups"

# =====================
# Logging Functions
# =====================

vs_info() {
  echo -e "\033[36m[INFO]\033[0m $*"
}

vs_warn() {
  echo -e "\033[33m[WARN]\033[0m $*"
}

vs_err() {
  echo -e "\033[31m[ERR ]\033[0m $*"
}

vs_ok() {
  echo -e "\033[32m[ OK ]\033[0m $*"
}

# =====================
# Core Helper Functions
# =====================

# Generate timestamp for backups
vs_ts() {
  date +%Y%m%d_%H%M%S
}

# Execute SSH command on remote server
vs_ssh() {
  ssh ${VS_SSH_OPTS} "$@"
}

# Execute command on configured remote server
vs_remote() {
  vs_ssh "${VS_REMOTE}" "$@"
}

# Securely copy file to remote server
vs_scp() {
  scp -q ${VS_SSH_OPTS} "$@"
}

# =====================
# Remote Directory Management
# =====================

# Ensure required directories exist on remote server
vs_ensure_remote_dirs() {
  vs_info "Creating remote directories..."
  vs_remote "mkdir -p '${VS_REMOTE_DIR}' '${VS_BACKUPS_DIR}'"
}

# =====================
# Backup Functions
# =====================

# Create a timestamped backup of a remote file
# Args: $1 = remote file path
# Returns: Backup file path (or empty if file doesn't exist)
vs_backup_remote() {
  local remote_file="$1"
  local base_name
  local timestamp
  local backup_path
  
  base_name="$(basename "${remote_file}")"
  timestamp="$(vs_ts)"
  backup_path="${VS_BACKUPS_DIR}/${base_name}.backup.${timestamp}"
  
  # Only backup if file exists
  vs_remote "test -f '${remote_file}' && cp -f '${remote_file}' '${backup_path}' || true"
  
  echo -n "${backup_path}"
}

# List all backups for a given file
# Args: $1 = filename (not full path)
vs_list_backups() {
  local filename="$1"
  
  vs_info "Listing backups for ${filename}..."
  vs_remote "ls -1t '${VS_BACKUPS_DIR}' | grep '^${filename}\\.backup\\.' || true"
}

# =====================
# Validation Functions
# =====================

# Verify Python file syntax by attempting to compile it
# Args: $1 = remote file path
# Returns: 0 if valid, 1 if syntax errors
vs_verify_python() {
  local file="$1"
  
  vs_info "Verifying Python syntax..."
  vs_remote "python3 -m py_compile '${file}'"
}

# =====================
# Service Management Functions
# =====================

# Stop a systemd service
# Args: $1 = service name
vs_service_stop() {
  local service="$1"
  
  # Skip if no service specified
  if [ -z "$service" ]; then
    return 0
  fi
  
  vs_info "Stopping service: ${service}"
  vs_remote "${VS_REMOTE_SUDO} systemctl stop '${service}'"
}

# Start a systemd service
# Args: $1 = service name
vs_service_start() {
  local service="$1"
  
  # Skip if no service specified
  if [ -z "$service" ]; then
    return 0
  fi
  
  vs_info "Starting service: ${service}"
  vs_remote "${VS_REMOTE_SUDO} systemctl start '${service}'"
}

# Check if a systemd service is active
# Args: $1 = service name
# Returns: 0 if active, 1 if not active
vs_service_is_active() {
  local service="$1"
  
  # Skip if no service specified
  if [ -z "$service" ]; then
    return 0
  fi
  
  vs_remote "${VS_REMOTE_SUDO} systemctl is-active --quiet '${service}'"
}

# =====================
# Rollback Functions
# =====================

# Restore a file from backup and restart the service
# Args: $1 = backup file path, $2 = destination path, $3 = service name
# Returns: 0 if successful, 1 if failed
vs_rollback() {
  local backup_path="$1"
  local dest_path="$2"
  local service="$3"
  
  if [ -z "${backup_path}" ]; then
    vs_warn "Rollback requested but no backup path supplied"
    return 1
  fi
  
  vs_warn "Rolling back to backup: ${backup_path}"
  
  # Restore backup file
  if ! vs_remote "cp -f '${backup_path}' '${dest_path}' && chown ${VS_REMOTE_OWNER} '${dest_path}'"; then
    vs_err "Failed to restore backup"
    return 1
  fi
  
  # Restart service
  vs_service_start "${service}"
  sleep 3
  
  # Verify service is running
  if vs_service_is_active "${service}"; then
    vs_ok "Rollback succeeded - service is active"
    return 0
  else
    vs_err "Rollback applied but service is still not active"
    return 1
  fi
}

# Restore the most recent backup for a file
# Args: $1 = filename (not full path), $2 = service name (optional)
rollback_latest() {
  local filename="$1"
  local service="${2:-${VS_SERVICE_NAME}}"
  local backup_file
  
  if [ -z "${filename}" ]; then
    vs_err "Usage: rollback_latest <remote_filename> [service]"
    return 2
  fi
  
  vs_info "Finding latest backup for ${filename}..."
  backup_file=$(vs_remote "ls -1t '${VS_BACKUPS_DIR}/${filename}.backup.'* 2>/dev/null | head -n1")
  
  if [ -z "${backup_file}" ]; then
    vs_err "No backups found for ${filename}"
    return 1
  fi
  
  vs_info "Latest backup: ${backup_file}"
  vs_rollback "${backup_file}" "${VS_REMOTE_DIR}/${filename}" "${service}"
}

# =====================
# Main Deployment Function
# =====================

# Deploy a local Python script to remote server with full safety checks
# Args: $1 = local file path, $2 = remote destination path, $3 = service name (optional)
# Returns: 0 if successful, 1 if failed, 2 if usage error
vs_deploy_script() {
  local local_path="$1"
  local remote_dest="$2"
  local service="$3"
  local backup_path
  local timestamp
  local tmp_remote
  
  # Validate arguments
  if [ -z "${local_path}" ] || [ -z "${remote_dest}" ]; then
    vs_err "Usage: vs_deploy_script <local_path> <remote_dest> [service]"
    return 2
  fi
  
  if [ ! -f "${local_path}" ]; then
    vs_err "Local file not found: ${local_path}"
    return 2
  fi
  
  # Start deployment
  vs_info "========================================"
  vs_info "Deploying: ${local_path}"
  vs_info "Target:    ${VS_REMOTE}:${remote_dest}"
  vs_info "Service:   ${service:-none}"
  vs_info "========================================"
  
  # Step 1: Prepare remote directories
  if ! vs_ensure_remote_dirs; then
    vs_err "Failed to create remote directories"
    return 1
  fi
  
  # Step 2: Stop service if specified
  vs_service_stop "${service}"
  
  # Step 3: Backup existing file
  backup_path="$(vs_backup_remote "${remote_dest}")"
  if [ -n "${backup_path}" ]; then
    vs_ok "Backup created: ${backup_path}"
  else
    vs_warn "No existing file to backup at ${remote_dest}"
  fi
  
  # Step 4: Upload to temporary location
  timestamp="$(vs_ts)"
  tmp_remote="${remote_dest}.tmp.${timestamp}"
  vs_info "Uploading to temporary location: ${tmp_remote}"
  
  if ! vs_scp "${local_path}" "${VS_REMOTE}:${tmp_remote}"; then
    vs_err "Upload failed"
    vs_service_start "${service}"
    return 1
  fi
  
  # Step 5: Set correct ownership
  vs_remote "chown ${VS_REMOTE_OWNER} '${tmp_remote}'"
  
  # Step 6: Verify Python syntax
  if ! vs_verify_python "${tmp_remote}"; then
    vs_err "Syntax verification failed - aborting deployment"
    vs_remote "rm -f '${tmp_remote}'"
    vs_rollback "${backup_path}" "${remote_dest}" "${service}"
    return 1
  fi
  vs_ok "Syntax verification passed"
  
  # Step 7: Atomically replace the file
  if ! vs_remote "mv -f '${tmp_remote}' '${remote_dest}'"; then
    vs_err "Failed to move file into place"
    vs_rollback "${backup_path}" "${remote_dest}" "${service}"
    return 1
  fi
  vs_ok "File installed: ${remote_dest}"
  
  # Step 8: Start service and verify
  vs_service_start "${service}"
  sleep 3
  
  if vs_service_is_active "${service}"; then
    vs_ok "========================================"
    vs_ok "Deployment successful!"
    vs_ok "Service ${service} is active and running"
    vs_ok "========================================"
    return 0
  else
    vs_err "Service ${service} failed to start - initiating rollback"
    vs_rollback "${backup_path}" "${remote_dest}" "${service}"
    return 1
  fi
}

# =====================
# Convenience Wrappers
# =====================

# Deploy hourly_volume_alert.py script with default settings
# Args: $1 = local file path (optional, defaults to repo location)
deploy_hourly_volume_alert() {
  local local_path="$1"
  local remote_dest="${VS_REMOTE_DIR}/hourly_volume_alert.py"
  
  # If no path provided, try to find it relative to script location
  if [ -z "${local_path}" ]; then
    local_path="$(dirname "$0")/../../hourly_volume_alert.py"
    local_path="$(readlink -f "${local_path}" 2>/dev/null || echo "${local_path}")"
  fi
  
  vs_info "Using local file: ${local_path}"
  vs_deploy_script "${local_path}" "${remote_dest}" "${VS_SERVICE_NAME}"
}

# =====================
# Usage Documentation
# =====================

vs_usage() {
  cat <<'EOF'
VolSpike DigitalOcean Deployment Script
========================================

DESCRIPTION:
  Safely deploy Python scripts to remote servers with automatic backup,
  syntax verification, and instant rollback on failure.

REQUIRED ENVIRONMENT:
  VS_REMOTE            SSH connection string (user@host)
                       Example: export VS_REMOTE=root@203.0.113.10

OPTIONAL ENVIRONMENT (with defaults):
  VS_REMOTE_DIR        Remote working directory
                       Default: /home/trader/volume-spike-bot
  
  VS_REMOTE_OWNER      File ownership on remote (user:group)
                       Default: trader:trader
  
  VS_SERVICE_NAME      Systemd service name
                       Default: volspike
  
  VS_SSH_OPTS          SSH connection options
                       Default: -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null
  
  VS_REMOTE_SUDO       Sudo prefix for systemd commands
                       Default: sudo

FUNCTIONS:
  deploy_hourly_volume_alert [local_path]
      Deploy hourly_volume_alert.py with default settings.
      If local_path not provided, attempts to find it automatically.
  
  vs_deploy_script <local_path> <remote_dest> [service]
      Generic deployment function for any Python script.
      - local_path: Path to local file
      - remote_dest: Full path on remote server
      - service: Optional systemd service name
  
  vs_list_backups <filename>
      List all backups for the specified filename.
  
  rollback_latest <filename> [service]
      Restore the most recent backup of a file.
      Service defaults to VS_SERVICE_NAME if not specified.

DEPLOYMENT PROCESS:
  1. Create remote directories (if needed)
  2. Stop systemd service
  3. Backup existing file
  4. Upload new file to temporary location
  5. Verify Python syntax
  6. Atomically replace file
  7. Start service
  8. Verify service is active
  9. Rollback automatically if any step fails

EXAMPLES:
  # Set required environment
  export VS_REMOTE=root@203.0.113.10
  
  # Deploy hourly volume alert script
  ./deploy_scripts.sh deploy_hourly_volume_alert
  
  # Deploy with explicit path
  ./deploy_scripts.sh deploy_hourly_volume_alert ../hourly_volume_alert.py
  
  # Deploy custom script
  ./deploy_scripts.sh vs_deploy_script \
    ./my_script.py \
    /home/trader/volume-spike-bot/my_script.py \
    my-service
  
  # List backups
  ./deploy_scripts.sh vs_list_backups hourly_volume_alert.py
  
  # Rollback to latest backup
  ./deploy_scripts.sh rollback_latest hourly_volume_alert.py

EXIT CODES:
  0 - Success
  1 - Deployment/rollback failed
  2 - Invalid usage/arguments

EOF
}

# =====================
# Main Entry Point
# =====================

# Show usage if no arguments provided
if [ "$#" -eq 0 ]; then
  vs_usage
  exit 0
fi

# Execute the requested function with provided arguments
"$@"