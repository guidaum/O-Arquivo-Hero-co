@props(['character', 'statAttributes' => [], 'deletable' => false])

@php
    // Ícones que o sistema antigo permitia escolher para o personagem.
    $icons = [
        'Shield' => 'shield', 'Sword' => 'sword', 'Zap' => 'zap', 'Flame' => 'flame', 'Eye' => 'eye',
        'Brain' => 'brain', 'Heart' => 'heart', 'Activity' => 'activity', 'Scroll' => 'scroll',
        'Dice6' => 'dice', 'Sparkles' => 'sparkles',
    ];
    $arcane = $character->color === 'arcane';
    $icon = $icons[$character->icon] ?? ($arcane ? 'shield' : 'sword');
    $xpPercent = $character->xp_max > 0 ? min(100, round($character->xp / $character->xp_max * 100, 1)) : 0;
    $stats = is_array($character->stats) ? $character->stats : [];
@endphp

{{--
    Cartão de personagem ("lenda") da página inicial. $statAttributes: primeiros atributos das regras.
    deletable: mostra a lixeira, que abre o modal "delete-character" da página (data-modal-action).
--}}
<div class="character-card-shell">
    <a
        href="{{ route('characters.show', $character) }}"
        @class(['character-card', 'character-card--arcane' => $arcane])
    >
        @if ($character->image_url)
            <img class="character-card__image" src="{{ $character->image_url }}" alt="" loading="lazy" referrerpolicy="no-referrer">
        @endif

        <div class="character-card__content">
            <div class="character-card__heading">
                <div>
                    <p class="character-card__meta">
                        Nível {{ $character->level }}@if ($character->class) • {{ $character->class }}@endif
                    </p>
                    <h3 class="character-card__name">{{ $character->name }}</h3>
                </div>

                <span class="character-card__emblem glass">
                    <x-icon :name="$icon" :size="24" />
                </span>
            </div>

            <div class="progress">
                <div class="progress__labels">
                    <span>PROGRESSO DE XP</span>
                    <span>{{ number_format($character->xp, 0, ',', '.') }} / {{ number_format($character->xp_max, 0, ',', '.') }}</span>
                </div>
                <div class="progress__track" role="progressbar" aria-label="Progresso de XP" aria-valuemin="0" aria-valuemax="100" aria-valuenow="{{ $xpPercent }}">
                    <div class="progress__bar" style="width: {{ $xpPercent }}%"></div>
                </div>
            </div>

            @if ($statAttributes !== [])
                <div class="stat-tiles">
                    @foreach ($statAttributes as $attribute)
                        <div class="stat-tile glass">
                            <p class="stat-tile__label">{{ strtoupper($attribute['id']) }}</p>
                            <p class="stat-tile__value">{{ $stats[$attribute['id']] ?? 0 }}</p>
                        </div>
                    @endforeach
                </div>
            @endif
        </div>
    </a>

    @if ($deletable)
        <button
            type="button"
            class="icon-button icon-button--danger character-card__delete"
            title="Excluir personagem"
            aria-label="Excluir {{ $character->name }}"
            data-modal-open="delete-character"
            data-modal-action="{{ route('characters.destroy', $character) }}"
            data-modal-text-name="{{ $character->name }}"
        >
            <x-icon name="trash" :size="16" />
        </button>
    @endif
</div>
