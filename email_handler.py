"""
Module pour la gestion des confirmations par e-mail.
"""
import imaplib
import email
import re
import requests
import database as db
from email.header import decode_header
import os
from dotenv import load_dotenv

load_dotenv()

def find_confirmation_link(body):
    """
    Trouve un lien de confirmation dans le corps d'un e-mail.
    Recherche des URLs contenant des mots-clés comme 'confirm', 'verify', 'validate'.
    """
    # Regex simple pour trouver les URLs
    urls = re.findall(r'http[s]?://[^\s<>"]+|www\.[^\s<>"]+', body)

    for url in urls:
        # Nettoyer les URLs qui peuvent avoir des caractères indésirables à la fin
        url = url.strip(').,>!')
        keywords = ['confirm', 'verify', 'validate', 'activation', 'subscribe']
        if any(keyword in url for keyword in keywords):
            return url

    return None

import json
from datetime import datetime

def process_pending_confirmations(config):
    """
    Traite toutes les opportunités en attente de confirmation par e-mail.
    """
    print("Vérification des e-mails de confirmation en attente...")
    pending_opps = [opp for opp in db.get_opportunities() if opp['status'] == 'email_confirmation_pending']

    if not pending_opps:
        print("Aucune confirmation en attente.")
        return

    email_enabled = config.get('email_handler', {}).get('enabled', False)
    if not email_enabled:
        print("Le gestionnaire d'e-mails est désactivé dans config.json.")
        return

    email_host = os.getenv("EMAIL_HOST")
    email_user = os.getenv("EMAIL_USER")
    email_password = os.getenv("EMAIL_PASSWORD")

    if not all([email_host, email_user, email_password]):
        print("Les variables d'environnement pour l'e-mail ne sont pas configurées.")
        return

    try:
        mail = imaplib.IMAP4_SSL(email_host)
        mail.login(email_user, email_password)

        for opp in pending_opps:
            details = json.loads(opp['confirmation_details'])
            check_email_for_opportunity(mail, opp, details)

    except Exception as e:
        print(f"Erreur lors du traitement des confirmations : {e}")
    finally:
        if 'mail' in locals() and mail.state != 'LOGOUT':
            mail.logout()

def check_email_for_opportunity(mail, opportunity, details):
    """Cherche un e-mail de confirmation pour une opportunité spécifique."""
    try:
        mail.select('inbox')

        domain = details['domain']
        since_date = datetime.fromisoformat(details['timestamp']).strftime('%d-%b-%Y')
        search_criteria = f'(UNSEEN FROM "{domain}" SENTSINCE {since_date})'

        status, messages = mail.search(None, search_criteria)
        if status != 'OK' or not messages[0]:
            return

        for num in messages[0].split():
            _, data = mail.fetch(num, '(RFC822)')
            msg = email.message_from_bytes(data[0][1])

            link = None
            if msg.is_multipart():
                for part in msg.walk():
                    if "text/html" in part.get_content_type():
                        body = part.get_payload(decode=True).decode(errors='ignore')
                        link = find_confirmation_link(body)
                        if link: break
            else:
                body = msg.get_payload(decode=True).decode(errors='ignore')
                link = find_confirmation_link(body)

            if link:
                print(f"Lien de confirmation trouvé pour l'opportunité #{opportunity['id']}: {link}")
                try:
                    requests.get(link, timeout=15, headers={'User-Agent': 'Mozilla/5.0'}).raise_for_status()
                    db.update_opportunity_status(opportunity['id'], 'success', f"Confirmation par e-mail réussie via le lien: {link}")
                    mail.store(num, '+FLAGS', '\\Seen')
                    return # On a trouvé le bon e-mail, on passe à l'opportunité suivante
                except requests.RequestException as e:
                    print(f"Erreur en visitant le lien pour l'opportunité #{opportunity['id']}: {e}")

    except Exception as e:
        print(f"Erreur lors de la recherche d'e-mail pour l'opportunité #{opportunity['id']}: {e}")
