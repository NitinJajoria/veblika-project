export function buildNginxCommands(domain, port) {
    const config = `
server {
    listen 80;
    server_name ${domain};

    location / {
        proxy_pass http://localhost:${port};

        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
`;

    const escapedConfig = config
        .replace(/\n/g, '\\n')
        .replace(/"/g, '\\"');

    return [
        `echo "${escapedConfig}" | sudo tee /etc/nginx/sites-available/${domain}`,

        `sudo ln -sf /etc/nginx/sites-available/${domain} /etc/nginx/sites-enabled/${domain}`,

        `sudo nginx -t`,

        `sudo systemctl reload nginx`
    ];
}