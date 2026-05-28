import { generateNginxConfig } from './generateNginxConfig.js';

export function buildNginxCommands(domain, port) {
    const config = generateNginxConfig(domain, port);

    return [
        `cat > /tmp/${domain}.conf <<'EOF'
${config}
EOF`,

        `sudo mv /tmp/${domain}.conf /etc/nginx/sites-available/${domain}`,

        `sudo ln -sf /etc/nginx/sites-available/${domain} /etc/nginx/sites-enabled/${domain}`,

        `sudo nginx -t`,

        `sudo systemctl reload nginx`
    ];
}