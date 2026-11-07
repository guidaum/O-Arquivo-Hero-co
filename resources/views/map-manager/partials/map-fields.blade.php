{{--
    Campos do mapa (criar e editar). Os grupos [data-map-only="world|dungeon"]
    aparecem conforme o tipo (public/js/map-manager/index.js).
    $map: null ao criar (usa old()), true ao editar (valores vêm do botão).
--}}
<div class="form-grid">
    <x-form.field name="name" :id="$bag.'-name'" label="Nome do mapa" :bag="$bag" required maxlength="255" placeholder="Ex.: Reino de Valoria" data-field="name" />
    <x-form.field name="subtitle" :id="$bag.'-subtitle'" label="Subtítulo" :bag="$bag" maxlength="255" placeholder="Ex.: Terras do norte e passagens congeladas" data-field="subtitle" />
</div>

<div class="map-image-field">
    <x-form.field name="image" :id="$bag.'-image'" :label="$map ? 'Nova imagem (opcional)' : 'Imagem do mapa'" type="file" :bag="$bag" accept="image/jpeg,image/png,image/webp" :required="! $map" data-map-image hint="JPG, PNG ou WEBP, até 10 MB." />
    <figure class="map-image-field__preview" data-map-preview hidden>
        <img alt="Prévia do mapa" data-map-preview-image>
        <figcaption data-map-dimensions></figcaption>
    </figure>
</div>

<div data-map-only="world">
    <x-form.field name="default_scale" :id="$bag.'-default_scale'" label="Escala exibida" :bag="$bag" maxlength="64" placeholder="1 cm = 25 léguas" data-field="default_scale" />
</div>

<div data-map-only="dungeon" class="map-dungeon-fields">
    <div class="form-grid">
        <x-form.field name="theme" :id="$bag.'-theme'" label="Tema" :bag="$bag" maxlength="64" placeholder="Ex.: Subterrâneo & Cripta" data-field="theme" />
        <x-form.field name="grid_cols" :id="$bag.'-grid_cols'" label="Colunas da grade" type="number" :bag="$bag" min="4" max="80" :value="old('grid_cols', 24)" data-field="grid_cols" />
        <x-form.field name="grid_rows" :id="$bag.'-grid_rows'" label="Linhas da grade" type="number" :bag="$bag" min="4" max="80" :value="old('grid_rows', 14)" data-field="grid_rows" />
    </div>
    <div class="chips" role="group" aria-label="Atalhos de grade">
        @foreach (App\Models\CampaignMap::GRID_PRESETS as $label => [$cols, $rows])
            <button type="button" class="chip" data-grid-preset="{{ $cols }}x{{ $rows }}">{{ $label }}</button>
        @endforeach
    </div>
</div>
