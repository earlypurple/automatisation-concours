#!/bin/bash
echo "🚀 LANCEMENT DASHBOARD ULTRA-AVANCÉ V3.0"
echo "🤖 IA + PWA + Temps Réel"
echo ""

# Vérifier Python3
if command -v python3 &> /dev/null; then
    python3 main.py
elif command -v python &> /dev/null; then
    python main.py
else
    echo "⚠️ Python non trouvé, ouverture statique"
    open index.html
fi
