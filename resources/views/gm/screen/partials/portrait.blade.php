{{-- Retrato do personagem (ou ícone do tipo) com a cor dele na borda. --}}
<span class="screen-portrait" style="--accent: {{ preg_match('/^#[0-9a-fA-F]{6}$/', (string) $character->color) ? $character->color : 'var(--arcane)' }}">
    @if ($character->image_url)
        <img src="{{ $character->image_url }}" alt="" loading="lazy" data-no-zoom>
    @else
        <x-icon :name="$character->is_monster ? 'skull' : ($character->is_npc ? 'crown' : 'user')" :size="18" />
    @endif
</span>
