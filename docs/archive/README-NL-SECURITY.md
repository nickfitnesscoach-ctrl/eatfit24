# NL Server Security Hardening Guide

## 🚨 CRITICAL SECURITY NOTICE

**Current Status:** Server running as ROOT - IMMEDIATE ACTION REQUIRED

- **Server:** 185.171.80.128
- **Current User:** root
- **Service:** AI Proxy (FastAPI on port 8001)
- **Risk Level:** CRITICAL ⚠️

## Quick Start - Activate DevOps Mode

Use any of these keywords to activate NL server DevOps mode:
- `sshnl` - SSH to NL server
- `nl` - Short alias

## Security Hardening Roadmap

### Phase 1: CRITICAL (P0) - Immediate Actions

#### 1. Create Dedicated User
```bash
# Create deploy user
useradd -m -s /bin/bash deploy

# Set strong password
passwd deploy
# Enter: [STRONG_PASSWORD]

# Add to sudo group
usermod -aG sudo deploy

# Verify
id deploy
```

#### 2. Setup SSH Keys
```bash
# Copy SSH directory from root to deploy
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/ 2>/dev/null || echo "No keys to copy"
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys 2>/dev/null || true
```

#### 3. Test New User
```bash
# Test sudo access
su - deploy
sudo whoami  # Should output: root
exit
```

#### 4. Disable Root SSH
```bash
# Backup sshd_config
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup

# Edit sshd_config
nano /etc/ssh/sshd_config

# Change these lines:
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes

# Restart SSH (DANGEROUS - ensure you tested deploy user first!)
systemctl restart sshd
```

#### 5. Setup Firewall
```bash
# Install UFW
apt update && apt install -y ufw

# Configure rules
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 8001/tcp comment 'AI Proxy API'

# Enable firewall
ufw --force enable

# Check status
ufw status verbose
```

### Phase 2: HIGH Priority (P1)

#### 6. Install fail2ban
```bash
apt install -y fail2ban

# Configure fail2ban
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = 22
logpath = /var/log/auth.log
EOF

systemctl enable fail2ban
systemctl start fail2ban
systemctl status fail2ban
```

#### 7. Setup Automatic Security Updates
```bash
apt install -y unattended-upgrades

# Configure
dpkg-reconfigure -plow unattended-upgrades

# Verify
systemctl status unattended-upgrades
```

#### 8. Security Audit
```bash
# Install security tools
apt install -y lynis rkhunter chkrootkit

# Run Lynis audit
lynis audit system

# Run rootkit hunter
rkhunter --check --skip-keypress

# Check for rootkits
chkrootkit
```

### Phase 3: MEDIUM Priority (P2)

#### 9. Setup Reverse Proxy with SSL
```bash
# Install nginx
apt install -y nginx certbot python3-certbot-nginx

# Configure nginx for AI Proxy
cat > /etc/nginx/sites-available/ai-proxy << 'EOF'
server {
    listen 80;
    server_name 185.171.80.128;

    location / {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF

ln -s /etc/nginx/sites-available/ai-proxy /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

#### 10. Harden Kernel Parameters
```bash
# Backup sysctl.conf
cp /etc/sysctl.conf /etc/sysctl.conf.backup

# Add security parameters
cat >> /etc/sysctl.conf << 'EOF'
# IP Forwarding
net.ipv4.ip_forward = 0

# SYN cookies
net.ipv4.tcp_syncookies = 1

# Ignore ICMP redirects
net.ipv4.conf.all.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0

# Ignore source routed packets
net.ipv4.conf.all.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0

# Log Martians
net.ipv4.conf.all.log_martians = 1
EOF

# Apply
sysctl -p
```

## Security Verification Checklist

### Pre-Hardening Audit
- [ ] List all users: `cat /etc/passwd`
- [ ] List all sudo users: `grep -Po '^sudo.+:\K.*$' /etc/group`
- [ ] Check open ports: `netstat -tulpn | grep LISTEN`
- [ ] Check running services: `systemctl list-units --type=service --state=running`
- [ ] Check SSH config: `cat /etc/ssh/sshd_config | grep -E "PermitRootLogin|PasswordAuthentication"`
- [ ] Check firewall status: `ufw status verbose || iptables -L -n -v`
- [ ] Check for security updates: `apt update && apt list --upgradable`
- [ ] Review AI Proxy security: `curl -s http://localhost:8001/health`

### Post-Hardening Verification
- [ ] Verify root SSH disabled: `ssh root@185.171.80.128` (should fail)
- [ ] Verify deploy user works: `ssh deploy@185.171.80.128`
- [ ] Verify sudo access: `sudo whoami`
- [ ] Verify firewall active: `sudo ufw status`
- [ ] Verify fail2ban running: `sudo systemctl status fail2ban`
- [ ] Verify AI Proxy accessible: `curl http://185.171.80.128:8001/health`
- [ ] Check for failed login attempts: `sudo lastb | head -20`
- [ ] Review security audit: `sudo lynis show report`

## AI Proxy Security

### Current Configuration
- **Port:** 8001
- **API Secret:** c6b837b17429b1e7b488cc6333759dce6a326b9f6cee73a1c228670867a44a5c
- **Health Check:** http://185.171.80.128:8001/health

### Security Recommendations
1. Verify API key is strong and not exposed
2. Implement rate limiting
3. Add request logging
4. Setup HTTPS/TLS
5. Restrict access by IP (if possible)
6. Monitor for unusual activity

## Monitoring & Maintenance

### Daily Checks
```bash
# Check system resources
df -h
free -h
uptime

# Check failed login attempts
sudo lastb | head -10

# Check AI Proxy health
curl -s http://localhost:8001/health
```

### Weekly Checks
```bash
# Check for updates
sudo apt update && sudo apt list --upgradable

# Review fail2ban logs
sudo fail2ban-client status sshd

# Check disk usage
sudo du -sh /var/log/*
```

### Monthly Checks
```bash
# Full security audit
sudo lynis audit system

# Check for rootkits
sudo rkhunter --check

# Review all users
cat /etc/passwd
```

## Emergency Rollback

If something goes wrong and you lose SSH access:

1. **Use VPS provider's console/VNC** to regain access
2. Revert sshd_config: `cp /etc/ssh/sshd_config.backup /etc/ssh/sshd_config`
3. Restart SSH: `systemctl restart sshd`
4. Disable firewall temporarily: `ufw disable`

## Related Files

- `.claude/ssh-nl-config.json` - NL server DevOps configuration
- `.claude/project.json` - Main project configuration with server shortcuts

## Next Steps After Hardening

1. [ ] Update `.claude/ssh-nl-config.json` to use `deploy` user instead of `root`
2. [ ] Document new deploy user credentials securely
3. [ ] Setup monitoring and alerting
4. [ ] Create backup strategy
5. [ ] Schedule regular security audits
