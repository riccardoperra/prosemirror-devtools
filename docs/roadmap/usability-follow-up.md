# Contesto diagnostico e WebMCP

Il controllo visivo precedente non aveva verificato il contesto diagnostico espanso nell'host
TanStack. L'header embedded disponeva selettore, contesto e tab su una stessa riga. Il contesto
aperto restringeva la navigazione e consumava lo spazio del pannello.

Il primo intervento separava la navigazione dal contesto e limitava l'altezza dell'header. La
versione corrente sposta stato della cattura, inspector e copia diagnostica in **Context**. I dati
del pannello live iniziano sotto le tab. La barra prima e dopo il dispatch compare quando si
seleziona una transazione storica. La regressione browser verifica lo spazio del pannello su
standalone e TanStack a 390 e 1280 pixel.

Il confronto su State in TanStack misura lo spazio fra la fine delle tab e l'inizio del contenuto.
La [baseline](./evidence/compact-context/baseline.jpg) occupava 1 px. La
[versione con contesto nell'header](./evidence/compact-context/previous.jpg) occupava 76 px.
[State ora](./evidence/compact-context/state.jpg) torna a 1 px. Il nome dell'editor torna leggibile.
[Context](./evidence/compact-context/context.jpg) mostra dati catturati e inspector installati.
I dettagli tecnici sono chiusi all'apertura.

`installProseMirrorWebMCPBridge` registra gli stessi cinque tool di lettura del bridge Chrome.
Usa l'API corrente `document.modelContext` e riconosce l'API precedente su `navigator`.
L'assenza dell'API restituisce `null`. Il cleanup termina le registrazioni del bridge e gestisce
anche un'installazione parziale. Nessuno shim viene installato.

Nel browser integrato sono stati scoperti i cinque tool e chiamati catalogo, editor, documento,
selezione e verifica. Documento e selezione hanno lo stesso punto di osservazione; il controllo
del tipo di lista restituisce `passed`. La [prova strutturata](./evidence/usability/native-webmcp.json)
conserva questi risultati. Il browser necessita del supporto WebMCP; Chrome MCP resta un percorso
alternativo con un server esterno. Entrambi usano il medesimo catalogo del pacchetto.

Il controllo segue il principio Prove It Works con chiamate native reali e screenshot del pannello
espanso, oltre ai test automatici. Le API browser sperimentali restano soggette a cambiamenti.

La seconda segnalazione riguarda il contenuto Transactions. I collegamenti del dispatch e dei
plugin occupavano più righe prima dei dati. Ora sono in Related evidence, chiuso inizialmente e
limitato in altezza quando aperto. Il test unitario segue un collegamento e torna a Transactions;
la regressione browser verifica che i dettagli siano nel viewport a larghezza desktop.

I dettagli tecnici si aprono dentro **Context**. Il controllo del viewport riguarda l’host TanStack.
