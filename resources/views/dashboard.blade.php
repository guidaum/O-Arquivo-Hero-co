@php
    $firstName = strtok($user->name, ' ');
@endphp

<x-layouts.app :title="$gmView ? 'Painel do Mestre' : 'Minhas Lendas'">
    <x-page-header
        :title="($gmView ? 'Painel do Mestre' : 'Minhas Lendas').', '.$firstName"
        :subtitle="$gmView ? 'Gerencie suas campanhas, regras e fichas da mesa' : 'As crônicas e personagens da sua jornada'"
    >
        <x-slot:badges>
            <span @class(['badge', 'badge--pill', 'badge--gm' => $gmView, 'badge--player' => ! $gmView])>
                <x-icon :name="$gmView ? 'shield' : 'sword'" :size="12" />
                {{ $gmView ? 'Interface do Mestre' : 'Interface do Jogador' }}
            </span>
            @if ($user->isAdmin())
                <x-role-badge :role="$user->role" pill />
            @endif
        </x-slot:badges>

        <x-slot:actions>
            <button type="button" class="button button--secondary button--pill" data-modal-open="join-session">
                <x-icon name="key" />
                Entrar
            </button>
            @if ($gmView)
                @can('create', App\Models\GameSession::class)
                    <button type="button" class="button button--pill" data-modal-open="create-session">
                        <x-icon name="crown" />
                        Mestrar
                    </button>
                @endcan
            @endif
            @can('use-feature', 'characterCreation')
                <a class="button button--parchment button--pill" href="{{ route('characters.create') }}">
                    <x-icon name="plus" />
                    Nova Lenda
                </a>
            @endcan
        </x-slot:actions>
    </x-page-header>

    {{-- Alternador rápido entre Mestre e Jogador, disponível para todos, como no sistema antigo. --}}
    <div class="centered">
        <x-view-mode-toggle :mode="$navigation->viewMode()" large />
    </div>

    @if ($gmView)
        <x-section title="Minhas Campanhas Ativas" icon="users">
            <div class="card-grid">
                @forelse ($sessions as $session)
                    <x-campaign-card :session="$session" :href="route('gm.sessions.show', $session)" />
                @empty
                    <x-empty-state>Você ainda não criou nenhuma campanha.</x-empty-state>
                @endforelse
            </div>
        </x-section>

        <x-section title="Minhas Lendas (DMPCs/NPCs)" icon="sword" tone="ember">
            <div class="card-grid">
                @forelse ($characters as $character)
                    <x-character-card :character="$character" :stat-attributes="$cardAttributes" :deletable="$user->can('delete', $character)" />
                @empty
                    <x-empty-state>Nenhum personagem criado.</x-empty-state>
                @endforelse
            </div>
        </x-section>
    @else
        <x-section title="Minhas Campanhas" icon="history">
            <div class="card-grid">
                @forelse ($sessions as $session)
                    @php
                        $ownCharacter = $characterBySession->get($session->id);
                        $sessionHref = match (true) {
                            $ownCharacter !== null && auth()->user()->can('use-feature', 'characterSheet') => route('characters.show', $ownCharacter),
                            auth()->user()->can('use-feature', 'journal') => route('journal.index', ['visao' => 'campanha', 'campanha' => $session->id]),
                            default => null,
                        };
                    @endphp
                    <x-campaign-card :session="$session" show-gm :href="$sessionHref" />
                @empty
                    <x-empty-state>Você ainda não participa de nenhuma campanha.</x-empty-state>
                @endforelse
            </div>
        </x-section>

        <x-section title="Lendas Ativas" icon="users">
            <div class="card-grid">
                @forelse ($characters as $character)
                    <x-character-card :character="$character" :stat-attributes="$cardAttributes" :deletable="$user->can('delete', $character)" />
                @empty
                    <x-empty-state>Nenhum personagem criado ainda. Que tal forjar a sua primeira lenda?</x-empty-state>
                @endforelse
            </div>
        </x-section>
    @endif

    {{-- Exclusão de personagem pelo dono: a lixeira de cada cartão preenche este formulário. --}}
    <x-modal id="delete-character" title="Excluir Personagem?" danger>
        <div class="confirm-box">
            <p>
                Tem certeza que deseja excluir <strong>"<span data-modal-text="name"></span>"</strong>?
                Perícias, poderes, traços, itens, anotações e tokens nas masmorras também serão apagados.
                Esta ação não pode ser desfeita.
            </p>
        </div>

        <form class="modal__actions" method="POST" action="#" data-modal-form>
            @csrf
            @method('DELETE')

            <button type="button" class="button button--secondary" data-modal-close>Cancelar</button>
            <button type="submit" class="button button--danger">
                <x-icon name="trash" :size="16" />
                Sim, Excluir
            </button>
        </form>
    </x-modal>

    {{-- Entrar numa campanha pelo código que o mestre compartilhou. --}}
    <x-modal id="join-session" title="Entrar em Campanha" :open-on-load="$errors->joinSession->isNotEmpty()">
        <form method="POST" action="{{ route('sessions.join') }}" class="form">
            @csrf
            <x-form.field name="code" label="Código da sessão" bag="joinSession" required maxlength="32" placeholder="Ex.: ABC123" autocomplete="off" class="input--code" />
            <div class="modal__actions">
                <button type="button" class="button button--secondary" data-modal-close>Cancelar</button>
                <button type="submit" class="button button--ember">Entrar na Jornada</button>
            </div>
        </form>
    </x-modal>

    @if ($gmView)
        @can('create', App\Models\GameSession::class)
            <x-modal id="create-session" title="Nova Campanha" :open-on-load="$errors->createSession->isNotEmpty()">
                <form method="POST" action="{{ route('sessions.store') }}" class="form">
                    @csrf
                    <x-form.field name="name" label="Nome da campanha" bag="createSession" required maxlength="255" placeholder="Ex.: As Crônicas de Eldoria" />
                    <x-form.field name="description" label="Descrição" type="textarea" bag="createSession" rows="3" maxlength="5000" />
                    <p class="field__hint">As regras começam iguais às Configurações Base; ajuste depois em "Regras da Campanha".</p>
                    <div class="modal__actions">
                        <button type="button" class="button button--secondary" data-modal-close>Cancelar</button>
                        <button type="submit" class="button">Criar Campanha</button>
                    </div>
                </form>
            </x-modal>
        @endcan
    @endif
</x-layouts.app>
