# Fork-Notizen (gurkengraeber/nametag)

Diese Datei sammelt alles, was bei der Arbeit an diesem Fork von Nametag gelernt wurde, damit man (und Claude) auch
vom Handy aus nahtlos weitermachen kann. Sie gehört nur in diesen Fork, nicht in Pull Requests an das Originalprojekt.

## Regeln dieses Forks

- Originalprojekt: `mattogodoy/nametag`. Dieser Fork ist `gurkengraeber/nametag`.
- **Nie** etwas beim Original veröffentlichen (keine Pull Requests, Kommentare, Reviews, Issues), bevor der Besitzer des Forks
  es selbst getestet und freigegeben hat. Pushen geht nur auf den Fork.
- Die Branches `fix/carddav-fetch-by-url` und `feat/calendar-tab` hängen an offenen Pull Requests beim Original. Nicht erneut
  pushen, ohne dass der Besitzer es sagt, weil sich sonst der Pull Request ändert.
- Der Stil der App bleibt, wie er ist: ruhig, warm, persönlich (siehe "Design Context" in `CLAUDE.md`). Kein Redesign, nur vorhandene
  Tailwind-Tokens und Bausteine (`components/ui`, `EmptyState`, `PillSelector`, Modals) verwenden. Dunkel ist Standard, hell muss gleich gut sein.
- Der Besitzer arbeitet auch am Handy: jede Seite muss bei schmaler Breite funktionieren (Touch-Ziele mindestens 44 px, kein horizontales Scrollen).

## Projektregeln aus `CLAUDE.md`, die man leicht vergisst

1. Kein `any`.
2. Jeder neue Text in **allen** Dateien unter `locales/*.json` (11 Sprachen, Schlüsselbäume deckungsgleich). Verlustfrei ändern:
   JSON mit Python laden und mit `json.dumps(d, indent=2, ensure_ascii=False) + "\n"` zurückschreiben.
3. Keine Gedankenstriche (em-dash, en-dash) irgendwo. Auch nicht in Commit-Nachrichten.
4. Jede Prisma-Leseabfrage auf `Person`, `Group`, `Relationship`, `RelationshipType`, `ImportantDate` braucht `deletedAt: null`.
5. Neue oder geänderte API-Routen gehören in `lib/openapi/*.ts` (Test `tests/api/openapi-spec.test.ts`) und in `docs/src/content/docs/api/*.md`.
   Geändertes Verhalten gehört in `docs/src/content/docs/features/*.md`.
6. Keine neuen Fehlercodes erfinden, es gibt Wächtertests `tests/api/error-codes-*.test.ts`. `apiResponse` und `handleApiError` nutzen.
7. Die `CLAUDE.md` des Originals verbietet KI-Hinweise in Commits. Der Besitzer dieses Forks erlaubt sie ausdrücklich für den Fork
   (`Co-Authored-By`-Zeile). Vor einem Pull Request an das Original ist das neu zu entscheiden.

## Lokal ausprobieren (ohne echte Daten)

1. PostgreSQL 16 in einem Container starten (Port zum Beispiel 55433), Datenbank leer lassen.
2. Umgebung setzen: `DATABASE_URL`, `NEXTAUTH_SECRET`, `CRON_SECRET` (beliebige lange Zeichenketten), `NEXTAUTH_URL=http://localhost:3000`,
   `DISABLE_GEOCODING=true`.
3. `npx prisma migrate deploy`, dann ein Testkonto und erfundene Personen einspielen (Skript mit `bcryptjs` und `tsx`, Passwort nur aus einer
   Umgebungsvariable lesen, nicht ins Repo schreiben), dann `npm run dev`.
4. Beim Wechsel zwischen Testumgebungen gilt: Das Anmelde-Cookie von `localhost` bleibt bestehen. Zeigt die App ein fremdes Konto oder
   Fremdschlüssel-Fehler ("Foreign key constraint violated ... userId_fkey"), ist es ein altes Cookie: abmelden oder privates Fenster.

## Fallstricke (gelernt)

- **Turbopack und `node_modules`:** Ein Symlink auf ein `node_modules` außerhalb des Projektordners bricht `next dev` ("Symlink node_modules is invalid,
  it points out of the filesystem root"). Bei Git-Worktrees stattdessen `cp -al <alt>/node_modules <worktree>/node_modules` (Hardlinks, schnell, fast kein Platz).
- **Mehrere Worktrees:** Pro Aufgabe ein `git worktree`, damit ein laufender Testserver nicht durch einen Branchwechsel kaputtgeht.
- **Browser im Hintergrund:** Eine ausgeblendete Browser-Ansicht drosselt Timer und Animationen stark. Die d3-Simulation des Netzwerk-Diagramms tickt dort
  nur etwa ein Mal pro Sekunde. Für Messungen die Ansicht einblenden.
- **Schwere Befehle serialisieren:** `nice -n 15 flock /tmp/nametag-heavy.lock <befehl>`, `vitest` mit `--maxWorkers=2`, `tsc` mit
  `NODE_OPTIONS=--max-old-space-size=2560`. Mehrere parallele Läufe lassen Tests in Zeitüberschreitungen laufen, einzeln sind sie grün.
- **Git-Repository nie in einem Cloud-Sync-Ordner:** Ein Synchronisationsprogramm (hier pCloud) hat Dateien unter `.git/refs/heads/` überschrieben und
  "[conflicted]"-Kopien angelegt, dadurch sprang ein Branch mehrfach auf einen älteren Commit zurück (Dateien blieben unverändert, nur der Zeiger).
  Erkennbar an `Warnung: Ignoriere Referenz mit fehlerhaftem Namen ... [conflicted]` und an Merge-Fehlern "lokale Änderungen würden überschrieben".
  Abhilfe: Repository außerhalb des Sync-Ordners halten. Notfalls `git reset --soft <richtiger-commit>` (Arbeitsbaum und Index vorher mit `git diff <commit>` auf Gleichheit prüfen)
  und Pushes über feste Commit-Nummern machen (`git push fork <sha>:refs/heads/<branch>`). Sicherung der Commits: `git bundle create <datei> --branches` an einen Ort außerhalb des Sync-Ordners.
- **Projektordner verschoben oder kopiert:** Danach den Ordner `.next` löschen. Der Turbopack-Zwischenspeicher kennt den alten Pfad, `next dev` meldet im Log
  `FATAL: An unexpected Turbopack error` mit `Next.js package not found`, und die Seite lädt im Browser endlos neu (hunderte `GET`-Anfragen).
- **Bildschirmfotos automatisch:** `playwright-core` liegt im Projekt, auf dem Rechner genügt `chromium-browser` (`executablePath`, `--no-sandbox`). Nur **einmal** anmelden und die Sitzung
  mit `context.storageState` speichern: Der Server begrenzt Anmeldungen (HTTP 429 auf `/api/auth/callback/credentials`), viele Läufe mit Anmeldung sperren sich selbst aus
  (der Zähler steht im Arbeitsspeicher, ein Neustart des Servers setzt ihn zurück). Vor dem Ausfüllen des Formulars warten, bis die Seite fertig geladen ist, sonst wird es nicht abgeschickt.
  Das eingebettete Browser-Fenster der Desktop-App ist schmal, breite Layouts werden dort stark verkleinert.
- **`tsc`-Fehler aus `.next/`** (zum Beispiel zu `app/calendar/page.js`) sind Altlasten aus anderen Branches und zu ignorieren.
- **Sammelauswahl mit Filter (bekannter Fehler im Original):** "Alle N auswählen" in der Personenliste schickt nur `selectAll: true`, die Bulk-Route
  (`app/api/people/bulk/route.ts`, `resolvePersonIds`) nimmt dann alle Kontakte statt der gefilterten. Siehe Branch `feat/people-quick-edit` für die Korrektur.
- **Netzwerk-Diagramm (`components/UnifiedNetworkGraph.tsx`):** Personen ohne jede Verbindung driften durch die Abstoßung weit weg (über 2000 px).
  Beim Einpassen (`components/graph/fit-view.ts`) zählen sie deshalb nicht mit. Die Simulation wird bei jedem Datenladen neu gebaut, Ereignis-Haken
  müssen an jeder neuen Simulation hängen, nicht nur an der ersten. Einpassen alle paar Ticks, bis der Nutzer selbst bewegt.
- **Datumsfelder:** Kalenderdaten (zum Beispiel `lastContact`) ohne Zeitzone behandeln, Hilfsfunktionen `parseCalendarDate` und `formatDate` nutzen.

## Branch-Übersicht (Stand 09.11.2026)

`fork-main` ist der Zusammenschluss aller Branches unten, getestet (4400+ Tests grün, `tsc` ohne Fehler, Seiten im Browser mit erfundenen Testdaten angesehen).
Die einzelnen Branches liegen zusätzlich getrennt auf dem Fork, damit sie bei Bedarf einzeln als Pull Request taugen.

| Branch | Inhalt |
| --- | --- |
| `feat/relationship-type-members` | Seite pro Beziehungsart, Leute per Namenssuche hinzufügen und entfernen (`/relationship-types/[id]`) |
| `fix/dashboard-graph-fit` | Netzwerk-Diagramm passt sich beim Öffnen auf "Du" zentriert ein, Höhe folgt dem Fenster |
| `feat/dashboard-overview` | Dashboard auf einen Bildschirm, Vollbild, Personen ohne Verbindung als Liste, Suche und Legende im Diagramm |
| `feat/people-quick-edit` | Personenliste mit Direktbearbeitung, Gruppenseite als Tabelle mit Verbindungen und Netzwerkansicht, Korrektur "Alle auswählen" mit Filter |
| `feat/groups-and-types-overview` | Gruppen- und Beziehungsarten-Übersichten, Standardarten, Mehrfachzuordnung |
| `feat/map-quick-assign` | Karte: Mehrfachauswahl, Personenkarte, Filter, Liste "Ohne Ort" |
| `feat/person-profile-quick-actions` | Detailseite mit Schnellaktionen, neues Formular "nur Name zuerst", Fehler am Feld |
| `feat/search-and-navigation` | Suche mit Schnellaktionen, Tastaturkürzel (`?`), Navigation am Handy, Leerzustände |
| `feat/journal-quick-entry` | Tagebuch: schneller Eintrag, Zeitleiste mit Suche und Zeitraum, Rückgängig beim Löschen, Entwürfe pro Konto |
| `feat/settings-clarity` | Einstellungsstart mit Suche, Speichern mit Rückmeldung, Vorschau bei Darstellung |
| `feat/carddav-flow-ux` | CardDAV: Anbietervorlagen, Verbindungstest, Import-Assistent, Export, Konflikte |
| `feat/duplicates-merge-trash-ux` | Duplikate nach Sicherheit, Schnell-Zusammenführen, Papierkorb mit Suche und Mehrfachwiederherstellung |
| `feat/graph-wheel-and-compact` | Mausrad scrollt die Seite (Zoom mit Strg/Cmd), kleines Netz auf der Personenseite |
| `showcase` | Vorzeigeseite mit Bildern (erfundene Daten) für den Ersteller, nur Bilder und Text |

Nicht auf dem Fork enthalten und nicht gepusht: `feat/calendar-tab` (offener Pull Request beim Original) und `fix/carddav-fetch-by-url`
(ebenfalls offener Pull Request). Beide haben ihren Stand beim Original.

## Wo was liegt (Erkenntnisse aus den Bereichen)

- **Dashboard und Graph:** `components/UnifiedNetworkGraph.tsx` wird auch auf der Personenseite benutzt (`compact`, ohne `groups`). Neue Werkzeuge hängen deshalb an `groups`.
  Das Canvas muss beim Vollbild dasselbe Element bleiben, sonst bricht die Simulation. Reine Logik in `components/graph/` (`fit-view`, `loose-people`, `search-people`, `legend`, `canvas-height`).
  `tests/e2e/graph-visualization.spec.ts` erwartet ein `data-testid`, das es nie gab (veraltet).
- **Verbindungen:** Jede Verbindung steht als **zwei** `Relationship`-Zeilen in der Datenbank. Rohzählungen halbieren (`lib/relationship-type-stats.ts`).
  Standardbeziehungsarten stehen in `lib/relationship-types.ts` (`PRELOADED_RELATIONSHIP_TYPES`), der interne Name entsteht aus dem Label.
- **Beziehung beim Anlegen:** Die API verlangt beim Anlegen einer Person zwingend eine Beziehung (`relationship_type_required`). "Nur Name ist Pflicht" gilt im Formular nur durch Vorbelegung.
- **Adressen:** `PUT /api/people/[id]` mit `addresses` ersetzt **alle** Adressen. Das Land steht als ISO-Code. Unveränderte Adressen werden über den Geocode-Cache (Hash) sofort wieder aufgelöst.
  Die Karte lädt nach 4 s und 12 s still nach, um Geocoding abzuwarten (im Test ist Geocoding aus, dort erscheinen 0 Personen auf der Karte).
- **Sammelaktionen:** `POST /api/people/bulk` mit `personIds`. `selectAll` nie ohne passende Filter benutzen. `BulkGroupAssignModal` setzt `isSubmitting` nach Erfolg nicht zurück
  (die Karte umgeht das mit einem `key`-Wechsel), besser in der Komponente beheben.
- **Tagebuch:** `JournalEntry` steht nicht in den Soft-Delete-Modellen. Pure Logik und der gemeinsame `where`-Builder in `lib/journal.ts`.
- **Einstellungen:** Struktur in `components/settings/settingsCatalog.tsx`, neue Seiten dort eintragen plus Schlüssel `settings.search.keywords.<id>`.
  Gemeinsame Bausteine: `saveSetting`, `OptionCardGroup`, `SettingsSaveBar`, `useUnsavedChangesWarning`, `formState.parseApiError`. API-Fehler haben die Form `{error, code, details:[{field,message}]}`.
  Die Farben in `ThemePreview` sind Kopien aus `globals.css`, ein Test sichert sie ab.
- **Navigation und Suche:** Navigation wird pro Seite neu gemountet (kein Layout-State). Test-Mocks: `useRouter` liefert pro Render ein neues Objekt, nie in Effekt-Abhängigkeiten setzen;
  `useSession`-Mocks müssen stabil sein, sonst endloses Laden. `SearchIndexProvider` ist Pflicht-Kontext, Tests mit `TrashManager`, `MergeClient` oder Schnell-Zusammenführen müssen `useSearchIndex` mocken.
- **Browser-Speicher:** Alles in `localStorage` trägt die Konto-ID im Schlüssel (`nametag:<bereich>:<userId>:...`), nur IDs und Zeitstempel, Ablauf nach 7 bis 30 Tagen.
  `lib/client-storage.ts` (`clearNametagStorage`) löscht beim Abmelden alle `nametag:`-Schlüssel, aufgerufen im Abmelden-Menü, bei Kontolöschung und beim Abmelden nach E-Mail-Wechsel.
- **CardDAV-Oberfläche:** Reine Logik in `lib/carddav-ui/`, gemeinsame Bausteine in `components/carddav/`. Die Import-API legt Gruppen und Beziehung nur für **neu** angelegte Personen an.
  Ein Konflikt speichert keinen Zeitpunkt der Server-Änderung. Nicht gegen einen echten Server geprüft: Anbieter-Adressen (mailbox.org, Fastmail, Posteo) und ob der Test bei mailbox.org die Kontaktzahl zeigt.
- **Duplikate und Papierkorb:** Ein zusammengeführter Kontakt landet leer im Papierkorb, Wiederherstellen macht das Zusammenführen nicht rückgängig. Rückgängig-Hinweis nach Löschen:
  `hooks/useUndoPersonDelete.ts` und `lib/undo-delete.ts` sind vorhanden, aber **noch nirgends eingebaut** (Aufrufer: `PersonActionsMenu.handleDelete`, Sammel-Löschung). `DuplicatesHint.tsx` ebenfalls noch nicht in der Personenliste.

## Offene Ideen (nicht umgesetzt)

- Untere Tab-Leiste am Handy (kollidiert mit der festen Auswahlleiste der Personenliste).
- Undo-Toast nach Löschen einbauen, Hinweis auf Duplikate in der Personenliste.
- Gruppe aus der Karte wieder entfernen, eigene Gruppe oder Beziehung direkt in der Karte anlegen.
- Beziehung beim Anlegen optional machen (braucht API-Änderung), Eingabe in einem noch offenen "Hinzufügen"-Feld geht beim Speichern verloren.
- Zeitleiste im Tagebuch nachladen statt alles auf einmal, Journal im Papierkorb.
- Beim Löschen einer Beziehungsart betroffene Verbindungen auf eine andere Art umhängen.
- Testnachricht-Knopf für E-Mail und Push in den Einstellungen (braucht neue API-Route), Sprachwähler als Auswahlliste prüfen.
- Sync mit 0 Kontakten auf dem Server sichtbar machen (braucht Änderung in `lib/carddav/sync.ts`).
- Verwaiste Übersetzungsschlüssel aufräumen (`groups.showing`, `groups.members.clearAll` u. a.).

## Arbeiten am Handy

Das Repository liegt auf GitHub unter `gurkengraeber/nametag`. Für Claude Code im Web oder auf dem Handy den Branch `fork-main` öffnen, diese Datei und `CLAUDE.md` lesen,
dann auf einem eigenen Branch weiterarbeiten. Es gibt dort keinen Datenbank-Container, deshalb nur mit `vitest`, `eslint` und `tsc` prüfen, die Oberfläche lässt sich nur lokal ansehen.

