# Review Action Plan

## Scop
Acest document transformă observațiile din `review.md` într-un plan de execuție clar.

Nu este un roadmap de marketing. Este un plan de lucru pragmatic pentru a ridica aplicația de la demo puternic la produs mai matur.

---

## Principiu de prioritizare
Ordinea corectă este:
1. stabilitate operațională
2. claritate UX în fluxurile critice
3. consistență UI
4. simplificare tehnică
5. extinderi noi

Dacă ordinea este inversată, produsul va arăta mai bine, dar va deveni mai greu de folosit și mai greu de întreținut.

---

# 1. Must Fix

## 1.1 Staff flow pentru mese, bonuri și rounds
### Obiectiv
Fluxul `staff` trebuie să devină imposibil de interpretat greșit.

### Probleme actuale
- prea multe stări și acțiuni pe același ecran
- bonuri multiple pe aceeași masă sunt sensibile
- round nou după trimiterea în kitchen trebuie să fie clar separat
- relația dintre `table`, `bon`, `queue`, `service`, `payment` trebuie să fie explicită

### Ce trebuie făcut
- definește model clar de `round` / `order batch` per masă
- separă vizual în modal:
  - `bon activ`
  - `round-uri anterioare`
  - `actions service`
  - `payment`
- interzice acțiuni incompatibile pe status greșit
- adaugă un singur flux explicit:
  - `nouveau bon`
  - `envoyer cuisine`
  - `prêt`
  - `servi`
  - `encaisser`

### Output concret
- refactor `src/components/staff-client.tsx`
- logică separată pentru round-uri / bonuri
- teste E2E dedicate pentru multiple rounds pe aceeași masă

---

## 1.2 Client → staff → kitchen → client trebuie să fie 100% coerent
### Obiectiv
Orice comandă trebuie să aibă un traseu clar și sincronizat între roluri.

### Probleme actuale
- unele stări ajung la client dar nu apar suficient de clar în staff
- unele adăugări de articole la o comandă deja expediată sunt sensibile
- există risc de nealiniere între ce vede kitchen și ce vede ospătarul

### Ce trebuie făcut
- definește statusuri formale pentru bon și pentru fiecare round
- documentează exact tranzițiile permise
- verifică ca toate rolurile citesc aceeași sursă de adevăr
- testează explicit:
  - prima comandă
  - a doua comandă pe aceeași masă
  - ready parțial / ready complet
  - served
  - payment

### Output concret
- contract de statusuri în cod
- reducer/helper dedicat pentru stările bonului
- test Playwright dedicat pentru comenzi multiple pe aceeași masă

---

## 1.3 Refactor componente mari
### Obiectiv
Reducerea riscului de regresii și a costului de schimbare.

### Componente prioritare
- `src/components/staff-client.tsx`
- `src/components/client-portal.tsx`
- `src/components/dashboard-client.tsx`

### Ce trebuie făcut
- extrage secțiuni mari în subcomponente
- extrage logică de business în helpers/hooks
- separă clar:
  - UI
  - state local
  - transformări de date
  - acțiuni API

### Output concret
- fișiere mai mici
- hooks dedicate
- logică testabilă fără UI complet

---

## 1.4 Design system minim unificat
### Obiectiv
Aplicația trebuie să pară un singur produs cu teme diferite, nu mai multe aplicații lipite.

### Probleme actuale
- `Noir 1` și `Food 1` au direcții bune, dar încă neuniforme
- unele ecrane admin folosesc convenții diferite de public/client/staff
- culorile nu au mereu aceeași semantică

### Ce trebuie făcut
- definește tokens de bază:
  - background
  - surface
  - border
  - text primary / secondary
  - success / warning / danger
  - active tab
  - CTA primary / secondary
- definește reguli clare:
  - roșu = alertă / critic / anulare
  - verde = succes / acțiune pozitivă / confirmare calmă
  - negru = accent premium, nu stare critică

### Output concret
- tokens în `globals.css` sau layer dedicat
- audit de componente pentru culori și stări

---

# 2. Should Fix

## 2.1 UX rezervări unificat peste tot
### Obiectiv
Același nivel de calitate pentru rezervări în public, client și staff.

### Ce trebuie făcut
- același calendar UX
- același time slot UX
- aceleași convenții pentru telefon și persoane
- aceeași semantică pentru disponibilitate mese

### Output concret
- componentă comună de booking UI
- eliminarea duplicării de UX între public și staff

---

## 2.2 Simplificarea paginii client
### Obiectiv
Clientul trebuie să înțeleagă instant ce are de făcut.

### Probleme actuale
- prea multe blocuri pot concura vizual
- loyalty, split, status, coș, service, profil trebuie mai bine ierarhizate

### Ce trebuie făcut
- prioritizează `ce faci acum`
- mută informațiile auxiliare mai jos sau în taburi secundare
- păstrează vizibil doar:
  - status comandă
  - coș / comandă curentă
  - call waiter
  - total/restant

### Output concret
- client portal mai simplu pe mobile
- mai puține blocuri simultan vizibile

---

## 2.3 Kitchen grouping mai clar
### Obiectiv
Kitchen trebuie să înțeleagă instant ce este nou, ce este continuare și ce este gata.

### Ce trebuie făcut
- grupează pe masă
- dar separă clar round-urile
- marchează explicit `nouveau round`
- evită orice ambiguitate între articole vechi și articole noi

### Output concret
- grouping UI mai bun în `kitchen-client`
- indicator clar de prioritate și noutate

---

## 2.4 Manager dashboard mai modular
### Obiectiv
Managerul nu trebuie să simtă că editează un panou admin generic.

### Ce trebuie făcut
- grupează pe secțiuni reale de business:
  - branding
  - menu
  - booking
  - users
  - modules
  - analytics / audit
- reduce densitatea form-urilor
- adaugă affordance clar pentru `save`, `draft`, `published` unde are sens

### Output concret
- dashboard mai ușor de parcurs
- onboarding mai clar pentru manager nou

---

# 3. Nice To Have

## 3.1 Landing premium
### Obiectiv
Landing-ul să fie nu doar clar, ci și memorabil.

### Ce trebuie făcut
- mai puțin text
- mai bună ierarhie vizuală
- ilustrații/flow mai premium
- demo entry și mai direct

---

## 3.2 Microinteracțiuni și feedback
### Ce trebuie făcut
- loading states mai consistente
- success/error feedback mai uniform
- confirmări scurte și clare pentru acțiuni critice

---

## 3.3 Export / reporting mai bune
### Ce trebuie făcut
- rapoarte simple pentru owner/manager
- sumar rezervări/comenzi/plăți pe interval
- dashboard mai orientat pe operațiune, nu doar pe configurare

---

# 4. Technical Debt Plan

## Faza A — imediat
- spargere `staff-client.tsx`
- spargere `client-portal.tsx`
- helper separat pentru order state transitions
- helper separat pentru reservation UI state

## Faza B — după stabilizare UX
- component library intern minim
- hooks comune pentru realtime / status / data refresh
- separare mai clară între API payload mapping și UI rendering

## Faza C — dacă produsul merge comercial
- storage real persistent
- model multi-tenant mai strict
- auth/session hardening
- audit și billing cu infrastructură reală

---

# 5. Ordinea corectă de execuție

## Sprint 1
- staff flow / rounds / payment / service
- kitchen grouping
- status contract pentru comenzi
- tests pentru multiple rounds

## Sprint 2
- design system minim
- client simplification
- booking UX shared component

## Sprint 3
- dashboard modularization
- owner clarity improvements
- landing premium pass

## Sprint 4
- refactor tehnic mai agresiv
- storage / persistence plan
- production-hardening plan

---

# 6. Ce nu aș face acum

Nu aș face încă:
- noi module comerciale majore
- analytics complexe
- AI features
- extinderi owner mari
- marketplace / integrații exotice

Motivul este simplu: produsul are deja suficientă funcționalitate. Ce lipsește acum este claritatea și robustețea în fluxurile critice.

---

# 7. Rezumat executiv

Dacă vrei impact maxim, ordinea corectă este:

1. `staff` și fluxul de bonuri / rounds
2. sync perfect client ↔ staff ↔ kitchen
3. design system unificat
4. simplificare client
5. refactor componente mari
6. dashboard modularizare
7. production-grade persistence

Asta va transforma produsul din:
- demo foarte bun

în:
- produs mult mai credibil pentru utilizare reală.
