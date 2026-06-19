# Plan v3 - Produs vandabil, mobile-first, fara a rupe ce exista

## Obiectiv
Transformarea aplicatiei intr-un produs clar, comercial si usor de demonstrat la restaurant.

Principiu de lucru:
- nu stric fluxurile deja functionale
- refactorizam prin stratificare, nu prin rescriere agresiva
- fiecare ecran trebuie sa aiba un singur scop principal
- totul trebuie sa fie mobile-first si full responsive pe telefon, tableta, laptop si desktop

## Criterii de succes
- managerul vede instant ce se intampla azi
- staff, client, kitchen, manager si owner au acelasi brand vizual
- pe mobil nu exista ecrane taiate sau aglomerate in stanga/dreapta
- managerul are navbar jos cu max 4 taburi utile pe toate device-urile
- meniul, rezervarile, auditul si setarile sunt separate clar
- UI-ul pare a fi pentru restaurante reale, nu admin generic

---

## Etapa 0 - Asezare si reguli de layout
Status: `completed`

### Obiectiv
Stabilim regula de baza pentru tot produsul: mobile-first, responsive, fara dezechilibru vizual.

### Ce facem
- managerul primeste navigatie consistenta pe toate device-urile
- pe mobil folosim navbar jos, nu panou lung
- evitam continutul lipit de stanga si „golul” din dreapta
- toate paginile critice au max-width si spacing coerent

### Livrabile
- shell responsive pentru manager
- reguli generale de spacing si density
- aliniere vizuala intre roluri

---

## Etapa 1 - Header de brand si status automat
Status: `completed`

### Obiectiv
Fiecare rol trebuie sa arate brandul restaurantului clar si usor de recunoscut.

### Ce facem
- logo-ul restaurantului in header stanga pentru `client`, `staff`, `kitchen`, `manager`
- numele restaurantului vizibil si clar
- badge mare `Ouvert / Fermé` calculat automat din program
- culori si stari consistente: verde pentru confirmare, rosu pentru alerta

### Livrabile
- header comun pe roluri
- status restaurant automat
- branding vizibil fara zgomot vizual

---

## Etapa 2 - Manager Dashboard comercial
Status: `completed`

### Obiectiv
Managerul trebuie sa inteleaga in 30 de secunde ce se intampla in restaurant.

### Ecranul principal
- Comenzi azi
- Rezervari azi
- Mese ocupate
- Valoare estimata
- Top 5 produse
- Urmatoarele rezervari
- alerte rapide

### Reguli
- dashboard-ul principal nu arata totul dintr-odata
- fara senzatie de BI sau panou tehnic
- doar date simple, comerciale, usor de explicat

### Livrabile
- layout de dashboard simplificat
- carduri mari si lizibile
- sumar operațional pentru patron

---

## Etapa 3 - Navbar manager jos, pe toate device-urile
Status: `completed`

### Obiectiv
Managerul foloseste acelasi tip de navigatie ca staff-ul: simpla, joasa, rapida.

### Taburi
- Dashboard
- Menu
- Reservations
- Settings

### Reguli
- pe mobil navbar jos
- pe desktop poate ramane sticky, dar compact
- fara mai mult de 4 taburi utile
- fara afisare simultana a tuturor sectiunilor

### Livrabile
- navbar manager unificat
- navigatie rapida si previzibila
- reducerea scroll-ului inutil

---

## Etapa 4 - Menu management modular
Status: `completed`

### Obiectiv
Meniul trebuie sa fie usor de editat, dar fara un ecran aglomerat.

### Reguli
- lista de categorii prima
- fiecare categorie se deschide separat
- editarea preparatului se face in modal
- buton de save clar si vizibil
- consum redus de spatiu pe mobil

### Cimpuri preparat
- nume
- descriere
- pret
- imagine
- ingrediente
- alergeni
- vizibil

### Livrabile
- editare de dish in modal
- categorii pliate / neaglomerate
- flux clar pentru adaugare si editare

---

## Etapa 5 - Reservations comercial si lizibil
Status: `completed`

### Obiectiv
Rezervarile sa fie simple de filtrat si actionat.

### Reguli
- rezervarile sunt doar in tabul `Reservations`
- filtre: today, pending, confirmed, cancelled, no-show
- carduri cu actiuni clare
- daca booking module e oprit, sectiunea nu apare

### Livrabile
- inbox rezervari lizibil
- stare si actiuni rapide
- UI pe scurt, fara densitate excesiva

---

## Etapa 6 - Restaurant Settings curate
Status: `completed`

### Obiectiv
Setarile trebuie sa fie grupate pe intentii reale, nu pe campuri brute.

### Seciuni
- General
- Opening hours
- Tables
- Links
- QR

### Reguli
- ascundem sectiunile care depind de module dezactivate
- afisam URL complet plus buton `Copier`
- pastram brandingul si statusul vizibile

### Livrabile
- setari mai curate
- campuri grupate pe carduri
- conditional rendering pe module

---

## Etapa 7 - Staff, kitchen, client si comenzi anonime
Status: `completed`

### Obiectiv
Toate rolurile trebuie sa arate ca apartin aceluiasi produs, iar clientii fara cont trebuie sa poata comanda in siguranta pe o masa clara.

### Reguli
- tema `Food 1` ramane light peste tot pentru acest restaurant
- stari active nu sunt black-on-black
- modalurile trebuie sa fie lizibile pe mobil
- butoanele de actiune importante au culori calme, nu agresive
- clientul anonim primeste un identifiant unic si poate comanda fara cont
- fiecare comanda anonima se leaga de o masa selectata explicit
- mai multi clienti pot imparti aceeasi masa, dar fiecare are propriul identificator si propriile articole
- ospatarul vede totalul pe masa si totalul pe persoana, inclusiv coplatitori
- clientii logati continua sa aiba fidelitate si abonament; anonimii nu acumuleaza puncte si nu au plan

### Livrabile
- consistenta vizuala pe roluri
- contrast corect
- mobile UX mai clar
- identitate de masa si identitate de client anonima
- selectie de masa la comanda si asociere clara cu bonul
- baza sigura pentru urmatoarele ecrane de audit si plata

---

## Etapa 8 - Audit umanizat
Status: `completed`

### Obiectiv
Auditul trebuie sa fie citibil pentru patron, nu pentru developer.

### Reguli
- mesajele tehnice se traduc in limbaj de business
- exemple:
  - Clientul de la Masa 1 a trimis o comanda
  - Bucataria a marcat comanda ca pregatita
  - Comanda a fost servita
  - Rezervare noua pentru 4 persoane

### Livrabile
- audit filtrabil
- mesaje intelese imediat
- afisare separata de dashboard-ul principal

---

## Etapa 9 - Linkuri si branding comercial
Status: `in_progress`

### Obiectiv
Managerul trebuie sa vada brandul si linkurile utile ca in produs comercial, nu ca in admin.

### Reguli
- logo vizibil sus
- restaurant name mare
- linkurile interne afisate complet
- buton de copiere
- QR si menu public usor de deschis

### Livrabile
- links section clara
- branding persistent
- prezentare comerciala mai buna

---

## Ordinea de implementare
1. Etapa 0
2. Etapa 1
3. Etapa 2
4. Etapa 3
5. Etapa 4
6. Etapa 5
7. Etapa 6
8. Etapa 7
9. Etapa 8
10. Etapa 9

## Regula de siguranta
Nu implementam urmatoarea etapa pana cand etapa curenta nu este stabilizata vizual si logic.
