{{--
    Configurações da campanha: dados, imagem, situação, loja, jogadores e
    exclusão. Fórmulas e pontos ficam em "Regras da Campanha".
--}}
@php($settings = $errors->settings)

<div class="gm-settings">
    <form method="POST" action="{{ route('gm.sessions.update', $session) }}" enctype="multipart/form-data" class="gm-settings__main form">
        @csrf
        @method('PUT')

        <x-section title="Campanha" icon="castle">
            @if ($settings->any())
                <div class="alert alert--error" role="alert">{{ $settings->first() }}</div>
            @endif

            <div class="form-grid">
                <x-form.field name="name" label="Nome" bag="settings" :value="$session->name" maxlength="255" required id="settings-name" />
                <x-form.field name="image" label="Imagem de capa" type="file" bag="settings" accept="image/jpeg,image/png,image/webp" hint="JPG, PNG ou WEBP até 5 MB." id="settings-image" />
            </div>
            <x-form.field name="description" label="Descrição" type="textarea" bag="settings" :value="$session->description" maxlength="5000" rows="3" id="settings-description" />

            @if ($session->image_url)
                <div class="gm-settings__cover">
                    <img src="{{ $session->image_url }}" alt="Capa atual da campanha">
                    <label class="checkbox"><input type="checkbox" name="remove_image" value="1"> Remover imagem</label>
                </div>
            @endif

            <div class="gm-settings__switches">
                <label class="gm-settings__switch">
                    <span>
                        <strong>Campanha ativa</strong>
                        <small class="muted">Campanhas inativas não aceitam novos jogadores pelo código.</small>
                    </span>
                    <span class="switch">
                        <input type="hidden" name="active" value="0">
                        <input type="checkbox" name="active" value="1" @checked(old('active', $session->active))>
                        <span class="switch__track"><span class="switch__thumb"></span></span>
                    </span>
                </label>
                <label class="gm-settings__switch">
                    <span>
                        <strong>Loja aberta</strong>
                        <small class="muted">Os jogadores compram itens do catálogo pelo inventário.</small>
                    </span>
                    <span class="switch">
                        <input type="hidden" name="shop_enabled" value="0">
                        <input type="checkbox" name="shop_enabled" value="1" @checked(old('shop_enabled', $session->shop_enabled))>
                        <span class="switch__track"><span class="switch__thumb"></span></span>
                    </span>
                </label>
            </div>
        </x-section>

        <x-section title="Itens da loja" icon="store">
            <p class="muted">Sem itens marcados, a loja oferece o catálogo inteiro. Marcados {{ count($shopItemIds) }} de {{ $catalogItems->count() }}.</p>

            @if ($catalogItems->isEmpty())
                <x-empty-state>O catálogo de itens está vazio.</x-empty-state>
            @else
                <div class="toolbar">
                    <button type="button" class="button button--secondary button--pill" data-check-all="[data-shop-item]"><x-icon name="check" :size="14" /> Marcar todos</button>
                    <button type="button" class="button button--secondary button--pill" data-uncheck-all="[data-shop-item]"><x-icon name="x" :size="14" /> Desmarcar todos</button>
                </div>
                <div class="gm-settings__shop">
                    @foreach ($catalogItems as $item)
                        <label class="checkbox gm-settings__item">
                            <input type="checkbox" name="shop_items[]" value="{{ $item->id }}" data-shop-item @checked(in_array($item->id, old('shop_items', $shopItemIds)))>
                            <span>{{ $item->name }}</span>
                            <small class="muted">{{ number_format((int) $item->value, 0, ',', '.') }} moedas</small>
                        </label>
                    @endforeach
                </div>
            @endif
        </x-section>

        <div class="form-actions">
            <button type="submit" class="button button--gold"><x-icon name="save" :size="16" /> Salvar configurações</button>
        </div>
    </form>

    <aside class="gm-settings__side">
        <x-section title="Jogadores" icon="users">
            <form method="POST" action="{{ route('gm.sessions.players.store', $session) }}" class="gm-settings__invite">
                @csrf
                <x-form.field name="email" label="Convidar por e-mail" type="email" bag="invitePlayer" maxlength="255" placeholder="jogador@exemplo.com" required id="invite-email" />
                <button type="submit" class="button button--secondary"><x-icon name="user-plus" :size="16" /> Convidar</button>
            </form>

            @if ($session->players->isEmpty())
                <x-empty-state>Nenhum jogador na campanha.</x-empty-state>
            @else
                <ul class="gm-settings__players">
                    @foreach ($session->players as $player)
                        <li>
                            <x-avatar :user="$player" />
                            <span class="gm-settings__player-name">{{ $player->name }}</span>
                            <button
                                type="button"
                                class="icon-button icon-button--danger"
                                title="Remover da campanha"
                                data-modal-open="confirm-remove"
                                data-modal-action="{{ route('gm.sessions.players.destroy', [$session, $player]) }}"
                                data-modal-text-name="{{ $player->name }}"
                            >
                                <x-icon name="x" :size="16" />
                                <span class="visually-hidden">Remover {{ $player->name }}</span>
                            </button>
                        </li>
                    @endforeach
                </ul>
            @endif
        </x-section>

        <x-section title="Zona de perigo" icon="alert-triangle" tone="ember">
            <p class="muted">Excluir a campanha apaga chat, mapas próprios, tokens, notas e regras dela. Os personagens ficam sem campanha.</p>
            <button type="button" class="button button--danger button--block" data-modal-open="confirm-session-delete">
                <x-icon name="trash" :size="16" /> Excluir campanha
            </button>
        </x-section>
    </aside>
</div>

<x-modal id="confirm-remove" title="Remover jogador" danger>
    <div class="confirm-box">
        <div class="confirm-box__row">
            <span class="eyebrow">Jogador</span>
            <strong data-modal-text="name"></strong>
        </div>
        <p>O jogador sai da campanha, mas os personagens dele continuam nela.</p>
    </div>
    <form class="modal__actions" method="POST" action="#" data-modal-form>
        @csrf
        @method('DELETE')
        <button type="button" class="button button--secondary" data-modal-close>Cancelar</button>
        <button type="submit" class="button button--danger">Remover</button>
    </form>
</x-modal>

<x-modal id="confirm-session-delete" title="Excluir campanha" danger :open-on-load="$errors->deleteSession->any()">
    <form method="POST" action="{{ route('gm.sessions.destroy', $session) }}" class="form">
        @csrf
        @method('DELETE')
        <p>Esta ação é irreversível. Digite <strong>{{ $session->name }}</strong> para confirmar.</p>
        <x-form.field name="confirmation" label="Nome da campanha" bag="deleteSession" autocomplete="off" required id="delete-confirmation" />
        <div class="modal__actions">
            <button type="button" class="button button--secondary" data-modal-close>Cancelar</button>
            <button type="submit" class="button button--danger"><x-icon name="trash" :size="16" /> Excluir para sempre</button>
        </div>
    </form>
</x-modal>
