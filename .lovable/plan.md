Pelo código, o episódio só deveria bloquear nota quando `watched` é falso. Como ele está marcado como visto, o problema mais provável é de interação/camada: o `RatingPicker` do episódio está dentro da linha clicável/checkbox e o popover também tem `z-50`, mesma camada do dialog, podendo ficar atrás do modal ou perder o clique.

Plano:
1. Ajustar o container do `RatingPicker` de episódio para parar a propagação do clique, igual já acontece na nota da temporada.
2. Subir o `z-index` do `PopoverContent` do `RatingPicker` para ficar acima dos dialogs/drawers (`z-[70]`), sem alterar o comportamento dos outros popovers.
3. Manter a regra atual: só episódios marcados como vistos podem ser avaliados; episódios não vistos continuam mostrando “Marque como assistido para avaliar”.
4. Validar no preview que clicar no chip/estrela do ep 01 abre o seletor e permite salvar a nota.