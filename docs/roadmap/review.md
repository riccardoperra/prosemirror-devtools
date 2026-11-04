# Revisione e limiti delle prove

La revisione indipendente ha usato agenti della stessa famiglia GPT. Nell'ambiente non era
disponibile una famiglia diversa. Le verifiche seguenti non costituiscono una revisione tra
famiglie di modelli.

## Difetti riprodotti e corretti

| Difetto                                                                                                                                              | Correzione                                                                                                                                                                                     | Prova permanente                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Un dispatch terminato dopo un remount poteva contaminare la nuova generazione con gli stessi ID. Anche un hook poteva attribuirle timing precedenti. | Ogni misurazione conserva la generazione iniziale. Il completamento rifiuta una generazione sostitutiva. Gli aggregati degli hook richiedono la stessa registrazione prima e dopo la chiamata. | `inspection-generation.test.ts` copre dispatcher, pausa e hook reali.                   |
| Il budget di una lettura per intervallo ripartiva da zero per ogni nodo fratello.                                                                    | Una sola visita condivide il budget fra tutti i nodi dello scope.                                                                                                                              | `inspection-client.test.ts` verifica l'interruzione su un documento di 1.000 paragrafi. |
| Un serializer opaco poteva diventare una proiezione storica disponibile e completa.                                                                  | Un confine non osservabile conserva il suo stato di errore. Le liste di proiezioni dichiarano copertura parziale.                                                                              | Test dei due confini del plugin e verifiche semantiche inconcludenti.                   |

L'ultima verifica dello stack ha riprodotto un quarto difetto nel consumer React controllato.
L'editor mostrava `AlphaZ`, ma State e Selection conservavano il modello precedente. I pannelli
leggono ora il modello autorevole della sessione. Le azioni sul DOM e il restore richiedono anche
che la view abbia completato il commit. La correzione non forza un aggiornamento della view.
Cinque test del pannello coprono lo stato prima del commit. Due nuovi scenari Chrome verificano
State e Selection contro lo stesso documento e la stessa selezione delle query pubbliche.
Il test preesistente del restore usa ora un remount reale con una nuova registrazione.

Un secondo agente ha rieseguito i quattro repro originali sugli ingressi pubblici costruiti.
I quattro casi sono corretti. Sono passati anche 33 test mirati e otto controlli aggiuntivi
sull'ingresso pubblico della verifica delle prove annidate.

`requiredEvidence` nomina esplicitamente i wrapper annidati che devono essere disponibili prima di
confrontarne il valore. I normali oggetti applicativi con una proprietà `kind` rimangono dati.

Il controllo indipendente dei commenti ha esaminato 22 commenti aggiunti in 14 file. Non ha
richiesto eliminazioni o soppressioni.

## Prove delle skill

La skill di validazione ha guidato lo scenario lista e undo tramite letture strutturate e poi
tramite UI, senza valutazione JavaScript nel secondo percorso. Le prove sono nella suite browser.

Due agenti nuovi hanno eseguito le skill di integrazione e diagnosi senza leggere il codice
applicativo. Il primo ha superato 15 controlli osservabili su cattura, reset, profili e produzione.
Il secondo ha diagnosticato correttamente il trace vuoto del profilo attach-only attraverso UI e
registrazione esportata. Entrambi hanno segnalato istruzioni insufficienti per trovare la
connessione strutturata.

La correzione distribuisce una reference di connessione con ogni skill. Il controllo documentale
la genera dalla stessa definizione degli strumenti e verifica link e compatibilità del protocollo.
La discovery e le cinque operazioni sono state eseguite anche con Chrome DevTools MCP 1.12.0.
Il [report MCP](./evidence/chrome-mcp.json) conserva documento, selezione e verdetto sullo stesso punto.

I report originali delle prove delle skill sono in [evidence/skills](./evidence/skills). Descrivono
la versione delle istruzioni letta prima dell'aggiunta della reference. I passaggi di disposal e
overlay non esposti dalla sola UI sono dichiarati non verificati in quel report. Il lifecycle e
le posizioni obsolete hanno prove separate nei test del pacchetto e negli scenari browser.

L'ambiente ha rifiutato il tentativo di usare la clipboard nella prova della diagnosi. L'agente ha
usato l'esportazione locale e ha completato la diagnosi. La lettura diagnostica non richiede
permessi per la clipboard. Il controllo CUA nativo era indisponibile. Il percorso UI usa Chrome
reale tramite Playwright e controlli accessibili.

## Correzione del registro

Le prime righe del registro sulla pulizia della cache citano un package lock. Quel file non prova
lo spazio liberato. I valori erano osservazioni dell'ambiente durante il lavoro e non una misura
riproducibile conservata nel repository. Una riga successiva del registro ritira quel riferimento
come prova dello spazio. Nessuna conclusione sulla correttezza o sulle prestazioni della libreria
dipende da quei valori.

La pulizia ha riguardato la cache rigenerabile dei download npm. Non ha cancellato sorgenti del
progetto o dipendenze installate. L'installazione finale dal lockfile è stata ricreata nel worktree.

## Limiti dichiarati

- Le nuove API sono verificate su build locali del ramo. La pubblicazione npm resta separata.
- Il bridge Chrome resta sperimentale e richiede la categoria third-party del server MCP.
- I timing sincroni non misurano paint o commit React differiti.
- Trasporto e provider hanno sequenze e campionamenti propri. La vicinanza temporale non prova causalità.
- Le registrazioni contengono solo gli scope acquisiti. Import non significa replay o nuova prova nel browser.
- La matrice distingue lifecycle degli editor, host dei pannelli e profilo. Non dichiara parità SSR generale.

## Correzioni dopo la prova manuale

La prova dell’utente ha rilevato il contesto espanso che comprimeva la navigazione TanStack.
Il [follow-up](./usability-follow-up.md) conserva il difetto visivo, la correzione e le prove
WebMCP native aggiunte successivamente. I controlli iniziali non coprivano quel layout espanso.
