<?php

declare(strict_types=1);

use App\Http\Controllers\Admin\CharacterController as AdminCharacterController;
use App\Http\Controllers\AmbienceController;
use App\Http\Controllers\CampaignLibraryController;
use App\Http\Controllers\SoundBoardController;
use App\Http\Controllers\Admin\DashboardController as AdminDashboardController;
use App\Http\Controllers\Admin\FeatureController as AdminFeatureController;
use App\Http\Controllers\Admin\GameSessionController as AdminGameSessionController;
use App\Http\Controllers\Admin\SuggestionController as AdminSuggestionController;
use App\Http\Controllers\Admin\UserController as AdminUserController;
use App\Http\Controllers\Auth\GoogleAuthController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\NewPasswordController;
use App\Http\Controllers\Auth\PasswordResetLinkController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\Catalog\CatalogItemController;
use App\Http\Controllers\CharacterAbilityController;
use App\Http\Controllers\CharacterCreationController;
use App\Http\Controllers\CharacterEditController;
use App\Http\Controllers\CharacterSheetController;
use App\Http\Controllers\ChatController;
use App\Http\Controllers\GameSessionController;
use App\Http\Controllers\GmModifierController;
use App\Http\Controllers\MapDrawingController;
use App\Http\Controllers\MapManagerController;
use App\Http\Controllers\MapStudioController;
use App\Http\Controllers\MapPinController;
use App\Http\Controllers\MapPingController;
use App\Http\Controllers\WorldMapController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\PublicStorageController;
use App\Http\Controllers\Catalog\PowerController;
use App\Http\Controllers\Catalog\SkillController;
use App\Http\Controllers\Catalog\SuggestionController;
use App\Http\Controllers\Catalog\TalentController;
use App\Http\Controllers\Catalog\TraitController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DiceRollController;
use App\Http\Controllers\DungeonAnnotationController;
use App\Http\Controllers\DungeonController;
use App\Http\Controllers\DungeonTokenController;
use App\Http\Controllers\QuickNoteController;
use App\Http\Controllers\GmBestiaryController;
use App\Http\Controllers\GmCharacterController;
use App\Http\Controllers\GmPlayerController;
use App\Http\Controllers\GmSessionController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\InventoryItemController;
use App\Http\Controllers\ShopController;
use App\Http\Controllers\SuggestionSubmissionController;
use App\Http\Controllers\JournalEntryController;
use App\Http\Controllers\JournalImageController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\RuleSetController;
use App\Http\Controllers\ViewModeController;
use Illuminate\Support\Facades\Route;

// Pública: também é o link exigido pela tela de consentimento do Google.
Route::view('/politica-de-privacidade', 'legal.privacy')->name('privacy');

Route::middleware('guest')->group(function (): void {
    Route::get('/login', [LoginController::class, 'create'])->name('login');
    Route::post('/login', [LoginController::class, 'store'])->name('login.store');

    Route::get('/cadastro', [RegisterController::class, 'create'])->name('register');
    Route::post('/cadastro', [RegisterController::class, 'store'])->name('register.store');

    Route::get('/esqueci-senha', [PasswordResetLinkController::class, 'create'])->name('password.request');
    Route::post('/esqueci-senha', [PasswordResetLinkController::class, 'store'])
        ->middleware('throttle:6,1')
        ->name('password.email');

    Route::get('/redefinir-senha/{token}', [NewPasswordController::class, 'create'])->name('password.reset');
    Route::post('/redefinir-senha', [NewPasswordController::class, 'store'])->name('password.store');

    Route::get('/auth/google', [GoogleAuthController::class, 'redirect'])->name('auth.google.redirect');
    Route::get('/auth/google/callback', [GoogleAuthController::class, 'callback'])->name('auth.google.callback');
});

Route::middleware('auth')->group(function (): void {
    Route::get('/', DashboardController::class)->name('dashboard');
    Route::put('/modo-de-visao', [ViewModeController::class, 'update'])->name('view-mode.update');

    Route::get('/perfil', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::put('/perfil', [ProfileController::class, 'update'])->name('profile.update');
    Route::put('/perfil/senha', [ProfileController::class, 'updatePassword'])->name('profile.password');

    // Campanhas: o mestre cria, os jogadores entram pelo código.
    Route::post('/campanhas', [GameSessionController::class, 'store'])->name('sessions.store');
    Route::post('/campanhas/entrar', [GameSessionController::class, 'join'])->middleware('throttle:10,1')->name('sessions.join');

    // Chat da sessão (fetch + polling) e notificações de menções.
    Route::get('/campanhas/{gameSession}/chat', [ChatController::class, 'index'])->name('chat.index');
    Route::post('/campanhas/{gameSession}/chat', [ChatController::class, 'store'])->middleware('throttle:30,1')->name('chat.store');
    Route::delete('/campanhas/{gameSession}/chat', [ChatController::class, 'clear'])->name('chat.clear');
    // Ambientação sonora da campanha (polling no menu de ações) e efeitos "para a mesa".
    Route::get('/campanhas/{gameSession}/ambiente', [AmbienceController::class, 'state'])->name('ambience.state');
    Route::put('/campanhas/{gameSession}/ambiente', [AmbienceController::class, 'update'])->name('ambience.update');
    Route::post('/campanhas/{gameSession}/ambiente/efeito', [AmbienceController::class, 'effect'])->middleware('throttle:60,1')->name('ambience.effect');
    // Menu de ações: rolador de dados e anotações rápidas da campanha (fetch).
    Route::post('/dados/rolar', DiceRollController::class)->middleware('throttle:60,1')->name('dice.roll');
    Route::scopeBindings()->prefix('/campanhas/{gameSession}/notas')->name('sessions.notes.')->group(function (): void {
        Route::get('/', [QuickNoteController::class, 'sessionIndex'])->name('index');
        Route::post('/', [QuickNoteController::class, 'sessionStore'])->name('store');
        Route::delete('/', [QuickNoteController::class, 'sessionClear'])->name('clear');
        Route::put('/{note}', [QuickNoteController::class, 'sessionUpdate'])->name('update');
        Route::delete('/{note}', [QuickNoteController::class, 'sessionDestroy'])->name('destroy');
    });

    Route::get('/notificacoes', [NotificationController::class, 'index'])->name('notifications.index');
    Route::post('/notificacoes/lidas', [NotificationController::class, 'markRead'])->name('notifications.read');

    // Painel do Mestre: abas por query string (?aba=mesa|bestiario|encontros|anotacoes|configuracoes).
    Route::prefix('/mestre/sessoes/{gameSession}')->name('gm.sessions.')->group(function (): void {
        Route::get('/', [GmSessionController::class, 'show'])->name('show');
        Route::put('/configuracoes', [GmSessionController::class, 'update'])->name('update');
        Route::put('/anotacoes', [GmSessionController::class, 'updateNotes'])->name('notes');
        Route::delete('/', [GmSessionController::class, 'destroy'])->name('destroy');

        Route::post('/jogadores', [GmPlayerController::class, 'store'])->middleware('throttle:20,1')->name('players.store');
        Route::delete('/jogadores/{player}', [GmPlayerController::class, 'destroy'])->name('players.destroy');

        Route::post('/npcs', [GmCharacterController::class, 'generate'])->middleware('throttle:30,1')->name('npcs.store');
        Route::scopeBindings()->prefix('/personagens/{character}')->name('characters.')->group(function (): void {
            Route::put('/progresso', [GmCharacterController::class, 'progress'])->name('progress');
            Route::put('/vida', [GmCharacterController::class, 'health'])->name('health');
            Route::put('/monstro', [GmCharacterController::class, 'toggleMonster'])->name('monster');
            Route::post('/masmorra', [GmCharacterController::class, 'spawn'])->name('spawn');
            Route::delete('/', [GmCharacterController::class, 'destroy'])->name('destroy');
        });

        Route::put('/sons', [SoundBoardController::class, 'update'])->name('sounds.update');
        Route::post('/sons/biblioteca', [SoundBoardController::class, 'storeSound'])->middleware('throttle:20,1')->name('sounds.store');
        Route::delete('/sons/biblioteca/{customSound}', [SoundBoardController::class, 'destroySound'])->name('sounds.destroy');

        Route::get('/encontro', [GmBestiaryController::class, 'encounter'])->name('encounter');
        Route::post('/bestiario', [GmBestiaryController::class, 'spawn'])->middleware('throttle:30,1')->name('bestiary.spawn');
    });
    Route::get('/mestre/sessoes/{gameSession}/regras', [RuleSetController::class, 'editSession'])->name('gm.sessions.rules.edit');
    Route::put('/mestre/sessoes/{gameSession}/regras', [RuleSetController::class, 'updateSession'])->name('gm.sessions.rules.update');
    Route::put('/mestre/sessoes/{gameSession}/regras/base', [RuleSetController::class, 'adoptBase'])->name('gm.sessions.rules.adopt');
    Route::delete('/mestre/sessoes/{gameSession}/regras', [RuleSetController::class, 'restoreBase'])->name('gm.sessions.rules.restore');

    // Biblioteca da campanha: catálogos herdados da base, alterações da campanha e sugestões da base.
    Route::prefix('/mestre/sessoes/{gameSession}/biblioteca')->name('gm.sessions.library.')->group(function (): void {
        Route::get('/', [CampaignLibraryController::class, 'index'])->name('index');
        Route::post('/sugestoes', [CampaignLibraryController::class, 'bulk'])->name('bulk');

        foreach ([
            'talentos' => TalentController::class,
            'pericias' => SkillController::class,
            'poderes' => PowerController::class,
            'tracos' => TraitController::class,
            'itens' => CatalogItemController::class,
        ] as $type => $controller) {
            Route::get('/'.$type.'/novo', [$controller, 'campaignCreate'])->name($type.'.create');
            Route::post('/'.$type, [$controller, 'campaignStore'])->name($type.'.store');
            Route::get('/'.$type.'/{entry}/editar', [$controller, 'campaignEdit'])->whereNumber('entry')->name($type.'.edit');
            Route::put('/'.$type.'/{entry}', [$controller, 'campaignUpdate'])->whereNumber('entry')->name($type.'.update');
        }

        $types = implode('|', array_keys(\App\Support\CampaignLibrary::TYPES));
        Route::put('/{type}/{entry}/adotar', [CampaignLibraryController::class, 'adopt'])->where(['type' => $types, 'entry' => '[0-9]+'])->name('adopt');
        Route::put('/{type}/{entry}/manter', [CampaignLibraryController::class, 'keep'])->where(['type' => $types, 'entry' => '[0-9]+'])->name('keep');
        Route::put('/{type}/{entry}/visibilidade', [CampaignLibraryController::class, 'visibility'])->where(['type' => $types, 'entry' => '[0-9]+'])->name('visibility');
        Route::delete('/{type}/{entry}', [CampaignLibraryController::class, 'destroy'])->where(['type' => $types, 'entry' => '[0-9]+'])->name('destroy');
    });

    // Catálogos globais e regras (abas de biblioteca do GMDashboard antigo).
    Route::middleware('can:use-gm-tools')->prefix('catalogos')->name('catalog.')->group(function (): void {
        Route::redirect('/', '/catalogos/talentos')->name('index');

        Route::resource('talentos', TalentController::class)->except('show')
            ->parameters(['talentos' => 'talent'])->names('talents');
        Route::resource('pericias', SkillController::class)->except('show')
            ->parameters(['pericias' => 'skill'])->names('skills');
        Route::resource('poderes', PowerController::class)->except('show')
            ->parameters(['poderes' => 'power'])->names('powers');
        Route::resource('tracos', TraitController::class)->except('show')
            ->parameters(['tracos' => 'trait'])->names('traits');
        Route::resource('itens', CatalogItemController::class)->except('show')
            ->parameters(['itens' => 'item'])->names('items');
        Route::post('itens/{item}/duplicar', [CatalogItemController::class, 'duplicate'])->name('items.duplicate');

        // A revisão das sugestões fica no Painel Admin; o endereço antigo leva para lá.
        Route::redirect('sugestoes', '/admin/sugestoes?origem=jogadores')->name('suggestions.index');
        Route::get('sugestoes/{suggestion}/revisar', [SuggestionController::class, 'review'])->name('suggestions.review');
        Route::put('sugestoes/{suggestion}/recusar', [SuggestionController::class, 'reject'])->name('suggestions.reject');
        Route::delete('sugestoes/{suggestion}', [SuggestionController::class, 'destroy'])->name('suggestions.destroy');

        Route::middleware('can:access-admin')->group(function (): void {
            Route::get('regras', [RuleSetController::class, 'editGlobal'])->name('rules.edit');
            Route::put('regras', [RuleSetController::class, 'updateGlobal'])->name('rules.update');
        });
    });

    // Diário de Sessão.
    Route::middleware("can:use-feature,'journal'")->group(function (): void {
        Route::resource('diario', JournalEntryController::class)->except('show')
            ->parameters(['diario' => 'journalEntry'])->names('journal');
        Route::post('/diario/{journalEntry}/imagens', [JournalImageController::class, 'store'])->name('journal.images.store');
        Route::delete('/diario/{journalEntry}/imagens/{image}', [JournalImageController::class, 'destroy'])->name('journal.images.destroy');
    });

    // Criação de Personagem e sugestões dos jogadores (enviadas pelo assistente via fetch).
    Route::middleware("can:use-feature,'characterCreation'")->group(function (): void {
        Route::get('/personagens/criar', [CharacterCreationController::class, 'create'])->name('characters.create');
        Route::post('/personagens', [CharacterCreationController::class, 'store'])->name('characters.store');
    });
    Route::post('/sugestoes', [SuggestionSubmissionController::class, 'store'])->middleware('throttle:20,1')->name('suggestions.store');

    // Exclusão pelo dono no painel inicial (fora do recurso "ficha", como no sistema antigo).
    Route::delete('/ficha/{character}', [CharacterEditController::class, 'destroy'])->name('characters.destroy');

    // Ficha Geral.
    Route::middleware("can:use-feature,'characterSheet'")->prefix('ficha')->group(function (): void {
        Route::get('/', [CharacterSheetController::class, 'index'])->name('characters.sheet');
        Route::get('/{character}', [CharacterSheetController::class, 'show'])->name('characters.show');
        Route::post('/{character}/teste', [CharacterSheetController::class, 'test'])->name('characters.test');
        Route::put('/{character}/estado', [CharacterSheetController::class, 'updateVitals'])->name('characters.vitals');

        // Edição (mestre da campanha ou dono com a edição liberada).
        Route::put('/{character}/dados', [CharacterEditController::class, 'updateDetails'])->name('characters.details');
        Route::put('/{character}/liberar', [CharacterEditController::class, 'toggleUnlock'])->name('characters.unlock');
        Route::put('/{character}/talentos', [CharacterEditController::class, 'updateTalentMods'])->name('characters.talent-mods');
        Route::put('/{character}/campanha', [CharacterEditController::class, 'updateCampaign'])->name('characters.campaign');

        Route::post('/{character}/pericias', [CharacterAbilityController::class, 'storeSkill'])->name('characters.skills.store');
        Route::delete('/{character}/pericias/{skill}', [CharacterAbilityController::class, 'destroySkill'])->name('characters.skills.destroy');
        Route::post('/{character}/poderes', [CharacterAbilityController::class, 'storePower'])->name('characters.powers.store');
        Route::delete('/{character}/poderes/{power}', [CharacterAbilityController::class, 'destroyPower'])->name('characters.powers.destroy');
        Route::post('/{character}/tracos', [CharacterAbilityController::class, 'storeTrait'])->name('characters.traits.store');
        Route::delete('/{character}/tracos/{trait}', [CharacterAbilityController::class, 'destroyTrait'])->name('characters.traits.destroy');

        // Anotações rápidas do personagem (menu de ações, via fetch).
        Route::scopeBindings()->group(function (): void {
            Route::get('/{character}/notas', [QuickNoteController::class, 'characterIndex'])->name('characters.notes.index');
            Route::post('/{character}/notas', [QuickNoteController::class, 'characterStore'])->name('characters.notes.store');
            Route::delete('/{character}/notas', [QuickNoteController::class, 'characterClear'])->name('characters.notes.clear');
            Route::put('/{character}/notas/{note}', [QuickNoteController::class, 'characterUpdate'])->name('characters.notes.update');
            Route::delete('/{character}/notas/{note}', [QuickNoteController::class, 'characterDestroy'])->name('characters.notes.destroy');
        });

        Route::post('/{character}/modificadores', [GmModifierController::class, 'store'])->name('characters.gm-modifiers.store');
        Route::delete('/{character}/modificadores/{modifier}', [GmModifierController::class, 'destroy'])
            ->whereUuid('modifier')
            ->name('characters.gm-modifiers.destroy');
    });

    // Inventário e loja. Itens são buscados dentro do personagem da URL (scopeBindings).
    Route::middleware("can:use-feature,'inventory'")->prefix('inventario')->group(function (): void {
        Route::get('/', [InventoryController::class, 'index'])->name('inventory.index');
        Route::get('/{character}', [InventoryController::class, 'show'])->name('inventory.show');
        Route::put('/{character}/dinheiro', [InventoryController::class, 'updateMoney'])->name('inventory.money');

        Route::scopeBindings()->group(function (): void {
            Route::get('/{character}/itens/criar', [InventoryItemController::class, 'create'])->name('inventory.items.create');
            Route::post('/{character}/itens', [InventoryItemController::class, 'store'])->name('inventory.items.store');
            Route::get('/{character}/itens/{item}/editar', [InventoryItemController::class, 'edit'])->name('inventory.items.edit');
            Route::put('/{character}/itens/{item}', [InventoryItemController::class, 'update'])->name('inventory.items.update');
            Route::delete('/{character}/itens/{item}', [InventoryItemController::class, 'destroy'])->name('inventory.items.destroy');
            Route::post('/{character}/itens/{item}/usar', [InventoryItemController::class, 'consume'])->name('inventory.items.consume');
            Route::post('/{character}/itens/{item}/equipar', [InventoryItemController::class, 'toggleEquip'])->name('inventory.items.equip');
            Route::post('/{character}/itens/{item}/mover', [InventoryItemController::class, 'move'])->name('inventory.items.move');
            Route::post('/{character}/itens/{item}/rolar', [InventoryItemController::class, 'roll'])->name('inventory.items.roll');
        });

        Route::get('/{character}/loja', [ShopController::class, 'index'])->name('inventory.shop');
        Route::post('/{character}/loja/{catalogItem}', [ShopController::class, 'purchase'])->name('inventory.shop.purchase');
    });

    // Gerenciador de Mapas (mestre): mapas da campanha, ativação, camadas e névoa.
    Route::middleware("can:use-feature,'mapManager'")->prefix('mapas')->name('map-manager.')->group(function (): void {
        Route::get('/', [MapManagerController::class, 'index'])->name('index');

        // Estúdio de Esboços: cartógrafo no navegador + refino opcional por IA gratuita.
        Route::get('/{gameSession}/estudio', [MapStudioController::class, 'show'])->name('studio');
        Route::post('/{gameSession}/estudio/renderizar', [MapStudioController::class, 'render'])->middleware('throttle:6,1')->name('studio.render');
        Route::get('/{gameSession}/estudio/renderizacoes/{render}', [MapStudioController::class, 'status'])->name('studio.status');
        Route::post('/{gameSession}/estudio/salvar', [MapStudioController::class, 'save'])->name('studio.save');

        Route::post('/{gameSession}', [MapManagerController::class, 'store'])->name('store');
        Route::put('/{gameSession}/{campaignMap}', [MapManagerController::class, 'update'])->name('update');
        Route::delete('/{gameSession}/{campaignMap}', [MapManagerController::class, 'destroy'])->name('destroy');
        Route::put('/{gameSession}/{campaignMap}/ativo', [MapManagerController::class, 'toggleActive'])->name('active');
        Route::get('/{gameSession}/{campaignMap}/camadas', [MapManagerController::class, 'layers'])->name('layers');
        Route::put('/{gameSession}/{campaignMap}/camadas', [MapManagerController::class, 'saveLayers'])->name('layers.update');
    });

    // Battlemap da masmorra: página e dados (fetch + polling) por campanha e mapa.
    // A funcionalidade vai entre aspas para o middleware "can" tratá-la como texto.
    Route::middleware("can:use-feature,'dungeon'")->group(function (): void {
        Route::get('/dungeon', [DungeonController::class, 'index'])->name('dungeon.index');

        Route::prefix('/campanhas/{gameSession}/mapas/{campaignMap}/masmorra')->name('dungeon.')->group(function (): void {
            Route::get('/estado', [DungeonController::class, 'state'])->name('state');
            Route::put('/nevoa', [DungeonController::class, 'fog'])->name('fog');
            Route::put('/combate', [DungeonController::class, 'combat'])->name('combat');
            Route::put('/clima', [DungeonController::class, 'weather'])->name('weather');
            Route::post('/tokens', [DungeonTokenController::class, 'store'])->middleware('throttle:60,1')->name('tokens.store');
            Route::put('/tokens/{token}', [DungeonTokenController::class, 'update'])->middleware('throttle:240,1')->name('tokens.update');
            Route::delete('/tokens/{token}', [DungeonTokenController::class, 'destroy'])->name('tokens.destroy');
            Route::post('/areas', [DungeonAnnotationController::class, 'storeAoe'])->name('aoes.store');
            Route::delete('/areas', [DungeonAnnotationController::class, 'clearAoes'])->name('aoes.clear');
            Route::put('/areas/{aoe}', [DungeonAnnotationController::class, 'updateAoe'])->name('aoes.update');
            Route::delete('/areas/{aoe}', [DungeonAnnotationController::class, 'destroyAoe'])->name('aoes.destroy');
            Route::post('/marcadores', [DungeonAnnotationController::class, 'storeMarker'])->name('markers.store');
            Route::delete('/marcadores/{marker}', [DungeonAnnotationController::class, 'destroyMarker'])->name('markers.destroy');
        });
    });

    // Mapa do Mundo: página e dados (fetch + polling) por campanha e mapa.
    Route::middleware("can:use-feature,'worldMap'")->group(function (): void {
        Route::get('/mapa', [WorldMapController::class, 'index'])->name('world-map.index');

        Route::prefix('/campanhas/{gameSession}/mapas/{campaignMap}')->name('world-map.')->group(function (): void {
            Route::get('/estado', [WorldMapController::class, 'state'])->name('state');
            Route::put('/ativo', [WorldMapController::class, 'toggleActive'])->name('active');
            Route::post('/marcadores', [MapPinController::class, 'store'])->name('pins.store');
            Route::put('/marcadores/{pin}', [MapPinController::class, 'update'])->name('pins.update');
            Route::delete('/marcadores/{pin}', [MapPinController::class, 'destroy'])->name('pins.destroy');
        });
    });

    // Desenhos e sinais sobre qualquer mapa da campanha (mundo agora, masmorra na fase 9).
    Route::prefix('/campanhas/{gameSession}/mapas/{campaignMap}')->name('maps.')->group(function (): void {
        Route::post('/desenhos', [MapDrawingController::class, 'store'])->middleware('throttle:120,1')->name('drawings.store');
        Route::delete('/desenhos', [MapDrawingController::class, 'clear'])->name('drawings.clear');
        Route::delete('/desenhos/{drawing}', [MapDrawingController::class, 'destroy'])->name('drawings.destroy');
        Route::post('/pings', [MapPingController::class, 'store'])->middleware('throttle:30,1')->name('pings.store');
    });

    Route::middleware('can:access-admin')->prefix('admin')->name('admin.')->group(function (): void {
        Route::get('/', AdminDashboardController::class)->name('index');

        Route::get('/recursos', [AdminFeatureController::class, 'edit'])->name('features.edit');
        Route::put('/recursos', [AdminFeatureController::class, 'update'])->name('features.update');
        Route::delete('/recursos', [AdminFeatureController::class, 'reset'])->name('features.reset');

        Route::get('/usuarios', [AdminUserController::class, 'index'])->name('users.index');
        Route::put('/usuarios/{user}/papel', [AdminUserController::class, 'updateRole'])->name('users.role');
        Route::delete('/usuarios/{user}', [AdminUserController::class, 'destroy'])->name('users.destroy');

        Route::get('/personagens', [AdminCharacterController::class, 'index'])->name('characters.index');
        Route::delete('/personagens/{character}', [AdminCharacterController::class, 'destroy'])->name('characters.destroy');

        Route::get('/sessoes', [AdminGameSessionController::class, 'index'])->name('sessions.index');
        Route::delete('/sessoes/{gameSession}', [AdminGameSessionController::class, 'destroy'])->name('sessions.destroy');

        // Sugestões para a base: das campanhas (?origem=campanhas) e dos jogadores (?origem=jogadores).
        Route::get('/sugestoes', [AdminSuggestionController::class, 'index'])->name('suggestions.index');
        $libraryTypes = implode('|', array_keys(\App\Support\CampaignLibrary::TYPES));
        Route::put('/sugestoes/campanhas/{type}/{entry}/adotar', [AdminSuggestionController::class, 'promote'])
            ->where(['type' => $libraryTypes, 'entry' => '[0-9]+'])->name('suggestions.promote');
        Route::put('/sugestoes/campanhas/{type}/{entry}/ignorar', [AdminSuggestionController::class, 'dismiss'])
            ->where(['type' => $libraryTypes, 'entry' => '[0-9]+'])->name('suggestions.dismiss');
    });

    Route::post('/logout', [LoginController::class, 'destroy'])->name('logout');
});

// Arquivos do disco "public" sem o link public/storage (hospedagens que bloqueiam symlink).
// Sem sessão nem cookies, para a CDN poder guardar a resposta.
Route::get('/storage/{path}', PublicStorageController::class)
    ->where('path', '.*')
    ->withoutMiddleware('web')
    ->name('storage.public');
