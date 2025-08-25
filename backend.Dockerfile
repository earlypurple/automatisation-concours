# Utiliser une image Python comme base
FROM python:3.9-slim

# Mettre à jour l'OS et installer les dépendances nécessaires pour Node.js et Puppeteer
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    # Dépendances pour Puppeteer/Chromium
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgcc1 \
    libgdk-pixbuf2.0-0 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    --no-install-recommends

# Installer Node.js et npm
RUN curl -fsSL https://deb.nodesource.com/setup_16.x | bash -
RUN apt-get install -y nodejs

# Définir le répertoire de travail
WORKDIR /app

# Copier les fichiers de dépendances
COPY requirements.txt package.json package-lock.json ./

# Installer les dépendances Python
RUN pip install --no-cache-dir -r requirements.txt

# Installer les dépendances Node.js
# Utiliser --unsafe-perm pour éviter des problèmes de permissions avec Puppeteer
RUN npm install --unsafe-perm

# Copier le reste de l'application
COPY . .

# Exposer le port de l'application
EXPOSE 8080

# Commande pour lancer l'application avec Gunicorn
CMD ["python", "run.py"]
