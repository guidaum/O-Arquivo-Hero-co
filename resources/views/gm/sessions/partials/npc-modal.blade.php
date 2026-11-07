{{--
    Gerador de NPCs e monstros (handleGenerateNPC). Os campos de monstro só
    aparecem com "É um monstro" marcado (public/js/gm/index.js).
--}}
@php($bag = $errors->generateNpc)

<x-modal id="generate-npc" title="Forja de NPCs" wide :open-on-load="$bag->any()">
    <form method="POST" action="{{ route('gm.sessions.npcs.store', $session) }}" class="form" data-npc-form>
        @csrf

        @if ($bag->any())
            <div class="alert alert--error" role="alert">{{ $bag->first() }}</div>
        @endif

        <div class="form-grid">
            <x-form.field name="name" label="Nome" bag="generateNpc" maxlength="255" placeholder="Deixe vazio para sortear" id="npc-name" />
            <x-form.field name="level" label="Nível" type="number" bag="generateNpc" :value="1" min="1" max="20" required id="npc-level" />
            <x-form.field name="archetype" label="Arquétipo" type="select" bag="generateNpc" :options="$archetypes" value="random" id="npc-archetype" />
            <x-form.field name="trait_count" label="Traços sorteados" type="number" bag="generateNpc" :value="2" min="0" max="5" required id="npc-traits" />
        </div>

        <label class="checkbox gm-npc__monster">
            <input type="hidden" name="is_monster" value="0">
            <input type="checkbox" name="is_monster" value="1" data-npc-monster @checked(old('is_monster'))>
            É um monstro (hostil, com PV reforçado pelo nível de perigo)
        </label>

        <div class="form-grid" data-npc-monster-fields @unless (old('is_monster')) hidden @endunless>
            <x-form.field name="monster_type" label="Tipo de monstro" bag="generateNpc" maxlength="64" placeholder="Ex.: Morto-vivo, Fera, Demônio" id="npc-monster-type" />
            <x-form.field name="danger_level" label="Nível de perigo" type="select" bag="generateNpc" :options="array_combine($dangerLevels, $dangerLevels)" value="Moderado" id="npc-danger" />
            <x-form.field name="monster_size" label="Tamanho no mapa" type="select" bag="generateNpc" :options="[1 => '1×1 (médio)', 2 => '2×2 (grande)', 3 => '3×3 (enorme)', 4 => '4×4 (colossal)']" value="1" id="npc-size" />
        </div>

        @if ($dungeonMaps->isNotEmpty())
            <div class="form-grid">
                <x-form.field name="map_id" label="Colocar na masmorra" type="select" bag="generateNpc" :options="['' => 'Não colocar agora'] + $dungeonMaps->pluck('name', 'id')->all()" id="npc-map" />
                <label class="checkbox gm-npc__hidden">
                    <input type="hidden" name="hidden" value="0">
                    <input type="checkbox" name="hidden" value="1" @checked(old('hidden', true))>
                    Oculto aos jogadores
                </label>
            </div>
        @endif

        <div class="modal__actions">
            <button type="button" class="button button--secondary" data-modal-close>Cancelar</button>
            <button type="submit" class="button button--ember"><x-icon name="sparkles" :size="16" /> Gerar</button>
        </div>
    </form>
</x-modal>
