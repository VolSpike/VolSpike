#!/bin/bash
################################################################################
# Deploy Verification Tools to Digital Ocean
################################################################################
# This script uploads all verification scripts and documentation from your
# local repository to your Digital Ocean droplet.
#
# Usage:
#   1. Edit the configuration section below (DO_HOST, DO_USER, DO_PATH)
#   2. Make executable: chmod +x deploy_verification_tools.sh
#   3. Run: ./deploy_verification_tools.sh
################################################################################

set -e

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# CONFIGURATION - EDIT THESE VALUES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DO_HOST="167.71.196.5"               # ← Digital Ocean droplet IP
DO_USER="root"                       # ← SSH as root user
DO_PATH="/home/trader/volume-spike-bot"  # ← Actual scripts directory

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LOCAL_DIR="Digital Ocean"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "======================================================================"
echo "  Deploying Verification Tools to Digital Ocean"
echo "======================================================================"

# Validate configuration
if [ "$DO_HOST" = "your-droplet-ip" ]; then
    echo -e "${RED}ERROR: Please edit this script and set DO_HOST to your Digital Ocean IP${NC}"
    echo "Edit: $0"
    echo "Line: DO_HOST=\"your-actual-ip\""
    exit 1
fi

# Check if we're in the right directory
if [ ! -d "$LOCAL_DIR" ]; then
    echo -e "${RED}Error: '$LOCAL_DIR' directory not found${NC}"
    echo "Please run this script from the repository root"
    exit 1
fi

echo ""
echo "Configuration:"
echo "  Remote Host: ${DO_USER}@${DO_HOST}"
echo "  Remote Path: ${DO_PATH}"
echo "  Local Dir:   ${LOCAL_DIR}"
echo ""

# Verify connection
echo -e "${BLUE}[1/5] Testing SSH connection...${NC}"
if ssh -o ConnectTimeout=5 ${DO_USER}@${DO_HOST} "echo 'Connection successful'" 2>/dev/null; then
    echo -e "${GREEN}✓ Connected to ${DO_USER}@${DO_HOST}${NC}"
else
    echo -e "${RED}✗ Failed to connect to ${DO_USER}@${DO_HOST}${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check if DO_HOST is correct: ${DO_HOST}"
    echo "  2. Check if DO_USER is correct: ${DO_USER}"
    echo "  3. Verify SSH key is set up: ssh ${DO_USER}@${DO_HOST}"
    exit 1
fi

# Create target directory
echo ""
echo -e "${BLUE}[2/5] Creating target directory...${NC}"
ssh ${DO_USER}@${DO_HOST} "mkdir -p ${DO_PATH}"
echo -e "${GREEN}✓ Directory created: ${DO_PATH}${NC}"

# Upload files
echo ""
echo -e "${BLUE}[3/5] Uploading verification scripts...${NC}"

cd "$LOCAL_DIR"

# List of files to upload (ONLY scripts, NO .md files)
FILES=(
    "verify_funding_data.py"
    "simulate_dual_alerts.py"
    "quick_verify.sh"
    "compare_funding_ws_vs_rest.py"
    "validate_funding_comparison.py"
    "troubleshoot_websocket.sh"
    "diagnose_websocket_issue.sh"
    "fix_websocket_paths.sh"
    "binance_funding_ws_daemon_improved.py"
    "check_websocket_status.sh"
)

UPLOADED=0
FAILED=0
SKIPPED=0

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        printf "  Uploading: %-40s" "$file"
        if scp -q "$file" ${DO_USER}@${DO_HOST}:${DO_PATH}/ 2>/dev/null; then
            echo -e "${GREEN}✓${NC}"
            ((UPLOADED++))
        else
            echo -e "${RED}✗ FAILED${NC}"
            ((FAILED++))
        fi
    else
        printf "  Skipping:  %-40s" "$file"
        echo -e "${YELLOW}⚠ Not found${NC}"
        ((SKIPPED++))
    fi
done

echo ""
echo "Upload Summary:"
echo -e "  ${GREEN}✓ Uploaded: ${UPLOADED}${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "  ${RED}✗ Failed:   ${FAILED}${NC}"
fi
if [ $SKIPPED -gt 0 ]; then
    echo -e "  ${YELLOW}⚠ Skipped:  ${SKIPPED}${NC}"
fi

if [ $FAILED -gt 0 ]; then
    echo ""
    echo -e "${RED}Some files failed to upload. Please check your connection and try again.${NC}"
    exit 1
fi

# Make scripts executable
echo ""
echo -e "${BLUE}[4/5] Making scripts executable...${NC}"
ssh ${DO_USER}@${DO_HOST} "cd ${DO_PATH} && chmod +x *.py *.sh 2>/dev/null"
echo -e "${GREEN}✓ Scripts made executable${NC}"

# Verify upload
echo ""
echo -e "${BLUE}[5/5] Verifying upload...${NC}"

# Check Python scripts
PY_COUNT=$(ssh ${DO_USER}@${DO_HOST} "ls ${DO_PATH}/*.py 2>/dev/null | wc -l" | tr -d ' ')
echo "  Python scripts (.py):  ${PY_COUNT}"

# Check shell scripts
SH_COUNT=$(ssh ${DO_USER}@${DO_HOST} "ls ${DO_PATH}/*.sh 2>/dev/null | wc -l" | tr -d ' ')
echo "  Shell scripts (.sh):   ${SH_COUNT}"

# Check services status
echo ""
echo -e "${BLUE}Checking WebSocket services status...${NC}"

if ssh ${DO_USER}@${DO_HOST} "systemctl is-active --quiet binance-funding-ws 2>/dev/null"; then
    echo -e "  WebSocket daemon:      ${GREEN}✓ Running${NC}"
else
    echo -e "  WebSocket daemon:      ${YELLOW}⚠ Not running${NC}"
fi

if ssh ${DO_USER}@${DO_HOST} "systemctl is-active --quiet binance-funding-api 2>/dev/null"; then
    echo -e "  API server:            ${GREEN}✓ Running${NC}"
else
    echo -e "  API server:            ${YELLOW}⚠ Not running${NC}"
fi

echo ""
echo "======================================================================"
echo -e "${GREEN}  Deployment Complete!${NC}"
echo "======================================================================"
echo ""
echo "📋 Files deployed to: ${DO_PATH}"
echo ""
echo "🚀 Next Steps:"
echo ""
echo "  1. SSH into Digital Ocean:"
echo -e "     ${BLUE}ssh ${DO_USER}@${DO_HOST}${NC}"
echo ""
echo "  2. Navigate to scripts directory:"
echo -e "     ${BLUE}cd ${DO_PATH}${NC}"
echo ""
echo "  3. Run quick verification:"
echo -e "     ${BLUE}./quick_verify.sh${NC}"
echo ""
echo "  4. Start real-time verification:"
echo -e "     ${BLUE}python3 verify_funding_data.py${NC}"
echo ""
echo ""
echo "======================================================================"
echo ""
