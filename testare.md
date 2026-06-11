# Testare aplicație — checklist practic

Acesta este ghidul de testare manuală pentru aplicația curentă. Urmează pașii în ordinea de mai jos.

## 0. Înainte să începi

1. Rulează aplicația local cu `npm run dev`.
2. Deschide browserul la `http://localhost:3000`.
3. Dacă ai sesiuni vechi, fă logout din toate rolurile.
4. Dacă vezi date vechi sau un restaurant lipsă, oprește și repornește `npm run dev`.

## 1. Testare publică

### 1.1 Pagina principală

1. Deschide `http://localhost:3000`.
2. Verifică dacă logo-ul Noir 1 se vede corect.
3. Verifică dacă navbar-ul este sticky și dark.
4. Verifică dacă logo-ul este în stânga, `Menu` este centrat și selectorul de limbă este în dreapta.
5. Verifică că `Reserve` nu apare pe demo-ul `Noir 1`.

### 1.2 Pagina restaurantului

1. Deschide `http://localhost:3000/r/bar-1?lang=fr`.
2. Verifică dacă pagina este în franceză.
3. Schimbă limba în `en`.
4. Schimbă limba în `it`.
5. Schimbă limba în `es`.
6. Verifică dacă textul, butoanele și meniul se schimbă corect.
7. Apasă butonul `Program` din secțiunea dedicată a paginii și verifică modalul cu orarul.
8. Închide modalul.
9. Dacă testezi un restaurant cu booking activ, apasă `Reserve` și verifică dacă se deschide modalul de rezervare.
10. Verifică dacă butoanele Google Maps și Waze trimit spre adresa restaurantului.
11. Verifică dacă meniul se deschide ca acordeon pe categorii.
12. Dacă testezi demo-ul `Noir 1`, verifică dacă vezi categoriile `Happy Hour 6:30pm - 8:30pm`, `Draft Beers`, `Aperitifs`, `Cocktails & Mocktails`, `Whiskies` și restul listelor de bar.
13. Verifică dacă lista de produse arată ca o listă curată, fără carduri, iar în listă apar doar numele și prețul din dreapta.
14. Verifică dacă prețurile sunt corecte față de seed-ul de bar și că la happy hour apare doar prețul aplicat acum.
15. Apasă pe un preparat și verifică dacă se deschide modalul cu imagine, descriere, recipe, ingrediente, alergeni și butonul `X`.
16. Verifică dacă signature apare pe imagine în modal, nu ca badge separat.
17. Verifică dacă meniul public folosește fundal întunecat și text deschis pe mobil.
18. Verifică dacă cardul de happy hour din hero arată countdown-ul live cu secunde în linia principală și că nu mai repetă textul jos.
19. Verifică faptul că butonul `Reserve` nu apare pe demo-ul `Noir 1`.

### 1.3 QR și PDF

1. Deschide `http://localhost:3000/qr/bar-1`.
2. Verifică dacă QR-ul deschide direct meniul web și dacă logo-ul este suprapus în centru.
3. Deschide `http://localhost:3000/pdf/bar-1` doar dacă vrei varianta de print.
4. Verifică dacă meniul PDF se vede în format A3.
5. Verifică dacă PDF-ul are doar conținutul dorit, fără elemente inutile.
6. Verifică dacă pe pagina publică nu apare textul explicativ de sub QR.
7. Verifică dacă QR-ul deschide direct `/r/bar-1`.

### 1.4 Rezervare publică

1. Din pagina publică, deschide modalul de rezervare.
2. Selectează o dată din calendar.
3. Selectează numărul de persoane.
4. Selectează o oră disponibilă.
5. Completează:
   - prenume
   - nume
   - telefon
   - email
   - mesaj pentru staff
6. Trimite cererea.
7. Verifică mesajul de confirmare de succes.

## 2. Testare manager

### 2.1 Login

1. Deschide `http://localhost:3000/dashboard`.
2. Loghează-te cu:
   - user: `raych`
   - parolă: `raychone!`
3. Verifică dacă vezi doar restaurantul tău.
4. Verifică dacă interfața este pe tema dark / whitesmoke.

### 2.2 Restaurant settings

1. Verifică numele restaurantului.
2. Verifică adresa și telefonul.
3. Verifică logo-ul și imaginea principală.
4. Verifică programul.
5. Verifică datele de contact.

### 2.3 Meniu

1. Deschide secțiunea meniului.
2. Schimbă un preț.
3. Schimbă descrierea unui produs.
4. Schimbă ingredientele.
5. Schimbă alergenii.
6. Setează un produs pe `happy hour` și modifică prețul redus.
7. Verifică dacă modificarea apare în pagina publică.

### 2.4 Staff users

1. Deschide cardul de utilizatori staff.
2. Creează un user nou.
3. Dă-i username și parolă temporară.
4. Verifică dacă `mustChangePassword` este activ.
5. Dezactivează userul.
6. Reactivează userul.
7. Resetează parola userului.

### 2.5 Creare restaurant

1. În blocul `Nouveau restaurant`, completează numele restaurantului.
2. Completează un slug public, de exemplu `bar-1-test`.
3. Completează managerul și/sau staff-ul inițial.
4. Apasă `Créer le restaurant`.
5. Verifică dacă noul restaurant apare în listă.
6. Verifică dacă userii inițiali apar în lista de staff a restaurantului creat.

### 2.6 Audit

1. Deschide `Historique`.
2. Verifică dacă vezi acțiuni de modificare.
3. Verifică dacă apar confirmări, anulări și modificări de meniu.
4. Verifică dacă staff-ul nu are acces la audit.

### 2.7 Modules

1. Schimbă `plan` între `starter`, `pro`, `premium`.
2. Schimbă `status` între `lead`, `trial`, `active`, `suspended`, `closed`.
3. Activează / dezactivează:
   - booking
   - QR mode
   - WhatsApp
   - SMS
   - Google Reviews
4. Apasă `Sauver les modules`.
5. Verifică dacă modificările se păstrează după refresh.

## 3. Testare staff

### 3.1 Login

1. Deschide `http://localhost:3000/staff`.
2. Loghează-te cu:
   - user: `user`
   - parolă: `pass123!`
3. Verifică dacă staff-ul este legat de un restaurant valid.
4. Dacă vrei să testezi barul demo, folosește `Noir 1` din `/owner`.
5. Verifică dacă itemele cu happy hour ajung în bon la prețul redus.

### 3.2 Mese și bon

1. Verifică dacă vezi mesele restaurantului.
2. Selectează o masă.
3. Deschide bonul activ.
4. Adaugă un produs din meniu.
5. Mai adaugă încă o dată același produs.
6. Mărește și micșorează cantitatea.
7. Șterge un item.
8. Verifică dacă bonul rămâne corect.
9. Închide bonul și verifică dacă apare toast-ul de succes cu masa, metoda și suma.

### 3.3 Takeaway

1. Selectează `À emporter`.
2. Creează un bon fără masă.
3. Adaugă produse.
4. Verifică dacă bonul se salvează corect.

### 3.4 Rezervări

1. Deschide lista de rezervări.
2. Creează o rezervare manuală.
3. Confirmă rezervarea.
4. Anulează rezervarea.
5. Marcheaz-o `no_show`.
6. Șterge o rezervare.
7. Verifică dacă statusurile se reflectă corect.

### 3.5 Mesaje și notificări

1. Deschide cererile de rezervare.
2. Verifică dacă vezi mesajele clienților.
3. Apasă butonul de notificare.
4. Verifică dacă se deschide SMS / WhatsApp / fallback-ul corect.
5. Verifică dacă mesajul conține rezumatul rezervării sau al confirmării.

## 4. Testare owner

### 4.1 Login

1. Deschide `http://localhost:3000/owner`.
2. Loghează-te cu:
   - user: `owner`
   - parolă: `owner123!`
3. Verifică dacă vezi toate restaurantele.
4. Verifică dacă poți crea un restaurant nou cu manager și staff inițial.

### 4.2 Portofoliu

1. Verifică numărul de restaurante.
2. Verifică numărul de rezervări active.
3. Verifică numărul de QR active.
4. Verifică numărul de SMS active.
5. Verifică totalul facturat.
6. Deschide `/r/bar-1` și verifică meniul dark, acordeoanele curate și prețurile bar.

### 4.3 Test rapid notificări

1. În headerul owner, selectează un restaurant.
2. Apasă `Tester notification`.
3. Verifică dacă se deschide composerul sau se trimite automat notificarea.
4. Verifică mesajul de rezultat.

### 4.4 Onboarding notifications

1. Intră în blocul `Onboarding notifications`.
2. Verifică dacă pașii sunt clari.
3. Folosește butonul `Aller aux modules`.
4. Folosește butonul `Aller au test`.
5. Testează încă o dată notificarea.

### 4.5 Facturi

1. Verifică lista de facturi.
2. Filtrează după status.
3. Verifică preseturile `Starter / Pro / Premium`.
4. Creează o factură.
5. Schimbă statusul unei facturi.
6. Șterge o factură.

### 4.6 Control comercial

1. Schimbă `plan` pentru un restaurant.
2. Schimbă `status` pentru un restaurant.
3. Activează / dezactivează modulele.
4. Verifică dacă setările se salvează.

## 5. Ce trebuie notat după test

După ce termini testarea, notează:

1. ce e lent
2. ce e greu de înțeles
3. ce e prea aglomerat pe mobil
4. ce e prea aglomerat pe desktop
5. ce butoane nu sunt clare
6. ce flux trebuie simplificat

## 6. Ordinea recomandată de testare

1. Public
2. Manager
3. Staff
4. Owner
5. Notificări
6. Facturi
7. Audit
8. Revenire cu feedback UI / UX
