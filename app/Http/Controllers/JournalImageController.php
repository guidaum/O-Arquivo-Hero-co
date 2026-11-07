<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\JournalEntry;
use App\Models\JournalEntryImage;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Galeria de imagens de um registro do diário.
 */
class JournalImageController extends Controller
{
    private const MAX_IMAGES = 30;

    public function store(Request $request, JournalEntry $journalEntry): RedirectResponse
    {
        Gate::authorize('update', $journalEntry);

        $count = $journalEntry->images()->count();

        $request->validate([
            'images' => ['required', 'array', 'min:1', 'max:'.max(0, self::MAX_IMAGES - $count)],
            'images.*' => ['image', 'mimes:jpeg,png,webp,gif', 'max:4096'],
        ], [
            'images.max' => 'A galeria aceita até '.self::MAX_IMAGES.' imagens por registro.',
        ], [
            'images' => 'imagens',
            'images.*' => 'imagem',
        ]);

        foreach ($request->file('images') as $offset => $file) {
            $journalEntry->images()->create([
                'path' => $file->store('journal', JournalEntryController::DISK),
                'position' => $count + $offset,
            ]);
        }

        return redirect()->route('journal.index', ['registro' => $journalEntry->id])->with('status', 'Imagens adicionadas à galeria!');
    }

    public function destroy(JournalEntry $journalEntry, JournalEntryImage $image): RedirectResponse
    {
        Gate::authorize('update', $journalEntry);
        abort_unless($image->journal_entry_id === $journalEntry->id, 404);

        $image->delete();
        JournalEntryController::deleteFiles([$image->path]);

        return redirect()->route('journal.index', ['registro' => $journalEntry->id])->with('status', 'Imagem removida da galeria.');
    }
}
