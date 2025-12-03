# Deploy Verification Tools to Digital Ocean

## Overview

This guide shows you how to upload the verification scripts from your local repository to Digital Ocean and run them.

## Files to Upload

From your local repository `Digital Ocean/` directory:

**New Verification Scripts:**
- `verify_funding_data.py` - Real-time visual comparison
- `simulate_dual_alerts.py` - Alert simulation
- `quick_verify.sh` - Automated health check

**Documentation:**
- `VERIFY_FUNDING_WEBSOCKET.md` - Complete verification guide
- `QUICK_REFERENCE.md` - Quick command reference
- `VERIFICATION_SUMMARY.md` - Implementation overview
- `ARCHITECTURE_DIAGRAM.txt` - Visual diagrams
- `DEPLOY_VERIFICATION_TOOLS.md` - This file

**Existing Tools (already there, but may need updates):**
- `compare_funding_ws_vs_rest.py`
- `validate_funding_comparison.py`

---

## Prerequisites

Before deploying, ensure you have:

1. ✅ SSH access to your Digital Ocean droplet
2. ✅ WebSocket daemon and API server already running on Digital Ocean
3. ✅ Your local repository is up to date

---

## Method 1: Upload via SCP (Recommended)

### Step 1: Set Variables (Run on your local machine)

```bash
# Set your Digital Ocean droplet IP and user
export DO_HOST="your-droplet-ip"        # Replace with your droplet IP
export DO_USER="root"                   # Using root user
export DO_PATH="/root/scripts"          # Target directory on Digital Ocean

# Verify connection
ssh ${DO_USER}@${DO_HOST} "echo 'Connection successful'"
```

### Step 2: Create Target Directory on Digital Ocean

```bash
# Create scripts directory if it doesn't exist
ssh ${DO_USER}@${DO_HOST} "mkdir -p ${DO_PATH}"
```

### Step 3: Upload Verification Scripts

```bash
# Navigate to your local repository
cd "/Users/nikolaysitnikov/Documents/Documents_Nik_MacBook/Everyday Life/AI/VolumeFunding/VolSpike/Digital Ocean"

# Upload all verification scripts and docs
scp verify_funding_data.py ${DO_USER}@${DO_HOST}:${DO_PATH}/
scp simulate_dual_alerts.py ${DO_USER}@${DO_HOST}:${DO_PATH}/
scp quick_verify.sh ${DO_USER}@${DO_HOST}:${DO_PATH}/
scp VERIFY_FUNDING_WEBSOCKET.md ${DO_USER}@${DO_HOST}:${DO_PATH}/
scp QUICK_REFERENCE.md ${DO_USER}@${DO_HOST}:${DO_PATH}/
scp VERIFICATION_SUMMARY.md ${DO_USER}@${DO_HOST}:${DO_PATH}/
scp ARCHITECTURE_DIAGRAM.txt ${DO_USER}@${DO_HOST}:${DO_PATH}/
scp DEPLOY_VERIFICATION_TOOLS.md ${DO_USER}@${DO_HOST}:${DO_PATH}/

# Upload comparison tools (if not already there)
scp compare_funding_ws_vs_rest.py ${DO_USER}@${DO_HOST}:${DO_PATH}/
scp validate_funding_comparison.py ${DO_USER}@${DO_HOST}:${DO_PATH}/
```

### Step 4: Make Scripts Executable

```bash
# SSH into Digital Ocean and make scripts executable
ssh ${DO_USER}@${DO_HOST} "cd ${DO_PATH} && chmod +x verify_funding_data.py simulate_dual_alerts.py quick_verify.sh compare_funding_ws_vs_rest.py validate_funding_comparison.py"
```

### Step 5: Verify Upload

```bash
# List uploaded files
ssh ${DO_USER}@${DO_HOST} "ls -lh ${DO_PATH}/*.py ${DO_PATH}/*.sh ${DO_PATH}/*.md ${DO_PATH}/*.txt"
```

---

## Method 2: Upload via Git (Alternative)

If your Digital Ocean droplet has git access to your repository:

### Step 1: SSH into Digital Ocean

```bash
ssh root@your-droplet-ip
```

### Step 2: Clone or Pull Repository

```bash
# If repository not cloned yet
cd /root
git clone https://github.com/YourUsername/VolSpike.git
cd VolSpike/Digital\ Ocean

# OR if already cloned, pull latest changes
cd /root/VolSpike
git pull origin main
cd Digital\ Ocean
```

### Step 3: Make Scripts Executable

```bash
chmod +x verify_funding_data.py simulate_dual_alerts.py quick_verify.sh compare_funding_ws_vs_rest.py validate_funding_comparison.py
```

---

## Method 3: Manual Upload via SFTP

If you prefer a GUI tool:

### Using FileZilla or Cyberduck:

1. **Connect**:
   - Protocol: SFTP
   - Host: your-droplet-ip
   - User: trader
   - Port: 22

2. **Navigate** to `/home/trader/scripts` on remote side

3. **Upload** all `.py`, `.sh`, `.md`, and `.txt` files from your local `Digital Ocean/` directory

4. **SSH** into droplet and run:
   ```bash
   cd /root/scripts
   chmod +x *.py *.sh
   ```

---

## Post-Upload Configuration

### Step 1: Verify Python Dependencies

SSH into Digital Ocean and check if required packages are installed:

```bash
ssh root@your-droplet-ip

# Check Python version
python3 --version

# Check if requests library is installed (required for verification scripts)
python3 -c "import requests; print('requests:', requests.__version__)"

# If missing, install
pip3 install requests
```

### Step 2: Verify Services Are Running

```bash
# Check WebSocket daemon
sudo systemctl status binance-funding-ws

# Check API server
sudo systemctl status binance-funding-api

# If not running, start them
sudo systemctl start binance-funding-ws
sudo systemctl start binance-funding-api
```

### Step 3: Test Health Endpoint

```bash
curl http://localhost:8888/funding/health | jq

# Expected output:
# {
#   "status": "healthy",
#   "websocketConnected": true,
#   "symbolCount": 300+
# }
```

---

## Quick Deployment Script (All-in-One)

Create this script on your **local machine** for easy deployment:

```bash
# Save as: deploy_verification_tools.sh in your local repo root

#!/bin/bash

# Configuration
DO_HOST="your-droplet-ip"      # CHANGE THIS
DO_USER="trader"                # CHANGE THIS if different
DO_PATH="/home/trader/scripts"  # CHANGE THIS if different

LOCAL_DIR="Digital Ocean"

echo "======================================================================"
echo "  Deploying Verification Tools to Digital Ocean"
echo "======================================================================"

# Check if we're in the right directory
if [ ! -d "$LOCAL_DIR" ]; then
    echo "Error: '$LOCAL_DIR' directory not found"
    echo "Please run this script from the repository root"
    exit 1
fi

# Verify connection
echo ""
echo "[1/5] Testing SSH connection..."
if ssh ${DO_USER}@${DO_HOST} "echo 'Connection successful'" 2>/dev/null; then
    echo "✓ Connected to ${DO_USER}@${DO_HOST}"
else
    echo "✗ Failed to connect to ${DO_USER}@${DO_HOST}"
    exit 1
fi

# Create target directory
echo ""
echo "[2/5] Creating target directory..."
ssh ${DO_USER}@${DO_HOST} "mkdir -p ${DO_PATH}"
echo "✓ Directory created: ${DO_PATH}"

# Upload files
echo ""
echo "[3/5] Uploading verification scripts..."

cd "$LOCAL_DIR"

FILES=(
    "verify_funding_data.py"
    "simulate_dual_alerts.py"
    "quick_verify.sh"
    "compare_funding_ws_vs_rest.py"
    "validate_funding_comparison.py"
    "VERIFY_FUNDING_WEBSOCKET.md"
    "QUICK_REFERENCE.md"
    "VERIFICATION_SUMMARY.md"
    "ARCHITECTURE_DIAGRAM.txt"
    "DEPLOY_VERIFICATION_TOOLS.md"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  Uploading: $file"
        scp "$file" ${DO_USER}@${DO_HOST}:${DO_PATH}/ 2>/dev/null
        if [ $? -eq 0 ]; then
            echo "  ✓ $file uploaded"
        else
            echo "  ✗ Failed to upload $file"
        fi
    else
        echo "  ⚠ Skipping: $file (not found)"
    fi
done

# Make scripts executable
echo ""
echo "[4/5] Making scripts executable..."
ssh ${DO_USER}@${DO_HOST} "cd ${DO_PATH} && chmod +x *.py *.sh"
echo "✓ Scripts made executable"

# Verify upload
echo ""
echo "[5/5] Verifying upload..."
ssh ${DO_USER}@${DO_HOST} "ls -lh ${DO_PATH}/*.py ${DO_PATH}/*.sh 2>/dev/null | wc -l" > /tmp/file_count.txt
FILE_COUNT=$(cat /tmp/file_count.txt | tr -d ' ')
echo "✓ Found ${FILE_COUNT} script files on remote server"

echo ""
echo "======================================================================"
echo "  Deployment Complete!"
echo "======================================================================"
echo ""
echo "Next steps:"
echo "  1. SSH into Digital Ocean: ssh ${DO_USER}@${DO_HOST}"
echo "  2. Navigate to scripts:    cd ${DO_PATH}"
echo "  3. Run verification:       ./quick_verify.sh"
echo ""
echo "For detailed instructions, see:"
echo "  ${DO_PATH}/QUICK_REFERENCE.md"
echo "======================================================================"
