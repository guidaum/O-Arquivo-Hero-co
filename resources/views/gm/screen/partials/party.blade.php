{{--
    O Grupo: personagens dos jogadores com vida (fetch), ATP, números de
    combate e atributos totais da ficha. O nome abre a ficha em popup.
--}}
<section class="gm-screen__panel glass" aria-labelledby="screen-party-title">
    <header class="gm-screen__panel-header">
        <h2 id="screen-party-title"><x-icon name="users" :size="18" /> O Grupo <span class="tabs__count">{{ $party->count() }}</span></h2>
        @if ($party->isNotEmpty())
            <button type="button" class="button button--link" data-party-long-rest title="Descanso longo para todos os personagens dos jogadores">
                <x-icon name="moon" :size="14" /> Descanso do grupo
            </button>
        @endif
    </header>

    @forelse ($party as $character)
        @php
            $current = (int) ($character->current_pv ?? $character->max_pv);
            $percent = (int) $character->max_pv > 0 ? $current / (int) $character->max_pv * 100 : 0;
            $state = match (true) {
                $current <= 0 => 'down',
                $percent <= 25 => 'critical',
                $percent <= 50 => 'wounded',
                default => 'healthy',
            };
            $readyToLevel = (int) $character->xp_max > 0 && (int) $character->xp >= (int) $character->xp_max;
        @endphp

        <article class="screen-hero" data-health-card data-state="{{ $state }}" data-party-card>
            <header class="screen-hero__header">
                @include('gm.screen.partials.portrait', ['character' => $character])
                <div class="screen-hero__title">
                    <h3>
                        <button type="button" class="screen-link" data-sheet-open="{{ route('characters.show', $character) }}" data-sheet-name="{{ $character->name }}">{{ $character->name }}</button>
                    </h3>
                    <p class="muted">
                        {{ $character->class ?: 'Aventureiro' }} · Nv {{ $character->level }}
                        @if ($character->user) · {{ $character->user->name }} @endif
                    </p>
                </div>
                @if ($readyToLevel)
                    <span class="badge badge--pill badge--gm" title="O XP chegou ao máximo do nível">Subir nível</span>
                @endif
            </header>

            @include('gm.screen.partials.health', ['character' => $character])

            <dl class="screen-hero__combat">
                <div><dt>ATP</dt><dd>{{ (int) ($character->current_atp ?? $character->screen_atp_max) }}<small>/{{ $character->screen_atp_max }}</small></dd></div>
                @foreach ($combatStats as $key => $label)
                    <div><dt>{{ $label }}</dt><dd>{{ $character->screen_combat[$key] ?? 0 }}</dd></div>
                @endforeach
            </dl>

            <ul class="screen-hero__attributes" aria-label="Atributos de {{ $character->name }}">
                @foreach ($character->screen_attributes as $attribute)
                    <li title="{{ $attribute['label'] }}"><span>{{ $attribute['id'] }}</span> <strong>{{ $attribute['total'] }}</strong></li>
                @endforeach
            </ul>
        </article>
    @empty
        <x-empty-state icon="users" hint="Os jogadores entram com o código {{ $session->code }}.">
            Nenhum personagem de jogador nesta campanha ainda.
        </x-empty-state>
    @endforelse
</section>
