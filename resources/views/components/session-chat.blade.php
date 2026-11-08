@props(['session', 'character' => null, 'launcher' => true])

{{--
    Chat da Sessão (SessionChat.tsx): botão flutuante + painel. As mensagens
    chegam por polling (public/js/chat/session-chat.js → core/realtime.js).
    Com $character, o usuário fala em nome do personagem dele (e o "/r" usa os atributos dele).
--}}
@php
    $isGm = auth()->user()->can('update', $session);
    $config = [
        'sessionId' => $session->id,
        'pollUrl' => route('chat.index', $session),
        'postUrl' => route('chat.store', $session),
        'clearUrl' => $isGm ? route('chat.clear', $session) : null,
        'characterId' => $character?->id,
        'userId' => auth()->id(),
        'participants' => $session->chatParticipants(),
    ];
@endphp

@once
    @push('styles')
        <link rel="stylesheet" href="@asset('css/chat.css')">
    @endpush
    @push('scripts')
        <script type="module" src="@asset('js/chat/session-chat.js')"></script>
    @endpush
@endonce

{{-- Sem launcher, o chat abre pelo menu de ações (x-action-menu), que mostra as não lidas. --}}
<div @class(['chat', 'chat--embedded' => ! $launcher]) data-chat data-config="{{ json_encode($config) }}">
    @if ($launcher)
        <button type="button" class="chat-launcher" data-chat-toggle aria-expanded="false" aria-controls="chat-panel-{{ $session->id }}" title="Chat da Sessão">
            <x-icon name="message-square" :size="22" />
            <span class="visually-hidden">Abrir o chat da sessão</span>
            <span class="chat-launcher__badge" data-chat-badge hidden></span>
        </button>
    @endif

    <section class="chat-panel" id="chat-panel-{{ $session->id }}" data-chat-panel hidden aria-label="Chat da Sessão">
        <header class="chat-panel__header">
            <span class="icon-tile"><x-icon name="message-square" :size="18" /></span>
            <div class="chat-panel__title">
                <h2>Chat da Sessão</h2>
                <p class="eyebrow">{{ $session->name }}</p>
            </div>
            <div class="chat-panel__tools">
                @if ($isGm)
                    <button type="button" class="icon-button chat-panel__clear" data-chat-clear title="Limpar o chat">
                        <x-icon name="trash" :size="18" />
                        <span data-chat-clear-label class="visually-hidden">Limpar o chat</span>
                    </button>
                @endif
                <button type="button" class="icon-button hide-mobile" data-chat-expand title="Aumentar ou reduzir" aria-pressed="false">
                    <x-icon name="maximize" :size="18" />
                </button>
                <button type="button" class="icon-button" data-chat-toggle title="Fechar o chat">
                    <x-icon name="chevron-down" :size="20" />
                </button>
            </div>
        </header>

        <div class="chat-panel__messages" data-chat-messages role="log" aria-live="polite" aria-relevant="additions">
            <div class="chat-empty" data-chat-empty>
                <x-icon name="message-square" :size="40" />
                <p>Nenhuma mensagem ainda.</p>
                <p class="eyebrow">Seja o primeiro a falar!</p>
            </div>
        </div>

        <form class="chat-panel__form" data-chat-form>
            <div class="chat-mentions" data-chat-mentions role="listbox" aria-label="Mencionar" hidden></div>

            <div class="chat-attachment" data-chat-attachment hidden>
                <x-icon name="image" :size="16" />
                <span class="chat-attachment__name" data-chat-attachment-name></span>
                <button type="button" class="icon-button" data-chat-attachment-remove title="Remover a imagem"><x-icon name="x" :size="14" /></button>
            </div>

            <div class="chat-image-url" data-chat-image-row hidden>
                <input class="field__input" type="url" name="image_url" placeholder="Cole o link de uma imagem (https://...)" maxlength="2048" data-chat-image-url aria-label="Link da imagem">
                <label class="button button--secondary chat-image-url__file">
                    Enviar arquivo
                    <input type="file" name="image" accept="image/jpeg,image/png,image/webp,image/gif" class="visually-hidden" data-chat-image-file>
                </label>
            </div>

            <div class="chat-compose">
                <div class="chat-compose__box">
                    <textarea name="text" rows="1" maxlength="2000" placeholder="Mensagem... (@ menciona, /r rola)" data-chat-input aria-label="Mensagem"></textarea>
                    <div class="chat-compose__tools">
                        <button type="button" class="icon-button" data-chat-image-toggle title="Anexar imagem"><x-icon name="image" :size="16" /></button>
                        <button type="button" class="icon-button" data-chat-roll-hint title="Rolar dados"><x-icon name="dice" :size="16" /></button>
                    </div>
                </div>
                <button type="submit" class="chat-compose__send" data-chat-send title="Enviar" disabled>
                    <x-icon name="send" :size="20" />
                    <span class="visually-hidden">Enviar</span>
                </button>
            </div>
            <p class="chat-panel__error" data-chat-error role="alert"></p>
        </form>
    </section>
</div>
