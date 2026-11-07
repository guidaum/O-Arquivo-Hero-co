{{-- Linha da linha do tempo no formulário do diário. $index pode ser "__INDEX__" (modelo do repeater). --}}
@php($controller = \App\Http\Controllers\JournalEntryController::class)

<div class="repeater__row journal-row" data-repeater-row>
    <input class="field__input field__input--mono journal-row__time" name="timeline[{{ $index }}][time]" value="{{ $item['time'] ?? '' }}" maxlength="32" placeholder="14:00" aria-label="Momento">

    <select class="field__input journal-row__select" name="timeline[{{ $index }}][type]" aria-label="Tipo do evento">
        @foreach ($controller::TIMELINE_TYPES as $type)
            <option value="{{ $type }}" @selected(($item['type'] ?? 'Exploração') === $type)>{{ $type }}</option>
        @endforeach
    </select>

    <select class="field__input journal-row__select" name="timeline[{{ $index }}][status]" aria-label="Situação">
        @foreach ($controller::TIMELINE_STATUSES as $value => $label)
            <option value="{{ $value }}" @selected(($item['status'] ?? 'completed') === $value)>{{ $label }}</option>
        @endforeach
    </select>

    <input class="field__input" name="timeline[{{ $index }}][event]" value="{{ $item['event'] ?? '' }}" maxlength="1000" placeholder="O que aconteceu neste momento?" aria-label="Evento">

    <button type="button" class="icon-button" data-repeater-remove aria-label="Remover evento"><x-icon name="x" :size="16" /></button>
</div>
