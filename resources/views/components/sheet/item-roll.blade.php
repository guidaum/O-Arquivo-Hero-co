@props(['character', 'item'])

{{--
    Rolagem de dano de um item (arma, munição...) direto da ficha, pela mesma
    rota do inventário: atributos totais da ficha, munição gasta e resultado
    no chat da campanha. Abre na janela de rolagem (x-roll-dialog), que a
    ficha inclui. Só aparece para itens com dano.
--}}
@if ($item->damage)
    <form method="POST" action="{{ route('inventory.items.roll', [$character, $item]) }}" data-roll-dialog="Dano · {{ $item->name }}">
        @csrf
        <button type="submit" {{ $attributes->class(['button button--ember button--small']) }} title="Rolar {{ $item->damage }}">
            <x-icon name="dice" :size="16" /> Rolar dano
        </button>
    </form>
@endif
