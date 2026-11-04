# Roadmap di ProseMirror Inspector e filoni paralleli

| Campo                   | Valore                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| Stato                   | Proposta di prodotto e architettura. Task da avviare.                                        |
| Data                    | 4 novembre 2026.                                                                             |
| Baseline del repository | Commit `448ddbe`.                                                                            |
| Ambito                  | Revisione delle funzioni, architettura, roadmap, task, dipendenze e criteri di accettazione. |
| Vincolo corrente        | Solo documentazione. Questo piano non introduce codice, skill eseguibili o nuove API.        |

## Obiettivo e risultato per chi integra

ProseMirror Inspector deve aiutare a ricostruire un comportamento dell'editor senza cercare
manualmente nel codice ogni passaggio. Uno sviluppatore deve poter seguire un evento fino ai
dispatch, ai plugin coinvolti, al cambiamento del documento e alla selezione risultante.

Un agente deve poter seguire lo stesso percorso attraverso strumenti strutturati o computer use.
Le skill distribuite con la libreria devono spiegare come integrare il devtool, delimitare una
diagnosi e verificare un comportamento nell'applicazione reale.

La direzione proposta conserva una sessione comune per editor, moduli diagnostici indipendenti e un
pannello condiviso fra gli host. Le informazioni hanno provenienza e copertura dichiarate. Le
conclusioni richiedono evidenze osservabili.

La roadmap ordina il lavoro per dipendenze e risultati. Non assegna date di rilascio o stime di
durata. I filoni sono responsabilità tecniche, senza assegnatari personali.

## Baseline e revisione delle funzioni

Le capacità elencate come presenti si riferiscono al repository alla baseline, non a una verifica
del contenuto pubblicato su npm. I punti di partenza sono il [README del package](../packages/prosemirror-devtools/README.md)
e la [review delle funzionalità](./devtools-review.md).

| Area presente            | Valutazione                                                                                                                | Evoluzione proposta                                                                                                                    |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| State e Selection        | Albero, mark e posizioni risolte rispondono a domande correlate.                                                           | Condividere nodo, posizione e momento osservato. Valutare un'area Document senza eliminare il resolver avanzato.                       |
| History                  | Registra dispatch, transazioni applicate, step e mapping. Non è un inspector di `prosemirror-history`.                     | Usare Transactions come nome visibile. Distinguere la registrazione dei dispatch dalla cronologia undo e redo.                         |
| Events e Commands        | Gli esiti degli handler sono utili anche senza transazioni prodotte. I nomi dei comandi richiedono tracciamento esplicito. | Collegare eventi e dispatch. Conservare gli eventi senza dispatch e dichiarare i limiti della cattura.                                 |
| Performance              | Aggregati e dettaglio dei dispatch aiutano a individuare il lavoro sincrono costoso.                                       | Condividere il dispatch selezionato con Transactions. Tenere distinti tempi sincroni, aggiornamenti del framework e paint del browser. |
| Plugins                  | Mostra ordine, props e stato corrente.                                                                                     | Aggiungere riepiloghi storici selettivi e collegamenti a handler, transazioni, decorazioni e costi.                                    |
| Decorations e Node views | Range e lifecycle sono informazioni utili per il rendering.                                                                | Renderle riconoscibili come diagnostiche di Rendering. Invalidare evidenziazioni riferite a documenti precedenti.                      |
| Schema                   | È un riferimento alle specifiche di nodi e mark.                                                                           | Aggiungere controlli contestuali su contenuto, mark e contenitori ammessi nella posizione selezionata.                                 |
| Snapshots                | Conserva documento e selezione. Il restore produce una nuova transazione nello stato corrente.                             | Aggiungere confronto fra checkpoint e anteprima del ripristino. Distinguere il checkpoint dalla registrazione diagnostica.             |
| Standalone e TanStack    | Entrambi usano già lo stesso pannello.                                                                                     | Esporre il mount indipendente dal framework e documentare la scelta dell'host.                                                         |
| Adapter dei framework    | Sono presenti React, Preact, Solid, Vue, Svelte e Angular.                                                                 | Verificare capacità e limiti per ciascun adapter, compresi lifecycle, aggiornamenti delle props e produzione.                          |
| Tiptap                   | Esistono helper per lifecycle e middleware Tiptap 3.                                                                       | Aggiungere un consumer Tiptap reale e un inspector di estensioni, options e storage.                                                   |
| Collaborazione           | La diagnostica specifica è rinviata nella review precedente.                                                               | Pianificare adapter per collab ufficiale e Yjs. La richiesta attuale riapre questa priorità.                                           |

Events mostra oggi ID da ritrovare manualmente in History. History e Performance mantengono inoltre
selezioni indipendenti. Il primo intervento di UX collega queste informazioni prima di cambiare
l'intera navigazione. L'albero di State copre già il ruolo di una vista Structure.

I demo attuali coprono i framework e usano ProseMirror con TanStack. Non sostituiscono esempi nativi
Tiptap e `@handlewithcare/react-prosemirror`. I test degli helper Tiptap usano oggetti costruiti per
il test. Il supporto nativo richiede quindi verifiche su versioni reali.

## Copertura da aggiungere rispetto a ProseMirror

| Area                                 | Informazioni utili                                                                        | Limite del contratto proposto                                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| History ufficiale                    | Profondità undo e redo, transazioni della history, `addToHistory` e operazioni osservate. | Usare API pubbliche. I branch interni completi non fanno parte della prima versione.                                 |
| Collab ufficiale                     | Versione, step non confermati e transazioni di origine.                                   | Connessione, invio e conferme del trasporto richiedono un'integrazione dell'applicazione.                            |
| Yjs                                  | Stato e segnali del provider, origine delle operazioni e undo del sistema collaborativo.  | È un adapter distinto da `prosemirror-collab`. La Collaboration di Tiptap usa Yjs.                                   |
| Plugin e transazioni                 | Differenze di stato, esiti di filter e collegamenti alle transazioni appended.            | Un timing non prova quale plugin abbia generato o rifiutato una transazione. Serve catturare la relazione.           |
| Schema e posizioni                   | Validità del contenuto, mark ammessi, contenitori e mapping.                              | Il controllo di uno schema non spiega automaticamente la logica applicativa di un comando.                           |
| Keymap e input rules                 | Ordine osservato, handler eseguiti, esiti e comandi nominati.                             | Un ritorno `false` non contiene necessariamente una motivazione. Le registrazioni richiedono un contratto esplicito. |
| Clipboard e composizione             | Passaggi osservabili, trasformazioni e selezione risultante.                              | I payload di testo e clipboard restano esclusi per default. Le catture aggiuntive sono esplicite e limitate.         |
| Rendering                            | Decorazioni, NodeView, posizione nel DOM corrente e costi osservati.                      | Il dato semantico non dimostra la correttezza visiva. Servono anche prove nel browser.                               |
| Tabelle e altri plugin specialistici | Selezioni e invarianti del modulo utilizzato.                                             | Sono inspector opzionali, da aggiungere dopo il contratto comune e uno scenario concreto.                            |

## Esperienza dei consumer

Con ProseMirror puro, l'integratore prepara la sessione prima dei plugin quando vuole i dettagli di
strumentazione. Collega poi la view e sceglie l'host. Un editor già creato può usare la cattura
compatibile con il solo attach. Il catalogo indica quali dettagli mancano.

Con Tiptap o React ProseMirror, l'integrazione dedicata possiede la registrazione nel lifecycle
corretto. Il consumer non combina attach generico e recorder del framework sulla stessa view.
L'adapter React del pannello e l'integrazione con React ProseMirror restano responsabilità distinte.

L'agente identifica la sorgente, legge versione e capacità, sceglie uno scenario e acquisisce un
punto iniziale. Esegue l'azione nell'applicazione e verifica le prove richieste. Una registrazione
importata permette diagnosi retrospettiva, senza attestare un'interazione nel browser corrente.

## Architettura proposta

### Decisione di sintesi

Due strutture sono state confrontate durante la progettazione.

| Struttura                                                             | Cosa nasconde al consumer                                    | Compromesso                                                        |
| --------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------ |
| Sessione proprietaria della cattura, moduli diagnostici specialistici | Ordinamento, identità, copertura e validità dei riferimenti. | Richiede un contratto comune preciso e un proprietario del nucleo. |
| Archivi autonomi per funzionalità, riuniti durante le query           | Le particolarità di ciascuna raccolta.                       | Le letture devono coordinare revisioni e scadenze di più archivi.  |

La proposta sceglie la sessione come proprietaria delle osservazioni pubblicate e delle regole
comuni. I moduli mantengono la conoscenza specialistica e proiezioni derivate. Non introducono una
seconda storia indipendente per UI, agenti o export.

Questa scelta conserva il vincolo documentato delle notifiche coerenti nel core. Gli host non
possiedono flush, ordinamento o completamento dei dispatch. La motivazione è presente nelle
[PR di separazione dei dati](https://github.com/riccardoperra/prosemirror-devtools/pull/3) e
[di pubblicazione sincrona](https://github.com/riccardoperra/prosemirror-devtools/pull/5).

### Confini dei moduli

I nomi seguenti descrivono responsabilità. Non prescrivono una rinomina immediata delle directory
esistenti o la creazione di altrettanti package npm.

| Modulo                  | Responsabilità                                                                                  | Confine                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Core                    | Identità, lifecycle, strumentazione, cattura, ordine, conservazione e copertura.                | Non interpreta gli internals di Tiptap, Yjs o history.                               |
| Inspector               | Riepiloghi e interpretazione di documento, plugin, history, collaborazione, rendering e Tiptap. | Non possiede un recorder alternativo per ogni consumer.                              |
| Inspection              | Ricerca, dettaglio e confronti riferiti a un punto osservato.                                   | Espone concetti del dominio, non oggetti vivi o formati del trasporto.               |
| Pannello e host         | Navigazione, presentazione, mount e teardown della UI condivisa.                                | Il contesto di navigazione appartiene al singolo host.                               |
| Bridge                  | Adattamento delle interrogazioni agli strumenti agentici e a Chrome.                            | Non duplica le regole diagnostiche.                                                  |
| Registrazioni           | Checkpoint, differenze, import ed export diagnostico.                                           | Un file importato è una sorgente offline, senza editor eseguibile.                   |
| Skill                   | Procedure di integrazione, diagnosi e validazione.                                              | L'agente controlla browser e artefatti esterni attraverso gli strumenti disponibili. |
| Esempi e documentazione | Consumer reali, scenari e compatibilità dichiarata.                                             | Le capacità pubblicizzate corrispondono a verifiche completate.                      |

Il [contratto delle estensioni attuali](../packages/prosemirror-devtools/src/core/extensions.ts)
descrive pannelli. Il nuovo contributo diagnostico deve funzionare senza UI. Le presentazioni sono
opzionali e il loro caricamento non impone il renderer ai consumer senza pannello.

### Forme dei dati comuni

| Concetto                  | Contenuto e significato                                                                                                          |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Sorgente                  | Editor live oppure registrazione offline. La variante determina le operazioni ammesse.                                           |
| Identità della sessione   | Editor e generazione del suo lifecycle. Un remount non riutilizza implicitamente i riferimenti precedenti.                       |
| Punto di lettura          | Sorgente, revisione pubblicata e limite delle osservazioni incluse. I risultati correlati indicano lo stesso ambito di lettura.  |
| Osservazione              | Fatto acquisito, origine, ordine d'ingresso e legami causali osservati. Può esistere senza un dispatch.                          |
| Capacità                  | Identificativo, significato, prerequisiti e livello di supporto della funzione installata.                                       |
| Copertura                 | Intervalli osservati e motivi delle lacune. Distingue capacità non supportata, disabilitata, non osservata, scaduta o in errore. |
| Contributo diagnostico    | Riepiloghi, interrogazioni e presentazioni opzionali di un inspector.                                                            |
| Contesto d'ispezione      | Sorgente, modalità live o storica, dispatch, nodo e posizione selezionati da un host.                                            |
| Checkpoint documentale    | Documento e selezione destinati a confronto e ripristino esplicito.                                                              |
| Registrazione diagnostica | Osservazioni, copertura, provenienza e descrittori esportabili con un formato versionato.                                        |
| Scenario di validazione   | Precondizioni, azioni, aspettative, attese e prove richieste.                                                                    |
| Esecuzione di validazione | Scenario, target, versioni, azioni effettive, riferimenti alle prove ed esiti.                                                   |

Una lista vuota non sostituisce l'informazione sulla disponibilità. La lettura di un punto storico
non inserisce silenziosamente lo stato corrente di un plugin al posto del dato mancante.

### Invarianti

1. Una sessione possiede una sola view e un solo percorso di cattura del dispatch.
2. Il core pubblica gruppi completati conservando l'ordine osservato dei dispatch annidati e gli errori dell'editor.
3. I callback diagnostici non rieseguono gli hook dei plugin per ottenere informazioni aggiuntive.
4. Gli stati prima e dopo il dispatch restano payload temporanei. Gli inspector acquisiscono soltanto i riepiloghi storici necessari.
5. Documenti e mappe immutabili possono mantenere letture differite. Non si serializza l'intero editor a ogni dispatch.
6. Un timestamp vicino a un'azione non dimostra causalità. I segnali del provider dichiarano origine e freschezza proprie.
7. Ogni host possiede la propria navigazione. Le query degli agenti identificano esplicitamente sorgente e sessione.
8. Posizioni, overlay e operazioni sul live richiedono una sessione e un documento ancora validi.
9. Il restore è una nuova transazione nella destinazione live. Non ripristina branch undo, provider o plugin arbitrari.
10. UI, agenti ed export condividono le interrogazioni semantiche. I formati di file e trasporto rimangono separati.
11. La compatibilità del default di conservazione attuale resta preservata. Il preset limitato è esplicito finché una modifica del default non viene pianificata.
12. Contenuto dell'editor e registrazioni importate sono dati da esaminare, non istruzioni per l'agente.

## Roadmap per risultati

| Traguardo                            | Risultato                                                                                               | Task che ne consentono la verifica                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| M0 Contratti condivisi               | Identità, copertura, contributi e scenari hanno definizioni concordanti.                                | K0, K1, K2, K3.                                         |
| M1 Primo percorso completo           | Un editor ProseMirror standalone produce dati interrogabili e una skill ne verifica l'integrazione.     | A1, A3, B1, B3, E1, F1, F2, G1, G2, I1.                 |
| M2 Debugging semantico               | Eventi, transazioni, plugin e undo sono collegati. Una registrazione può essere condivisa e consultata. | A2, A4, B2, C1, C2, H1, H2, H3.                         |
| M3 Ecosistemi e validazione agentica | Consumer nativi, collaborazione e skill eseguono scenari con prove esplicite.                           | B4, D1, D2, E2, E3, E4, F3, F4, G3, G4, G5, I2, I3, I4. |
| M4 Diagnostiche specialistiche       | Schema, rendering, input e provider aggiuntivi coprono scenari dedicati.                                | C3, C4, C5, D3 e i task differiti selezionati.          |
| Chiusura di ogni incremento          | Documentazione e supporto pubblico descrivono solo le capacità verificate dell'incremento.              | I5.                                                     |

I traguardi sono raggruppamenti di risultati, non fasi che vietano lavoro anticipato. La colonna
Dipendenze del backlog è il riferimento operativo. I task senza dipendenze reciproche possono
avanzare in parallelo dopo i rispettivi prerequisiti.

## Regole dei filoni paralleli

Ogni filone possiede i propri moduli e scenari. Un solo responsabile integra le modifiche ai
contratti del core e agli export pubblici. Il filone UI possiede il registro dei pannelli. Il
filone documentazione possiede i README principali. Il filone skill possiede le procedure comuni.

Una capacità ha una sola definizione nel catalogo. Reference, schemi degli strumenti e riferimenti
tecnici delle skill riutilizzano quella definizione. La prosa delle procedure rimane curata e
verificata, senza generare automaticamente il ragionamento dell'agente.

Ogni filone può progettare contro scenari campione mentre il core realizza il contratto. La
chiusura di un task richiede però il comportamento indicato su un consumer reale quando pertinente.
Un risultato su dati campione non dimostra il corretto lifecycle di Tiptap o il rendering nel browser.

Per chiudere un task servono il risultato previsto, le prove dei suoi criteri e l'aggiornamento
del livello di supporto. Una lacuna aperta resta dichiarata. Nessun task passa a completato per la
sola compilazione o per la presenza di una schermata.

### K Contratti comuni

Tutti i task del backlog sono da avviare. Le dipendenze indicano prerequisiti per il completamento,
non impediscono di preparare design, esempi descrittivi e casi di verifica.

| Task                    | Dipendenze | Consegna e criteri di accettazione                                                                                                                                                                                     |
| ----------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K0 Baseline e scenari   | Nessuna.   | Inventario di capacità presenti, proposte e limiti. Gli scenari V1, V2, V3 e V4 hanno stato iniziale, osservazioni ed esito atteso descritti. La baseline non viene presentata come supporto npm verificato.           |
| K1 Identità e letture   | K0.        | Contratto per sorgente, sessione, punto di lettura e copertura. Distingue live, storico e offline. Un remount invalida i target precedenti e una lettura non mescola punti diversi senza dichiararlo.                  |
| K2 Inspector e catalogo | K1.        | Contratto dei contributi senza UI e catalogo delle capacità. Uno stesso significato alimenta UI, query, export e reference. Un inspector senza pannello è utilizzabile e il consumer non deve coordinare più recorder. |
| K3 Scenari e prove      | K1, K2.    | Contratto di scenario, esecuzione, prove e verdetti. Specifica attese e prerequisiti. Un risultato negativo è distinto dalla mancanza delle prove necessarie.                                                          |

M0 è il passaggio comune minimo. Non richiede una riscrittura dello store o il completamento di
tutti gli inspector.

La partenza parallela dopo M0 comprende A1, B1, B3, E2, E3, F1, G1 e I1. Non ci sono dipendenze
reciproche fra questi task. I primi passaggi successivi sono distinti:

- A1 sblocca A2 e A3.
- B1 sblocca H1.
- A1 e B3 sbloccano E1.
- A3 sblocca C1 e D1. Insieme a F1 sblocca F2.

I restanti filoni possono preparare i propri scenari e contributi mentre attendono questi
prerequisiti. I criteri di completamento continuano a richiedere i consumer e le prove indicati.

### A Cattura e interrogazioni comuni

Il filone possiede sessioni, recorder, strumentazione, store, data client e integrazione dei
contratti pubblici. Gli altri filoni propongono contributi attraverso K2.

| Task                        | Dipendenze | Consegna e criteri di accettazione                                                                                                                                                                                                                     |
| --------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1 Identità e pubblicazione | K1, K2.    | Integra i riferimenti comuni mantenendo una cattura per view. Annidamento, dispatcher custom, eccezioni e teardown conservano l'ordine e il controllo dell'applicazione. Un cleanup vecchio non rimuove la sessione sostitutiva.                       |
| A2 Relazioni osservate      | A1.        | Registra esiti di filter e relazioni delle transazioni appended quando osservabili. Distingue applicata, filtrata ed esito sconosciuto. Nessun hook viene richiamato per ricostruire il risultato e le relazioni ignote rimangono tali.                |
| A3 Letture semantiche       | A1, K2.    | Ricerca, dettaglio e sottoscrizione condivisi dai consumer. Le risposte dichiarano punto di lettura e limiti. Gli oggetti vivi restano interni e i dettagli costosi vengono richiesti per uno scope limitato.                                          |
| A4 Profili e conservazione  | A1, A3.    | Preset limitato, budget per canale, pausa e ripresa con copertura esplicita. L'eliminazione rende riconoscibili i riferimenti scaduti. Durante una pausa il minimo necessario a delimitare il vuoto resta attivo, senza inventare i dispatch mancanti. |

### B Esperienza e host

Il filone possiede contesto del pannello, navigazione, registro dei pannelli, shell e contratto di
montaggio condiviso. La riorganizzazione dei tab segue la verifica dei percorsi d'uso.

| Task                            | Dipendenze  | Consegna e criteri di accettazione                                                                                                                                                                                                                          |
| ------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1 Contesto d'ispezione         | K1.         | Mantiene sorgente, punto e oggetto selezionati nello stesso host. Passare da Transactions a Performance conserva il dispatch. Due host navigano indipendentemente e non cambiano il target di un agente.                                                    |
| B2 Collegamenti e nomi          | B1, A3.     | Collega evento, dispatch, plugin e dettagli disponibili. History diventa Transactions come nome visibile, con una decisione esplicita sugli ID pubblici esistenti. Un evento senza dispatch resta consultabile e le viste spiegano i dati mancanti.         |
| B3 Mount pubblico               | K1.         | Un ingresso indipendente dal framework usa lo stesso renderer degli adapter. Mount, aggiornamento e unmount funzionano nel container scelto. Standalone e TanStack non possiedono copie differenti della UI o del recorder.                                 |
| B4 Accesso tramite computer use | B1, B2, K3. | Controlli con nomi e ruoli riconoscibili, target dell'editor identificabile e contesto diagnostico copiabile. Un agente senza valutazione JavaScript consulta eventi, differenze e copertura. I riferimenti al DOM corrente dichiarano la propria validità. |

### C Inspector ProseMirror

Il filone possiede interpretazioni e presentazioni specialistiche, senza introdurre nuovi
proprietari del lifecycle dell'editor.

| Task                              | Dipendenze  | Consegna e criteri di accettazione                                                                                                                                                                                                                    |
| --------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1 History ufficiale              | A3, K2.     | Usa le API pubbliche di history per profondità undo e redo e classificazione delle transazioni. I metadati osservati sono consultabili. Una demo distingue dispatch, evento annullabile e restore. Non presenta i branch privati come API supportata. |
| C2 Stato storico dei plugin       | A2, A3.     | Riepiloghi e delta acquisiti con serializer e budget espliciti. Una query storica usa il dato catturato. Valori opachi, mutazioni non osservate o getter falliti producono copertura parziale.                                                        |
| C3 Documento e schema contestuale | A3, B1.     | Collega documento, selezione, mark, schema e mapping. Spiega vincoli verificabili di inserimento e contenuto. Mapping incompleto o riferito a un altro documento è dichiarato. Comprende confronto fra JSON e HTML esportato quando supportato.       |
| C4 Rendering e performance        | A3, B1.     | Collega decorazioni, NodeView, tempi e dispatch. Non invoca nuovamente i callback osservati. Overlay obsoleti non evidenziano posizioni nel documento corrente. I tempi sincroni non vengono descritti come misura del paint o dei commit asincroni.  |
| C5 Input e comandi                | A2, A3, K2. | Tracce di keymap, comandi nominati, input rules, paste e composizione con copertura dichiarata. Un esito `false` non riceve una motivazione inventata. I payload esclusi per default rimangono esclusi e ogni cattura aggiuntiva è limitata.          |

### D Collaborazione

Il filone possiede gli adapter dei sistemi collaborativi. Il trasporto dell'applicazione conserva
la responsabilità della rete e fornisce i segnali che il plugin non espone.

| Task                       | Dipendenze  | Consegna e criteri di accettazione                                                                                                                                                                                                          |
| -------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 Collab ufficiale        | A3, K2.     | Espone versione, step non confermati e origini disponibili attraverso `prosemirror-collab`. La demo mostra le differenze fra stato locale e versione confermata. Un'origine non osservabile rimane sconosciuta.                             |
| D2 Trasporto e concorrenza | D1, A4.     | Contratto esplicito per invio, ricezione, conferme e connessione. Due editor modificano il documento con ritardi controllati. Il report distingue ordine osservato, rebase e legami causali. La pausa non nasconde le lacune della cattura. |
| D3 Yjs                     | A3, K2, D2. | Adapter distinto con capacità proprie, segnali del provider e undo collaborativo. Una demo Tiptap usa il sistema history corretto. L'assenza di un dato specifico non viene sostituita con una lettura del plugin collab ufficiale.         |

D3 riutilizza il vocabolario di provenienza e trasporto verificato da D2. Il suo progetto e gli
scenari possono avanzare insieme a D1 e D2.

### E Integrazioni editoriali

Il filone possiede il lifecycle delle integrazioni e i loro consumer. Le funzionalità visibili
restano indipendenti dal framework che ospita il pannello.

| Task                       | Dipendenze  | Consegna e criteri di accettazione                                                                                                                                                                                                                                                                             |
| -------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1 ProseMirror minimo      | B3, A1.     | Esempio con editor reale e standalone attraverso il mount pubblico, con fixture lista e history per V2. Una modifica produce una sola registrazione del dispatch applicativo. Attach semplice e strumentazione precedente allo stato dichiarano capacità differenti. Dispose rimuove registrazione e listener. |
| E2 Tiptap reale            | K1, K2.     | Consumer con versioni native dichiarate. Middleware, Strict Mode e ricreazione dell'editor non duplicano la cattura. Sono verificati anche il percorso senza strumentazione e i limiti dei plugin registrati dinamicamente.                                                                                    |
| E3 React ProseMirror reale | K1, K2.     | Consumer `@handlewithcare/react-prosemirror` con lifecycle e accesso alla view coerenti con la libreria. Stato controllato, remount e cleanup non applicano due volte una transazione. Le versioni compatibili sono dichiarate.                                                                                |
| E4 Inspector Tiptap        | E2, A3, K2. | Estensioni attive, priorità, options, storage e collegamenti ai plugin generati. Lo storage che cambia fuori dispatch richiede un segnale o un campionamento dichiarato. Non si presume una corrispondenza universale uno a uno fra estensione e plugin.                                                       |

E2 ed E3 possono usare gli host già presenti durante lo sviluppo. Non devono attendere E1 o la
riscrittura della navigazione per verificare il lifecycle nativo.

### F Accesso agentico e bridge

Il filone adatta le interrogazioni comuni. Il primo contratto agentico riguarda lettura e
verifica. Comandi che modificano l'editor richiedono un contratto separato e non sono necessari
per dimostrare il percorso browser della validazione.

| Task                        | Dipendenze | Consegna e criteri di accettazione                                                                                                                                                                                                    |
| --------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1 Catalogo degli strumenti | K1, K2.    | Espone versione, editor, sessioni e capacità con prerequisiti leggibili. Le definizioni degli strumenti derivano dal catalogo e non replicano i significati in un altro elenco manuale.                                               |
| F2 Query serializzabili     | F1, A3.    | Letture limitate di documento, selezione, transazioni e contributi disponibili. Ogni risposta dichiara target, punto e copertura. Nessuna risposta remota contiene view, DOM, funzioni o stati vivi arbitrari.                        |
| F3 Bridge Chrome            | F2.        | Adattatore della discovery diagnostica di Chrome MCP, con stato sperimentale e prerequisiti espliciti. Usa le stesse query di F2. Non richiede un server MCP autonomo o una nuova implementazione del pannello.                       |
| F4 Verifiche semantiche     | F2, K3.    | Confronta aspettative e risultati osservati. Produce superato, fallito o inconcludente per ogni controllo. Dati assenti e risultato negativo restano distinti. Le condizioni asincrone richiedono il segnale previsto dallo scenario. |

### G Skill e validazione

Le skill sono un prodotto distribuito e versionato insieme alla libreria. L'agente mantiene il
controllo del browser e delle prove esterne. La libreria conserva i fatti diagnostici e marker
limitati della verifica.

| Task                     | Dipendenze      | Consegna e criteri di accettazione                                                                                                                                                                                                                              |
| ------------------------ | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1 Pacchetto di skill    | K2, K3.         | Directory con `SKILL.md`, riferimenti e scenari identificati. Versioni e requisiti sono dichiarati. L'installazione è documentata per gli ambienti supportati, senza presumere che npm installi automaticamente le skill nell'agente.                           |
| G2 Skill di integrazione | G1, E1, I1.     | `prosemirror-inspector-integrate` sceglie lifecycle, host e profilo. Verifica target unico, capacità, cleanup e produzione del percorso supportato. Consulta la matrice per Tiptap e React ProseMirror e non presenta percorsi non verificati come compatibili. |
| G3 Skill di diagnosi     | G1, A2, A3.     | `prosemirror-inspector-debug` delimita il problema e collega osservazioni, differenze e limiti. Una diagnosi può essere inconclusiva. Contenuto dell'editor e file importati non diventano istruzioni operative.                                                |
| G4 Skill di validazione  | G1, E1, C1, F4. | `prosemirror-inspector-validate` esegue V2 con azioni nel browser reale e prove semantiche. Attende condizioni esplicite. Un cambiamento dello stato ottenuto attraverso un'azione nascosta non viene presentato come prova del percorso UI.                    |
| G5 Percorso computer use | G4, B4, I2.     | Esegue lo stesso scenario senza valutazione JavaScript. Consulta la UI accessibile e conserva le prove richieste. Se mancano dati necessari per la causalità, il controllo corrispondente è inconcludente anche quando il risultato visibile è corretto.        |

Il report della skill distingue scenario, esecuzione, checkpoint di validazione e checkpoint
documentale ripristinabile. Le aspettative applicative provengono dallo scenario, dall'utente o dai
test del progetto. La libreria fornisce invarianti ProseMirror e dati osservati, senza inventare
il comportamento desiderato dell'applicazione.

### H Checkpoint e registrazioni

Il filone possiede formato degli artefatti, import, export, confronto e presentazioni relative.
Utilizza le interrogazioni comuni per evitare collector dedicati all'esportazione.

| Task                        | Dipendenze  | Consegna e criteri di accettazione                                                                                                                                                                                                           |
| --------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1 Confronto e restore      | K1, B1.     | Confronto di due checkpoint e anteprima verso un target live esplicito. Documento, attributi e selezione rispettano il contratto dichiarato. Schema incompatibile, target rimontato o dati non validi impediscono un ripristino implicito.   |
| H2 Export diagnostico       | A3, A4, K2. | Esporta un intervallo con osservazioni, copertura, versioni e descrittori necessari. Le informazioni escluse sono dichiarate. Il formato è versionato e non contiene oggetti vivi. Non promette replay eseguibile.                           |
| H3 Import e lettura offline | H2.         | Valida il formato e apre una sorgente offline separata. Le query applicabili mantengono significato e copertura. Non crea una view fittizia per simulare capacità live e non può indirizzare implicitamente il nuovo editor dopo un remount. |

### I Esempi, documentazione e verifiche comuni

Il filone possiede README, reference e scenari trasversali. Ogni integrazione mantiene nella
propria area gli esempi specifici. Le modifiche ai documenti principali passano da un solo
proprietario per evitare aggiornamenti concorrenti.

| Task                               | Dipendenze                  | Consegna e criteri di accettazione                                                                                                                                                                                                                                                                                     |
| ---------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I1 Matrice di supporto             | K0, K2.                     | Distingue sistema editoriale, host e profilo di cattura. Indica attach, strumentazione, diagnostics, adapter specifico, versione verificata e disponibilità nella release. Separa implementato, verificato e pianificato.                                                                                              |
| I2 Scenari browser comuni          | K3, E1, B1.                 | Un consumer reale esegue gli scenari applicabili. Sono verificati anche pannelli stretti, mount e teardown, più editor e contesti separati. Una prova su oggetti costruiti per il test non sostituisce il consumer nativo.                                                                                             |
| I3 Compatibilità delle skill       | G2, G3, G4, G5, E2, E3, H3. | Riferimenti a capacità e scenari esistenti, versioni compatibili e percorsi nativi verificati. L'incompatibilità restituisce un esito esplicito. La diagnosi offline non viene presentata come nuova esecuzione browser.                                                                                               |
| I4 Adapter e produzione            | B3, E1, E2, E3, I1.         | Matrice verificata per gli adapter dichiarati, con aggiornamenti delle props, cleanup, SSR dove supportato e build di produzione. Gli ingressi core e Tiptap richiedono la guardia documentata. Gli ingressi `/production` rimangono un'attivazione intenzionale.                                                      |
| I5 Allineamento di ogni incremento | I1.                         | README introduttivo, reference e guide riportano lo stato dei task consegnati e le prove disponibili. Ogni capacità promossa come supportata ha superato i propri criteri, compresi quelli di I2, I3 o I4 quando applicabili. Nessuna proposta diventa una promessa di release per la sola presenza in questa roadmap. |

I5 si ripete per ogni incremento. I2, I3 e I4 crescono con le capacità disponibili. Una funzione
resta pianificata o sperimentale finché il relativo scenario non è verificato.

## Scenari di accettazione trasversali

Ogni scenario definisce input, capacità richieste, azioni e prove. Una verifica semantica non
sostituisce una prova visiva quando l'aspettativa riguarda il rendering.

| Scenario                        | Azione e condizione                                                                                                                            | Esito atteso                                                                                                                                                                               | Task collegati      |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- |
| V1 Dispatch annidati e filtri   | Un dispatch genera lavoro annidato, un filtro e una transazione appended.                                                                      | Ordine e relazioni osservate sono corretti. Il record filtrato non dichiara mapping applicati. Gli errori conservano il controllo dell'applicazione.                                       | A1, A2, A3.         |
| V2 Lista e undo                 | Da un documento iniziale noto con history isolata, l'agente preme Enter in una voce, verifica struttura e selezione, poi esegue Undo dalla UI. | Documento e selezione soddisfano le aspettative. Il report collega azioni, dispatch, riepilogo history e prove visive. La vista storica resta sul punto selezionato mentre il live avanza. | C1, G4.             |
| V3 Collaborazione durante pausa | Due editor modificano il documento e una ricezione remota avviene durante una pausa della cattura dettagliata.                                 | Stato corrente e provider restano leggibili secondo le capacità. La registrazione mostra il vuoto. Una conclusione sui passaggi non catturati è inconcludente.                             | A4, D1, D2.         |
| V4 Remount e import             | L'editor viene ricreato mentre è presente un overlay o termina un'importazione.                                                                | La nuova sessione invalida riferimenti DOM precedenti. L'import apre una sorgente offline. Nessuna operazione importata modifica implicitamente la nuova view.                             | A1, C4, H1, H3.     |
| V5 Query e computer use         | Lo scenario V2 viene eseguito prima con browser e API, poi tramite UI accessibile.                                                             | Entrambi i percorsi verificano le prove richieste. L'esito dichiara eventuali capacità mancanti, senza sostituire il gesto con una modifica diretta dello stato.                           | B4, F2, G4, G5.     |
| V6 Cattura parziale             | Diagnostics sono disabilitate oppure i record necessari sono scaduti.                                                                          | UI, API e skill mostrano lo stesso motivo di indisponibilità. Un insieme vuoto non certifica che l'evento non sia avvenuto.                                                                | A3, A4, B2, F4, G3. |
| V7 Consumer e produzione        | I consumer supportati vengono montati, aggiornati, smontati e compilati per produzione.                                                        | Lifecycle e guardie corrispondono alla matrice. Una modalità che resta attiva in produzione è dichiarata e verificata.                                                                     | E1, E2, E3, I4.     |

Il piano di verifica include una traccia riproducibile di azioni, punti di lettura, osservazioni e
aspettative. Non basta un'immagine finale per attestare lo stato interno del sistema.

## Protocollo di validazione degli agenti

La skill identifica ambiente, versione, editor e capacità prima di scegliere il percorso.
Acquisisce un punto iniziale e avvia una finestra di osservazione limitata. Esegue le azioni
dell'applicazione e attende le condizioni dello scenario. Confronta le prove e produce il report.

Le condizioni di attesa dipendono dall'aspettativa. La comparsa del nodo atteso, la pubblicazione
del relativo aggiornamento o il segnale dichiarato di sincronizzazione sono condizioni distinte.
Il silenzio degli eventi per alcuni millisecondi non dimostra che ogni attività asincrona sia
terminata. Timeout e segnali mancanti producono un esito esplicito.

| Provenienza delle prove     | Responsabilità                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| Runtime del devtool         | Sessione, osservazioni, relazioni, riepiloghi semantici, copertura e marker limitati.      |
| Interrogazioni su richiesta | Differenze dettagliate, riepiloghi e riferimenti al DOM corrente, con validità dichiarata. |
| Agente o runner browser     | Azioni effettive, screenshot, video e altri artefatti del browser.                         |
| Report della verifica       | Riferimenti alle prove, aspettative, risultati e limiti per ogni controllo.                |

Un marker delimita un intervallo, senza attribuire automaticamente all'azione tutti gli eventi
contenuti. Una registrazione importata conserva il proprio contesto di origine. Non testimonia un
gesto eseguito nel browser attuale.

Il verdetto appartiene a ogni aspettativa. Superato significa che le prove richieste la
soddisfano. Fallito significa che dimostrano una differenza. Inconcludente significa che manca una
prova necessaria. Un report può contenere un controllo visivo superato e una ricostruzione causale
inconcludente.

Due agenti che modificano un editor usano sessioni o consumer separati. Se devono operare sulla
stessa istanza, il runner ordina le azioni. Il core non introduce un sistema generale di lock per
compensare verifiche concorrenti non isolate.

## Distribuzione e compatibilità

La proposta iniziale mantiene un package con ingressi distinti. Core, pannello, host e bridge
rimangono separati nelle dipendenze e nelle responsabilità. Le skill sono un artefatto versionato
con istruzioni d'installazione esplicite.

Il mount pubblico riusa il renderer corrente. Un launcher flottante può aggiungere un host, senza
diventare un'altra implementazione del pannello. Un'estensione Chrome con UI e un server MCP
autonomo sono opzioni differenti dal bridge delle interrogazioni.

I contratti pubblici dichiarano il significato dei dati. La versione del file diagnostico, quella
del protocollo degli strumenti e la compatibilità della skill sono controllate separatamente.
Un'etichetta di versione npm uguale non sostituisce questi controlli.

La migrazione riguarda anche i consumer esistenti. Un cambio di nome visibile può preservare gli
ID pubblici quando utile. Un nuovo percorso di lettura non deve lasciare due implementazioni
diagnostiche divergenti come soluzione permanente.

## Opzioni differite e rischi da risolvere

| Task                            | Prerequisito | Condizione per introdurlo                                                                                                                                       |
| ------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1 Launcher e finestra dedicata | B3, I2.      | Uno scenario dimostra un beneficio rispetto al container embedded. Mount, focus, overlay e teardown rimangono coerenti.                                         |
| L2 Inspector specialistici      | C3, C5, K2.  | Un problema riproducibile giustifica un modulo per tabelle, input, clipboard o altri plugin. Ogni modulo porta il proprio scenario.                             |
| L3 Distribuzioni separate       | I1, F3.      | Un problema verificato di dipendenze, distribuzione o accesso richiede package distinti, server MCP o estensione Chrome. La scelta ha una migrazione esplicita. |

La conservazione dei dati richiede budget e casi di documento grande. Gli stati arbitrari dei
plugin possono essere opachi o mutabili. Il contratto deve ammettere riepiloghi parziali, senza
trattenere tutto il loro stato vivo.

Le prestazioni richiedono misure su consumer rappresentativi, prima di promettere un impatto
percentuale o un preset basato su quella misura. I tempi sincroni del recorder non descrivono da
soli il tempo visibile di un'interazione.

La compatibilità Tiptap richiede consumer reali, in particolare per lifecycle, middleware e
strumentazione dei plugin generati. Il supporto Svelte richiede verifiche specifiche per props
reattive e SSR in sviluppo. Il supporto di uno dei sei framework non implica parità di tutte le
capacità.

L'API sperimentale di Chrome e i sistemi collaborativi possono cambiare. I loro adattatori
rimangono confinati. Una modifica del bridge non cambia il significato delle evidenze nel core.

## Riferimenti e origine delle proposte

I commenti pubblici al [post originale di Sven Adlung](https://www.linkedin.com/posts/sven-adlung_dominik-biedebach-and-i-recently-realized-activity-7500560122738282496-cImr)
chiedono estensioni, rappresentazioni HTML e JSON, rendering e interazioni fra plugin. Altri
commenti sottolineano lo stato dell'editor e delle estensioni nel tempo. Sono segnali qualitativi
che motivano confronto storico e diagnosi collegata, senza costituire una misura della domanda.

Il riferimento all'inspector Tiptap suggerisce options e storage come informazioni specifiche
dell'ecosistema. La presenza di sezioni Collab e Versions in una schermata non prova il loro
funzionamento o la disponibilità del prodotto.

| Fonte                                                                                                                                                                                                                                                                                                                | Uso nella proposta                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| [Guida del package](../packages/prosemirror-devtools/README.md) e [review](./devtools-review.md)                                                                                                                                                                                                                     | Capacità presenti, limiti, host e follow-up della baseline.                                               |
| [Sessione](../packages/prosemirror-devtools/src/core/session.ts), [eventi pubblicati](../packages/prosemirror-devtools/src/core/types.ts), [data client](../packages/prosemirror-devtools/src/core/data-client.ts) ed [estensioni](../packages/prosemirror-devtools/src/core/extensions.ts)                          | Lifecycle unico, payload temporanei, confine delle interrogazioni e differenza fra dati ed estensioni UI. |
| [History ufficiale](https://github.com/ProseMirror/prosemirror-history/blob/master/src/history.ts)                                                                                                                                                                                                                   | API pubbliche per undo, redo, profondità, raggruppamento e classificazione delle transazioni.             |
| [Collab ufficiale](https://github.com/ProseMirror/prosemirror-collab/blob/master/src/collab.ts)                                                                                                                                                                                                                      | Versione, step non confermati, origini, ricezione e rebase.                                               |
| [Node](https://raw.githubusercontent.com/ProseMirror/prosemirror-model/master/src/node.ts) e [ContentMatch](https://raw.githubusercontent.com/ProseMirror/prosemirror-model/master/src/content.ts)                                                                                                                   | Validità del documento e vincoli di contenuto.                                                            |
| [Keymap](https://raw.githubusercontent.com/ProseMirror/prosemirror-keymap/master/src/keymap.ts), [comandi](https://raw.githubusercontent.com/ProseMirror/prosemirror-commands/master/src/commands.ts) e [input rules](https://raw.githubusercontent.com/ProseMirror/prosemirror-inputrules/master/src/inputrules.ts) | Ordine, concatenazione ed esiti delle interazioni.                                                        |
| [Estensioni Tiptap](https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/extension) e [Collaboration](https://tiptap.dev/docs/editor/extensions/functionality/collaboration)                                                                                                                       | Options, priorità, storage e distinzione del sistema collaborativo Yjs.                                   |
| [React ProseMirror](https://github.com/handlewithcarecollective/react-prosemirror)                                                                                                                                                                                                                                   | Lifecycle e accesso alla view coerenti con gli aggiornamenti React.                                       |
| [Plugin TanStack](https://tanstack.com/devtools/latest/docs/building-custom-plugins)                                                                                                                                                                                                                                 | Host opzionale e separazione fra dati e presentazione.                                                    |
| [Strumenti diagnostici Chrome MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/third-party-developer-tools.md)                                                                                                                                                                              | Bridge sperimentale per discovery ed esecuzione degli strumenti della pagina.                             |
| [Agent Skills](https://agentskills.io/specification)                                                                                                                                                                                                                                                                 | Formato delle skill, riferimenti e requisiti di compatibilità.                                            |
| [Post X di Sven](https://x.com/svenadlung/status/2094796770723176839) e [condivisione Tiptap](https://x.com/tiptap_editor/status/2094813067116720326)                                                                                                                                                                | Riferimenti pubblici collegati alla discussione sull'inspector.                                           |

Le fonti esterne sono state consultate per la proposta del 4 novembre 2026. Versioni, flag e API
sperimentali vanno ricontrollati durante il task che li integra.

## Evidenza disponibile alla baseline

Durante l'analisi sono passati 62 test esistenti in 10 file mirati. Riguardano attach, dispatcher
custom, diagnostiche, mapping, snapshot, shell, eventi, selezione, data client e helper Tiptap.
Questa evidenza riguarda il comportamento coperto da quei test alla baseline.

La nuova architettura, le skill, i consumer nativi e i nuovi percorsi browser non sono implementati
o verificati dalla scrittura di questo documento. Il backlog specifica le prove necessarie per
promuoverli a capacità supportate.
