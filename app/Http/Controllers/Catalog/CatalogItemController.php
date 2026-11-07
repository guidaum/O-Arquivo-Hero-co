<?php

declare(strict_types=1);

namespace App\Http\Controllers\Catalog;

use App\Game\GameRules;
use App\Http\Controllers\Controller;
use App\Models\CatalogItem;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

/**
 * Catálogo Global de Itens (armas, armaduras, munição, consumíveis...).
 */
class CatalogItemController extends Controller
{
    private const DISK = 'public';

    private const IMAGE_FOLDER = 'catalog';

    public function index(Request $request): View
    {
        $search = trim((string) $request->query('busca'));
        $category = (string) $request->query('categoria');

        $items = CatalogItem::query()
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

        return $this->form(new CatalogItem(['category' => 'weapons', 'rarity' => 'Common', 'stats' => []]));
    }

    public function store(Request $request): RedirectResponse
    {
        Gate::authorize('create', CatalogItem::class);

        $data = $this->validated($request);

        $item = DB::transaction(function () use ($request, $data): CatalogItem {
            $item = new CatalogItem($data['attributes']);
            $item->created_by = $request->user()->id;
            $this->applyImage($request, $item);
            $item->save();
            $item->relatedItems()->sync($data['related']);

            return $item;
        });

        return redirect()->route('catalog.items.index')->with('status', 'Item "'.$item->name.'" criado no catálogo!');
    }

    public function edit(CatalogItem $item): View
    {
        Gate::authorize('update', $item);

        return $this->form($item);
    }

    public function update(Request $request, CatalogItem $item): RedirectResponse
    {
        Gate::authorize('update', $item);

        $data = $this->validated($request, $item);

        DB::transaction(function () use ($request, $item, $data): void {
            $item->fill($data['attributes']);
            $this->applyImage($request, $item);
            $item->save();
            $item->relatedItems()->sync($data['related']);
        });

        return redirect()->route('catalog.items.index')->with('status', 'Item "'.$item->name.'" atualizado!');
    }

    public function duplicate(Request $request, CatalogItem $item): RedirectResponse
    {
        Gate::authorize('create', CatalogItem::class);

        $copy = DB::transaction(static function () use ($request, $item): CatalogItem {
            $copy = $item->replicate(['firestore_id']);
            $copy->name = Str::limit($item->name.' (Cópia)', 255, '');
            $copy->created_by = $request->user()->id;
            $copy->save();
            $copy->relatedItems()->sync($item->relatedItems()->pluck('catalog_items.id'));

            return $copy;
        });

        return back()->with('status', 'Item duplicado como "'.$copy->name.'".');
    }

    public function destroy(CatalogItem $item): RedirectResponse
    {
        Gate::authorize('delete', $item);

        $path = $item->image_path;
        $item->delete();
        $this->deleteImageIfUnused($path);

        return back()->with('status', 'Item "'.$item->name.'" excluído do catálogo.');
    }

    private function form(CatalogItem $item): View
    {
        return view('catalog.items.form', [
            'item' => $item,
            'attributes' => GameRules::global()->attributes(),
            'weapons' => CatalogItem::query()
                ->where('category', 'weapons')
                ->when($item->exists, static fn ($query) => $query->whereKeyNot($item->getKey()))
                ->orderBy('name')
                ->get(['id', 'name']),
            'related' => $item->exists ? $item->relatedItems()->pluck('catalog_items.id')->all() : [],
        ]);
    }

    /**
     * @return array{attributes: array<string, mixed>, related: list<int>}
     */
    private function validated(Request $request, ?CatalogItem $item = null): array
    {
        $attributeIds = array_map(static fn (array $attribute): string => strtolower($attribute['id']), GameRules::global()->attributes());

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
                Rule::exists('catalog_items', 'id')->where('category', 'weapons'),
                Rule::notIn($item?->exists ? [$item->getKey()] : []),
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

    private function applyImage(Request $request, CatalogItem $item): void
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
     * Apaga a imagem local se nenhum outro item (ex.: uma cópia) a usa.
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
