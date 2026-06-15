# README V0.2 — plan produs și flux operațional

Acesta este planul pentru următorul modul major al aplicației: un flux complet de comandă cu statusuri clare, notificări și control per restaurant, activat sau dezactivat de owner.

---

## Status bar

| Etapă | Status |
|---|---|
| Baza actuală stabilă | ✅ Done |
| Documentație V0.2 | ✅ Done |
| Flag-uri modul per restaurant | ✅ Done |
| UI owner pentru module | ✅ Done |
| Gates client / staff / kitchen | ✅ Done |
| Notificare comandă nouă către restaurant | ✅ Done |
| Status client vizibil | ✅ Done |
| Polling live du statut client | ✅ Done |
| Timeline statut client | ✅ Done |
| Notifications served / ready | ✅ Done |
| Push notifications end-to-end | ✅ Done |

---

## 1. Obiectiv

Vreau un modul nou, activat din `Owner` doar pentru un restaurant anume, care să permită:

- clientul să scaneze QR-ul, să vadă meniul și să adauge produse în coș
- clientul să se autentifice cu Google sau cu e-mail/parolă
- clientul să confirme comanda pentru masa lui
- ospătarul să valideze fizic comanda înainte de bucătărie
- bucătăria să primească comanda și să o pregătească
- ospătarul să primească notificare când comanda este gata
- ospătarul să ducă preparatul la masă și să marcheze `served`
- managerul, staff-ul și owner-ul să poată vedea statusurile clare
- owner-ul să poată activa sau dezactiva modulul per restaurant

Acest modul trebuie să fie:

- mobile first
- rapid
- clar vizual
- ușor de folosit de staff, client și manager
- pregătit pentru push / notificări

---

## 2. Control de la owner

Owner-ul poate seta per restaurant:

- `order_flow_enabled` = on / off
- `client_google_login_enabled` = on / off
- `waiter_validation_enabled` = on / off
- `kitchen_notification_enabled` = on / off
- `served_confirmation_enabled` = on / off

### Reguli

- dacă modulul este `off`, restaurantul nu vede fluxul complet
- dacă modulul este `on`, restaurantul îl poate folosi integral
- owner-ul controlează doar restaurantul dorit
- managerul și staff-ul folosesc doar ce este activat pentru restaurantul lor

---

## 3. Roluri și responsabilități

### Client

- scanează QR
- vede meniul
- adaugă produse în coș
- se conectează cu Google sau e-mail
- confirmă comanda
- vede statusul comenzii
- poate chema ospătarul

### Staff

- validează fizic comanda clientului
- vede comenzile noi
- trimite comanda la bucătărie
- vede când comanda este gata
- duce comanda la masă
- marchează `served`
- poate încasă

### Kitchen

- vede doar comenzile trimise în bucătărie
- începe prepararea
- marchează `ready`
- nu vede zona de administrare

### Manager

- vede comenzi și audit pentru restaurantul lui
- vede și poate regla meniul
- vede statusurile operaționale

### Owner

- activează / dezactivează modulul per restaurant
- vede toate restaurantele
- vede auditul global
- vede dacă notificările sunt funcționale

---

## 4. Fluxul exact pe rute

### Public

- landing page: `/`
- meniu restaurant: `/r/bar-1?lang=fr`
- QR: `/qr/bar-1`

### Client

- login client: `/client`
- signup client: `/client/signup`
- după login Google sau e-mail, clientul este trimis în:
  - `/client?focus=cart`

### Staff

- login staff: `/staff`
- staff vede:
  - rezervări
  - cereri client
  - comenzi de validat
  - bon activ
  - starea comenzilor

### Kitchen

- login kitchen: `/kitchen`
- kitchen vede doar comenzile:
  - `sent_to_kitchen`
  - `preparing`
  - `ready`

### Manager

- login manager: `/dashboard`
- manager vede:
  - restaurantul lui
  - meniul
  - auditul
  - setările modulului

### Owner

- login owner: `/owner`
- owner vede:
  - toate restaurantele
  - modulul on/off
  - notificări
  - planuri
  - facturi

---

## 5. State flow comandă

Fluxul dorit este:

1. `draft`
2. `confirmed_by_client`
3. `validated_by_waiter`
4. `sent_to_kitchen`
5. `preparing`
6. `ready`
7. `served`
8. `paid`
9. `archived`

### Reguli

- clientul confirmă doar comanda lui
- ospătarul confirmă fizic înainte de bucătărie
- bucătăria vede doar comenzile trimise
- când comanda e `ready`, ospătarul primește notificare
- după livrare, ospătarul marchează `served`
- la final se poate marca `paid`

---

## 6. Notificări

Trebuie să existe notificări clare pentru:

- comandă nouă
- comandă confirmată de client
- comandă validată de ospătar
- comandă trimisă în bucătărie
- comandă gata
- comandă servită
- rezervare nouă
- rezervare confirmată

### Destinatari

- client
- staff
- kitchen
- manager
- owner

### Implementare dorită

- provider principal: Android / device restaurant
- fallback: WhatsApp Business
- fallback: Twilio
- owner activează providerul per restaurant

---

## 7. UX cerut

### Public

- dark, curat, mobile first
- acordeoane compacte
- listă simplă de produse
- modal de produs scrollabil
- QR direct către meniul real

### Client

- coș clar
- login Google vizibil
- confirmare simplă
- statusuri ușor de înțeles
- buton `Appeler le serveur`

### Staff

- puține acțiuni în față
- buton clar de validare
- statusuri vizibile
- încasare rapidă
- alertă clară pentru comanda gata

### Kitchen

- coadă simplă
- doar comenzile relevante
- buton `ready`
- fără zgomot vizual

### Manager / Owner

- dark theme
- text ușor de citit
- control pe module și statusuri
- audit vizibil

---

## 8. Cum verifici simplu

### Test minim

1. Deschide `/`
2. Verifică prezentarea aplicației și butoanele demo
3. Deschide `/r/bar-1?lang=fr`
4. Adaugă produse în coș
5. Autentifică-te ca client
6. Confirmă coșul
7. Intră în `/staff`
8. Validează comanda
9. Intră în `/kitchen`
10. Marchează `ready`
11. Revino în `/staff`
12. Confirmă că apare notificarea de comandă gata
13. Marchează `served`
14. Intră în `/owner`
15. Pornește / oprește modulul pentru restaurant
16. Verifică dacă fluxul dispare sau apare corect

---

## 9. Criterii de acceptare

Modulul este gata doar dacă:

- se activează / dezactivează per restaurant
- funcționează pe mobil bine
- clientul poate confirma comanda
- staff-ul validează fizic
- kitchen primește comanda corect
- ospătarul primește notificare când e gata
- statusurile sunt clare și corecte
- auditul notează acțiunile
- owner-ul vede controlul complet

---

## 10. Notă de implementare

Acesta este modul nou peste ce există deja.

Nu trebuie să strice:

- QR-ul curent
- meniul curent
- rezervările
- managerul
- staff-ul
- owner-ul

Trebuie doar să adauge un flux complet, cu activare / dezactivare per restaurant.
