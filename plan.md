# Plan produs — meniuri, rezervări, staff, manager, owner

## Obiectiv
Construiesc o platformă SaaS pentru restaurante mici și medii, cu:

- meniu public pe restaurant
- QR code per restaurant
- rezervări online
- pagină staff pentru operare zilnică
- dashboard manager pentru configurare restaurant și meniu
- dashboard owner pentru portofoliu, facturare și control global

Scopul este să fie ușor de clonat și branduit diferit pentru fiecare restaurant nou.

---

## Avancement

`Faza 1` ✅ `Faza 2` ✅ `Faza 3` ✅ `Faza 4` ✅ `Faza 5` ✅ `Faza 6` ✅

---

## Status general

`Faza 1` → `Faza 2` → `Faza 3` → `Faza 4` → `Faza 5` → `Faza 6`

- Faza 1 — model și scoping
- Faza 2 — users și parole
- Faza 3 — mese, bonuri și comenzi
- Faza 4 — restricții UI / API și audit
- Faza 5 — facturare și pachete
- Faza 6 — SMS, WhatsApp, polish și scalare

---

## Fazele planului

### Faza 1 — model și scoping

- `Restaurant` ca entitate principală
- `restaurantId` intern UUID
- `slug` doar pentru URL
- `RestaurantStatus`
- `plan`
- scoping strict pe restaurant pentru manager și staff

**Stare curentă:** modelul `Restaurant + User`, autentificarea pe useri reali, izolarea pe restaurant și managementul de staff sunt implementate; bonul activ pe masă este închis, iar auditul manager/owner este acum în lucru. Rezervările includ și statusul `no_show` în dashboard și staff.
Meniul public este orientat mobile-first, cu categorii dark tip acordeon/listă, fără count badge și fără „carduri” pentru variante; în listă apar doar numele și prețul, iar modalul de preparat este scrollabil la tap/click cu imagine, recipe și signature peste imagine. QR-ul duce direct la meniul web fără text explicativ.
Restaurantul demo principal este `Noir 1`, cu logo local noir și un seed complet pentru happy hour, beers, aperitifs, wines, cocktails, rums, whiskies, gins, vodkas, tequilas și digestifs. Happy hour-ul afișează un countdown live cu secunde, iar booking-ul este dezactivat pe demo-ul principal.

### Faza 2 — users și parole

- `User` cu roluri `owner` | `manager` | `staff`
- `restaurantId` pentru manager și staff
- `restaurantId = null` pentru owner
- `active / disabled`
- `temporaryPassword`
- `mustChangePassword`
- schimbare parolă în app
- reset doar din manager / owner
- staff creat de manager pentru restaurantul lui

### Faza 3 — mese, bonuri și comenzi

- `Table`
- `Order`
- `Payment`
- `OrderItem`
- selecția mesei
- bon activ pe masă
- ajustare cantități pe bon

**Stare curentă:** selecția mesei, bonul activ, adăugarea produselor din meniu, ajustarea cantităților și încasarea sunt implementate la nivel de bază pentru staff.

### Faza 4 — restricții UI / API și audit

- staff fără audit
- manager cu audit
- owner cu audit global
- scoping complet pe restaurant
- soft delete prin `deletedAt`
- `AuditLog` separat de datele operaționale
- rezervările suportă și statusul `no_show`

**Stare curentă:** auditul este separat, restaurant-scoped, și expus în dashboard-ul managerului + ownerului; rezervările suportă `no_show`; owner-ul poate ajusta `plan` și `status` pentru fiecare restaurant, poate activa/dezactiva modulele comerciale și are deja rezumat comercial cu setup / maintenance + filtre rapide + preseturi de facturare. Paginile publice au și metadata SEO / Open Graph. Urmează polish-ul de permisiuni și istorice.

### Faza 5 — facturare și pachete

- setup
- mentenanță
- domain
- DB
- QR
- booking
- SMS
- owner poate edita `plan` și `status` pentru fiecare restaurant
- owner poate activa / dezactiva modulele comerciale pe restaurant
- owner are facturi filtrabile pe status
- owner are rezumat pe setup / maintenance + coverage
- owner are separat setup / maintenance în sumarul comercial
- owner are preseturi `Starter / Pro / Premium` pentru facturi
- public pages au metadata SEO / Open Graph / canonical

**Stare curentă:** faza 5 este finalizată la nivel de produs; owner-ul are control pe plan, status, module comerciale, facturi filtrabile și preseturi rapide de facturare. Owner-ul poate crea acum și un restaurant nou împreună cu manager și/sau staff inițial.

### Faza 6 — SMS, WhatsApp, polish și scalare

- provider de notificări per restaurant, cu Android SMS ca implicit
- fallback Twilio / WhatsApp Business
- serviciul de notificări și link-urile sunt deja pregătite în aplicație
- cererile de rezervare trimit deja alerte către restaurant când providerul permite
- confirmarea rezervărilor poate declanșa notificări prin server sau composer Android
- owner are un panou de test pentru notificări per restaurant
- owner are și un test rapid în header cu selector de restaurant
- owner are și un onboarding compact pentru configurarea și testarea notificărilor
- staff-ul demo este remapat automat pe un restaurant valid la migrare
- ghid de instalare pentru Android și fallback-uri
- performanță
- SEO
- clonare rapidă pentru restaurante noi

**Stare curentă:** faza 6 este închisă la nivel de produs; providerul de notificări este pregătit în model, UI și serviciul server-side, owner-ul are test de notificări + test rapid în header + onboarding compact, iar Android SMS rămâne default cu fallback-uri Twilio / WhatsApp Business documentate.
Pe zona UI/UX, meniul public a fost refăcut pe stil dark mobile-first, cu detaliu de preparat în modal, iar produsele pot avea happy hour price redus.

---

## Principii de produs

- Fiecare restaurant este izolat de celelalte.
- `Owner` vede toate restaurantele.
- `Manager` vede doar restaurantul lui.
- `Staff` vede doar restaurantul lui.
- `Staff` nu vede audit.
- `Manager` vede audit.
- `Owner` vede audit, facturi și situația globală.
- Fără email și flow-uri complicate de reset la început.
- Parolele staff se schimbă direct în aplicație.
- Rezervările și comenzile trebuie să fie rapide pe mobile.

---

## Roluri și permisiuni

### Owner

Owner-ul este administratorul platformei.

Poate:

- vedea toate restaurantele
- vedea statistici globale
- vedea facturi de setup și mentenanță
- vedea ce module sunt active pe fiecare restaurant
- activa sau dezactiva opțiuni la nivel de restaurant
- vedea auditul global
- crea sau gestiona restaurante noi
- vedea statusul comercial al fiecărei clone

### Manager

Managerul administrează un singur restaurant.

Poate:

- edita numele, descrierea, logo-ul, culorile și contactele
- edita meniul, prețurile, ingredientele și alergenii
- activa sau dezactiva QR menu, booking, SMS, WhatsApp și Google Reviews
- seta linkuri Uber Eats și TripAdvisor per restaurant
- vedea auditul restaurantului
- crea, dezactiva și reseta utilizatori staff
- configura programul și capacitatea
- confirma / anula / șterge rezervări

Nu poate:

- vedea alte restaurante
- vedea facturi globale
- vedea conturile altor restaurante

### Staff

Staff-ul operează restaurantul în timpul serviciului.

Poate:

- vedea meniul complet al restaurantului lui
- vedea rezervările cerute
- vedea rezervările făcute
- vedea mesajele clienților
- crea rezervări manuale
- confirma / anula rezervări
- gestiona bonuri / comenzi active
- adăuga produse la comanda clientului
- marca un bon ca plătit / încasat

Nu poate:

- vedea audit
- vedea alte restaurante
- modifica setările restaurantului
- modifica meniul

---

## Model de utilizatori

### User

Toate conturile sunt în același sistem.

### Roluri

- `owner`
- `manager`
- `staff`

### Legarea de restaurant

Managerul și staff-ul sunt legați de un restaurant.

- `id`
- `restaurantId`
- `role`
- `name`
- `username`
- `passwordHash`
- `temporaryPassword` sau echivalent de setup
- `mustChangePassword`
- `status` = `active` | `disabled`
- `deletedAt`
- `createdAt`
- `updatedAt`
- opțional, pregătit pentru mai târziu:
  - `pinEnabled`
  - `pinHash`

### Reguli de legare

- `owner` are `restaurantId = null`
- `manager` are `restaurantId`
- `staff` are `restaurantId`
- un `manager` vede doar restaurantul lui
- un `staff` vede doar restaurantul lui
- `owner` vede toate restaurantele

### Reguli de cont

- Managerul creează userul staff.
- Userul primește parolă temporară.
- La primul login, dacă `mustChangePassword = true`, trebuie să schimbe parola.
- Fără email de reset la început.
- Dacă userul uită parola, managerul o resetează din dashboard.
- Staff-ul poate schimba doar propria parolă.
- Owner-ul poate reseta orice cont.

### Status user

- `active` — poate intra în aplicație
- `disabled` — nu mai poate intra, dar nu se șterge

Aceasta este importantă ca managerul să poată dezactiva un angajat fără să-i șteargă istoricul.

### Soft delete

- `deletedAt` se folosește în loc de ștergere fizică
- se aplică pentru:
  - rezervări
  - comenzi
  - utilizatori
- datele rămân recuperabile și auditabile

---

## Model de restaurant

Fiecare restaurant are propria configurație:

- date de branding
- meniu
- rezervări
- staff users
- QR
- auditurile lui
- facturi asociate

### Restaurant

Entitatea principală a sistemului.

- `id` UUID
- `slug`
- `name`
- `status`
- `plan`
- `createdAt`
- `updatedAt`
- `deletedAt` opțional

### Identitate internă

- `restaurantId` UUID
- `slug` doar pentru URL

### Status restaurant

- `lead`
- `trial`
- `active`
- `suspended`
- `closed`

### Plan restaurant

- `starter`
- `pro`
- `premium`

### Câmpuri importante

- `bookingEnabled`
- `qrMode` = `pdf` | `menu` | `off`
- `whatsappAlertsEnabled`
- `smsAlertsEnabled`
- `googleReviewsEnabled`
- `tableCount`
- `seatsPerTable`
- `weeklyHours`
- `restaurantStatus`
- `plan`
- `deletedAt`

### Ce pot controla aceste câmpuri

- `bookingEnabled`
  - afișează sau ascunde rezervarea pe public
- `qrMode`
  - `pdf` deschide PDF A3
  - `menu` deschide meniul web
  - `off` dezactivează QR-ul
- `whatsappAlertsEnabled`
  - pregătit pentru notificări pe WhatsApp
- `smsAlertsEnabled`
  - pregătit pentru SMS
- `googleReviewsEnabled`
  - afișează sau ascunde blocul Google Reviews
- `restaurantStatus`
  - ajută owner-ul să vadă statusul comercial al unei clone
- `plan`
  - pregătește activarea modulelor în funcție de abonament

### Soft delete restaurant

- dacă un restaurant este dezactivat, nu trebuie șters fizic
- `deletedAt` poate fi folosit și la nivel de restaurant, dacă vei avea nevoie de arhivare

---

## Rezervări

### Flux public

Clientul intră pe:

- `/r/[restaurantSlug]?lang=fr`
- `/r/[restaurantSlug]?lang=en`
- `/r/[restaurantSlug]?lang=it`
- `/r/[restaurantSlug]?lang=es`

Rezervarea se face într-un modal cu pași:

1. dată
2. număr persoane
3. oră
4. date client
5. confirmare finală

Datele cerute:

- prenume
- nume
- telefon
- email
- mesaj pentru staff

### Note interne per rezervare

Staff și manager pot adăuga note private, de exemplu:

- client dificil
- alergie arahide
- VIP
- vine cu câine

Aceste note sunt vizibile doar pentru staff / manager.

### Soft delete rezervări

- rezervările nu se șterg fizic
- se folosește `deletedAt`
- asta păstrează istoricul și auditul curat

### Flux staff / manager

- cererea apare în inbox
- staff vede cererile și rezervările
- manager vede cererile și auditul
- rezervarea poate fi:
  - `pending`
  - `confirmed`
  - `cancelled`
  - `no_show`

### Statusuri vizuale

- `pending` — portocaliu
- `confirmed` — verde
- `cancelled` — roșu
- `no_show` — gri sau neutral

### Reguli

- `Confirm` dispare după confirmare
- în loc rămân acțiuni relevante:
  - anulează
  - șterge
  - eventual modifică
- rezervările se sortează cu pending primele
- sus apar counters:
  - azi
  - în așteptare
  - confirmate
  - anulate
  - no-show

---

## Bonuri / comenzi

### Entități de bază

Trebuie pregătite de la început:

- `Table`
- `Order`
- `OrderItem`
- `Payment`
- `source`

### Model masă

Fiecare restaurant are propriile mese.

- `id`
- `restaurantId`
- `name` — de exemplu `Table 1`, `Terrasse 5`
- `zone` — de exemplu `Salle`, `Terrasse`, `Bar`
- `seats`
- `active`

### `source`

- `table`
- `takeaway`
- `phone`
- `qr`

### Status comandă

- `open`
- `sent_to_kitchen`
- `paid`
- `cancelled`

### Flux staff

- Staff intră în `/staff`.
- Alege masa înainte să adauge produse.
- Dacă masa are bon deschis, continuă bonul existent.
- Dacă masa nu are bon, se creează unul nou cu status `open`.
- Selectează produse din meniu cu un click.
- Poate modifica cantitățile.
- Poate șterge item-uri din bon.
- Poate adăuga o notă la item sau la bon.
- La final vede sumarul mesei și marchează:
  - `paid`
  - `paid_external`
  - `cancelled`

### Model minim recomandat

#### `Table`

- `id`
- `restaurantId`
- `name`
- `zone`
- `seats`
- `active`

#### `Order`

- `id`
- `restaurantId`
- `tableId` opțional
- `staffUserId`
- `status` = `open` | `paid` | `cancelled` | `archived`
- `openedAt`
- `closedAt`
- `deletedAt` opțional

#### `Payment`

- `id`
- `orderId`
- `restaurantId`
- `amount`
- `method` = `cash` | `card` | `split` | `external`
- `status` = `pending` | `paid` | `refunded`
- `createdAt`

### Reguli de plată

- `Order` și `Payment` sunt separate.
- O comandă poate avea mai multe plăți.
- Exemple:
  - 50€ cash
  - 50€ card
- `Order` poate fi `archived` ca să ascunzi istoricul fără să-l ștergi.

#### `OrderItem`

- `id`
- `orderId`
- `menuItemId`
- `nameSnapshot`
- `priceSnapshot`
- `quantity`
- `note`

### Soft delete comenzi

- comanda poate rămâne în istoric cu `deletedAt`
- nu șterge fizic datele operaționale

### Reguli importante

- `nameSnapshot` și `priceSnapshot` trebuie salvate în comandă.
- Comenzile vechi nu trebuie să se schimbe dacă meniul se modifică mai târziu.
- UI-ul staff trebuie să fie foarte simplu, rapid și clar pe tabletă / telefon.
- Masa nu trebuie să fie obligatorie.
- `source = takeaway` trebuie să funcționeze fără masă.

### Scop

Acest modul trebuie să acopere:

- comenzi la masă
- take-away
- comenzi telefonice
- comandă asociată QR
- selectarea mesei înainte de bon
- continuarea bonului existent al mesei
- finalizarea / încasarea bonului de masă

---

## Audit

### Ce trebuie să dispară din staff

- audit-ul nu apare în staff

### Ce trebuie să rămână pentru manager / owner

Auditul păstrează:

- cine a confirmat o rezervare
- cine a anulat o rezervare
- cine a încasat
- cine a modificat meniul
- cine a schimbat prețuri
- cine a creat / dezactivat useri
- cine a deschis sau închis un bon
- cine a marcat o masă ca încasată

### Audit separat

Auditul trebuie să fie într-un tabel dedicat:

- `AuditLog`
- `actorId`
- `restaurantId`
- `action`
- `entityType`
- `entityId`
- `createdAt`

### Ideea

Auditul este pentru control intern și rezolvarea greșelilor, nu pentru operațiunea zilnică a staff-ului.

---

## Facturare

Owner-ul trebuie să poată gestiona:

- factură de setup inițial
- factură de mentenanță
- domeniu
- bază de date
- QR menu
- booking
- SMS

### Entitate factură

Să existe:

- `Invoice`
- `InvoiceItem` sau echivalent simplificat
- `status`
- `periodLabel`
- `includeDomain`
- `includeDatabase`
- `includeQrMenu`
- `includeBooking`
- `includeSms`

### Status factură

- `draft`
- `sent`
- `paid`
- `cancelled`

---

## Clonare restaurant

Platforma trebuie să poată fi clonată ușor pentru un restaurant nou.

### La clonare trebuie să poată fi setat:

- branding diferit
- meniul diferit
- logo diferit
- QR diferit
- booking on/off
- QR mode on/off/pdf/menu
- WhatsApp alerts on/off
- SMS on/off
- Google Reviews on/off
- număr de mese
- număr de locuri per masă
- staff users proprii

### Obiectiv

Să fie ușor de vândut ca pachet:

- restaurant mic
- restaurant mediu
- restaurant cu mai multe mese și staff

---

## Ținte de performanță și SEO

### Performanță

- pagini ușoare
- conținut server-side unde are sens
- cât mai puțin state inutil pe client
- imagini optimizate
- layout stabil pe mobile

### SEO / Google

- URL-uri clare pe restaurant
- metadata corectă
- conținut indexabil pe pagina publică
- PDF A3 separat pentru imprimare
- pagini publice rapide și mobile-first

### UX

- public: clar, rapid, mobil-first
- staff: operare rapidă în service
- manager: setări și control
- owner: overview și facturare

---

## Ordinea de implementare

### Faza 1

- model `Restaurant + User`
- status `active / disabled`
- `temporaryPassword`
- `mustChangePassword`
- auth scoping pe restaurant

### Faza 2

- manager user management
- create / disable / reset staff
- login staff pe un singur restaurant
- seed și migrare curată

### Faza 3

- bon activ / orders
- `Table`, `Order`, `OrderItem`, `Payment`, `source`
- add-to-bon din meniu
- `+ / -` pentru cantități
- încasare / finalizare

### Faza 4

- restricții API și UI pe roluri
- staff fără audit
- manager cu audit
- owner cu overview global
- audit manager accordion
- audit global owner

### Faza 5

- facturare
- pachete setup / mentenanță
- opțiuni per restaurant

### Faza 6

- provider de notificări cu Android SMS implicit
- fallback Twilio / WhatsApp Business API
- ghid de instalare notificări
- polish final
- scalare pentru mai multe restaurante

---

## Reguli de implementare

- nu stric demo-ul existent
- păstrez compatibilitatea cu datele actuale
- adaug migrare sau normalizare unde e nevoie
- fac separare clară între roluri
- nu introduc email / reset links până nu există nevoie reală
- păstrez aplicația rapidă și simplă pentru restaurante mici
