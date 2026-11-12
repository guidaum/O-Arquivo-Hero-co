@props(['character', 'target', 'label', 'rules'])

{{--
    Teste rápido com dificuldade (F, N, D, E), como na ficha antiga. O valor é
    calculado no servidor a partir do alvo ("attr:for", "talent:3", "combat:en"...).
    O resultado abre na janela de rolagem (x-roll-dialog), que a tela deve incluir.
--}}
<form class="test-buttons" method="POST" action="{{ route('characters.test', $character) }}" aria-label="Testar {{ $label }}" data-roll-dialog="Teste · {{ $label }}">
    @csrf
    <input type="hidden" name="target" value="{{ $target }}">
    <x-icon name="dice" :size="16" class="test-buttons__icon" />
    @foreach ([
        ['easy', 'F', 'Fácil (+'.rtrim(rtrim(number_format($rules->easyModifier(), 2, ',', ''), '0'), ',').')'],
        ['normal', 'N', 'Normal'],
        ['hard', 'D', 'Difícil (÷'.rtrim(rtrim(number_format($rules->hardDivisor(), 2, ',', ''), '0'), ',').')'],
        ['extreme', 'E', 'Extremo (÷'.rtrim(rtrim(number_format($rules->extremeDivisor(), 2, ',', ''), '0'), ',').')'],
    ] as [$value, $short, $title])
        <button type="submit" name="difficulty" value="{{ $value }}" class="test-buttons__button test-buttons__button--{{ $value }}" title="Testar {{ $label }}: {{ $title }}" aria-label="Testar {{ $label }}: {{ $title }}">{{ $short }}</button>
    @endforeach
</form>
