# Esecuzione della roadmap

Le capacità obbligatorie del piano sono implementate e verificate sulle build del ramo. Le tre
opzioni L1-L3 mantengono le condizioni di introduzione del piano. La pubblicazione npm resta separata dalle PR.

## Verifiche complessive

- Baseline main `448ddbe`, 162 test in 32 file.
- Versione integrata, 250 test in 52 file.
- Suite browser su server nuovi, 20 test passati con Chrome 156.0.8078.80 e Playwright 1.64.1.
- Build e controlli dei tipi dei package nel workspace di 13 progetti. Typecheck rigoroso anche degli scenari browser.
- Lint, formato, reference generate, formato delle tre skill e publint.
- Archivio installato in un consumer temporaneo. Core, agent e recordings importano senza browser e senza Tiptap, Yjs, Angular, history o collab installati.
- Chrome DevTools MCP 1.12.0 connesso con profilo isolato. Discovery, documento, selezione sullo stesso punto e verdetto passano senza evaluate_script.

Il primo ramo ha 215 test in 45 file e il secondo 229 test in 49 file. Entrambi compilano e
verificano i consumer disponibili nel proprio stato. Il terzo aggiunge le prove complete dei
consumer, delle input rules, degli strumenti agentici e del browser.

## Stato dei task

| Task                               | Stato                    | Evidenza e criterio verificato                                                                                                                       |
| ---------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| K0 Baseline e scenari              | Verificato               | Baseline main 448ddbe, 162 test in 32 file. Inventario e V1-V7 nel piano approvato.                                                                  |
| K1 Identità e letture              | Verificato               | inspection/types e test inspection-client/inspection-generation. Target scaduti dopo remount.                                                        |
| K2 Inspector e catalogo            | Verificato               | Catalogo comune e provider senza UI. Query, UI, export e reference condividono le definizioni.                                                       |
| K3 Scenari e prove                 | Verificato               | Contratti scenario, esecuzione e verdetti. Test agent-validation, agent-tools e suite browser.                                                       |
| A1 Identità e pubblicazione        | Verificato               | Attach, dispatcher custom, sessioni e generazioni con editor reali. Un recorder per view.                                                            |
| A2 Relazioni osservate             | Verificato               | inspection-capture, attach-custom-dispatch e instrument. Filtri e append osservati senza ripetere hook.                                              |
| A3 Letture semantiche              | Verificato               | Pin/read/query/subscribe, intervalli e budget in inspection-client. Identità e limiti espliciti.                                                     |
| A4 Profili e conservazione         | Verificato               | Profili, pausa, evizione e clear. inspection-capture, inspection-client, diagnostics e V3/V6.                                                        |
| B1 Contesto d'ispezione            | Verificato               | panel-context e prova I2 con due host indipendenti e una sola cattura.                                                                               |
| B2 Collegamenti e nomi             | Verificato               | Transactions e Rendering mantengono gli ID pubblici. Collegamenti evento/dispatch e Follow live in V2/V5.                                            |
| B3 Mount pubblico                  | Verificato               | Mount/update/unmount pubblico sul renderer comune. standalone-mount e consumer reale.                                                                |
| B4 Accesso tramite computer use    | Verificato               | V5 usa ruoli e nomi accessibili senza page.evaluate. Contesto e copertura leggibili nella UI.                                                        |
| C1 History ufficiale               | Verificato               | history-inspector e V2. API pubbliche, Enter/Undo, profondità e selezione.                                                                           |
| C2 Stato storico dei plugin        | Verificato               | Serializer prima/dopo, errori e copertura parziale. inspection-capture e inspection-client.                                                          |
| C3 Documento e schema contestuale  | Verificato               | Documento, selezione, schema e mapping contestuali. Test panel-selection, panel-state, panel-changes e transaction-changes. HTML esplicito.          |
| C4 Rendering e performance         | Verificato               | Diagnostiche rendering, overlay obsoleti e timing sincroni. Test diagnostics/panel-decorations e V4.                                                 |
| C5 Input e comandi                 | Verificato               | Keymap e inputRules ufficiali, comando nominato, paste e composizione. inspection-input prova cattura unica ed esclusione dei payload.               |
| D1 Collab ufficiale                | Verificato               | collab-inspector e V3. Versione confermata, pending step e origini dichiarate.                                                                       |
| D2 Trasporto e concorrenza         | Verificato               | Due editor, autorità reale e consegna ritardata. V3 verifica concorrenza, conferma, pausa e gap.                                                     |
| D3 Yjs                             | Verificato               | Y.Doc e Tiptap Collaboration reali. yjs-inspector e V3 verificano undo locale che preserva il peer.                                                  |
| E1 ProseMirror minimo              | Verificato               | Standalone con lista, history, profili e teardown. V2/V5/V6/V7 e test del mount.                                                                     |
| E2 Tiptap reale                    | Verificato               | Tiptap 3.31.4 reale. tiptap-native copre Strict Mode, remount, entrambi i profili e plugin dinamici.                                                 |
| E3 React ProseMirror reale         | Verificato               | React ProseMirror 3.2.11 controllato. Test nativi, pannelli live sul modello aggiornato e tre remount browser senza doppia applicazione.             |
| E4 Inspector Tiptap                | Verificato               | Provider attivo nel consumer Tiptap. tiptap-inspector verifica storage, priorità, opzioni e associazioni esplicite.                                  |
| F1 Catalogo degli strumenti        | Verificato               | Catalogo e strumenti comuni. Reference generate e verificate da docs:check.                                                                          |
| F2 Query serializzabili            | Verificato               | Risposte limitate e serializzabili. Test agent-tools, client e conformance MCP reale.                                                                |
| F3 Bridge Chrome                   | Verificato, sperimentale | Chrome DevTools MCP 1.12.0 connesso. Discovery e cinque operazioni. Categoria sperimentale esplicita.                                                |
| F4 Verifiche semantiche            | Verificato               | Verdetti distinti e requiredEvidence per wrapper annidati. agent-validation, agent-tools e V3/V6.                                                    |
| G1 Pacchetto di skill              | Verificato               | Tre SKILL.md nel pacchetto, formato validato, reference di connessione e installazione esplicita.                                                    |
| G2 Skill di integrazione           | Verificato               | Forward test con agente nuovo, 15 controlli osservabili. Lifecycle e guardie hanno test separati. Limiti UI nel report.                              |
| G3 Skill di diagnosi               | Verificato               | Agente nuovo diagnostica attach-only da UI e registrazione. Bootstrap corretto con reference generate e prova MCP.                                   |
| G4 Skill di validazione            | Verificato               | Skill seguita per lista/undo reale, letture semantiche e screenshot. V2 e V5.                                                                        |
| G5 Percorso computer use           | Verificato               | V5 ripete il percorso senza valutazione JavaScript. Causalità assente resta inconcludente. CUA nativo indisponibile.                                 |
| H1 Confronto e restore             | Verificato               | Confronto, anteprima, schema, selezione e root attrs. Test snapshot/UI. Root mark differenti rifiutati prima del dispatch.                           |
| H2 Export diagnostico              | Verificato               | Export via query comuni, massimo 25 dispatch e 2 MB. Test recordings e file realmente scaricato.                                                     |
| H3 Import e lettura offline        | Verificato               | Import rigoroso e source offline. V4 importa dopo remount, legge prima/dopo e conserva il viewer su file invalido.                                   |
| I1 Matrice di supporto             | Verificato               | Matrice distinta per editor, host, profilo e release. Versioni native bloccate e installazione pulita.                                               |
| I2 Scenari browser comuni          | Verificato               | 20 test browser su cinque consumer. Viewport stretto, due editor, due host, remount, produzione e import.                                            |
| I3 Compatibilità delle skill       | Verificato               | Protocollo e link delle skill verificati. Reference dal catalogo, forward test e contesti live/offline distinti.                                     |
| I4 Adapter e produzione            | Verificato               | Build e tipi di tutti i 13 progetti. Test adapter, consumer nativi e quattro preview di produzione. Nessuna parità SSR generale dichiarata.          |
| I5 Allineamento di ogni incremento | Verificato               | README, guide, matrice, reference e note di rilascio aggiornati. Nuove API indicate come non pubblicate.                                             |
| L1 Launcher e finestra dedicata    | Differito come previsto  | Nessun beneficio dimostrato per un launcher o una finestra aggiuntiva. Embedded e secondo host coprono gli scenari verificati.                       |
| L2 Inspector specialistici         | Differito come previsto  | Nessun problema riproducibile richiede un modulo specialistico ulteriore. I callback di input richiesti sono coperti da C5.                          |
| L3 Distribuzioni separate          | Differito come previsto  | Un package con ingressi opzionali supera publint e installazione senza ecosistemi opzionali. Nessun server proprio o estensione separata necessario. |

## Ripetere i controlli

Usare Node 26.5.0 e pnpm 11.22.0 come nel workspace. I comandi non pubblicano pacchetti.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test
pnpm lint
pnpm format:check
pnpm docs:check
pnpm --filter prosemirror-inspector run publint
pnpm exec playwright install chromium
pnpm test:browser
pnpm test:chrome-mcp
```

Per Chrome già installato, impostare `PLAYWRIGHT_EXECUTABLE_PATH` al suo eseguibile. Il runner MCP
avvia una fixture propria e usa un profilo temporaneo. Non cambia la configurazione globale. Il
server ufficiale è una dipendenza di sviluppo, non un server distribuito dalla libreria.

## Prove e limiti

Le [prove browser](./evidence/browser) includono screenshot, osservazioni e un export diagnostico.
La [revisione](./review.md) conserva difetti corretti, prove delle skill e limiti dell’ambiente.
Il [registro delle decisioni](./decisions.tsv) è append-only. La [matrice di supporto](../support-matrix.md)
distingue le build verificate dalla disponibilità nella release.
