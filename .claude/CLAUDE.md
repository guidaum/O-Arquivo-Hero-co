## Scope of Work

The assistant must act exclusively as technical support for analyzing, creating, correcting, and improving code within the existing Laravel project.

The assistant is not responsible for infrastructure operations, deployment, dependency installation, or environment configuration.

---

## Project Context

### What the project is

**O Arquivo Heroico (The Heroic Archive)** is a web application for fantasy tabletop RPG groups. It combines character sheets, session journals and Game Master (GM) tools with a "digital tome" visual identity. The user interface is in **Brazilian Portuguese**, and every new screen, message and validation text must remain in Portuguese.

### Migration status

The project is being converted to the target stack defined in this file (Laravel 13, PHP 8.3, Blade, plain CSS, native JavaScript, MySQL 8.0 / MariaDB 10.6). The goal is to move the system to another server with full control over the code.

### Target stack decisions

These decisions were made by the developer and must be followed:

* **Location:** the Laravel project lives at the root of this repository and the legacy application in the `legado/` folder. The base project (`composer create-project`) is created by the team; the assistant only writes application code inside it;
* **Rendering:** Blade views + Controllers. **Livewire is not used**, and neither is any other server-driven UI package;
* **JavaScript:** native JavaScript only (ES modules, `fetch`, DOM APIs, Canvas, Web Audio). No jQuery, no frontend framework, no external libraries;
* **CSS:** plain, hand-written CSS. No Tailwind, no preprocessors;
* **Assets:** CSS and JS are plain files in `public/css/` and `public/js/`, loaded with `asset()`. No Vite, no npm build step;
* **Interactive requests:** JavaScript talks to Laravel routes through `fetch` with JSON responses, always sending the CSRF token (`<meta name="csrf-token">`);
* **Real-time:** implemented with **polling** for now (the client asks the server for changes since the last known timestamp/version). It is not yet known whether the new server will accept a WebSocket process, so all real-time code in JavaScript must go through a single transport module (e.g. `public/js/core/realtime.js`), so that polling can later be replaced by WebSocket without rewriting the screens;
* **Framework version:** Laravel 13 (`laravel/framework ^13.30`). Laravel 11 was dropped because it reached end of life and every 11.x release is affected by unpatched security advisories (including a critical authentication bypass). Security advisories must never be ignored in `composer.json` to force a vulnerable version;
* **PHP version:** PHP 8.3 is the minimum (required by Laravel 13), both locally and on the server. Features exclusive to PHP 8.4 or later must not be used;
* **Data import:** `laravel_export/` (migrations, seeders, `dump.sql`, images), `dump_data/firestore_dump.json` and `images_export/` (all at the root; the default import path is `config('arquivo.import.dump_path')`) are the **data source** for the import, not the final schema. The final schema must be relational (see "Data model"). These files contain real personal data and must never be copied into examples, tests or documentation.

The repository still contains the **legacy application** in `legado/` (legacy paths in this document, such as `src/`, `server.ts` and `firestore.rules`, are relative to that folder), written in:

* React 19 + TypeScript + Vite + Tailwind CSS (`src/`);
* a small Node/Express server (`server.ts`);
* Firebase Authentication + Cloud Firestore (`src/firebase.ts`, `firestore.rules`, `firebase-blueprint.json`);
* Vitest tests (`tests/character-system.test.ts`).

Rules for working with the legacy code:

* the legacy code is the **functional reference** (business rules, fields, formulas, permissions, screens and texts), never the **architectural reference**;
* the architecture and patterns of the Laravel project prevail as soon as they exist, following the "Existing Project Standards" section;
* the legacy code must not be extended with new features; new features belong to the Laravel project;
* the legacy code must not be removed or modified unless the developer explicitly requests it;
* the conversion advances module by module, in the order agreed with the developer;
* when the Laravel base project does not exist yet in the repository, the assistant must not create it through Composer or the Laravel installer; the base project is the team's responsibility.

### Conversion phases

1. Database and Models: relational migrations and data import from the export;
2. Authentication, users and authorization (Policies/Gates/middleware);
3. Business rules in PHP (formulas, dice, trait costs) with tests;
4. Base layout: plain CSS, light/dark theme, Blade components;
5. Simple modules: catalogs, admin, journal, inventory;
6. Character creation and character sheet;
7. Sessions, chat and notifications (polling);
8. World map and map manager;
9. Dungeon battlemap and GM dashboard.

### Functional modules (legacy routes)

| Legacy route | Module |
| --- | --- |
| `/` | Player dashboard |
| `/create` | Character creation (attributes, talents, skills, powers, traits) |
| `/sheet` | Character sheet |
| `/inventory` | Inventory and item catalog |
| `/journal` | Session journal (entries, timeline, NPCs, gallery) |
| `/map` | World map with pins |
| `/map-manager` | World and campaign map management, sketch studio |
| `/dungeon` | Dungeon battlemap (tokens, fog of war, AoE, markers, atmosphere, drawings, pings) |
| `/gm/session/:sessionId` | GM dashboard (bestiary, encounter generator, audio, health tracking) |
| `/admin` | Admin dashboard (global settings, catalogs, feature management, suggestions) |

Cross-cutting features: session chat with dice rolls and mentions, notifications, quick notes, dice roller with animation, sound effects, light/dark theme and user profile.

### Roles and authorization

User roles are `admin`, `gm` and `user`. The authorization rules are defined in `firestore.rules` and must be reproduced in Laravel with native mechanisms (Policies, Gates and middleware), for example:

* a character is visible to its owner, to admins and to the GM and players of the session it belongs to;
* a game session belongs to a GM (`gmId`) and has players (`playerIds`);
* global catalogs (talents, skills, powers, traits) are readable by authenticated users and writable only by GMs/admins;
* global settings are managed by admins.

### Data model (Firestore → MySQL)

The entities are described in `firebase-blueprint.json`. Each Firestore collection becomes a table with an Eloquent Model:

| Firestore collection | Entity |
| --- | --- |
| `users` | User |
| `characters` | Character |
| `journalEntries` | JournalEntry |
| `gameSessions` | GameSession |
| `talents`, `skills`, `powers`, `traits` | Talent, Skill, Power, Trait |
| `globalSettings/config` | GlobalSettings (single record) |
| `suggestions` | Suggestion |
| `chatMessages` | ChatMessage |
| `itemCatalog` | CatalogItem |
| `mapPins`, `worldMaps`, `campaignMaps`, `mapDrawings`, `worldMapPings` | World/campaign map entities |
| `dungeonMaps`, `dungeonTokens`, `dungeonFog`, `dungeonAoEs`, `dungeonMarkers`, `dungeonAtmosphere`, `dungeonDrawings`, `dungeonPings` | Dungeon battlemap entities |
| `customSounds` | CustomSound |

Conversion guidelines:

* Firestore string IDs and `ownerId` / `gmId` / `sessionId` references become foreign keys with proper relationships;
* arrays of references (such as `playerIds` and `shopItemIds`) become pivot tables;
* nested structures without their own identity (such as `stats`, `conditions`, `revealedCells`) may use JSON columns with Eloquent casts;
* Firestore timestamps become `timestamps()` or `dateTime` columns;
* the validation functions in `firestore.rules` (`isValidCharacter`, `isValidJournalEntry`, etc.) are the reference for the Laravel validation rules.

### Business rules to preserve

* Attribute, combat and cost formulas are configurable in `GlobalSettings` (`pvFormula`, `atpFormula`, `defesaFormula`, `skillCostFormula`, `powerCostFormula`, etc.) and evaluated at runtime;
* dice formulas, trait costs and trait modifiers are implemented in `src/lib/utils.ts` (`evaluateFormula`, `rollDiceFormula`, `resolveStatsWithVars`, `calculateTraitCost`, `getTraitEffectiveModifier`, `getTraitTargets`) and covered by `tests/character-system.test.ts`;
* these rules must be ported to PHP with equivalent behavior and covered by tests using the testing tools already available in the Laravel project;
* when the same rule is needed in the browser (for example, live preview on the character sheet), the JavaScript version must mirror the PHP version, and the server is always the authority;
* formulas must never be evaluated with `eval()` (in PHP) or `eval()` / `new Function()` (in JavaScript); a safe parser must be implemented natively;
* the ported rules live in `app/Game/` (`FormulaEvaluator`, `ExpressionParser`, `GameRules`, `CharacterCalculator`, `TraitCalculator`, `DiceRoller`) with tests in `tests/Unit/Game/`; the browser mirrors are `public/js/core/formula.js` and `traits.js`, which receive the resolved rules from `GameRules::toArray()`. Any rule change must be made on both sides;
* default rule values (formulas, difficulty modifiers, attribute list) are in `config/arquivo.php` under `rules`; empty `rule_sets` fields fall back to them;
* a disadvantage keeps the modifier sign it was registered with (a positive modifier adds to the attribute), matching the legacy production behavior; changing this alters existing character sheets and must be decided by the developer.

### Points that require attention during conversion

* **Real-time features:** the legacy app relies on Firestore real-time listeners (chat, tokens, fog of war, pings, notifications). The solution uses polling through the single transport module described in "Target stack decisions", with lightweight endpoints that return only what changed since the last request, and must not introduce new packages or infrastructure;
* **Authentication:** the legacy app uses Firebase Auth (email/password and Google sign-in). Laravel uses native session authentication. Imported users have no password, so a password definition/reset flow must exist for the first access. Google sign-in, if kept, must be implemented with the native HTTP client (no Socialite);
* **Map rendering by AI:** `server.ts` exposes `POST /api/render-map`, which sends a sketch to an external image generation API. In Laravel, external calls must use the native HTTP client, and URLs or keys must come from `config()`, never from `env()` in application code;
* **Images:** the legacy app stores images as compressed data URLs. In Laravel, file storage must use the native Storage facade;
* **Heavy interactive screens:** the battlemap, sketch studio and dice animations are canvas/JavaScript-heavy. They must be rewritten in native JavaScript (Canvas API) without new libraries. The `three` dependency in the legacy `package.json` is not used by the code and must not be carried over;
* **Large components:** `GMDashboard.tsx`, `DungeonMap.tsx`, `CharacterSheet.tsx`, `CharacterCreation.tsx`, `MapManager.tsx` and `WorldMap.tsx` contain thousands of lines each and must be split into smaller Blade views/components and small native JavaScript modules during conversion;
* **Styling:** the legacy UI uses Tailwind utility classes. They must be translated into a small set of semantic CSS classes and CSS custom properties (theme tokens), not reproduced one by one;
* **Static assets:** map images in `src/assets/images/` and the bestiary data in `src/lib/bestiaryData.ts` must be preserved.

---

## Mandatory Restrictions

The assistant must never:

* use or suggest Git commands;
* create commits;
* create branches;
* perform merges;
* execute `push`, `pull`, `fetch`, `checkout`, `rebase`, or similar operations;
* perform deployments or releases;
* suggest CI/CD pipelines;
* access servers;
* access hosting control panels;
* execute commands in production;
* modify infrastructure settings;
* access or modify the `.env` file;
* request the contents of the `.env` file;
* access files containing credentials;
* request passwords, tokens, private keys, or certificates;
* modify database connection settings;
* modify web server settings;
* modify PHP configuration;
* modify files inside `vendor/`;
* modify files inside `node_modules/`;
* modify compiled files;
* install third-party packages;
* request package installation through Composer;
* execute `composer require`;
* execute `composer install`;
* suggest external libraries as a requirement for the solution;
* request package installation through npm;
* depend on tools that are not already available in the project;
* create a new architecture without considering the existing architecture;
* replace existing project patterns with personal preferences;
* assume that the project uses a library without evidence in the provided code.

---

## Dependencies

Solutions must use only:

* native PHP 8.3 features;
* native Laravel 13 features;
* classes, components, and libraries that already exist in the project;
* patterns already adopted by the project;
* dependencies explicitly shown in the code or informed by the developer.

When a solution would normally require an external package, the assistant must seek an implementation using the resources already available in Laravel or PHP.

The assistant must not recommend installing new packages as the primary solution or as an alternative.

---

## Environment Configuration

The assistant must not access, request, or modify sensitive configuration files, including:

```text
.env
.env.production
.env.local
auth.json
credentials.json
secrets.json
```

When configuration is required, the code must use mechanisms that already exist in the project, such as:

```php
$url = config('services.system.url');
```

The assistant may state that a certain configuration must exist, but must not request access to the real value or propose direct changes to the `.env` file.

Acceptable example:

```php
$url = config('services.system.url');
```

Unacceptable example:

```php
$url = env('SYSTEM_URL');
```

The assistant must also never ask the developer to provide:

* database credentials;
* authentication tokens;
* API keys;
* certificates;
* passwords;
* real personal data;
* confidential environment information.

Sensitive values used in examples must be represented by placeholders:

```text
YOUR_TOKEN
SERVICE_URL
CONFIGURATION_NAME
```

---

## Git and Version Control

The assistant must not provide commands or instructions related to Git.

Examples such as the following must not be included:

```bash
git add .
git commit
git push
git pull
git checkout
git merge
```

The assistant must also not:

* suggest commit messages;
* create branching strategies;
* propose Git workflows;
* provide repository publishing instructions;
* access or modify internal Git files.

Version control is the exclusive responsibility of the project team.

---

## Deployment and Release

The assistant must not perform or provide instructions for deployment procedures.

It must not provide commands or steps for:

* production deployment;
* server updates;
* running migrations in production;
* restarting services;
* changing file permissions;
* configuring Nginx or Apache;
* configuring Supervisor;
* configuring queue workers on servers;
* changing PHP versions;
* creating deployment pipelines;
* publishing to staging or production environments.

When a change requires a migration, the assistant may create the migration code, but must not provide instructions for running it on a server.

---

## Existing Project Standards

The provided code must primarily follow the standards already established in the project.

Before proposing an implementation, the assistant must consider:

* the structure of existing Controllers;
* Model organization;
* the structure of Blade views;
* custom Blade components;
* filtering patterns;
* pagination patterns;
* sorting patterns;
* naming conventions;
* the existing Service and Repository structure, when applicable;
* message handling;
* error handling;
* visual standards;
* permissions and authorization;
* route conventions;
* existing relationships.

The assistant must not introduce a new architectural layer when the project does not already use that layer.

For example:

* do not create a Repository if the project works directly with Eloquent;
* do not create a Service for a simple operation if the existing pattern keeps it in the Controller;
* do not introduce Livewire, jQuery or any frontend framework;
* do not replace existing Blade components with plain HTML;
* do not change naming conventions without a clear reason;
* do not create new abstractions without a concrete benefit.

When the developer provides a working example from the project, that example must be treated as the primary implementation reference.

---

## Laravel 13 and PHP 8.3

All new code must be compatible with:

* Laravel 13;
* PHP 8.3;
* MySQL 8.0 or MariaDB 10.6.

Every new PHP file must begin with:

```php
<?php

declare(strict_types=1);
```

Parameter and return types must be used whenever they are compatible with the current project conventions.

Example:

```php
public function save(array $data): Model
{
    //
}
```

The assistant must not use features exclusive to later versions without clearly explaining the incompatibility.

---

## Database

The assistant may help create:

* migrations;
* Models;
* relationships;
* scopes;
* Eloquent queries;
* Query Builder queries;
* filters;
* pagination;
* sorting;
* transactions;
* data integrity validations.

SQL queries must never use direct value concatenation.

Incorrect example:

```php
DB::select(
    "SELECT * FROM users WHERE name = '$name'"
);
```

Correct example:

```php
DB::select(
    'SELECT * FROM users WHERE name = :name',
    [
        'name' => $name,
    ],
);
```

Whenever possible, Eloquent or Query Builder must be used:

```php
User::query()
    ->where('name', 'like', '%' . $name . '%')
    ->orderBy('name')
    ->paginate(15);
```

The assistant may create the required migration, but must not execute it or provide production execution instructions.

---

## Controllers

Controllers must follow the project’s current pattern.

The assistant must avoid adding unnecessary layers.

When the project uses Controllers with Services, that pattern must be preserved.

When the project uses Controllers directly with Eloquent, the assistant must respect that pattern, provided the solution remains organized and secure.

Validation must follow the existing project approach:

* `FormRequest`, when already used;
* validation inside the Controller, when that is the current pattern.

Controllers that serve `fetch` requests return JSON (`response()->json()`), use the same validation and authorization as the HTML routes, and return Portuguese error messages.

---

## Blade Views

The project does not use Livewire. Screens are Blade views rendered by Controllers. The assistant must preserve:

* the base layout and its sections/stacks;
* custom Blade components (`resources/views/components/`);
* filtering, pagination and sorting through query strings;
* route names;
* actions and permissions (`@can`, Policies);
* visual structure.

The assistant must not replace a working implementation with another library.

---

## CSS and JavaScript

The project uses **plain CSS** and **native JavaScript**, served as static files from `public/` (no Vite, no npm build).

The assistant must not:

* install frontend frameworks;
* introduce jQuery or external libraries (including CDN scripts);
* add a build step;
* modify dependency files;
* insert code into files outside the requested scope.

Organization:

* CSS in `public/css/` (global tokens and base styles shared by all pages, plus one file per module when needed);
* JavaScript in `public/js/` as ES modules (`<script type="module">`), with shared helpers in `public/js/core/` (HTTP/CSRF, real-time transport, formulas, UI helpers) and one entry module per screen;
* data needed by a script is passed from Blade with `@json` or `data-*` attributes, never by concatenating values into inline scripts;
* CSS, JS and the icon sprite are referenced with the Blade directive `@asset('css/app.css')` (`App\Support\Assets::url()`: `asset()` plus `?v=<file mtime>`), because the hosting CDN caches static files for 7 days; both layouts publish an import map (`Assets::importMap()`) so relative imports between ES modules are versioned too; fonts and images keep plain `asset()`;
* the hosting blocks `symlink()` and `exec()`, so `storage:link` fails there: `/storage/{path}` is served by `PublicStorageController` (route `storage.public`, without the `web` middleware, only image/audio extensions, 7-day cache); the `local` disk has `serve` off so it does not take `/storage`; keep public-disk URLs as `Storage::disk('public')->url()`;

Layout conventions (phase 4):

* authenticated pages use `<x-layouts.app title="...">` (prop `full` for map screens); guest pages use `<x-layouts.guest>`;
* the menu and the Mestre/Jogador view mode live in `app/Support/Navigation.php` (rules from the legacy `Layout.tsx`), shared with the layout by a view composer in `AppServiceProvider`;
* shared components: `x-icon` (sprite `public/images/icons.svg`; add new icons there), `x-page-header`, `x-section`, `x-empty-state` (optional `icon`, `hint` and `action` slot with the next step), `x-modal` (native `<dialog>`), `x-view-mode-toggle`, `x-role-badge`, `x-avatar`, `x-character-card`, `x-campaign-card`, `x-form.field`, `x-alert`;
* every legacy module now has its own controller (the last `coming-soon` route, `/dungeon`, was replaced in phase 9a); the `coming-soon` view remains available for future modules, protected by `can:use-feature,'<feature>'`;
* fonts are self-hosted in `public/fonts/` (no Google Fonts); `public/js/core/layout.js` handles the sidebar, dropdowns (`<details data-dropdown>`), modals (`data-modal-open` / `data-modal-close`) and copy buttons (`data-copy="<text>"`).

List and admin patterns (phase 5a, reference: `app/Http/Controllers/Admin/` and `resources/views/admin/`):

* lists filter by query string (`busca`, plus specific filters), use `paginate(20)->withQueryString()` and the default pagination view `partials.pagination`;
* one confirmation modal per page serves every row: the row button sets `data-modal-action` (DELETE route) and `data-modal-text-<name>`, which fill `form[data-modal-form]` and `[data-modal-text="<name>"]`;
* `[data-autosubmit]` submits its form on change (filters, inline role change); `[data-check-all="<selector>"]` checks every matching checkbox;
* shared list styles in `app.css`: `.tabs`, `.toolbar`, `.search-field`, `.select`, `.row-list` / `.row-card`, `.stat-cards`, `.switch`, `.pagination`, `.confirm-box`; module-specific styles go in their own CSS file pushed to the `styles` stack;
* phase 5 is split into 5a (admin panel, done), 5b (catalogs and rules, done), 5c (session journal, done) and 5d (inventory, done).

Inventory and shop (phase 5d, reference: `InventoryController`, `InventoryItemController`, `ShopController`, `resources/views/inventory/`):

* routes live under `/inventario/{character}`; item routes use `scopeBindings()` so an item is always resolved inside the character of the URL; changes require the `update` policy of the character (owner or campaign GM);
* `character_items` gained `weight`, `value` and `position` (migration `000014`); ammo and consumables stack by name/catalog item; old items without category are inferred as in the legacy app (defense → armor, damage → weapon, otherwise misc);
* rarity may be stored in English (catalog) or Portuguese (legacy inventory): always compare through `CatalogItem::normalizeRarity()`;
* the shop is open for characters without a campaign or when `game_sessions.shop_enabled` is true, and lists only the campaign shop items when the GM chose any; purchases lock the character row and never let money go below zero;
* damage rolls use `DiceRoller::rollFormula` with stats + stats_mods and consume one compatible ammo (catalog relation) when the weapon requires it; posting rolls to the chat comes with phase 7.

Character sheet (phase 6a, reference: `App\Game\CharacterSheet`, `CharacterSheetController`, `resources/views/characters/`):

* phase 6 is split into 6a (sheet: reading, quick tests and vitals, done), 6b (sheet editing: stats when unlocked, skills/powers, traits, GM modifiers, campaign and image, done) and 6c (character creation wizard, done);
* every sheet number comes from `CharacterSheet::for($character, GameRules::forSession($session), $talents)`; attribute total = base + mod + traits (ignored when the attribute has its own mod) + equipped item stats + GM modifiers; talents sum their composition the same way;
* GM modifiers are stored in `characters.gm_modifiers` (migration `000015`), keyed by attribute id or `talent:<id>`, each entry with value and justification; the column is not fillable;
* quick tests post only the target (`attr:for`, `talent:3`, `skill:5`, `power:2`, `combat:en|dm|defesa|esquiva`) and the difficulty; the value is always computed on the server; attributes roll d10 and everything else d20, as in the legacy sheet;
* rolls never reload the page: forms with `data-roll-dialog="<title>"` (sheet quick tests, inventory damage) are sent by `public/js/tools/roll-dialog.js` and shown in `<x-roll-dialog />` (include it on the screen); the route answers JSON with `result: {title, label, value, outcome (critical|fumble|success|failure|null), detail, note}` when `expectsJson()`, and keeps the redirect for non-JS submits; errors use `ValidationException` (422 in the dialog, error bag otherwise); the event `roll:result` lets the screen update what changed (e.g. `inventory/ammo.js`);
* the sheet uses the campaign rules (falling back to the global ones), while the legacy sheet always used the global rules.

Sheet editing (phase 6b, reference: `CharacterEditController`, `CharacterAbilityController`, `GmModifierController`):

* who edits follows `CharacterPolicy`: `editStats` (campaign GM, admin, or owner when `can_edit_stats` is on) for details, portrait, talent mods, skills, powers and traits; `unlockStats` (campaign GM/admin) for the unlock switch and GM modifiers; `update` (owner or GM) for vitals, tests and the campaign link;
* adding a skill/power spends its `purchase_cost` from `skill_points`/`power_points` and removing refunds it, as in the legacy sheet (character creation uses the cost formula instead); point changes lock the character row;
* GM modifier entries carry a UUID `id` used by the DELETE route; justification is mandatory;
* level, XP and point grants are GM dashboard features (phase 9b), not sheet features;
* the owner deletes a character from the dashboard card (`DELETE /ficha/{character}`, `CharacterPolicy::delete`, confirmation modal `delete-character`); every deletion (owner, GM for NPCs, admin) goes through `Character::deleteWithFiles()`, which also removes dungeon tokens and uploaded portrait/item files.

Character creation (phase 6c, reference: `CharacterCreationController`, `App\Game\CharacterDraft`, `resources/views/characters/create.blade.php`, `public/js/creation/wizard.js`):

* the 7-step wizard (traits, origins, attributes, skills, powers, equipment, review) runs on one page; the draft lives in the browser and is posted as a single JSON field `payload` (`basics`, `traits`, `stats`, `skills`, `powers`, `equipment.catalog` / `equipment.custom`); on validation errors the page comes back with the draft in `config.old` and the wizard restores it;
* the server always recomputes the draft with `CharacterDraft` (trait balance >= 0, attributes within `max_single_attribute_value` and summing up to `max_attribute_points`, skill/power costs by the cost formulas up to the initial points, starting catalog items up to `initial_money`); leftovers are stored in `attribute_points`, `skill_points`, `power_points` and `money`;
* starting points come from `GameRules::points()` (rule set columns, falling back to `config('arquivo.rules.points')`) and are part of `GameRules::toArray()`;
* a character is born in an active campaign or in one the user masters; library entries must be global or belong to that campaign; a player creating in someone else's campaign joins it as a player; PV and ATP start full;
* players suggest skills, powers and traits through `POST /sugestoes` (JSON, `SuggestionSubmissionController`), reviewed by the admin in the admin panel (`/admin/sugestoes?origem=jogadores`);
* shared JS helpers: `public/js/core/http.js` (`request`, `postJson`, CSRF and Portuguese 422 messages) and `public/js/core/dom.js` (`el`, `replace`, `icon`; text is never inserted as HTML; the sprite URL comes from `<meta name="icon-sprite">` in the app layout).

Sessions, chat and notifications (phase 7, reference: `GameSessionController`, `ChatController`, `NotificationController`, `GmSessionController`, `components/session-chat.blade.php`, `public/js/chat/session-chat.js`):

* every polling screen goes through `public/js/core/realtime.js` (`subscribe(url, { interval, params, onData, onError })` with `refresh()`, `setInterval()`, `stop()`); it slows down in hidden tabs, backs off on errors and stops on 401/403/419; never call `fetch` in a loop from a screen;
* GMs create campaigns from the dashboard ("Mestrar", 6-character code without 0/O/1/I) and players join with "Entrar" (`POST /campanhas/entrar`, errors in the `joinSession` bag); `/mestre/sessoes/{id}` is the GM dashboard (phase 9b);
* chat routes live under `/campanhas/{gameSession}/chat`: `GET ?depois=<id>` returns only newer messages (or the last 100), plus `cursor` and `cleared_at`; `POST` (JSON or multipart) accepts text, image upload (`chat/` on the public disk) or image URL, `/r <formula>` rolls with `Character::rollStats()`, and `character_id` only counts when the character belongs to the user and the campaign; `DELETE` (GM) clears messages and files and sets `game_sessions.chat_cleared_at`;
* reading and posting follow `GameSessionPolicy::view` (GM, players, admin); clearing follows `update`;
* mentions use `GameSession::chatParticipants()` (GM also as `@GM` / `@Mestre`, players, characters; handle = name without spaces) and are stored in `chat_message_mentions`, never notifying the sender; the bell (`public/js/notifications/bell.js`, `GET /notificacoes`) shows the last 5 mentions and counts those after `users.notifications_seen_at`;
* sheet quick tests and item damage rolls post to the campaign chat with `ChatMessage::postRoll()` / `ChatMessage::post()` (ammo warnings use type `system`); messages reach the browser only through `ChatMessage::toChatArray()`, which also reads the imported roll format (`outcome`);
* `?chat=1` opens the chat (notification links); unread counts are kept per campaign in the browser.

Action menu (phase 7b, reference: `components/action-menu.blade.php`, `DiceRollController`, `QuickNoteController`, `public/js/tools/`):

* `x-action-menu :session :character notes="character|campaign"` replaces the legacy `ActionMenu` (dice roller, chat, quick notes) in the sheet, the inventory and the GM session page; it embeds `x-session-chat :launcher="false"`; use it on any new screen that needs these tools (e.g. the dungeon in phase 9);
* the tools talk through document events: `tool:toggle {tool, open?}`, `tool:state {tool, open}` (only one tool open at a time) and `tool:badge {tool, count}`; other screens can request a roll with `dice:roll {sides, quantity, modifier, advantage_mode}`;
* dice are rolled on the server (`POST /dados/rolar`, `DiceRoller::roll()`, d4–d100, up to 20 dice) and posted to the campaign chat in the legacy format; animation, history (last 50) and the sound switch stay in the browser (`localStorage`);
* sounds: `public/js/core/sound.js` plays the URLs configured in the rule set (`dice_roll_sound`, `success_sound`, `failure_sound`, `critical_sound`, `fumble_sound`) and falls back to Web Audio synthesis (no external audio by default);
* quick notes: character notes in `character_notes` (`/ficha/{character}/notas`, `CharacterPolicy::update`), campaign notes in `game_session_notes` (migration `000017`, `/campanhas/{gameSession}/notas`, GM only); categories `general`, `npc`, `hook`, `loot`, `location`; pinned notes come first.

World map (phase 8a, reference: `WorldMapController`, `MapPinController`, `MapDrawingController`, `MapPingController`, `resources/views/world-map/`, `public/js/world-map/`):

* phase 8 is split into 8a (world map: pins, drawings, pings, done), 8b (map manager: custom maps, activation and layers per campaign, done) and 8c (sketch studio and AI rendering, done);
* `/mapa?campanha=&mapa=` shows one world map of one campaign; maps come from `GameSession::mapsOfType()` (campaign custom maps first, then presets by creation order) with `active_in_session` from `game_session_maps` (falling back to the map's own `active`); `GameSession::setMapActive()` changes it;
* every map endpoint lives under `/campanhas/{gameSession}/mapas/{campaignMap}` and calls `AuthorizesMapAccess::authorizeMap()` (campaign participant, preset or campaign map, players only on active maps); it returns whether the user acts as GM: campaign GM/admin **in the Mestre view mode** (the GM in Jogador mode sees the map as a player, as in the legacy app);
* `GET .../estado?versao=` (polled every 3 s through `realtime.js`) resends pins and drawings only when the version hash changes; pings (last 6 s) always come; pins reach the browser only through `MapPin::toMapArray()`;
* pins: any participant creates; author or campaign GM edits/deletes (`MapPinPolicy`); categories, icons, danger levels and statuses are constants in `MapPin` (legacy `city` = `town`); `secrets` and `is_secret` are GM-only: players never send nor receive them (the legacy app leaked them);
* drawings (`MapDrawingController`, `maps.drawings.*`) and pings (`MapPingController`, `maps.pings.store`) work on any map type, so the dungeon (phase 9) reuses them; drawings are deleted by the author or the campaign GM (`MapDrawingPolicy`), "clear all" is GM-only; ping color is amber for the GM and cyan for players;
* the screen modules are `viewport.js` (pan/zoom, coordinates in % of the image), `drawing.js` (SVG pen that closes when the ends meet, polygon, eraser, undo/redo) and `index.js` (modes, polling, pins, sidebar, forms).

Map manager (phase 8b, reference: `MapManagerController`, `resources/views/map-manager/`, `public/js/map-manager/`):

* `/mapas?campanha=&tipo=world|dungeon&origem=custom|presets` lists the maps of a campaign the user masters (admins: every campaign); the GM in Jogador mode sees the "Acesso Exclusivo para Mestres" page, as in the legacy app;
* custom maps are uploaded files (`maps/custom/` on the public disk, JPG/PNG/WEBP up to 10 MB; never data URLs), belong to one campaign and are edited/deleted only by their creator or the campaign GM (`CampaignMapPolicy`); presets (`preset_key`) are never edited or deleted, but can be activated per campaign; deleting a map also deletes its pins, drawings, tokens and fog (FK cascade) and its image;
* layer settings live in `game_session_maps.layer_settings`, always read through `GameSessionMap::normalizeLayers()` (accepts the imported camelCase format; units `ft`, `m`, `squares`, `km`, `mi`, `leagues`); fog of war lives only in `dungeon_fogs` (`enabled`, `revealed_cells` as row * cols + col), read through `CampaignMap::fogIn()` (falls back to imported `fogEnabled`/`revealedCells`), so the dungeon (phase 9) reads the same source;
* the layers inspector (`/mapas/{campanha}/{mapa}/camadas`) edits layers, paints fog cell by cell (brush 1/3×3/5×5, reveal all, hide all, entrance, invert) and measures with the ruler; it saves everything in one `PUT` JSON; maps without their own grid use `CampaignMap::DEFAULT_GRID` (24×14);
* `public/js/core/maps.js` has `gridDistance()` and `cellsInRadius()` (legacy `calculateGridDistance`), shared with the dungeon;
* the character sheet lists the maps of the character campaign (players: active maps with generic thumbnails from `CampaignMap::thumbnailUrl()`); real thumbnails and hidden maps only for the campaign GM/admin **in the Mestre view mode** (`mapsAsGm`, same rule as `authorizeMap()`), never for a GM playing in Jogador mode.

Sketch studio and map rendering (phase 8c, reference: `MapStudioController`, `App\Support\AiHordeMapRenderer`, `resources/views/map-manager/studio.blade.php`, `public/js/sketch-studio/`):

* the studio (`/mapas/{campanha}/estudio`, campaign GM) replaces `MapSketchStudio.tsx` and the `POST /api/render-map` of `server.ts`; the sketch is painted with **semantic colors** (one unique color per element in `elements.js`: world terrain/water/roads, dungeon floor/water/lava/rubble) plus stamps stored as points; tools: brush, line, rect, polygon, bucket, stamp, eraser, undo/redo;
* `cartographer.js` is the main renderer: it classifies each pixel by the element colors, builds distance fields (coast or walls) and paints an illustrated map with Canvas only (themes `parchment`, `painted`, `contemporary`, `futuristic` for worlds; `stone`, `cave`, `crypt`, `temple`, `volcanic` for dungeons, with the tactical grid of the map); it is free, instant and works offline; changing an element color in `elements.js` requires no other change, but adding an element needs its handling in `cartographer.js`;
* optional AI refinement uses the free AI Horde through `AiHordeMapRenderer` (native HTTP client, config `services.ai_horde.*`: `enabled`, `url`, `api_key` — anonymous `0000000000` when empty —, `models`, `timeout`): img2img of the illustrated map (never the raw sketch), prompts per map type and theme with a negative prompt after `###`, fidelity → denoising, optional ControlNet `fakescribbles`, 1–4 variations; requests are async: `POST .../estudio/renderizar` returns a local UUID kept in the cache for 15 min (owner + campaign), `GET .../estudio/renderizacoes/{uuid}` is polled through `realtime.js` (the Horde is asked at most every 3 s) and downloads the variations to `maps/renders/` (pruned after one day);
* `POST .../estudio/salvar` creates a custom campaign map from an AI variation (`render` + `variation`, copied to `maps/custom/`) or from the illustrated image uploaded as a file; Gemini image models were evaluated and are not free (paid only), so they are not used.

Dungeon battlemap (phase 9a, reference: `DungeonController`, `DungeonTokenController`, `DungeonAnnotationController`, `resources/views/dungeon/`, `public/js/dungeon/`):

* phase 9 is split into 9a (dungeon battlemap, done), 9b (GM dashboard: health tracking, XP/level/point grants, bestiary and encounter generator, done) and 9c (audio: atmosphere/soundscapes, GM sound effects, rule set sound settings, done);
* `/dungeon?campanha=&mapa=` shows one dungeon map (`MapType::Dungeon`) of a campaign; endpoints live under `/campanhas/{gameSession}/mapas/{campaignMap}/masmorra` and call `authorizeDungeon()` (same rules as `authorizeMap()` plus the map type); drawings and pings reuse `maps.drawings.*` / `maps.pings.store`;
* `GET .../masmorra/estado?versao=` (polled every 2.5 s) resends layers, fog, tokens, AoEs, markers, drawings and combat only when the version changes; the token part of the version hashes the token rows (not `max(updated_at)`, which missed moves within the same second); players always receive their own player tokens (`DungeonToken::isPlayerTokenOf()`) and every other token (other players included) only when not hidden and not on an unrevealed fog cell (the legacy app hid them only visually); GM creatures are not "own" tokens for the GM in Jogador mode; character tokens of NPCs/monsters get type `npc`/`monster`;
* tokens reach the browser through `toBoardArray()` with `DungeonToken::BOARD_RELATIONS` loaded: `avatar_url` is the current sheet portrait (then the token image, then the owner's profile photo for players) and `sheet_url` opens the sheet in a popup (`#dungeon-sheet`, iframe; GM: any campaign character; players: player characters only); pages inside an iframe get `html.is-embedded` (theme-init.js), which hides the app chrome and turns `realtime.js` subscriptions into no-ops;
* tokens: a player joins with an own character of the campaign (one token per character per map, HP from the sheet, initiative d20 + INI) and moves/changes HP, conditions and initiative only of own tokens; the campaign GM spawns campaign characters, quick presets (`DungeonToken::PRESETS`) or custom creatures, and alone changes name, max HP, size and visibility; positions snap to the grid (`DungeonTokenController::snap()`: cell center for odd sizes, grid crossing for even sizes); a moving player token reveals 5×5 fog cells when fog is on;
* fog of war is edited only by the GM (`PUT .../nevoa`, saved with `DungeonFog::saveFor()`, also used by the layers inspector); for the GM the fog is drawn translucent under the tokens, for players opaque above them;
* combat state is shared (migration `000018`: `dungeon_atmospheres.in_combat`, `combat_round`, `active_token_id`); `PUT .../combate` (GM) accepts `start`, `next`, `prev`, `reroll`, `reset`; the order is initiative descending among visible tokens;
* AoEs (`circle`, `cone` 53°, `line` 5 ft wide, `cube`) are sized in feet through the grid scale of the layers; markers use `DungeonMarker::CATEGORIES`; both are created by any participant and changed/removed by the author or the GM; clearing all AoEs is GM-only;
* the screen reuses `world-map/viewport.js` and `world-map/drawing.js`; `dungeon/board.js` renders the layers and `dungeon/index.js` holds modes, polling and panels; quick rolls use the action menu (`dice:roll`).

GM dashboard (phase 9b, reference: `GmSessionController`, `GmCharacterController`, `GmPlayerController`, `GmBestiaryController`, `App\Game\NpcGenerator`, `App\Game\Bestiary`, `resources/views/gm/sessions/`, `public/js/gm/`):

* `/mestre/sessoes/{gameSession}?aba=mesa|bestiario|encontros|anotacoes|configuracoes` (tabs by query string, `GmSessionController::TABS`); every route under `/mestre/sessoes/{gameSession}` requires `GameSessionPolicy::update` (deleting the campaign requires `delete` and typing its name, bag `deleteSession`); character routes use `scopeBindings()`, so the character is always resolved inside the campaign;
* the table (`mesa`, filters `tipo=jogadores|npcs|monstros`, `ordem=nivel`) shows each character with the health tracker: `PUT .../personagens/{character}/vida` (JSON) applies `damage` (temporary PV absorbs first), `heal` (capped at the maximum), `temp`, `clear_temp`, `short_rest` (+25% of the maximum), `long_rest` (full PV, temp cleared) and `full_heal`, locking the character row;
* maximum PV comes from `CharacterSheet::maxPv()` (campaign formula; generated monsters keep their danger-boosted PV in `stats.pv`, as in the legacy app, and it wins when larger); `DungeonTokenController::vitals()` uses the same source;
* progression (`PUT .../progresso`, forms): `level_up` adds 1–20 levels plus the per-level points of `GameRules::progression()`; `points` adds/removes attribute, skill or power points (never below zero); `xp` changes XP without levelling up automatically (the card shows "Pronto para subir" when `xp >= xp_max`);
* `App\Game\NpcGenerator` (legacy `handleGenerateNPC`) uses `GameRules::npcDefaults()`: attributes start at the minimum and receive the pool with archetype weights (pool ×1.25 Letal, ×1.5 Chefe), skills/powers are bought by `purchase_cost` within the points, PV/ATP come from the formulas (PV ×1.3 Perigoso, ×1.6 Letal, ×2.2 Chefe for monsters); NPCs belong to the GM, have `is_npc`, and monsters `is_monster` / `monster_size` (migration `000019`); the GM deletes only NPCs (their tokens go with them) and toggles NPC/monster;
* creatures go to a dungeon of the campaign through `Concerns\SpawnsDungeonTokens` (near the entrance, rows of five, snapped to the grid): characters with `POST .../personagens/{character}/masmorra` (player characters keep one token per map owned by the player), bestiary monsters with `POST .../bestiario` (`monsters: [{id, count}]`, at most 30 per request, names numbered `#1`, `#2`...);
* the bestiary data lives in `resources/data/bestiary.json` (converted from `src/lib/bestiaryData.ts`); `Bestiary::encounter()` (`GET .../encontro?ambiente=&dificuldade=&tatica=`) uses the levels of the campaign player characters (4 × level 1 when empty); the browser adjusts counts and recomputes the adjusted XP with the same `countMultiplier` (mirror in `public/js/gm/encounter.js`); action damage buttons send `dice:roll` to the action menu;
* settings (`PUT .../configuracoes`, bag `settings`): name, description, cover image (`sessions/` on the public disk), active, shop enabled and shop items (none selected = whole catalog); players are invited by e-mail (`POST .../jogadores`, bag `invitePlayer`) and removed keeping their characters; GM notes (`gm_notes`) are saved from the `anotacoes` tab.

GM audio (phase 9c, reference: `App\Support\Sounds`, `SoundBoardController`, `AmbienceController`, `DungeonController::weather()`, `resources/views/gm/sessions/tabs/sons.blade.php`, `public/js/core/{sound,ambience}.js`, `public/js/tools/ambience.js`, `public/js/dungeon/weather.js`):

* `Sounds::EFFECTS` lists the 19 effects of the legacy `soundManager.ts` (5 dice sounds stored in the rule set columns, the other 14 and `custom_ambient` in `rule_sets.sound_settings`, migration `000020`); a stored value is empty/`synth:*` (Web Audio synthesis in `core/sound.js`), `sound:<id>` (library) or an `http(s)` URL (max 255 chars); the browser always receives resolved URLs from `Sounds::urls()` (`null` = synth), and a missing or failing file falls back to the synth;
* the "Sons" tab (`PUT /mestre/sessoes/{id}/sons`, bag `sounds`; select value `url` uses `sound_urls[key]`) saves into the campaign rule set (created as a copy of the global one when missing); admins may tick "também padrão global";
* the library is `custom_sounds`: uploads (MP3/WAV/OGG/M4A/WEBM up to 10 MB, `sounds/` on the public disk) or external URLs, per campaign or personal (`game_session_id` null, every campaign of that GM); `CustomSound::availableTo($user, $session)` is the only visibility rule; deleting removes the file;
* campaign ambience lives in the `dungeon_atmospheres` row without map: `GET /campanhas/{id}/ambiente?versao=` (participants, polled by the action menu tool "Ambientação" through `realtime.js`), `PUT` (GM: `soundscape` = one of `Sounds::SOUNDSCAPES`, `none` or `custom` + library `sound_id`, `volume`) and `POST .../efeito` (GM: plays an effect for every connected participant; `effect_at` keeps milliseconds and effects older than 15 s are not played); the model uses `$dateFormat` with milliseconds;
* browsers only play audio after a click, so listening is an opt-in per participant (`localStorage`: track, GM effects, volume); the 6 procedural soundscapes are ported to `core/ambience.js` (custom tracks loop and fall back to the cavern); the legacy per-map soundscapes imported in `dungeon_atmospheres` are not used;
* dungeon weather (`none`, `rain`, `fog`, `embers`, `snow`) is per map: `PUT .../masmorra/clima` (GM), returned as `weather` in the dungeon state and drawn in screen space by `dungeon/weather.js` (one still frame with `prefers-reduced-motion`).

Session journal (phase 5c, reference: `JournalEntryController`, `JournalImageController`, `resources/views/journal/`):

* `/diario` shows one selected entry (`?registro=`) with filters by query string: `visao=tudo` (own entries), `visao=campanha&campanha=` (every entry of a campaign the user plays or masters), `visao=personagem&personagem=`;
* reading follows `JournalEntryPolicy` (author, campaign GM and players, admin); only the author (or admin) edits, deletes and manages the gallery;
* uploaded files (gallery and NPC images) live on the public disk and are deleted when replaced or when the entry is deleted; hidden `image_path` inputs are only accepted if they already belong to the entry;
* eager loads that feed policies must select the columns the policy needs (e.g. `gameSession:id,...,gm_id`).

Catalogs and rules (phase 5b, reference: `app/Http/Controllers/Catalog/`, `RuleSetController`, `resources/views/catalog/`, `resources/views/rules/`):

* catalogs (talents, skills, powers, traits, item catalog) are global, under `/catalogos`, protected by `can:use-gm-tools` plus the content policies; resource routes use Portuguese verbs (`/criar`, `/editar`, set in `AppServiceProvider`);
* global rules ("Configurações Base") are admin-only (`/catalogos/regras`); campaign rules belong to the session GM (`/mestre/sessoes/{id}/regras`) and start as a copy of the global ones;
* formulas are validated with the `App\Rules\Formula` rule (`FormulaEvaluator::isValid`); renaming a skill/power type also renames the catalog entries and the formula variables of that rule set;
* player suggestions are approved through the catalog form (`?sugestao=ID`), so the admin reviews the data before it enters the base;
* shared form helpers: `x-form.field type="select" :options`, `x-search-bar` (slot for filters, `actions` slot for buttons), editable lists via `public/js/core/repeater.js` (`data-repeater`, `__INDEX__` placeholder);
* sound settings of the rule sets are edited in the "Sons" tab of the GM dashboard (phase 9c).

Campaign settings with live inheritance (reference: `App\Support\CampaignLibrary`, `Models\Concerns\CampaignLibraryEntry`, `CampaignLibraryController`, `Catalog\Concerns\ManagesCampaignEntries`, `RuleSet::saveAsGlobal()` / `pendingBaseChanges()`, migration `000021`, views `gm/sessions/library/`):

* a campaign inherits the base ("Configurações Base") as it is; everything the GM changes becomes a campaign version and the base never changes; **base changes never apply directly**: they arrive as suggestions the GM adopts or keeps;
* catalogs (talents, skills, powers, traits, items): base row = `game_session_id` and `base_id` null (`version` grows on each edit); campaign version = `game_session_id` + `base_id` (data the campaign uses, `base_version` = base version already reviewed, `hidden`); campaign-only entry = `game_session_id` without `base_id`. The canonical ID is always the base ID (sheets, shop, talent mods, GM modifiers and trait targets keep working); `CampaignLibrary::overlay()` swaps the data;
* states: `inherited`, `customized`, `update` (base changed), `new` (new base entry, hidden until adopted), `hidden`, `campaign`; base edits must call `CampaignLibrary::baseUpdating()` before saving (campaigns still inheriting get a copy of the previous data) and base creations `baseCreated()` (existing campaigns get it hidden as a suggestion); new campaigns inherit everything;
* every read of a catalog for a campaign goes through `CampaignLibrary::for($session)->entries(Model::class)` (or `rows()` for the GM); never query `whereNull('game_session_id')->orWhere(...)` again; the global catalog lists only base rows (`->base()`);
* rules: a campaign without its own rule set uses the global one live; `RuleSet::saveAsGlobal()` gives campaigns still inheriting a copy of the previous rules; campaign rule sets keep `base_snapshot`, and `pendingBaseChanges()` lists, field by field, base changes not yet reviewed (adopt the ticked ones with `PUT .../regras/base`; `DELETE .../regras` restores the base); new campaign rule sets come from `RuleSet::copyOfGlobalFor()`;
* the GM manages it at `/mestre/sessoes/{id}/regras` and `/mestre/sessoes/{id}/biblioteca?tipo=talentos|pericias|poderes|tracos|itens&situacao=` (tab "Regras & Biblioteca", `GameSessionPolicy::update`); create/edit reuse the catalog controllers and forms (`$form` with action, method, cancel, session, notice, version); a campaign version of an item uses the compatible weapons of the base item, while campaign-only items (e.g. ammo) define their own;
* deleting a base entry archives it (`archived_at`, `CampaignLibrary::baseArchived()`): it leaves the base catalog and campaigns created afterwards, but existing campaigns keep their own copy (state `removed`, no adopt/restore, the GM may hide it); base entries are never hard-deleted by the catalogs;
* what a GM creates or changes in a campaign library is a proposal for the base (`proposed_at`); the admin reviews it in `/admin/sugestoes?origem=campanhas` (`Admin\SuggestionController`): "Levar para a base" (`CampaignLibrary::promote()`: a change updates the base and the other campaigns get it as a suggestion; a campaign-only entry becomes a base entry with the same ID) or "Ignorar";
* player suggestions (`POST /sugestoes`) are reviewed only by admins (`SuggestionPolicy::review`) in `/admin/sugestoes?origem=jogadores`; approval still opens the catalog form (`?sugestao=`) and enters the base, reaching existing campaigns as "Novo na base"; `/catalogos/sugestoes` redirects to the admin panel.

---

## Security

The assistant must:

* validate input data;
* respect existing authorization rules;
* prevent SQL injection;
* avoid exposing sensitive information;
* escape output when necessary;
* respect CSRF protection;
* prevent unsafe mass assignment;
* use transactions for dependent operations;
* avoid logging passwords or tokens.

The assistant must not request real data to build examples.

Fictitious values and placeholders must be used.

---

## Response Format

Responses must prioritize code that can be directly applied to the project.

Whenever possible, the response must indicate:

* the file that must be changed;
* the code that must be added;
* the code that must be replaced;
* required imports;
* the expected impact of the change.

Example structure:

```text
File:
app/Http/Controllers/CharacterController.php

Change:
Replace the index() method with the code below.
```

When multiple files are required, the response must separate them clearly:

```text
1. Migration
2. Model
3. Controller
4. Blade View
5. CSS / JavaScript
6. Routes
```

The assistant must not include Git, deployment, Composer, npm, or environment configuration steps.

---

## Main Rule

The assistant’s purpose is exclusively to support code development.

Every solution must:

1. respect the project’s current standards;
2. use only resources already available in the project;
3. avoid external dependencies;
4. never access sensitive configuration;
5. never use Git;
6. never perform deployments;
7. never modify infrastructure;
8. provide code compatible with Laravel 13 and PHP 8.3;
9. avoid unnecessary changes to the existing architecture;
10. clearly identify the files and code sections that must be changed.
