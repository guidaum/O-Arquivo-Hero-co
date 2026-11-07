@props(['session', 'href' => null, 'showGm' => false])

{{--
    Cartão de campanha. Espera $session com players_count e journal_entries_count
    (withCount). Com showGm, mostra o mestre no lugar do código (visão do jogador).
--}}
<{{ $href ? 'a' : 'article' }} @if ($href) href="{{ $href }}" @endif class="campaign-card glass">
    <div class="campaign-card__cover">
        @if ($session->image_url)
            <img src="{{ $session->image_url }}" alt="" loading="lazy" referrerpolicy="no-referrer">
        @endif
    </div>

    <div class="campaign-card__body">
        <div class="campaign-card__heading">
            <div>
                <h3 class="campaign-card__title">{{ $session->name }}</h3>
                @if ($showGm)
                    <p class="eyebrow">Mestre: {{ $session->gm?->name ?? '—' }}</p>
                @else
                    <p class="eyebrow">Código: {{ $session->code }}</p>
                @endif
            </div>

            <span class="campaign-card__emblem">
                <x-icon name="history" />
            </span>
        </div>

        <div class="campaign-card__meta">
            <span>
                <x-icon name="users" :size="14" />
                {{ $session->players_count ?? 0 }} {{ ($session->players_count ?? 0) === 1 ? 'Jogador' : 'Jogadores' }}
            </span>
            <span>
                <x-icon name="scroll" :size="14" />
                {{ $session->journal_entries_count ?? 0 }} {{ ($session->journal_entries_count ?? 0) === 1 ? 'Registro' : 'Registros' }}
            </span>
        </div>
    </div>
</{{ $href ? 'a' : 'article' }}>
