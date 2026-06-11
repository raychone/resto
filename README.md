# Meniu restaurant SaaS

Aplicație Next.js pentru meniuri digitale, QR, rezervări, staff, manager și owner.

## Ce este implementat acum

- meniu public per restaurant, cu limbi `fr / en / it / es`
- categoriile din meniu sunt afișate ca acordeon/listă, închise by default, fără număr de produse și fără etichetă duplicată
- preparatele se deschid într-un modal scrollabil cu imagine, recipe, ingredients și allergens, iar signature apare pe imagine
- rândurile din meniu sunt list-style, fără carduri, iar în listă apar doar numele și prețul
- meniul public are stil dark pe mobile, cu text deschis pentru lizibilitate
- menu-ul public afișează un singur preț curent, cu discount happy hour aplicat când este activ
- QR code per restaurant, direct către meniul web
- PDF A3 pentru meniu, ca variantă opțională de print
- navbar public dark, fără orar în header, cu logo-ul restaurantului în stânga, butonul `Menu` centrat și selectorul de limbă în dreapta
- butoanele Google Maps și Waze sunt icon-only, cu cerc discret pentru lizibilitate
- rezervări online cu modal pe pași
- pagină `staff` pentru rezervări, mesaje și operare zilnică
- pagină `dashboard` pentru manager
- pagină `owner` pentru overview global și facturare
- model restaurant + user cu scoping pe restaurant
- login cu useri reali din store local
- logica de active / disabled și `mustChangePassword` pregătită în model
- managerul poate crea, dezactiva și reseta utilizatori staff pentru restaurantul lui
- mese, bon activ, comenzi și plăți separate pentru staff
- staff-ul poate ajusta cantitățile cu `+ / -` direct pe bon
- managerul vede un historique d’audit dans un accordion
- owner-ul vede un audit global à l’échelle du portefeuille
- rezervările au statusuri `pending / confirmed / cancelled / no_show`
- owner-ul poate schimba `plan` și `status` pentru fiecare restaurant
- owner-ul poate activa / dezactiva modulele per restaurant: booking, QR mode, WhatsApp, SMS, Google Reviews
- owner-ul poate crea un restaurant nou și poate adăuga manager / staff inițial din aceeași formă
- owner-ul are filtre și statusuri rapide pentru facturi: brouillon / envoyée / payée / annulée
- owner-ul vede acum și un rezumat comercial pe setup / maintenance + acoperirea pachetelor
- owner-ul are și filtre de facturi plus sumar comercial pe setup / maintenance / coverage
- owner-ul are preseturi rapide de facturare `Starter / Pro / Premium`
- paginile publice au metadata SEO / Open Graph / canonical
- audit separat și facturare de bază
- owner-ul are un panou de test pentru notificări direct din cardul restaurantului
- owner-ul are și un test rapide des notifications în header, cu selector de restaurant
- owner-ul are și un onboarding compact pour configurer / tester les notifications sur un écran
- demo-ul `Noir 1` este pregătit pentru happy hour, beers, aperitifs, wines, cocktails, rums, whiskies, gins, vodkas, tequilas și digestifs
- path demo pentru bar: `/r/bar-1`
- logo dedicat pentru `Noir 1` în stil noir, încărcat local din `/bar-1-logo.svg`
- happy hour-ul este configurabil pe zile și interval, cu card live de countdown cu secunde pe pagina publică
- booking-ul este oprit pentru `Noir 1`, deci `Book a table` nu apare pe demo-ul principal
- happy hour-ul are un countdown live cu secunde vizibile doar în linia principală a cardului
- produsele din menu pot avea happy hour price redus

## Implementare pe faze

### Faza 1 — model și scoping

- `Restaurant` are identitate proprie și `slug` doar pentru URL
- `owner / manager / staff` sunt roluri în același sistem `User`
- managerul și staff-ul sunt legați de un singur restaurant
- login-ul folosește useri reali și nu token-uri hardcodate
- starea curentă: restaurantul este izolat prin `restaurantId`, iar owner-ul rămâne global

### Faza 2 — users și parole

- managerul creează staff pentru restaurantul lui
- staff-ul are `active / disabled`
- staff-ul are `temporaryPassword` și `mustChangePassword`
- resetarea parolei se face din dashboard, fără email
- starea curentă: managerul creează, dezactivează și resetează userii staff ai restaurantului lui; staff-ul își schimbă parola în app

### Faza 3 — mese, bonuri și comenzi

- staff-ul selectează masa sau `takeaway`
- bonul este activ și poate fi continuat
- produsele se adaugă din meniu
- cantitățile se modifică cu `+ / -`
- plata este separată de comandă
- starea curentă: staff-ul poate lucra pe masă sau takeaway, iar comanda activează bonul și permite ajustarea itemilor

### Faza 4 — restricții UI / API și audit

- staff-ul nu vede audit
- managerul vede auditul restaurantului lui
- owner-ul vede auditul global
- rezervările au `pending / confirmed / cancelled / no_show`
- starea curentă: auditul este separat, scoping-ul este strict, iar rezervările au statusurile corecte inclusiv `no_show`

### Faza 5 — facturare și pachete

- owner-ul setează `plan` și `status` per restaurant
- owner-ul activează sau oprește module comerciale
- owner-ul creează facturi de `setup` și `maintenance`
- facturile au filtre, sumare și preseturi `Starter / Pro / Premium`
- starea curentă: facturarea și pachetele sunt funcționale la nivel de produs; owner-ul poate controla pachetele și modulele fiecărui restaurant

### Faza 6 — notificări, SEO și scalare

- provider notificări per restaurant cu `Android SMS` ca default
- fallback-uri pentru `WhatsApp Business` și `Twilio`
- metadata SEO / Open Graph / canonical pe paginile publice
- ghid de instalare notificări pentru owner și restaurant
- starea curentă: providerul este modelat în aplicație, iar confirmarea rezervărilor poate declanșa notificări prin fallback-uri server-side sau composer-ul Android

## Roluri curente

- `owner` — vede toate restaurantele
- `manager` — vede doar restaurantul lui
- `staff` — vede doar restaurantul lui

## Credentiale demo

- owner: `owner / owner123!`
- manager: `raych / raychone!`
- staff: `user / pass123!`

## Cum rulezi local

```bash
npm install
npm run dev
```

<<<<<<< HEAD
Open [http://localhost:3000]q (http://localhost:3000) with your browser to see the result.
=======
Deschide:
>>>>>>> cd9e415 (cevaaaaa)

- `http://localhost:3000`
- `http://localhost:3000/dashboard`
- `http://localhost:3000/staff`
- `http://localhost:3000/owner`

## Cum verifici ce s-a implementat acum

1. Deschide `http://localhost:3000`.
2. Verifică pagina publică și deschide meniul restaurantului.
3. Intră în `/r/bar-1?lang=fr`, apoi schimbă în `en`, `it`, `es`.
4. Deschide `/qr/bar-1` și verifică faptul că QR-ul deschide direct meniul web, cu logo suprapus.
5. Deschide `/pdf/bar-1` doar dacă vrei să verifici varianta A3 de print.
6. Intră în `/dashboard` cu `raych / raychone!`.
7. Verifică faptul că vezi doar restaurantul tău.
8. În cardul de utilizatori staff, creează un angajat nou și verifică statusul / resetarea parolei.
9. În `/dashboard`, schimbă `plan`, `status` și modulele comerciale.
10. În `/dashboard`, deschide `Historique` și verifică auditul manager.
11. Intră în `/staff` cu `user / pass123!`.
12. În pagina staff, selectează o masă, adaugă un produs din meniu și ajustează cantitatea cu `+ / -`.
13. Creează o rezervare manuală din staff și marcheaz-o `confirmed`, `cancelled` și `no_show`.
14. Intră în `/owner` cu `owner / owner123!`.
15. Verifică faptul că owner-ul vede portofoliul global, facturile și auditul global.
16. În `/owner`, schimbă `plan` sau `status` pentru un restaurant și apasă `Enregistrer`.
17. În `/owner`, modifică modulele unui restaurant și apasă `Sauver les modules`.
18. În secțiunea `Factures`, filtrează după status și verifică sumarul de sus.
19. Folosește preseturile `Starter / Pro / Premium` ca să precompletezi rapid factura.
20. În `Owner`, apasă `Tester notification` pe un restaurant și verifică rezultatul.
21. În `Owner`, folosește testul rapid din header și verifică selectorul de restaurant.
22. În `Owner`, folosește blocul `Onboarding notifications` ca să configurezi și să testezi rapid un restaurant.

## Fișiere importante

- `plan.md` — planul complet al produsului și fazele de implementare
- `src/lib/types.ts` — modelele de date
- `src/lib/auth.ts` — autentificare și scoping
- `src/lib/restaurant-store.ts` — restaurante și migrare seed
- `src/lib/user-store.ts` — useri, parole și status

## Stare curentă

Implementarea este stabilă pe fazele 1–6:

- `Restaurant` are identitate proprie
- `User` este model comun pentru `owner / manager / staff`
- login-ul nu mai folosește token-uri hardcodate
- managerul și staff-ul sunt legați de un singur restaurant
- owner-ul rămâne global
- publicul vede navbar dark fără orar, cu logo-ul restaurantului și selectorul de limbă
- managerul poate crea / dezactiva / reseta staff direct din dashboard
- dacă un user demo staff apare fără restaurant valid, store-ul îl remapează automat pe primul restaurant activ
- staff-ul poate deschide un bon pe masă sau pe takeaway și poate adăuga produse din meniu
- staff-ul poate mări sau micșora rapid cantitatea unui produs din bon
- managerul și owner-ul au vizualizare de audit, staff-ul nu
- rezervările au acum și statusul `no_show` în dashboard și staff
- owner-ul poate seta `plan` și `status` per restaurant din portalul owner
- owner-ul poate activa sau dezactiva modulele comerciale per restaurant
- owner-ul are listă de facturi filtrabilă pe status
- owner-ul are și un rezumat comercial pe pachete și acoperire
- owner-ul vede rezumat separat pentru setup și maintenance
- owner-ul are preseturi comerciale rapide pentru facturi
- paginile publice au metadata SEO și social sharing mai bun
- providerul de notificări este configurabil per restaurant, cu Android SMS ca default și fallback-uri Twilio / WhatsApp Business documentate
- crearea și confirmarea rezervărilor pot declanșa notificări server-side sau composer-ul Android, în funcție de provider
- owner-ul are un panou de test pentru notificări direct din cardul restaurantului
- owner-ul are și un onboarding compact pentru configurarea și testarea notificărilor
- QR-ul public deschide direct meniul web; A3 rămâne doar pentru print
- meniul public e acum orientat mobile-first, cu categorii dark și detaliu pe tap/click
- produsele pot avea preț happy hour setat din dashboard, iar staff-ul vede doar prețul curent

Ce rămâne acum este mai degrabă operativ:

- configurarea credențialelor reale Twilio / WhatsApp Business când vrei trimitere automată externă
- testarea pe restaurante reale
- polish UI / UX și eventuale ajustări de produs după feedback

## Ghid de instalare notificări

Canalul principal este `Android SMS`.

### Ce faci tu ca owner

1. Intră în `/owner`.
2. Găsește restaurantul în listă.
3. Deschide cardul de module / capabilities.
4. La `Notification`, alege `Android SMS`.
5. Salvează modificarea cu `Sauver les modules`.
6. Dacă restaurantul vrea WhatsApp, schimbă providerul pe `WhatsApp Business`.
7. Dacă vrei trimitere automată din server, schimbă providerul pe `Twilio`.
8. Verifică dacă restaurantul are trecut corect numărul de telefon de notificări.

### Ce faci pe telefonul Android al restaurantului

1. Deschide telefonul Android al restaurantului.
2. Verifică să existe aplicația normală de mesaje, de obicei `Messages`.
3. Intră în `Setări`.
4. Deschide `Aplicații`.
5. Caută `Aplicații implicite`.
6. Verifică aplicația implicită pentru `SMS`.
7. Las-o pe aplicația de mesaje standard.
8. Nu instala altă aplicație doar pentru notificări.
9. Testează din aplicație: apasă butonul de notificare de pe o rezervare.
10. Telefonul trebuie să deschidă composerul de SMS cu textul gata scris.
11. Tu sau staff-ul apăsați `Trimite` manual de pe telefon.

### Cum testezi că funcționează

1. Creează o rezervare de test din pagina publică.
2. Intră în `Staff` sau `Dashboard`.
3. Confirmă rezervarea.
4. Verifică dacă rezervarea a trimis automat alerta către restaurant.
5. Dacă providerul este `Android SMS`, apasă butonul de notificare.
6. Verifică dacă mesajul este precompletat.
7. Trimite mesajul manual de pe telefon.
8. Verifică auditul pentru evenimentul `reservation_notification`.

### Fallback-uri

- `WhatsApp Business` — selectezi providerul în `Owner`, apoi folosești aplicația WhatsApp Business instalată pe telefon.
- `Twilio` — selectezi providerul în `Owner`, apoi conectezi credențialele server-side pentru trimitere automată.

### Configurare `.env.local` pentru fallback-uri

Adaugă doar dacă vrei să trimiți efectiv din server:

```bash
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+33...
WHATSAPP_BUSINESS_TOKEN=...
WHATSAPP_BUSINESS_PHONE_NUMBER_ID=...
```

Reguli simple:

- dacă `Notification` este `Android SMS`, nu ai nevoie de aceste variabile
- dacă alegi `Twilio`, completezi variabilele Twilio și repornești serverul
- dacă alegi `WhatsApp Business`, completezi token-ul și phone number ID
- după orice modificare în `.env.local`, repornești `npm run dev`

### Cum testezi fallback-urile

1. În `Owner`, selectează `Twilio` sau `WhatsApp Business` la `Notification`.
2. Pune valorile din `.env.local`.
3. Repornește aplicația.
4. Creează o rezervare.
5. Confirmă rezervarea din `Staff` sau `Dashboard`.
6. Verifică în audit că apare `reservation_notification`.
7. Dacă providerul e `Twilio` sau `WhatsApp Business`, verifică în providerul extern că mesajul a fost trimis.

## Cum testezi pe roluri

### Public

1. Deschide pagina publică a restaurantului.
2. Verifică logo-ul, hero-ul și butoanele de mapare.
3. Schimbă limba din selectorul din header.
4. Verifică programul din secțiunea dedicată a paginii, nu din navbar.
5. Deschide `Reserve` și verifică modalul de rezervare, doar dacă restaurantul are booking activ.
6. Trimite o cerere și verifică mesajul de confirmare.
7. Verifică dacă categoriile din meniu se deschid ca acordeon.

### Manager

1. Intră în `/dashboard` cu `raych / raychone!`.
2. Verifică faptul că vezi doar restaurantul tău.
3. Modifică meniul, programul și datele restaurantului.
4. Creează, dezactivează și resetează un user staff.
5. Schimbă `plan`, `status` și modulele comerciale.
6. Deschide `Historique` și verifică auditul.

### Staff

1. Intră în `/staff` cu `user / pass123!`.
2. Verifică restaurantul asociat.
3. Deschide o masă sau `À emporter`.
4. Adaugă produse la bon și ajustează cantitățile.
5. Creează o rezervare manuală.
6. Confirmă, anulează și marchează `no_show`.
7. Verifică mesajele și notificările clientului.

### Owner

1. Intră în `/owner` cu `owner / owner123!`.
2. Verifică portofoliul global.
3. Testează notificările din header și din blocul de onboarding.
4. Verifică pachetele și facturile.
5. Schimbă `plan`, `status` și modulele unui restaurant.
6. Verifică auditul global.

## Cum testezi de la zero până acum

Ordinea corectă de verificare este asta:

1. Rulează `npm install`.
2. Rulează `npm run dev`.
3. Deschide pagina principală și verifică logo-ul și navbar-ul.
4. Intră în pagina publică a restaurantului și schimbă limba.
5. Deschide QR-ul și verifică unde duce.
6. Deschide PDF-ul A3 și verifică aspectul de meniu printabil.
7. Intră în `/dashboard` cu `raych / raychone!`.
8. Creează sau dezactivează un user staff.
9. Schimbă planul, statusul și modulele comerciale.
10. Verifică auditul managerului.
11. Intră în `/staff` cu `user / pass123!`.
12. Selectează o masă sau `takeaway`.
13. Adaugă produse în bon și schimbă cantitățile.
14. Creează o rezervare manuală și confirm-o.
15. Închide / anulează / marchează `no_show` o rezervare.
16. Intră în `/owner` cu `owner / owner123!`.
17. Verifică restaurantele, planurile, statusurile și modulele.
18. Verifică facturile și filtrele de status.
19. Verifică auditul global.
20. Testează notificarea cu providerul ales.
21. Rulează testele pe roluri, apoi notează ce UI/UX ți se pare greoi.
