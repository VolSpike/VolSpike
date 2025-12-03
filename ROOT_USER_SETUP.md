# Root User Setup for Digital Ocean Deployment

## Changes Made

All scripts and documentation have been updated to use the **root** user instead of the `trader` user for Digital Ocean deployment.

---

## Configuration

### Deployment Script

File: [deploy_verification_tools.sh](deploy_verification_tools.sh)

**Updated configuration:**
```bash
DO_HOST="your-droplet-ip"     # ← Set your Digital Ocean IP
DO_USER="root"                 # ← Now uses root user
DO_PATH="/root/scripts"        # ← Scripts directory for root user
```

---

## How to Deploy as Root

### Step 1: Edit Deployment Script

```bash
cd "/Users/nikolaysitnikov/Documents/Documents_Nik_MacBook/Everyday Life/AI/VolumeFunding/VolSpike"

# Edit deployment script
nano deploy_verification_tools.sh

# Change this line:
DO_HOST="your-droplet-ip"    # ← Set your actual Digital Ocean IP address

# These are already set for root:
DO_USER="root"
DO_PATH="/root/scripts"

# Save and exit (Ctrl+X, Y, Enter)
```

### Step 2: Ensure SSH Access as Root

Make sure you can SSH as root:

```bash
# Test SSH connection
ssh root@your-droplet-ip "echo 'Connected successfully'"
```

**If SSH as root is disabled**, you have two options:

#### Option A: Enable root SSH (Recommended for scripts)

On your Digital Ocean droplet:

```bash
# SSH with your current user first
ssh your-user@your-droplet-ip

# Switch to root
sudo -i

# Edit SSH config
nano /etc/ssh/sshd_config

# Find and change:
PermitRootLogin yes

# Save and restart SSH
systemctl restart sshd

# Exit and test
exit
ssh root@your-droplet-ip "echo 'Root SSH works'"
```

#### Option B: Use sudo with your current user

If you prefer not to enable root SSH, modify the deployment script:

```bash
# Keep using your current user
DO_USER="your-username"
DO_PATH="/home/your-username/scripts"

# Scripts will need to run with sudo on Digital Ocean:
ssh your-username@your-droplet-ip
cd /home/your-username/scripts
sudo ./quick_verify.sh
```

### Step 3: Deploy

```bash
# Run deployment
./deploy_verification_tools.sh
```

---

## SSH as Root on Digital Ocean

### Commands Updated

All documentation now uses:

```bash
# SSH command
ssh root@your-droplet-ip

# Scripts directory
cd /root/scripts

# Run verification
./quick_verify.sh
python3 verify_funding_data.py
python3 simulate_dual_alerts.py
```

---

## Files Updated

All instances of `trader` user and `/home/trader` paths have been updated to `root` and `/root` in:

1. ✅ [deploy_verification_tools.sh](deploy_verification_tools.sh)
2. ✅ [Digital Ocean/DEPLOY_VERIFICATION_TOOLS.md](Digital Ocean/DEPLOY_VERIFICATION_TOOLS.md)
3. ✅ [Digital Ocean/QUICK_REFERENCE.md](Digital Ocean/QUICK_REFERENCE.md)
4. ✅ [Digital Ocean/VERIFICATION_SUMMARY.md](Digital Ocean/VERIFICATION_SUMMARY.md)
5. ✅ [FUNDING_WEBSOCKET_VERIFICATION.md](FUNDING_WEBSOCKET_VERIFICATION.md)
6. ✅ [START_HERE.md](START_HERE.md)
7. ✅ [FILE_STRUCTURE.txt](FILE_STRUCTURE.txt)
8. ✅ [Digital Ocean/ARCHITECTURE_DIAGRAM.txt](Digital Ocean/ARCHITECTURE_DIAGRAM.txt)

---

## Manual SCP Upload (as root)

If you prefer manual upload instead of the deployment script:

```bash
# Set variables
export DO_HOST="your-droplet-ip"
export DO_USER="root"
export DO_PATH="/root/scripts"

# Create directory on Digital Ocean
ssh ${DO_USER}@${DO_HOST} "mkdir -p ${DO_PATH}"

# Navigate to local Digital Ocean directory
cd "Digital Ocean"

# Upload files
scp verify_funding_data.py ${DO_USER}@${DO_HOST}:${DO_PATH}/
scp simulate_dual_alerts.py ${DO_USER}@${DO_HOST}:${DO_PATH}/
scp quick_verify.sh ${DO_USER}@${DO_HOST}:${DO_PATH}/
scp *.md ${DO_USER}@${DO_HOST}:${DO_PATH}/

# Make executable
ssh ${DO_USER}@${DO_HOST} "cd ${DO_PATH} && chmod +x *.py *.sh"
```

---

## Verification Commands (as root)

After deployment, all verification commands run as root:

```bash
# SSH as root
ssh root@your-droplet-ip

# Navigate to scripts
cd /root/scripts

# Run verifications (no sudo needed - already root)
./quick_verify.sh
python3 verify_funding_data.py
python3 simulate_dual_alerts.py

# Monitor logs (no sudo needed - already root)
journalctl -u binance-funding-ws -f
journalctl -u your-volume-alert-service -f | grep "Funding Comparison"
```

---

## Security Considerations

### Running as Root

**Pros:**
- No permission issues
- Direct access to systemd services
- Simpler deployment process
- No sudo password prompts

**Cons:**
- Higher security risk if compromised
- Best practice is to use non-root user with sudo

### Best Practice (Optional)

If security is a concern, consider:

1. **Use a non-root user** with sudo access
2. **Deploy scripts** to that user's home directory
3. **Run systemd commands** with sudo
4. **Disable root SSH** after setup

Example with custom user:
```bash
DO_USER="deployer"
DO_PATH="/home/deployer/scripts"

# On Digital Ocean
ssh deployer@your-droplet-ip
cd /home/deployer/scripts
sudo ./quick_verify.sh  # Use sudo when needed
```

---

## Quick Start (Root User)

**Current setup is ready for root user deployment:**

```bash
# 1. Edit deployment script
cd "/Users/nikolaysitnikov/Documents/Documents_Nik_MacBook/Everyday Life/AI/VolumeFunding/VolSpike"
nano deploy_verification_tools.sh
# Set DO_HOST="your-actual-ip"
# Save

# 2. Deploy
./deploy_verification_tools.sh

# 3. SSH and verify
ssh root@your-droplet-ip
cd /root/scripts
./quick_verify.sh
```

---

## Summary

- ✅ All scripts configured for **root** user
- ✅ All documentation updated to use **root**
- ✅ Deployment path: **/root/scripts**
- ✅ SSH command: **ssh root@your-droplet-ip**
- ✅ No sudo needed when running as root

**Ready to deploy as root!** Just set your IP address in the deployment script and run it.
