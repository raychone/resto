# Plan etapizat pentru a transforma aplicația într-un produs 100% funcțional și vandabil

## Obiectiv
Scopul nu este doar să „meargă”. Scopul este să ajungă la un nivel în care:
- funcționează robust în utilizare reală
- este ușor de explicat și demo-uit
- poate fi vândut fără să creeze neîncredere operațională
- poate fi instalat și întreținut cu cost rezonabil

Asta înseamnă că trebuie să lucrăm simultan pe 4 axe:
1. produs
2. operațiuni reale
3. UX/UI
4. infrastructură și fiabilitate

---

# Faza 0 — Definirea produsului vândabil

## Obiectiv
Înainte de dezvoltare suplimentară, produsul trebuie încadrat clar.

## Ce trebuie decis
- pentru cine vinzi prima versiune:
  - baruri
  - restaurante casual
  - beach bars
  - coffee / bistro
- ce vinzi efectiv în prima versiune comercială:
  - meniu QR
  - rezervări
  - client ordering
  - kitchen flow
  - loyalty
  - owner dashboard
- ce NU intră în v1 comercială

## Decizie recomandată
Prima versiune vandabilă trebuie limitată la:
- public menu
- QR
- rezervări
- client ordering
- staff validation
- kitchen queue
- served / paid flow
- manager dashboard de bază
- owner onboarding minim

Aș scoate din mesajul comercial principal, temporar:
- prea mult accent pe billing intern
- prea mult accent pe modules avansate
- complexitate mare owner dacă nu e necesară în demo

## Livrabile
- listă clară de features v1
- listă clară de features v2
- poziționare comercială pe 1-2 tipuri de restaurante, nu pe toate deodată

---

# Faza 1 — Stabilizarea fluxurilor critice

## Obiectiv
Produsul trebuie să fie 100% predictibil în operațiunile de restaurant.

## Fluxuri critice
1. QR → menu → cart → submit
2. client order → staff confirm → kitchen → ready → served → paid
3. reservation → pending → confirmed/cancelled/no-show
4. table with multiple rounds
5. payment recording

## Ce trebuie făcut
- finalizezi modelul de `bon` / `round` / `order batch`
- faci imposibile tranzițiile greșite de status
- te asiguri că toate rolurile văd aceeași stare în același timp
- tratezi cazurile reale:
  - client adaugă din nou la aceeași masă
  - staff adaugă din meniu pe masă deja deschisă
  - kitchen primește încă o rundă pentru aceeași masă
  - staff servește parțial sau complet
  - se încasează după servire

## Standard de ieșire din fază
- niciun flux critic nu are comportament ambiguu
- toate cazurile de comandă multiple pe aceeași masă sunt testate
- toate rolurile rămân sincronizate

## Livrabile
- state machine clară pentru orders
- state machine clară pentru table rounds
- teste E2E pentru toate cazurile critice

---

# Faza 2 — UX/UI de nivel comercial

## Obiectiv
Produsul trebuie să fie ușor de folosit fără explicații lungi.

## Zone prioritare
- `staff`
- `client`
- `public menu`
- `manager`

## Ce trebuie făcut

### 2.1 Staff
- UI foarte clar pe mobil
- modal de masă complet și suficient
- minim de text, maxim de claritate
- acțiuni principale vizibile imediat
- statusuri și alerte imposibil de confundat

### 2.2 Client
- simplificare portal client
- coșul și comanda curentă devin prioritatea principală
- statusul comenzii să fie central și foarte clar
- `call waiter` și `pay` să fie ușor de găsit

### 2.3 Public menu
- finalizezi tema `Food 1` și `Noir 1` ca teme coerente
- elimini diferențele accidentale dintre ele
- optimizezi CTA-urile pentru conversie

### 2.4 Manager
- reduci senzația de „admin generic”
- grupare pe secțiuni business
- editarea meniului trebuie să fie intuitivă și rapidă

## Standard de ieșire din fază
- un utilizator nou poate naviga fluxurile principale fără explicații tehnice
- pe mobil, ecranele cheie nu par aglomerate
- produsul arată coerent vizual în toate rolurile

## Livrabile
- design system minim
- audit cromatic și semantic
- cleanup de spacing, badge-uri, CTA-uri și stări active

---

# Faza 3 — Arhitectură și mentenabilitate

## Obiectiv
Produsul trebuie să poată evolua fără să devină instabil.

## Probleme actuale
- componente prea mari
- logică UI + business prea amestecată
- risc mare de regresii la schimbări rapide

## Ce trebuie făcut
- spargi componentele mari:
  - `staff-client.tsx`
  - `client-portal.tsx`
  - `dashboard-client.tsx`
  - `owner-client.tsx`
- extragi hooks și helpers pentru:
  - order transitions
  - reservation state
  - payment flow
  - realtime updates
- separi clar:
  - prezentare
  - logică locală
  - logică de business
  - IO / fetch / mutation

## Standard de ieșire din fază
- componentele critice devin lizibile și ușor de modificat
- bugfix-urile nu mai cer schimbări în 4-5 zone simultan
- testele devin mai stabile

## Livrabile
- refactor incremental, nu big bang
- fișiere mai mici și mai specializate
- convenții clare de structură în repo

---

# Faza 4 — Persistență și model de producție reală

## Obiectiv
Trecerea de la demo puternic la produs deployabil.

## Probleme actuale
- seed-uri și store-uri locale sunt bune pentru demo, nu pentru operare reală
- concurența reală multi-device va cere persistență serioasă
- audit, orders, reservations și users au nevoie de model persistent real

## Ce trebuie făcut
- alegi stack-ul de date pentru producție
- introduci DB reală și persistare adevărată
- definești model multi-tenant strict
- migrezi treptat flow-urile critice:
  - users
  - restaurants
  - reservations
  - orders
  - payments
  - audit

## Standard de ieșire din fază
- datele supraviețuiesc restart-ului și deploy-ului
- mai multe sesiuni și device-uri lucrează robust pe același restaurant
- aplicația poate fi demo-uită și operată fără reset accidental de stare

## Livrabile
- schema de date
- migrare controlată
- fallback/backup plan

---

# Faza 5 — Hardening operațional

## Obiectiv
Produsul trebuie să reziste utilizării reale în restaurant.

## Ce trebuie făcut
- handling mai bun pentru erori de rețea
- retry și toasts clare
- loading states coerente
- protecție la acțiuni duble
- protecție la race conditions
- logging mai bun pentru incidente
- audit complet pentru acțiunile importante

## Exemple de cazuri care trebuie tratate
- două device-uri staff schimbă aceeași masă
- clientul trimite din nou comanda accidental
- kitchen marchează ready de două ori
- staff încearcă payment pe bon deja plătit
- reconnect după tab suspendat / telefon blocat

## Standard de ieșire din fază
- aplicația nu se rupe ușor în operațiuni repetitive
- erorile sunt lizibile și recuperabile
- echipa restaurantului nu ajunge „blocată” în UI

---

# Faza 6 — Pachet comercial v1

## Obiectiv
Produsul trebuie să poată fi vândut și instalat rapid.

## Ce trebuie pregătit

### 6.1 Pachete comerciale
Definești clar pachetele:
- Starter
- Pro
- Premium

Dar cu diferențe reale și simple:
- Starter: menu + QR + basic booking
- Pro: ordering + staff + kitchen + manager
- Premium: owner, loyalty, advanced modules, branding extins

### 6.2 Onboarding client
Trebuie să existe un proces standard de instalare:
- creare restaurant
- configurare branding
- adăugare meniu
- configurare mese
- configurare rezervări
- configurare notificări
- creare conturi staff/kitchen/manager
- test complet end-to-end

### 6.3 Checklist de livrare
Fiecare client nou trebuie instalat cu checklist clar:
- logo
- slogan
- ore
- telefon
- adresă
- links maps/delivery/reviews
- tables
- menu complet
- QR testat
- rezervare testată
- order flow testat

## Standard de ieșire din fază
- poți onboarda un restaurant în mod repetabil
- produsul poate fi prezentat și instalat fără improvizații

---

# Faza 7 — Vânzare și demo

## Obiectiv
Produsul trebuie să fie ușor de vândut.

## Ce trebuie făcut

### 7.1 Demo script
Ai nevoie de un demo script clar de 10-15 minute:
1. landing
2. QR
3. client order
4. staff validation
5. kitchen ready
6. client sees status
7. reservation flow
8. manager edit menu
9. owner overview

### 7.2 Demo environments curate
- `Noir 1` pentru bar
- `Food 1` pentru restaurant
- ambele curate și stabile
- fără stări haotice după demo-uri succesive

### 7.3 Material comercial
- 1 pagină ofertă
- 1 listă clară de beneficii
- 1 comparație cu metoda clasică
- 1 video scurt / capturi curate

## Standard de ieșire din fază
- poți face demo unui client fără să explici workaround-uri
- demo-ul spune clar „ce problemă rezolvă”

---

# Faza 8 — Prima implementare reală pilot

## Obiectiv
Un singur restaurant real, controlat, cu feedback activ.

## Cum trebuie făcut
- alegi un restaurant dispus să testeze
- instalezi doar v1 comercială
- nu activezi tot ce există în produs
- colectezi feedback 1-2 săptămâni
- măsori:
  - ce nu înțeleg staff-ul și managerul
  - unde se blochează clientul
  - ce acțiuni sunt prea lente
  - ce stări sunt neclare

## Standard de ieșire din fază
- primești feedback real din utilizare
- corectezi 5-10 probleme mari înainte de a încerca scalare

---

# Faza 9 — Scalare controlată

## Obiectiv
Treci de la pilot la produs repetabil.

## Ce trebuie făcut
- documentație internă
- procedură onboarding
- procedură suport
- procedură update
- procedură incident handling
- versioning clar pe feature-uri

## Standard de ieșire din fază
- poți instala 5-10 restaurante fără haos operațional

---

# Roadmap pragmatic pe 90 de zile

## Zilele 1-15
- finalizezi fluxurile critice staff/client/kitchen
- stabilizezi multiple rounds pe masă
- plăți și note în modal
- teste E2E complete pe cazuri grele

## Zilele 16-30
- cleanup UX/UI pentru staff și client
- design system minim
- booking UX unificat
- landing/demo simplificat premium

## Zilele 31-45
- refactor tehnic componente mari
- separare logică business/UI
- reducere risc regresii

## Zilele 46-60
- persistare reală și model de date solid
- multi-tenant hardening
- audit și payments robuste

## Zilele 61-75
- onboarding standard
- pachete comerciale clare
- demo script
- ofertă comercială

## Zilele 76-90
- pilot real
- feedback loop
- bugfix-uri de operațiune
- pregătire pentru primele implementări repetabile

---

# Ce înseamnă 100% funcțional
Pentru această aplicație, „100% funcțional” înseamnă:
- fiecare rol își poate termina munca fără workaround
- statusurile sunt coerente peste tot
- comenzile și rezervările nu se pierd
- acțiunile duble nu strică starea
- UI-ul este clar pe mobil
- aplicația rezistă utilizării reale într-un restaurant

---

# Ce înseamnă vandabil
Pentru această aplicație, „vandabil” înseamnă:
- poți explica produsul simplu în 2-3 minute
- demo-ul merge fără improvizații
- clientul vede imediat avantajul
- onboarding-ul este clar
- ai pachete simple
- nu promiți mai mult decât poți livra robust

---

# Prioritatea absolută
Dacă trebuie comprimat tot planul într-o singură propoziție:

**Mai întâi rezolvi impecabil operațiunile reale din restaurant, apoi ambalezi comercial produsul.**

Asta este ordinea corectă.
