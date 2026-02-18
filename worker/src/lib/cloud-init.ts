export function generateCloudInit(params: {
  sshPublicKey: string;
  tailscaleAuthKey: string;
  dropletName: string;
}): string {
  return `#cloud-config

users:
  - name: instaclaw
    uid: "1000"
    groups: sudo,docker
    shell: /bin/bash
    sudo: ALL=(ALL) NOPASSWD:ALL
    ssh_authorized_keys:
      - ${params.sshPublicKey}

package_update: true
package_upgrade: true

packages:
  - curl
  - wget
  - git
  - jq
  - socat
  - ufw
  - fail2ban
  - htop

runcmd:
  # Disable root SSH login
  - sed -i 's/^#\\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
  - sed -i 's/^#\\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
  - systemctl restart sshd

  # Install Tailscale
  - curl -fsSL https://tailscale.com/install.sh | sh
  - tailscale up --auth-key=${params.tailscaleAuthKey} --hostname=${params.dropletName}

  # UFW: Tailscale-only SSH + WireGuard handshake
  - ufw default deny incoming
  - ufw default allow outgoing
  - ufw allow in on tailscale0
  - ufw allow 41641/udp
  - ufw --force enable

  # Configure fail2ban
  - systemctl enable fail2ban
  - systemctl start fail2ban

  # Install Docker
  - curl -fsSL https://get.docker.com | sh
  - usermod -aG docker instaclaw
  - systemctl enable docker
  - systemctl start docker

  # Create app directories owned by instaclaw (uid 1000)
  - mkdir -p /opt/openclaw/home/.openclaw /opt/openclaw/home/.local /opt/openclaw/data
  - chown -R instaclaw:instaclaw /opt/openclaw

  # Docker log rotation
  - mkdir -p /etc/docker
  - |
    cat > /etc/docker/daemon.json << 'EOF'
    {
      "log-driver": "json-file",
      "log-opts": {
        "max-size": "10m",
        "max-file": "3"
      }
    }
    EOF
  - systemctl restart docker

  # Sentinel file -- signals cloud-init is done
  - touch /opt/instaclaw-ready

write_files:
  - path: /etc/fail2ban/jail.local
    content: |
      [DEFAULT]
      bantime = 3600
      findtime = 600
      maxretry = 3
      [sshd]
      enabled = true
    permissions: '0644'

final_message: "InstaClaw server setup complete!"
`;
}
