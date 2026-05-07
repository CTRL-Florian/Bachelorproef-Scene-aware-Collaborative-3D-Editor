Problemen & Oplossingen
Twee gebruikers willen tegelijkertijd hetzelfde object verplaatsen, draaien of resizen
Men voert beide bewerkingen uit (netto bewerking)
Men geeft prioriteit aan een van de bewerkingen, hiervoor is criteria nodig:
Op basis van tijd
User role 
Men lockt de bewerking zodat enkel 1 user het object op deze manier kan bewerken. Andere gebruikers kunnen wel andere bewerkingen doen.

Twee gebruikers passen de kleur van een object aan.
Er moet 1 van de kleuren geselecteerd worden. 

Twee gebruikers bewerken hetzelfde object, maar met een bewerking van andere aard (e.g. de ene gebruiker verplaatst, de andere draait)
Beide bewerkingen worden uitgevoerd (optioneel: melding sturen dat de bewerking mogelijks anders is dan bedoeld)

Twee gebruikers proberen hetzelfde object te linken aan verschillende objecten
Prioriteit geven aan het linken van 1 object, op basis van:
Tijd
User role

Een gebruiker wilt een object verplaatsen of draaien terwijl een andere gebruiker een dochter-object aan het bewerken is
Men wacht met het verplaatsen of draaien ven het dochter object tot de gebruiker ermee klaar is. Eventueel andere dochter-objecten worden wel al verplaatst. 
De plaats van het dochter-object wordt t.o.v. het moeder-object opgeslagen. De verplaatsing van het dochter-object wordt eerst uitgevoerd, daarna gebeurt het verplaatsen en/of draaien t.g.v. die van het moeder-object met de nieuwe relatieve plaats van het dochter-object.

Een volledig object locken zorgt ervoor dat gebruikers gelimiteerd zijn in hun efficiëntie. Het is al beter dan een hele scene locken, maar kunnen we dit nog efficiënter doen?
We locken waar mogelijk de bewerkingen (als de ene gebruiker aan het verplaatsen is, mag de andere gebruiker dit niet doen). Zijn er scenario’s waar dit niet mogelijk is?
…

Is de editor schaalbaar? Wat als er meer dan honderd personen tegelijkertijd in het bestand werken? Of aan hetzelfde object, dezelfde ketting van moeder- en dochter-objecten?
De oplossingen van conflicten van bewerkingen onder meerdere gebruikers moet schaalbaar zijn. 

Indien een gebruiker meerdere bewerkingen doet in dezelfde tijd dat een andere gebruiker ook meerdere bewerkingen doet, die tegelijkertijd doorgevoerd worden en eventueel een conflict leveren. Hoe kan men dit dan oplossen, schaalbaar maken?
De bewerkingen van de ene gebruiker omzetten naar een netto bewerking (e.g. meerdere verplaatsingen weergeven als 1 verplaatsing die de som is van de andere verplaatsingen).
Bewerkingen groeperen:
Een reeks bewerkingen (van 1 gebruiker) op hetzelfde object samennemen: Men kan een groep bewerkingen van 1 gebruiker vergelijken met een overeenkomstige groep van een andere gebruiker.
Keyframes toevoegen na x aantal bewerkingen (die mogelijks een correlatie hebben): Telkens per keyframe conflicten oplossen (e.g. telkens per 3 bewerkingen van een gebruiker problemen oplossen). Men kan ervoor kiezen voorwaarden aan een keyframe toe te voegen (e.g. een keyframe pas plaatsen na herhaalde verplaatsingen van hetzelfde object en zo het aantal bewerkingen verminderen).

Wat als een gebruiker het object verwijdert terwijl een andere gebruiker aanpassingen maakt aan het object?
Het object verwijderen
Het object toch behouden
Een popup tonen met de vraag of we het object willen behouden

Twee gebruikers die tegelijkertijd een object toevoegen (ev. met zelfde id):
Een nieuw id toekennen aan een van de objecten
Een van de objecten niet toevoegen
Popup tonen voor beide gebruikers


