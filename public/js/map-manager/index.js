// Gerenciador de Mapas: formulários de criar/editar mapa.
// - os campos de mundo (escala) ou masmorra (tema e grade) aparecem conforme o tipo;
// - a prévia da imagem mostra as dimensões e, numa masmorra nova, sugere a
//   grade pela proporção (16:9 → 24×14, quadrado → 24×24, vertical → 14×24);
// - o nome do arquivo vira o nome do mapa quando o campo está vazio.

function ratioLabel(width, height) {
    const ratio = width / height;
    let label = `${width} × ${height}`;

    if (Math.abs(ratio - 16 / 9) < 0.15) label += ' (16:9)';
    else if (Math.abs(ratio - 1) < 0.15) label += ' (1:1 Quadrado)';
    else if (Math.abs(ratio - 21 / 9) < 0.2) label += ' (21:9 Panorâmico)';
    else if (ratio < 0.8) label += ' (Vertical)';

    return label;
}

function suggestedGrid(width, height) {
    const ratio = width / height;

    if (ratio >= 1.5) return [24, 14];
    if (ratio >= 0.85 && ratio <= 1.25) return [24, 24];
    if (ratio < 0.85) return [14, 24];

    return null;
}

function setupForm(form) {
    const isEdit = form.hasAttribute('data-edit-form');
    const field = (name) => form.querySelector(`[data-field="${name}"]`);
    const preview = form.querySelector('[data-map-preview]');
    const previewImage = form.querySelector('[data-map-preview-image]');
    const dimensions = form.querySelector('[data-map-dimensions]');
    const fileInput = form.querySelector('[data-map-image]');
    let objectUrl = null;

    const currentType = () => (isEdit ? form.dataset.type : form.querySelector('[data-map-type]:checked')?.value) ?? 'world';

    function syncType() {
        const type = currentType();
        form.querySelectorAll('[data-map-only]').forEach((group) => {
            group.hidden = group.dataset.mapOnly !== type;
            group.querySelectorAll('input').forEach((input) => { input.disabled = group.hidden; });
        });
    }

    function showPreview(url, suggest) {
        if (!url) {
            preview.hidden = true;
            return;
        }

        previewImage.onload = () => {
            const { naturalWidth: width, naturalHeight: height } = previewImage;
            dimensions.textContent = ratioLabel(width, height);

            const grid = suggest && currentType() === 'dungeon' ? suggestedGrid(width, height) : null;
            if (grid) {
                field('grid_cols').value = grid[0];
                field('grid_rows').value = grid[1];
                dimensions.textContent += ` · grade sugerida ${grid[0]}×${grid[1]}`;
            }
        };
        previewImage.src = url;
        preview.hidden = false;
    }

    form.querySelectorAll('[data-map-type]').forEach((radio) => radio.addEventListener('change', syncType));

    form.querySelectorAll('[data-grid-preset]').forEach((button) => button.addEventListener('click', () => {
        const [cols, rows] = button.dataset.gridPreset.split('x');
        field('grid_cols').value = cols;
        field('grid_rows').value = rows;
    }));

    fileInput?.addEventListener('change', () => {
        const file = fileInput.files[0];

        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = file ? URL.createObjectURL(file) : null;

        if (file && !isEdit && field('name').value.trim() === '') {
            const name = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim();
            field('name').value = name.charAt(0).toUpperCase() + name.slice(1);
        }

        showPreview(objectUrl, !isEdit);
    });

    syncType();

    return { syncType, showPreview };
}

const forms = new Map([...document.querySelectorAll('[data-map-form]')].map((form) => [form, setupForm(form)]));
const editForm = document.querySelector('[data-edit-form]');
const editDialog = document.getElementById('edit-map');

document.querySelectorAll('[data-edit-map]').forEach((button) => button.addEventListener('click', () => {
    const map = JSON.parse(button.dataset.editMap);
    const controls = forms.get(editForm);

    editForm.reset();
    editForm.action = map.action;
    editForm.dataset.type = map.type;
    editDialog.querySelector('.modal__title').textContent = `Editar "${map.name}"`;

    ['name', 'subtitle', 'default_scale', 'theme', 'grid_cols', 'grid_rows'].forEach((name) => {
        const input = editForm.querySelector(`[data-field="${name}"]`);
        if (input) input.value = map[name] ?? '';
    });
    editForm.querySelector('[data-edit-active]').checked = map.active;

    controls.syncType();
    controls.showPreview(map.image_url, false);
    editDialog.showModal();
}));
