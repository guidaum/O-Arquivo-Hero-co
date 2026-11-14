<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\Pulse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Polling leve do tempo real (public/js/core/realtime.js): devolve a senha de
 * versão de cada canal pedido, sem sessão, cookies nem banco (rota fora do
 * middleware "web"). O navegador só chama o endpoint completo de um canal,
 * que usa o banco e a autorização, quando a senha muda.
 *
 * Os canais chegam assinados pelos endpoints autorizados (Pulse::sign());
 * canais com assinatura inválida são ignorados. A resposta não pode ficar
 * em cache (CDN/LiteSpeed da hospedagem).
 */
class PulseController extends Controller
{
    private const MAX_CHANNELS = 12;

    public function __invoke(Request $request): JsonResponse
    {
        $tokens = [];

        foreach (array_slice((array) $request->query('c', []), 0, self::MAX_CHANNELS) as $signed) {
            if (! is_string($signed) || strlen($signed) > 200) {
                continue;
            }

            $channel = Pulse::verify($signed);

            if ($channel !== null) {
                $tokens[$signed] = Pulse::token($channel);
            }
        }

        return response()->json(['tokens' => (object) $tokens])
            ->header('Cache-Control', 'no-store, private, max-age=0')
            ->header('X-LiteSpeed-Cache-Control', 'no-cache');
    }
}
