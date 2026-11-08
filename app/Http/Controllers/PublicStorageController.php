<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Storage;
use League\Flysystem\PathTraversalDetected;
use Symfony\Component\HttpFoundation\Response;

/**
 * Entrega os arquivos do disco "public" em /storage/... sem depender do link
 * simbólico public/storage (php artisan storage:link). Hospedagens que
 * bloqueiam symlink() e exec() no PHP não conseguem criar esse link.
 *
 * Quando o link existe, o servidor web entrega o arquivo direto e esta rota
 * nem é chamada. Só tipos de mídia enviados pelo sistema são servidos.
 */
class PublicStorageController extends Controller
{
    /** Extensões aceitas: imagens (uploads e importação) e sons da biblioteca. */
    private const EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp3', 'wav', 'ogg', 'm4a', 'webm'];

    /** Os nomes dos arquivos não se repetem, então a CDN e o navegador podem guardar por 7 dias. */
    private const MAX_AGE = 604800;

    public function __invoke(string $path): Response
    {
        abort_unless(in_array(strtolower(pathinfo($path, PATHINFO_EXTENSION)), self::EXTENSIONS, true), 404);

        $disk = Storage::disk('public');

        try {
            abort_unless($disk->exists($path) && ! is_dir($disk->path($path)), 404);

            // Arquivo direto (não streamed): aceita Range (sons) e responde 304 com Last-Modified.
            $response = response()->file($disk->path($path));
        } catch (PathTraversalDetected) {
            abort(404);
        }

        $response->headers->set('Cache-Control', 'public, max-age='.self::MAX_AGE);
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");

        return $response;
    }
}
