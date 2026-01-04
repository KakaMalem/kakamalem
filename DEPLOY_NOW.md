# Deploy Kaka Malem

## Step 6: Configure Nginx

```bash
# Remove old site configs
sudo rm /etc/nginx/sites-enabled/*

# Copy new config
sudo cp nginx.conf /etc/nginx/sites-available/kakamalem
sudo ln -s /etc/nginx/sites-available/kakamalem /etc/nginx/sites-enabled/

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

## Step 7: Verify

```bash
pm2 status
pm2 logs kakamalem --lines 30
curl https://kakamalem.com
```

Done. Visit https://kakamalem.com

## Future Deploys

```bash
cd /var/www/kakamalem
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```
