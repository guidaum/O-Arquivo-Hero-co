{{--
    Linha de NPC no formulário do diário. $index pode ser "__INDEX__" (modelo do repeater).
    A imagem atual vai num campo oculto; o servidor só aceita caminhos que já são do registro.
--}}
@php
    $controller = \App\Http\Controllers\JournalEntryController::class;
    $imagePath = $npc['image_path'] ?? null;
    $imageUrl = $imagePath ? $entry->npcImageUrl($npc) : null;
@endphp

<div class="repeater__row npc-row" data-repeater-row>
    <span class="npc__image">
        @if ($imageUrl)
            <img src="{{ $imageUrl }}" alt="" referrerpolicy="no-referrer">
        @else
            <x-icon name="user" :size="20" />
        @endif
    </span>

    <div class="npc-row__fields">
        <input class="field__input" name="npcs[{{ $index }}][name]" value="{{ $npc['name'] ?? '' }}" maxlength="255" placeholder="Nome (ex.: Mestre Kenneth)" aria-label="Nome do NPC">
        <input class="field__input" name="npcs[{{ $index }}][role]" value="{{ $npc['role'] ?? '' }}" maxlength="255" placeholder="Papel (ex.: Comandante da Guarda)" aria-label="Papel do NPC">

        <select class="field__input" name="npcs[{{ $index }}][status]" aria-label="Atitude do NPC">
            @foreach ($controller::NPC_STATUSES as $status)
                <option value="{{ $status }}" @selected(($npc['status'] ?? 'Neutro') === $status)>{{ $status }}</option>
            @endforeach
        </select>

        <input class="field__input" type="file" name="npcs[{{ $index }}][image]" accept="image/jpeg,image/png,image/webp,image/gif" aria-label="Imagem do NPC">

        @if ($imagePath)
            <input type="hidden" name="npcs[{{ $index }}][image_path]" value="{{ $imagePath }}">
            <label class="checkbox">
                <input type="hidden" name="npcs[{{ $index }}][remove_image]" value="0">
                <input type="checkbox" name="npcs[{{ $index }}][remove_image]" value="1"> Remover imagem
            </label>
        @endif
    </div>

    <button type="button" class="icon-button" data-repeater-remove aria-label="Remover NPC"><x-icon name="x" :size="16" /></button>
</div>
