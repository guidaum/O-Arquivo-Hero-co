{{--
    Painel do Mestre de uma campanha: convite, mesa (jogadores e personagens),
    atalhos e chat. Bestiário, encontros, áudio e vida dos personagens: fase 9.
--}}
<x-layouts.app :title="$session->name">
    @push('styles')
        <link rel="stylesheet" href="{{ asset('css/gm-session.css') }}">
    @endpush

    <x-page-header :title="$session->name" subtitle="Painel do Mestre">
        <x-slot:badges>
            <span class="badge badge--pill badge--gm"><x-icon name="shield" :size="12" /> Mestre da campanha</span>
            @unless ($session->active)
                <span class="badge badge--pill">Inativa</span>
            @endunless
        </x-slot:badges>

        <x-slot:actions>
            <a class="button button--secondary button--pill" href="{{ route('gm.sessions.rules.edit', $session) }}">
                <x-icon name="sliders" /> Regras da Campanha
            </a>
            @can('use-feature', 'journal')
                <a class="button button--secondary button--pill" href="{{ route('journal.index', ['visao' => 'campanha', 'campanha' => $session->id]) }}">
                    <x-icon name="book-open" /> Diário
                </a>
            @endcan
            <a class="button button--secondary button--pill" href="{{ route('catalog.talents.index') }}">
                <x-icon name="library" /> Catálogos
            </a>
        </x-slot:actions>
    </x-page-header>

    <div class="gm-session">
        <section class="gm-session__invite glass">
            <p class="eyebrow">Código de convite</p>
            <div class="gm-session__code">
                <code>{{ $session->code }}</code>
                <button type="button" class="icon-button icon-button--bordered" data-copy="{{ $session->code }}" title="Copiar código">
                    <x-icon name="copy" :size="16" />
                    <span class="visually-hidden">Copiar código</span>
                </button>
            </div>
            <p class="muted">Os jogadores usam este código em "Entrar" no painel inicial.</p>

            <dl class="gm-session__stats">
                <div><dt>Jogadores</dt><dd>{{ $session->players_count }}</dd></div>
                <div><dt>Personagens</dt><dd>{{ $session->characters->count() }}</dd></div>
                <div><dt>Registros</dt><dd>{{ $session->journal_entries_count }}</dd></div>
            </dl>

            @if ($session->description)
                <p class="gm-session__description">{{ $session->description }}</p>
            @endif
        </section>

        <x-section title="A Mesa" icon="users" class="gm-session__table">
            @if ($session->players->isEmpty() && $session->characters->isEmpty())
                <x-empty-state>Nenhum jogador entrou ainda. Compartilhe o código de convite.</x-empty-state>
            @else
                <ul class="table-list">
                    @foreach ($session->players as $player)
                        <li class="table-list__row glass">
                            <x-avatar :user="$player" />
                            <div class="table-list__main">
                                <strong>{{ $player->name }}</strong>
                                <div class="table-list__characters">
                                    @forelse ($charactersByUser->get($player->id, collect()) as $character)
                                        <a class="chip" href="{{ route('characters.show', $character) }}">
                                            {{ $character->name }} <small>{{ $character->class }} · Nv {{ $character->level }}</small>
                                        </a>
                                    @empty
                                        <span class="muted">Sem personagem nesta campanha.</span>
                                    @endforelse
                                </div>
                            </div>
                        </li>
                    @endforeach

                    @php($gmCharacters = $charactersByUser->get($session->gm_id, collect()))
                    @if ($gmCharacters->isNotEmpty())
                        <li class="table-list__row glass">
                            <span class="icon-tile"><x-icon name="crown" :size="18" /></span>
                            <div class="table-list__main">
                                <strong>Personagens do mestre (DMPCs/NPCs)</strong>
                                <div class="table-list__characters">
                                    @foreach ($gmCharacters as $character)
                                        <a class="chip" href="{{ route('characters.show', $character) }}">{{ $character->name }} <small>Nv {{ $character->level }}</small></a>
                                    @endforeach
                                </div>
                            </div>
                        </li>
                    @endif
                </ul>
            @endif
        </x-section>

        <p class="gm-session__soon muted">
            <x-icon name="hammer" :size="16" />
            Bestiário, gerador de encontros, áudio ambiente e acompanhamento de vida chegam com o Painel do Mestre completo.
        </p>
    </div>

    <x-action-menu :session="$session" notes="campaign" />
</x-layouts.app>
