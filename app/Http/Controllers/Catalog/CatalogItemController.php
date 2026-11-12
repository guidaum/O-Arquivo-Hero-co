<?php

declare(strict_types=1);

namespace App\Http\Controllers\Catalog;

use App\Game\GameRules;
use App\Http\Controllers\Catalog\Concerns\ManagesCampaignEntries;
use App\Http\Controllers\Controller;
use App\Models\CatalogItem;
use App\Models\GameSession;
use App\Support\CampaignLibrary;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

/**
 * Catálogo de Itens (armas, armaduras, munição, consumíveis...). As rotas
 * /catalogos editam a base (mudanças chegam às campanhas como sugestão);
 * as do Painel do Mestre, a versão da campanha. As armas compatíveis de uma
 * munição pertencem ao item: a versão da campanha usa as da base.
 */
class CatalogItemController extends Controller
{
    use ManagesCampaignEntries;

    private const DISK = 'public';

    private const IMAGE_FOLDER = 'catalog';

    public function index(Request $request): View
    {
        $search = trim((string) $request->query('busca'));
        $category = (string) $request->query('categoria');

        $items = CatalogItem::query()
            ->base()
            ->when($search !== '', static fn ($query) => $query->where('name', 'like', '%'.$search.'%'))
            ->when(array_key_exists($category, CatalogItem::CATEGORIES), static fn ($query) => $query->where('category', $category))
            ->orderBy('name')
            ->paginate(20)
            ->withQueryString();

        return view('catalog.items.index', [
            'items' => $items,
            'search' => $search,
            'category' => $category,
        ]);
    }

    public function create(): View
    {
        Gate::authorize('create', CatalogItem::class);

        return $this->form(new CatalogItem(['category' => 'weapons', 'rarity' => 'Common', 'stats' => []]), self::baseForm(null));
    }

    public function store(Request $request): RedirectResponse
    {
        Gate::authorize('create', CatalogItem::class);

        $data = $this->validatedEntry($request, null, null);

        $item = DB::transaction(function () use ($request, $data): CatalogItem {
            $item = new CatalogItem;
            $item->created_by = $request->user()->id;
            $this->fillEntry($request, $item, $data);
            $item->save();
            $this->afterEntrySaved($item, $data, false);
            CampaignLibrary::baseCreated($item);

            return $item;
        });

        return redirect()->route('catalog.items.index')->with('status', 'Item "'.$item->name.'" criado no catálogo! As campanhas existentes o recebem como sugestão.');
    }

    public function edit(CatalogItem $item): View
    {
        Gate::authorize('update', $item);
        abort_unless($item->isBase(), 404);

        return $this->form($item, self::baseForm($item));
    }

    public function update(Request $request, CatalogItem $item): RedirectResponse
    {
        Gate::authorize('update', $item);
        abort_unless($item->isBase(), 404);

        $data = $this->validatedEntry($request, null, $item);

        DB::transaction(function () use ($request, $item, $data): void {
            $this->fillEntry($request, $item, $data);
            CampaignLibrary::baseUpdating($item);
            $item->save();
            $this->afterEntrySaved($item, $data, false);
        });

        return redirect()->route('catalog.items.index')->with('status', 'Item "'.$item->name.'" atualizado! As campanhas recebem a mudança como sugestão.');
    }

    public function duplicate(Request $request, CatalogItem $item): RedirectResponse
    {
        Gate::authorize('create', CatalogItem::class);
        abort_unless($item->isBase(), 404);

        $copy = DB::transaction(static function () use ($request, $item): CatalogItem {
            $copy = $item->replicate(['firestore_id', 'version', 'base_version']);
            $copy->name = Str::limit($item->name.' (Cópia)', 255, '');
            $copy->created_by = $request->user()->id;
            $copy->save();
            $copy->relatedItems()->sync($item->relatedItems()->pluck('catalog_items.id'));
            CampaignLibrary::baseCreated($copy);

            return $copy;
        });

        return back()->with('status', 'Item duplicado como "'.$copy->name.'".');
    }

    public function destroy(CatalogItem $item): RedirectResponse
    {
        Gate::authorize('delete', $item);
        abort_unless($item->isBase(), 404);

        // Sai da base e das campanhas novas; as campanhas existentes ficam com a sua cópia (e a imagem).
        DB::transaction(static fn () => CampaignLibrary::baseArchived($item));

        return back()->with('status', 'Item "'.$item->name.'" excluído da base. As campanhas que já o usavam continuam com ele.');
    }

    protected function libraryModel(): string
    {
        return CatalogItem::class;
    }

    /**
     * @param  array{action: string, method: string, cancel: string, session: ?GameSession, notice: ?string, version: bool}  $form
     */
    protected function form(Model $entry, array $form, ?int $suggestionId = null): View
    {
        $weapons = $form['session'] !== null
            ? CampaignLibrary::for($form['session'])->entries(CatalogItem::class)->where('category', 'weapons')->values()
            : CatalogItem::query()->base()->where('category', 'weapons')->orderBy('name')->get(['id', 'name']);

        return view('catalog.items.form', [
            'item' => $entry,
            'attributes' => GameRules::forSession($form['session'])->attributes(),
            // A versão da campanha usa as armas compatíveis da base.
            'weapons' => $form['version'] ? collect() : $weapons->reject(static fn (CatalogItem $weapon): bool => $entry->exists && $weapon->id === $entry->getKey())->values(),
            'related' => $entry->exists ? $entry->relatedItems()->pluck('catalog_items.id')->all() : [],
            'form' => $form,
        ]);
    }

    /**
     * @return array{attributes: array<string, mixed>, related: list<int>}
     */
    protected function validatedEntry(Request $request, ?GameSession $session, ?Model $entry): array
    {
        $attributeIds = array_map(static fn (array $attribute): string => strtolower($attribute['id']), GameRules::forSession($session)->attributes());
        $weaponIds = $session !== null
            ? CampaignLibrary::for($session)->entries(CatalogItem::class)->where('category', 'weapons')->keys()->all()
            : CatalogItem::query()->base()->where('category', 'weapons')->pluck('id')->all();

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'category' => ['required', Rule::in(array_keys(CatalogItem::CATEGORIES))],
            'rarity' => ['required', Rule::in(array_keys(CatalogItem::RARITIES))],
            'weight' => ['required', 'numeric', 'min:0', 'max:100000'],
            'value' => ['required', 'integer', 'min:0', 'max:1000000000'],
            'damage' => ['nullable', 'string', 'max:64'],
            'defense' => ['required', 'integer', 'min:0', 'max:1000'],
            'bonus_text' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'is_starting_item' => ['boolean'],
            'stats' => ['array'],
            'stats.*' => ['nullable', 'integer', 'min:-100', 'max:100'],
            'image' => ['nullable', 'image', 'max:2048'],
            'remove_image' => ['boolean'],
            'related' => ['array'],
            'related.*' => [
                'integer',
                Rule::in($weaponIds),
                Rule::notIn($entry?->exists ? [$entry->getKey()] : []),
            ],
        ]);

        // Só bônus diferentes de zero e de atributos existentes.
        $stats = [];

        foreach ($data['stats'] ?? [] as $attribute => $bonus) {
            if (in_array((string) $attribute, $attributeIds, true) && (int) $bonus !== 0) {
                $stats[(string) $attribute] = (int) $bonus;
            }
        }

        return [
            'attributes' => [
                ...collect($data)->only(['name', 'category', 'rarity', 'weight', 'value', 'damage', 'defense', 'bonus_text', 'description'])->all(),
                'is_starting_item' => (bool) ($data['is_starting_item'] ?? false),
                'stats' => $stats,
            ],
            // Munição indica as armas compatíveis; outras categorias não têm vínculo.
            'related' => $data['category'] === 'ammo' ? array_map('intval', $data['related'] ?? []) : [],
        ];
    }

    /**
     * @param  array{attributes: array<string, mixed>, related: list<int>}  $data
     */
    protected function fillEntry(Request $request, Model $entry, array $data): void
    {
        $entry->fill($data['attributes']);
        $this->applyImage($request, $entry);
    }

    /**
     * @param  array{attributes: array<string, mixed>, related: list<int>}  $data
     */
    protected function afterEntrySaved(Model $entry, array $data, bool $isVersion): void
    {
        if (! $isVersion) {
            $entry->relatedItems()->sync($data['related']);
        }
    }

    /**
     * @return array{action: string, method: string, cancel: string, session: null, notice: ?string, version: bool}
     */
    private static function baseForm(?CatalogItem $item): array
    {
        return [
            'action' => $item !== null ? route('catalog.items.update', $item) : route('catalog.items.store'),
            'method' => $item !== null ? 'PUT' : 'POST',
            'cancel' => route('catalog.items.index'),
            'session' => null,
            'notice' => null,
            'version' => false,
        ];
    }

    private function applyImage(Request $request, Model $item): void
    {
        $previous = $item->getOriginal('image_path');

        if ($request->hasFile('image')) {
            $item->image_path = $request->file('image')->store(self::IMAGE_FOLDER, self::DISK);
        } elseif ($request->boolean('remove_image')) {
            $item->image_path = null;
        }

        if ($previous !== null && $previous !== $item->image_path) {
            DB::afterCommit(fn () => $this->deleteImageIfUnused($previous));
        }
    }

    /**
     * Apaga a imagem local se nenhum outro item (ex.: uma cópia ou a versão
     * de uma campanha) a usa.
     */
    private function deleteImageIfUnused(?string $path): void
    {
        if ($path === null || Str::startsWith($path, ['http://', 'https://'])) {
            return;
        }

        if (! CatalogItem::query()->where('image_path', $path)->exists()) {
            Storage::disk(self::DISK)->delete($path);
        }
    }
}
