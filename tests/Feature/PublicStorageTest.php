<?php

declare(strict_types=1);

namespace Tests\Feature;

use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Rota /storage/... que entrega o disco "public" quando a hospedagem não
 * permite criar o link public/storage.
 */
class PublicStorageTest extends TestCase
{
    public function test_public_files_are_served_without_the_symlink(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('characters/retrato.png', 'conteudo-de-teste');

        $response = $this->get('/storage/characters/retrato.png');

        $response->assertOk();
        $response->assertHeader('X-Content-Type-Options', 'nosniff');
        $this->assertStringContainsString('max-age=604800', (string) $response->headers->get('Cache-Control'));
        $this->assertSame([], $response->headers->getCookies());
    }

    public function test_missing_files_unknown_types_and_traversal_return_not_found(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('notas/texto.php', '<?php echo 1;');

        $this->get('/storage/characters/inexistente.png')->assertNotFound();
        $this->get('/storage/notas/texto.php')->assertNotFound();
        $this->get('/storage/../../.env.png')->assertNotFound();
        $this->get('/storage/characters/..%2F..%2F..%2Fsegredo.png')->assertNotFound();
    }
}
