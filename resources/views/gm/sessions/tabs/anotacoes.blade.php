{{-- Anotações privadas do mestre (gmNotes): só o mestre da campanha vê. --}}
<form method="POST" action="{{ route('gm.sessions.notes', $session) }}" class="gm-notes glass">
    @csrf
    @method('PUT')

    <div class="gm-notes__header">
        <div>
            <p class="eyebrow"><x-icon name="lock" :size="12" /> Visível só para você</p>
            <h2>Anotações do Mestre</h2>
        </div>
        <button type="submit" class="button button--gold"><x-icon name="save" :size="16" /> Salvar notas</button>
    </div>

    <label class="visually-hidden" for="gm-notes">Anotações</label>
    <textarea
        id="gm-notes"
        name="gm_notes"
        class="field__input gm-notes__text"
        rows="18"
        maxlength="65000"
        placeholder="Ganchos de enredo, segredos dos NPCs, preparação da próxima sessão..."
    >{{ old('gm_notes', $session->gm_notes) }}</textarea>
    @error('gm_notes')
        <p class="field__error">{{ $message }}</p>
    @enderror

    <p class="muted">Para anotações rápidas por categoria (NPCs, ganchos, tesouros) use o menu de ações no canto da tela.</p>
</form>
