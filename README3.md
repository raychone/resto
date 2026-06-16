# Resto SaaS — Review general

Acesta este documentul de prezentare al aplicației, scris ca pentru un review de produs.
Scopul lui este să explice clar ce face aplicația, pentru cine este, cum arată fluxurile reale și cum poate fi testată rapid.

---

## 1. Ce este aplicația

Aplicația este un SaaS pentru restaurante, construit pentru un flux complet:

- meniu digital pe QR
- comandă din client
- validare de către ospătar
- coadă de bucătărie
- servire la masă
- rezervări
- loyalty pentru client
- facturare și planuri comerciale
- administrare per restaurant
- audit

Este gândită pentru restaurante mici, medii și operatori care vor să poată vinde produsul mai departe către mai multe locații.

---

## 2. Ce problemă rezolvă

Aplicația rezolvă câteva probleme concrete din restaurante:

- meniul se poate actualiza rapid fără reprint
- clientul poate comanda din QR
- ospătarul vede imediat ce a comandat clientul
- bucătăria primește comenzile clar
- managerul vede meniul, auditul și utilizatorii restaurantului
- owner-ul vede toate restaurantele și poate activa / dezactiva modulele
- rezervările și comenzile sunt sincronizate pe aceeași masă

---

## 3. Arhitectura pe roluri

### Owner

Owner-ul este nivelul global.

Poate:

- vedea toate restaurantele
- crea restaurante noi
- seta planul și statusul restaurantului
- activa / dezactiva module per restaurant
- vedea facturile
- vedea auditul global
- configura notificările

### Manager

Managerul este legat de un singur restaurant.

Poate:

- edita meniul
- schimba prețuri
- seta happy hour
- vedea auditul restaurantului
- crea, dezactiva și reseta useri staff
- vedea rezervările
- vedea statusul operațional al restaurantului

### Staff

Staff-ul este legat de un singur restaurant și vede doar ce trebuie pentru operare.

Poate:

- vedea mesele
- vedea alertele de la clienți
- vedea comenzile QR
- adăuga produse pe bonul mesei
- confirma comenzi către bucătărie
- marca servirea
- încasă
- răspunde la cererile clientului

### Kitchen

Bucătăria vede doar comenzile trimise la preparare.

Poate:

- vedea coada de comenzi
- marca `preparing`
- marca `ready`
- semnala când comanda e gata

### Client

Clientul vede:

- meniul
- coșul
- comanda curentă
- nota live a mesei
- loyalty
- statusul comenzii

Poate:

- adăuga produse
- trimite comanda
- chema ospătarul
- se loga cu e-mail/parolă sau Google
- face signup

---

## 4. Fluxul principal

Fluxul principal pentru restaurant este:

1. clientul scanează QR
2. vede meniul
3. adaugă produse în coș
4. se loghează sau își creează cont
5. trimite comanda
6. ospătarul validează fizic comanda
7. comanda intră în bucătărie
8. bucătăria o prepară
9. ospătarul primește notificare când e gata
10. ospătarul servește masa
11. comanda este marcată `served`
12. la încasare se actualizează și loyalty-ul

---

## 5. Ruta principală pentru demo

Restaurantul demo principal este:

- `Noir 1`
- slug: `bar-1`

Rutele importante sunt:

- landing page: `http://localhost:3000`
- meniu public: `http://localhost:3000/r/bar-1?lang=fr`
- QR: `http://localhost:3000/qr/bar-1`
- client: `http://localhost:3000/client`
- client signup: `http://localhost:3000/client/signup`
- staff: `http://localhost:3000/staff`
- kitchen: `http://localhost:3000/kitchen`
- dashboard manager: `http://localhost:3000/dashboard`
- owner: `http://localhost:3000/owner`

---

## 6. Credentiale demo

- owner: `owner / owner123!`
- manager: `manager / manager123!`
- staff: `user / pass123!`
- kitchen: `kitchen / kitchen123!`
- client: `client / client123!`

---

## 7. Ce vede utilizatorul final

### În public

Clientul vede:

- un landing page clar
- un meniu dark, mobile-first
- categorie în acordeon
- produse listate simplu
- modal de produs cu detalii
- QR direct spre meniu

### În client

Clientul vede:

- meniu în aplicație
- coș
- note live
- statusul comenzii
- loyalty
- split de notă
- buton de apel ospătar

### În staff

Staff-ul vede:

- alertele pe mese
- comenzile QR
- bonul activ
- meniul rapid
- statusurile din kitchen
- masa activă și bonul asociat

### În kitchen

Bucătăria vede:

- comenzile primite
- ce este în lucru
- ce e gata
- ce a fost servit

### În manager

Managerul vede:

- restaurantul lui
- meniul
- auditul
- staff-ul
- rezervările
- setările restaurantului

### În owner

Owner-ul vede:

- toate restaurantele
- planuri
- module
- notificări
- facturi
- audit global

---

## 8. Modulul restaurantului

Aplicația are un modul per restaurant care poate fi pornit sau oprit.

Owner-ul poate controla:

- order flow
- booking
- QR
- WhatsApp
- SMS
- Google Reviews
- Uber Eats
- TripAdvisor

Dacă modulul este oprit, secțiunile aferente dispar din UI.

---

## 9. Identitatea restaurantului

Fiecare restaurant are:

- `id` intern
- `slug` pentru URL
- nume
- status comercial
- plan
- logo
- adresa
- telefon
- program
- meniuri traduse

Restaurantele demo sunt configurate pe un model de tip production-ready, nu doar mock static.

---

## 10. Meniul public

Meniul public este construit ca pentru un restaurant real:

- dark theme
- mobile-first
- acordeoane curate
- itemii se deschid în modal
- prețurile sunt afișate corect
- happy hour are preț redus
- QR duce direct la meniul web

Pe `Noir 1`, rezervarea este oprită, deci `Réserver une table` nu apare.

---

## 11. Rezervări

Rezervările sunt separate de meniul public.

Flux:

- clientul alege data
- alege numărul de persoane
- alege ora
- trimite rezervarea
- staff-ul vede cererea
- staff-ul confirmă / anulează / marchează `no_show`

Rezervările sunt controlate per restaurant.

---

## 12. Notificări și sincronizare

Aplicația are flux de notificări pentru:

- comandă nouă
- apel ospătar
- comandă gata
- servire
- rezervare nouă
- rezervare confirmată

Notificările pot apărea:

- în browser
- în staff
- în kitchen
- în client

Există și fallback-uri comerciale:

- Android / device restaurant
- WhatsApp Business
- Twilio

---

## 13. Loyalty și client account

Clientul are:

- login
- signup
- Google OAuth
- loyalty tier
- puncte
- split de notă
- istoric pe masă

Loyalty-ul este pregătit pentru:

- Bronze
- Silver
- Gold
- Platinum

---

## 14. Management și audit

Managerul și owner-ul pot vedea auditul.

Auditul acoperă:

- rezervări
- modificări de meniu
- statusuri de comandă
- încasări
- acțiuni staff

Staff-ul nu vede auditul.

---

## 15. Facturare și planuri

Owner-ul poate:

- crea facturi
- filtra facturi
- seta planuri
- seta status comercial
- activa module
- vinde setup + mentenanță

Există și presete rapide:

- Starter
- Pro
- Premium

---

## 16. Cum arată UX-ul

Direcția de UX este:

- mobile first
- rapid
- clar
- dark theme în zonele operaționale
- statusuri evidente
- taburi sticky
- conținut accesibil fără scroll inutil

---

## 17. Ce trebuie verificat într-un review

Dacă vrei să dai aplicația unui review real, urmărește:

1. meniul public se deschide rapid
2. QR-ul duce direct la meniu
3. rezervarea funcționează unde este activată
4. clientul poate comanda din portal
5. staff-ul vede aceeași masă ca clientul
6. bucătăria primește aceeași comandă
7. notificările se propagă corect
8. managerul vede audit și meniu
9. owner-ul poate controla tot portofoliul
10. modulele per restaurant funcționează

---

## 18. Ce este important pentru clientul final

Pentru un patron de restaurant, valoarea principală este:

- mai puține erori la comandă
- timp mai scurt de servire
- meniu ușor de schimbat
- rezervări și comenzi într-un singur loc
- staff mai organizat
- audit și control
- posibilitate de a vinde sistemul altor restaurante

---

## 19. Stare actuală

Aplicația este deja funcțională pe:

- public
- client
- staff
- kitchen
- manager
- owner

Are deja:

- meniu digital
- QR
- rezervări
- comenzi
- loyalty
- split de notă
- audit
- facturare
- module per restaurant

---

## 20. Concluzie

Proiectul este un SaaS complet pentru restaurante, cu:

- flux operativ real
- roluri distincte
- control per restaurant
- design orientat pe mobil
- panouri clare pentru staff și manager
- management global pentru owner

Demo-ul principal este `Noir 1`, iar acesta este punctul de referință pentru testare și review.
