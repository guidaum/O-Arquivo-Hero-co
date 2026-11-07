import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

function slugify(text: string): string {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '_')
    .substring(0, 50);
}

function escapePhpString(val: any): string {
  if (val === null || val === undefined) return 'null';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'object') {
    const json = JSON.stringify(val);
    return `'${json.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  }
  const str = String(val);
  return `'${str.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function escapeSql(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (typeof val === 'object') {
    const json = JSON.stringify(val);
    return `'${json.replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
  }
  const str = String(val);
  return `'${str.replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
}

async function downloadFile(url: string, destPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const client = url.startsWith('https') ? https : http;
      const file = fs.createWriteStream(destPath);
      const req = client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          res.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve(true);
          });
        } else if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlinkSync(destPath);
          downloadFile(res.headers.location, destPath).then(resolve);
        } else {
          file.close();
          if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
          resolve(false);
        }
      });
      req.on('error', () => {
        file.close();
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
        resolve(false);
      });
      req.setTimeout(5000, () => {
        req.destroy();
        file.close();
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
        resolve(false);
      });
    } catch (_) {
      resolve(false);
    }
  });
}

function saveBase64Image(dataUri: string, outDir: string, baseName: string): string | null {
  try {
    const match = dataUri.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (!match) return null;
    let ext = match[1].toLowerCase();
    if (ext === 'jpeg') ext = 'jpg';
    if (ext === 'svg+xml') ext = 'svg';
    const buffer = Buffer.from(match[2], 'base64');
    const filename = `${baseName}.${ext}`;
    const filePath = path.join(outDir, filename);
    fs.writeFileSync(filePath, buffer);
    return filename;
  } catch (e) {
    console.warn(`Failed to decode base64 for ${baseName}:`, e);
    return null;
  }
}

async function main() {
  console.log('--- Starting Laravel Migrations, Seeders & Images Exporter ---');

  const raw = fs.readFileSync('dump_data/firestore_dump.json', 'utf-8');
  const dbData = JSON.parse(raw);

  // Output directories
  const laravelDir = path.resolve('laravel_export');
  const migrationsDir = path.join(laravelDir, 'database', 'migrations');
  const seedersDir = path.join(laravelDir, 'database', 'seeders');
  const imagesBaseDir = path.resolve('images_export');
  const staticMapsDir = path.join(imagesBaseDir, 'static_maps');
  const charImagesDir = path.join(imagesBaseDir, 'characters_uploaded');
  const campaignImagesDir = path.join(imagesBaseDir, 'campaign_sessions');
  const chatImagesDir = path.join(imagesBaseDir, 'chat_uploads');
  const itemImagesDir = path.join(imagesBaseDir, 'item_catalog');
  const userImagesDir = path.join(imagesBaseDir, 'user_avatars');

  [migrationsDir, seedersDir, staticMapsDir, charImagesDir, campaignImagesDir, chatImagesDir, itemImagesDir, userImagesDir].forEach(d => {
    fs.mkdirSync(d, { recursive: true });
  });

  // 1. Copy static maps from src/assets/images
  console.log('\n[1/5] Processing Static System Images...');
  const srcAssets = path.resolve('src/assets/images');
  if (fs.existsSync(srcAssets)) {
    const files = fs.readdirSync(srcAssets);
    for (const f of files) {
      fs.copyFileSync(path.join(srcAssets, f), path.join(staticMapsDir, f));
      console.log(`  -> Copied static map: ${f}`);
    }
  }

  // 2. Process Character Uploaded Images
  console.log('\n[2/5] Processing Character Images...');
  const characters = dbData.characters || [];
  const charImageMap: Record<string, string> = {};

  for (const c of characters) {
    const charName = slugify(c.data.name || 'character');
    const imgVal = c.data.image;
    if (typeof imgVal === 'string') {
      if (imgVal.startsWith('data:image')) {
        const saved = saveBase64Image(imgVal, charImagesDir, `${c.id}_${charName}`);
        if (saved) {
          console.log(`  -> Decoded base64 character portrait: ${saved}`);
          charImageMap[c.id] = `images/characters_uploaded/${saved}`;
        }
      } else if (imgVal.startsWith('http')) {
        const ext = imgVal.includes('.png') ? 'png' : 'jpg';
        const filename = `${c.id}_${charName}.${ext}`;
        const filePath = path.join(charImagesDir, filename);
        const ok = await downloadFile(imgVal, filePath);
        if (ok) {
          console.log(`  -> Downloaded character portrait: ${filename}`);
          charImageMap[c.id] = `images/characters_uploaded/${filename}`;
        } else {
          charImageMap[c.id] = imgVal;
        }
      }
    }
  }

  // 3. Process Campaign Sessions Images
  console.log('\n[3/5] Processing Campaign Session Images...');
  const sessions = dbData.gameSessions || [];
  const sessionImageMap: Record<string, string> = {};

  for (const s of sessions) {
    const sName = slugify(s.data.name || 'campaign');
    const imgVal = s.data.image;
    if (typeof imgVal === 'string') {
      if (imgVal.startsWith('data:image')) {
        const saved = saveBase64Image(imgVal, campaignImagesDir, `${s.id}_${sName}`);
        if (saved) {
          console.log(`  -> Decoded base64 campaign banner: ${saved}`);
          sessionImageMap[s.id] = `images/campaign_sessions/${saved}`;
        }
      } else if (imgVal.startsWith('http')) {
        const ext = imgVal.includes('.png') ? 'png' : 'jpg';
        const filename = `${s.id}_${sName}.${ext}`;
        const filePath = path.join(campaignImagesDir, filename);
        const ok = await downloadFile(imgVal, filePath);
        if (ok) {
          console.log(`  -> Downloaded campaign banner: ${filename}`);
          sessionImageMap[s.id] = `images/campaign_sessions/${filename}`;
        } else {
          sessionImageMap[s.id] = imgVal;
        }
      }
    }
  }

  // 4. Process Item Catalog Images
  console.log('\n[4/5] Processing Item Catalog Images...');
  const items = dbData.itemCatalog || [];
  const itemImageMap: Record<string, string> = {};

  for (const item of items) {
    const itName = slugify(item.data.name || 'item');
    const imgVal = item.data.image;
    if (typeof imgVal === 'string') {
      if (imgVal.startsWith('data:image')) {
        const saved = saveBase64Image(imgVal, itemImagesDir, `${item.id}_${itName}`);
        if (saved) itemImageMap[item.id] = `images/item_catalog/${saved}`;
      } else if (imgVal.startsWith('http')) {
        const ext = imgVal.includes('.png') ? 'png' : 'jpg';
        const filename = `${item.id}_${itName}.${ext}`;
        const filePath = path.join(itemImagesDir, filename);
        const ok = await downloadFile(imgVal, filePath);
        if (ok) {
          console.log(`  -> Downloaded item image: ${filename}`);
          itemImageMap[item.id] = `images/item_catalog/${filename}`;
        } else {
          itemImageMap[item.id] = imgVal;
        }
      }
    }
  }

  // 5. Process User Avatars
  console.log('\n[5/5] Processing User Avatars...');
  const users = dbData.users || [];
  const userImageMap: Record<string, string> = {};

  for (const u of users) {
    const uName = slugify(u.data.displayName || 'user');
    const photo = u.data.photoURL;
    if (typeof photo === 'string' && photo.startsWith('http')) {
      const filename = `${u.id}_${uName}.jpg`;
      const filePath = path.join(userImagesDir, filename);
      const ok = await downloadFile(photo, filePath);
      if (ok) {
        console.log(`  -> Downloaded user avatar: ${filename}`);
        userImageMap[u.id] = `images/user_avatars/${filename}`;
      } else {
        userImageMap[u.id] = photo;
      }
    }
  }

  // Also check chat messages for base64 attachments
  const chatMessages = dbData.chatMessages || [];
  for (const msg of chatMessages) {
    const photo = msg.data.senderPhoto;
    if (typeof photo === 'string' && photo.startsWith('data:image')) {
      saveBase64Image(photo, chatImagesDir, `chat_${msg.id}`);
    }
  }

  console.log('\n=== Generating Laravel Migrations ===');

  const migrationsList = [
    {
      file: '2024_01_01_000001_create_users_table.php',
      table: 'users',
      class: 'CreateUsersTable',
      schema: `            $table->string('id', 128)->primary();
            $table->string('uid', 128)->unique();
            $table->string('email')->nullable();
            $table->string('display_name')->nullable();
            $table->text('photo_url')->nullable();
            $table->text('bio')->nullable();
            $table->string('location')->nullable();
            $table->string('phone_number')->nullable();
            $table->boolean('is_verified')->default(false);
            $table->enum('role', ['admin', 'gm', 'user'])->default('user');
            $table->timestamp('last_active')->nullable();
            $table->timestamps();`
    },
    {
      file: '2024_01_01_000002_create_game_sessions_table.php',
      table: 'game_sessions',
      class: 'CreateGameSessionsTable',
      schema: `            $table->string('id', 128)->primary();
            $table->string('name');
            $table->string('code', 32)->index();
            $table->string('gm_id', 128)->index();
            $table->text('description')->nullable();
            $table->longText('image')->nullable();
            $table->string('image_path')->nullable();
            $table->boolean('active')->default(true);
            $table->json('player_ids')->nullable();
            $table->json('map_settings')->nullable();
            $table->json('attributes')->nullable();
            $table->json('combat_tracker')->nullable();
            $table->text('dice_roll_sound')->nullable();
            $table->text('critical_sound')->nullable();
            $table->text('fumble_sound')->nullable();
            $table->text('success_sound')->nullable();
            $table->text('failure_sound')->nullable();
            $table->timestamps();`
    },
    {
      file: '2024_01_01_000003_create_characters_table.php',
      table: 'characters',
      class: 'CreateCharactersTable',
      schema: `            $table->string('id', 128)->primary();
            $table->string('owner_id', 128)->index();
            $table->string('session_id', 128)->nullable()->index();
            $table->string('name');
            $table->string('class')->nullable();
            $table->integer('level')->default(1);
            $table->integer('xp')->default(0);
            $table->integer('xp_max')->default(1000);
            $table->longText('image')->nullable();
            $table->string('image_path')->nullable();
            $table->string('color', 32)->nullable();
            $table->string('icon', 64)->nullable();
            $table->json('stats')->nullable();
            $table->json('stats_mods')->nullable();
            $table->json('talent_mods')->nullable();
            $table->boolean('can_edit_stats')->default(false);
            $table->json('skills')->nullable();
            $table->json('powers')->nullable();
            $table->json('traits')->nullable();
            $table->json('inventory')->nullable();
            $table->integer('atp')->nullable();
            $table->json('model_sheet_3d')->nullable();
            $table->timestamps();`
    },
    {
      file: '2024_01_01_000004_create_journal_entries_table.php',
      table: 'journal_entries',
      class: 'CreateJournalEntriesTable',
      schema: `            $table->string('id', 128)->primary();
            $table->string('owner_id', 128)->index();
            $table->string('game_session_id', 128)->nullable()->index();
            $table->string('character_id', 128)->nullable()->index();
            $table->string('title');
            $table->string('date')->nullable();
            $table->string('type')->nullable();
            $table->integer('xp')->default(0);
            $table->longText('content')->nullable();
            $table->timestamps();`
    },
    {
      file: '2024_01_01_000005_create_talents_table.php',
      table: 'talents',
      class: 'CreateTalentsTable',
      schema: `            $table->string('id', 128)->primary();
            $table->string('session_id', 128)->nullable()->index();
            $table->string('gm_id', 128)->nullable()->index();
            $table->string('name');
            $table->text('description')->nullable();
            $table->json('composition')->nullable();
            $table->timestamps();`
    },
    {
      file: '2024_01_01_000006_create_skills_table.php',
      table: 'skills',
      class: 'CreateSkillsTable',
      schema: `            $table->string('id', 128)->primary();
            $table->string('session_id', 128)->nullable()->index();
            $table->string('gm_id', 128)->nullable()->index();
            $table->string('name');
            $table->string('type')->nullable();
            $table->integer('atp_cost')->default(0);
            $table->string('damage')->nullable();
            $table->text('description')->nullable();
            $table->timestamps();`
    },
    {
      file: '2024_01_01_000007_create_powers_table.php',
      table: 'powers',
      class: 'CreatePowersTable',
      schema: `            $table->string('id', 128)->primary();
            $table->string('session_id', 128)->nullable()->index();
            $table->string('gm_id', 128)->nullable()->index();
            $table->string('name');
            $table->string('cost')->nullable();
            $table->text('effect')->nullable();
            $table->text('description')->nullable();
            $table->timestamps();`
    },
    {
      file: '2024_01_01_000008_create_traits_table.php',
      table: 'traits',
      class: 'CreateTraitsTable',
      schema: `            $table->string('id', 128)->primary();
            $table->string('session_id', 128)->nullable()->index();
            $table->string('name');
            $table->text('description')->nullable();
            $table->text('effect')->nullable();
            $table->json('effects')->nullable();
            $table->integer('modifier')->default(0);
            $table->string('modifier_type')->nullable();
            $table->enum('type', ['advantage', 'disadvantage'])->default('advantage');
            $table->integer('cost')->default(0);
            $table->timestamps();`
    },
    {
      file: '2024_01_01_000009_create_item_catalog_table.php',
      table: 'item_catalog',
      class: 'CreateItemCatalogTable',
      schema: `            $table->string('id', 128)->primary();
            $table->string('name');
            $table->string('category')->nullable();
            $table->string('rarity')->nullable();
            $table->decimal('weight', 8, 2)->default(0);
            $table->integer('value')->default(0);
            $table->text('description')->nullable();
            $table->text('image')->nullable();
            $table->string('image_path')->nullable();
            $table->json('stats')->nullable();
            $table->string('damage')->nullable();
            $table->integer('defense')->default(0);
            $table->string('created_by', 128)->nullable();
            $table->timestamps();`
    },
    {
      file: '2024_01_01_000010_create_world_maps_table.php',
      table: 'world_maps',
      class: 'CreateWorldMapsTable',
      schema: `            $table->string('id', 128)->primary();
            $table->string('name');
            $table->string('subtitle')->nullable();
            $table->longText('image_url')->nullable();
            $table->string('default_scale')->nullable();
            $table->boolean('active')->default(true);
            $table->string('session_id', 128)->nullable()->index();
            $table->string('created_by', 128)->nullable();
            $table->json('layer_settings')->nullable();
            $table->timestamps();`
    },
    {
      file: '2024_01_01_000011_create_dungeon_maps_table.php',
      table: 'dungeon_maps',
      class: 'CreateDungeonMapsTable',
      schema: `            $table->string('id', 128)->primary();
            $table->string('name');
            $table->string('subtitle')->nullable();
            $table->string('theme')->nullable();
            $table->longText('image_url')->nullable();
            $table->integer('grid_cols')->default(24);
            $table->integer('grid_rows')->default(14);
            $table->json('entrance_coord')->nullable();
            $table->boolean('active')->default(true);
            $table->string('session_id', 128)->nullable()->index();
            $table->string('created_by', 128)->nullable();
            $table->json('layer_settings')->nullable();
            $table->timestamps();`
    },
    {
      file: '2024_01_01_000012_create_dungeon_tokens_table.php',
      table: 'dungeon_tokens',
      class: 'CreateDungeonTokensTable',
      schema: `            $table->string('id', 128)->primary();
            $table->string('map_id', 128)->nullable()->index();
            $table->string('token_id', 128)->nullable();
            $table->string('name')->nullable();
            $table->integer('col')->default(0);
            $table->integer('row')->default(0);
            $table->string('color', 32)->nullable();
            $table->text('avatar')->nullable();
            $table->string('type', 32)->nullable();
            $table->timestamps();`
    },
    {
      file: '2024_01_01_000013_create_dungeon_fog_table.php',
      table: 'dungeon_fog',
      class: 'CreateDungeonFogTable',
      schema: `            $table->string('id', 128)->primary();
            $table->string('dungeon_id', 128)->nullable()->index();
            $table->boolean('enabled')->default(true);
            $table->json('revealed_cells')->nullable();
            $table->timestamps();`
    },
    {
      file: '2024_01_01_000014_create_dungeon_atmosphere_table.php',
      table: 'dungeon_atmosphere',
      class: 'CreateDungeonAtmosphereTable',
      schema: `            $table->string('id', 128)->primary();
            $table->string('dungeon_id', 128)->nullable()->index();
            $table->string('preset')->nullable();
            $table->integer('intensity')->default(50);
            $table->json('config')->nullable();
            $table->timestamps();`
    },
    {
      file: '2024_01_01_000015_create_map_pins_table.php',
      table: 'map_pins',
      class: 'CreateMapPinsTable',
      schema: `            $table->string('id', 128)->primary();
            $table->string('map_id', 128)->nullable()->index();
            $table->string('title');
            $table->text('description')->nullable();
            $table->decimal('x', 8, 4);
            $table->decimal('y', 8, 4);
            $table->string('type')->nullable();
            $table->text('custom_map_url')->nullable();
            $table->string('created_by', 128)->nullable();
            $table->timestamps();`
    },
    {
      file: '2024_01_01_000016_create_map_drawings_table.php',
      table: 'map_drawings',
      class: 'CreateMapDrawingsTable',
      schema: `            $table->string('id', 128)->primary();
            $table->string('map_id', 128)->nullable()->index();
            $table->json('paths')->nullable();
            $table->string('created_by', 128)->nullable();
            $table->timestamps();`
    },
    {
      file: '2024_01_01_000017_create_chat_messages_table.php',
      table: 'chat_messages',
      class: 'CreateChatMessagesTable',
      schema: `            $table->string('id', 128)->primary();
            $table->string('session_id', 128)->index();
            $table->string('sender_id', 128)->nullable();
            $table->string('sender_name')->nullable();
            $table->text('sender_photo')->nullable();
            $table->text('text')->nullable();
            $table->string('type')->nullable();
            $table->json('roll_result')->nullable();
            $table->timestamp('timestamp')->nullable();
            $table->timestamps();`
    },
    {
      file: '2024_01_01_000018_create_dungeon_pings_table.php',
      table: 'dungeon_pings',
      class: 'CreateDungeonPingsTable',
      schema: `            $table->string('id', 128)->primary();
            $table->string('dungeon_id', 128)->nullable()->index();
            $table->decimal('x', 8, 4);
            $table->decimal('y', 8, 4);
            $table->string('user_name')->nullable();
            $table->string('user_color', 32)->nullable();
            $table->timestamps();`
    },
    {
      file: '2024_01_01_000019_create_suggestions_table.php',
      table: 'suggestions',
      class: 'CreateSuggestionsTable',
      schema: `            $table->string('id', 128)->primary();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('category')->nullable();
            $table->string('status')->nullable();
            $table->string('suggested_by', 128)->nullable();
            $table->integer('votes')->default(0);
            $table->timestamps();`
    },
    {
      file: '2024_01_01_000020_create_global_settings_table.php',
      table: 'global_settings',
      class: 'CreateGlobalSettingsTable',
      schema: `            $table->string('id', 128)->primary();
            $table->json('attributes')->nullable();
            $table->json('system_config')->nullable();
            $table->json('sounds')->nullable();
            $table->timestamps();`
    }
  ];

  for (const m of migrationsList) {
    const code = `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('${m.table}', function (Blueprint $table) {
${m.schema}
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('${m.table}');
    }
};
`;
    fs.writeFileSync(path.join(migrationsDir, m.file), code, 'utf-8');
    console.log(`  -> Created migration: ${m.file}`);
  }

  console.log('\n=== Generating Laravel Seeders ===');

  function generateSeeder(className: string, tableName: string, records: any[]): string {
    const chunkedRows: string[] = [];
    records.forEach(r => {
      const entries: string[] = [];
      Object.entries(r).forEach(([k, v]) => {
        entries.push(`                '${k}' => ${escapePhpString(v)}`);
      });
      chunkedRows.push(`            [\n${entries.join(',\n')}\n            ]`);
    });

    return `<?php

namespace Database\\Seeders;

use Illuminate\\Database\\Seeder;
use Illuminate\\Support\\Facades\\DB;

class ${className} extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        DB::table('${tableName}')->delete();

        $records = [
${chunkedRows.join(',\n')}
        ];

        foreach (array_chunk($records, 50) as $chunk) {
            DB::table('${tableName}')->insert($chunk);
        }
    }
}
`;
  }

  // Build users records
  const userRows = (dbData.users || []).map((u: any) => ({
    id: u.id,
    uid: u.data.uid || u.id,
    email: u.data.email || null,
    display_name: u.data.displayName || null,
    photo_url: userImageMap[u.id] || u.data.photoURL || null,
    bio: u.data.bio || null,
    location: u.data.location || null,
    phone_number: u.data.phoneNumber || null,
    is_verified: !!u.data.isVerified,
    role: u.data.role || 'user',
    last_active: u.data.lastActive || null,
    created_at: u.data.createdAt || new Date().toISOString(),
    updated_at: u.data.updatedAt || new Date().toISOString()
  }));
  fs.writeFileSync(path.join(seedersDir, 'UserSeeder.php'), generateSeeder('UserSeeder', 'users', userRows));

  // Build sessions records
  const sessionRows = (dbData.gameSessions || []).map((s: any) => ({
    id: s.id,
    name: s.data.name || 'Sessão sem nome',
    code: s.data.code || s.id.substring(0, 6).toUpperCase(),
    gm_id: s.data.gmId || '',
    description: s.data.description || null,
    image: s.data.image || null,
    image_path: sessionImageMap[s.id] || null,
    active: s.data.active !== false,
    player_ids: s.data.playerIds || [],
    map_settings: s.data.mapSettings || null,
    attributes: s.data.attributes || null,
    combat_tracker: s.data.combatTracker || null,
    dice_roll_sound: s.data.diceRollSound || null,
    critical_sound: s.data.criticalSound || null,
    fumble_sound: s.data.fumbleSound || null,
    success_sound: s.data.successSound || null,
    failure_sound: s.data.failureSound || null,
    created_at: s.data.createdAt || new Date().toISOString(),
    updated_at: s.data.updatedAt || new Date().toISOString()
  }));
  fs.writeFileSync(path.join(seedersDir, 'GameSessionSeeder.php'), generateSeeder('GameSessionSeeder', 'game_sessions', sessionRows));

  // Build character records
  const charRows = (dbData.characters || []).map((c: any) => ({
    id: c.id,
    owner_id: c.data.ownerId || '',
    session_id: c.data.sessionId || null,
    name: c.data.name || 'Personagem',
    class: c.data.class || null,
    level: Number(c.data.level) || 1,
    xp: Number(c.data.xp) || 0,
    xp_max: Number(c.data.xpMax) || 1000,
    image: c.data.image || null,
    image_path: charImageMap[c.id] || null,
    color: c.data.color || null,
    icon: c.data.icon || null,
    stats: c.data.stats || null,
    stats_mods: c.data.statsMods || null,
    talent_mods: c.data.talentMods || null,
    can_edit_stats: !!c.data.canEditStats,
    skills: c.data.skills || [],
    powers: c.data.powers || [],
    traits: c.data.traits || [],
    inventory: c.data.inventory || [],
    atp: c.data.atp ?? null,
    model_sheet_3d: c.data.modelSheet3d || null,
    created_at: c.data.createdAt || new Date().toISOString(),
    updated_at: c.data.updatedAt || new Date().toISOString()
  }));
  fs.writeFileSync(path.join(seedersDir, 'CharacterSeeder.php'), generateSeeder('CharacterSeeder', 'characters', charRows));

  // Build journal records
  const journalRows = (dbData.journalEntries || []).map((j: any) => ({
    id: j.id,
    owner_id: j.data.ownerId || '',
    game_session_id: j.data.gameSessionId || null,
    character_id: j.data.characterId || null,
    title: j.data.title || 'Diário',
    date: j.data.date || null,
    type: j.data.type || null,
    xp: Number(j.data.xp) || 0,
    content: j.data.content || null,
    created_at: j.data.createdAt || new Date().toISOString(),
    updated_at: j.data.updatedAt || new Date().toISOString()
  }));
  fs.writeFileSync(path.join(seedersDir, 'JournalEntrySeeder.php'), generateSeeder('JournalEntrySeeder', 'journal_entries', journalRows));

  // Build talents records
  const talentRows = (dbData.talents || []).map((t: any) => ({
    id: t.id,
    session_id: t.data.sessionId || null,
    gm_id: t.data.gmId || null,
    name: t.data.name || 'Talento',
    description: t.data.description || null,
    composition: t.data.composition || [],
    created_at: t.data.createdAt || new Date().toISOString(),
    updated_at: t.data.updatedAt || new Date().toISOString()
  }));
  fs.writeFileSync(path.join(seedersDir, 'TalentSeeder.php'), generateSeeder('TalentSeeder', 'talents', talentRows));

  // Build skills records
  const skillRows = (dbData.skills || []).map((s: any) => ({
    id: s.id,
    session_id: s.data.sessionId || null,
    gm_id: s.data.gmId || null,
    name: s.data.name || 'Habilidade',
    type: s.data.type || 'Geral',
    atp_cost: Number(s.data.atpCost) || 0,
    damage: s.data.damage || null,
    description: s.data.description || null,
    created_at: s.data.createdAt || new Date().toISOString(),
    updated_at: s.data.updatedAt || new Date().toISOString()
  }));
  fs.writeFileSync(path.join(seedersDir, 'SkillSeeder.php'), generateSeeder('SkillSeeder', 'skills', skillRows));

  // Build powers records
  const powerRows = (dbData.powers || []).map((p: any) => ({
    id: p.id,
    session_id: p.data.sessionId || null,
    gm_id: p.data.gmId || null,
    name: p.data.name || 'Poder',
    cost: p.data.cost || null,
    effect: p.data.effect || null,
    description: p.data.description || null,
    created_at: p.data.createdAt || new Date().toISOString(),
    updated_at: p.data.updatedAt || new Date().toISOString()
  }));
  fs.writeFileSync(path.join(seedersDir, 'PowerSeeder.php'), generateSeeder('PowerSeeder', 'powers', powerRows));

  // Build traits records
  const traitRows = (dbData.traits || []).map((t: any) => ({
    id: t.id,
    session_id: t.data.sessionId || null,
    name: t.data.name || 'Traço',
    description: t.data.description || null,
    effect: t.data.effect || null,
    effects: t.data.effects || [],
    modifier: Number(t.data.modifier) || 0,
    modifier_type: t.data.modifierType || null,
    type: t.data.type || 'advantage',
    cost: Number(t.data.cost) || 0,
    created_at: t.data.createdAt || new Date().toISOString(),
    updated_at: t.data.updatedAt || new Date().toISOString()
  }));
  fs.writeFileSync(path.join(seedersDir, 'TraitSeeder.php'), generateSeeder('TraitSeeder', 'traits', traitRows));

  // Build items records
  const itemRows = (dbData.itemCatalog || []).map((it: any) => ({
    id: it.id,
    name: it.data.name || 'Item',
    category: it.data.category || null,
    rarity: it.data.rarity || 'Comum',
    weight: Number(it.data.weight) || 0,
    value: Number(it.data.value) || 0,
    description: it.data.description || null,
    image: it.data.image || null,
    image_path: itemImageMap[it.id] || null,
    stats: it.data.stats || null,
    damage: it.data.damage || null,
    defense: Number(it.data.defense) || 0,
    created_by: it.data.createdBy || null,
    created_at: it.data.createdAt || new Date().toISOString(),
    updated_at: it.data.updatedAt || new Date().toISOString()
  }));
  fs.writeFileSync(path.join(seedersDir, 'ItemCatalogSeeder.php'), generateSeeder('ItemCatalogSeeder', 'item_catalog', itemRows));

  // Build world maps records
  const worldMapRows = (dbData.worldMaps || []).map((m: any) => ({
    id: m.id,
    name: m.data.name || 'Mapa do Mundo',
    subtitle: m.data.subtitle || null,
    image_url: m.data.imageUrl || null,
    default_scale: m.data.defaultScale || '1 cm = 25 léguas',
    active: m.data.active !== false,
    session_id: m.data.sessionId || null,
    created_by: m.data.createdBy || null,
    layer_settings: m.data.layerSettings || null,
    created_at: m.data.createdAt || new Date().toISOString(),
    updated_at: m.data.updatedAt || new Date().toISOString()
  }));
  fs.writeFileSync(path.join(seedersDir, 'WorldMapSeeder.php'), generateSeeder('WorldMapSeeder', 'world_maps', worldMapRows));

  // Build dungeon maps records
  const dungeonMapRows = (dbData.dungeonMaps || []).map((m: any) => ({
    id: m.id,
    name: m.data.name || 'Masmorra',
    subtitle: m.data.subtitle || null,
    theme: m.data.theme || null,
    image_url: m.data.imageUrl || null,
    grid_cols: Number(m.data.gridCols) || 24,
    grid_rows: Number(m.data.gridRows) || 14,
    entrance_coord: m.data.entranceCoord || null,
    active: m.data.active !== false,
    session_id: m.data.sessionId || null,
    created_by: m.data.createdBy || null,
    layer_settings: m.data.layerSettings || null,
    created_at: m.data.createdAt || new Date().toISOString(),
    updated_at: m.data.updatedAt || new Date().toISOString()
  }));
  fs.writeFileSync(path.join(seedersDir, 'DungeonMapSeeder.php'), generateSeeder('DungeonMapSeeder', 'dungeon_maps', dungeonMapRows));

  // Build dungeon tokens records
  const tokenRows = (dbData.dungeonTokens || []).map((tok: any) => ({
    id: tok.id,
    map_id: tok.data.mapId || null,
    token_id: tok.data.tokenId || tok.id,
    name: tok.data.name || null,
    col: Number(tok.data.col) || 0,
    row: Number(tok.data.row) || 0,
    color: tok.data.color || null,
    avatar: tok.data.avatar || null,
    type: tok.data.type || null,
    created_at: tok.data.createdAt || new Date().toISOString(),
    updated_at: tok.data.updatedAt || new Date().toISOString()
  }));
  fs.writeFileSync(path.join(seedersDir, 'DungeonTokenSeeder.php'), generateSeeder('DungeonTokenSeeder', 'dungeon_tokens', tokenRows));

  // Build dungeon fog records
  const fogRows = (dbData.dungeonFog || []).map((f: any) => ({
    id: f.id,
    dungeon_id: f.data.dungeonId || f.id,
    enabled: f.data.enabled !== false,
    revealed_cells: f.data.revealedCells || [],
    created_at: f.data.createdAt || new Date().toISOString(),
    updated_at: f.data.updatedAt || new Date().toISOString()
  }));
  fs.writeFileSync(path.join(seedersDir, 'DungeonFogSeeder.php'), generateSeeder('DungeonFogSeeder', 'dungeon_fog', fogRows));

  // Build map pins records
  const pinRows = (dbData.mapPins || []).map((p: any) => ({
    id: p.id,
    map_id: p.data.mapId || null,
    title: p.data.title || 'Marcador',
    description: p.data.description || null,
    x: Number(p.data.x) || 0,
    y: Number(p.data.y) || 0,
    type: p.data.type || null,
    custom_map_url: p.data.customMapUrl || null,
    created_by: p.data.createdBy || null,
    created_at: p.data.createdAt || new Date().toISOString(),
    updated_at: p.data.updatedAt || new Date().toISOString()
  }));
  fs.writeFileSync(path.join(seedersDir, 'MapPinSeeder.php'), generateSeeder('MapPinSeeder', 'map_pins', pinRows));

  // Build chat messages records
  const chatRows = (dbData.chatMessages || []).map((msg: any) => ({
    id: msg.id,
    session_id: msg.data.sessionId || '',
    sender_id: msg.data.senderId || null,
    sender_name: msg.data.senderName || 'Anônimo',
    sender_photo: msg.data.senderPhoto || null,
    text: msg.data.text || null,
    type: msg.data.type || 'text',
    roll_result: msg.data.rollResult || null,
    timestamp: msg.data.timestamp || new Date().toISOString(),
    created_at: msg.data.createdAt || new Date().toISOString(),
    updated_at: msg.data.updatedAt || new Date().toISOString()
  }));
  fs.writeFileSync(path.join(seedersDir, 'ChatMessageSeeder.php'), generateSeeder('ChatMessageSeeder', 'chat_messages', chatRows));

  // Build suggestions records
  const suggestionRows = (dbData.suggestions || []).map((s: any) => ({
    id: s.id,
    title: s.data.title || 'Sugestão',
    description: s.data.description || null,
    category: s.data.category || null,
    status: s.data.status || 'pending',
    suggested_by: s.data.suggestedBy || null,
    votes: Number(s.data.votes) || 0,
    created_at: s.data.createdAt || new Date().toISOString(),
    updated_at: s.data.updatedAt || new Date().toISOString()
  }));
  fs.writeFileSync(path.join(seedersDir, 'SuggestionSeeder.php'), generateSeeder('SuggestionSeeder', 'suggestions', suggestionRows));

  // Build global settings records
  const settingRows = (dbData.globalSettings || []).map((g: any) => ({
    id: g.id,
    attributes: g.data.attributes || null,
    system_config: g.data.systemConfig || null,
    sounds: g.data.sounds || null,
    created_at: g.data.createdAt || new Date().toISOString(),
    updated_at: g.data.updatedAt || new Date().toISOString()
  }));
  fs.writeFileSync(path.join(seedersDir, 'GlobalSettingSeeder.php'), generateSeeder('GlobalSettingSeeder', 'global_settings', settingRows));

  // Master DatabaseSeeder.php
  const masterSeeder = `<?php

namespace Database\\Seeders;

use Illuminate\\Database\\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            UserSeeder::class,
            GameSessionSeeder::class,
            CharacterSeeder::class,
            JournalEntrySeeder::class,
            TalentSeeder::class,
            SkillSeeder::class,
            PowerSeeder::class,
            TraitSeeder::class,
            ItemCatalogSeeder::class,
            WorldMapSeeder::class,
            DungeonMapSeeder::class,
            DungeonTokenSeeder::class,
            DungeonFogSeeder::class,
            MapPinSeeder::class,
            ChatMessageSeeder::class,
            SuggestionSeeder::class,
            GlobalSettingSeeder::class,
        ]);
    }
}
`;
  fs.writeFileSync(path.join(seedersDir, 'DatabaseSeeder.php'), masterSeeder, 'utf-8');
  console.log('  -> Created DatabaseSeeder.php');

  // Also write a full SQL Dump file
  console.log('\n=== Generating Direct SQL Dump (dump.sql) ===');
  let sqlDump = `-- RPG System Database Export
-- Generated on: ${new Date().toISOString()}
-- Compatible with MySQL 8.0+ / MariaDB / PostgreSQL

SET FOREIGN_KEY_CHECKS=0;

`;

  const allTables = [
    { name: 'users', rows: userRows },
    { name: 'game_sessions', rows: sessionRows },
    { name: 'characters', rows: charRows },
    { name: 'journal_entries', rows: journalRows },
    { name: 'talents', rows: talentRows },
    { name: 'skills', rows: skillRows },
    { name: 'powers', rows: powerRows },
    { name: 'traits', rows: traitRows },
    { name: 'item_catalog', rows: itemRows },
    { name: 'world_maps', rows: worldMapRows },
    { name: 'dungeon_maps', rows: dungeonMapRows },
    { name: 'dungeon_tokens', rows: tokenRows },
    { name: 'dungeon_fog', rows: fogRows },
    { name: 'map_pins', rows: pinRows },
    { name: 'chat_messages', rows: chatRows },
    { name: 'suggestions', rows: suggestionRows },
    { name: 'global_settings', rows: settingRows }
  ];

  for (const t of allTables) {
    if (t.rows.length === 0) continue;
    sqlDump += `\n-- Table: ${t.name}\n`;
    const cols = Object.keys(t.rows[0]);
    sqlDump += `INSERT INTO \`${t.name}\` (\`${cols.join('`, `')}\`) VALUES\n`;
    const valRows = t.rows.map(r => {
      const vals = cols.map(c => escapeSql((r as any)[c]));
      return `  (${vals.join(', ')})`;
    });
    sqlDump += valRows.join(',\n') + ';\n';
  }

  sqlDump += `\nSET FOREIGN_KEY_CHECKS=1;\n`;
  fs.writeFileSync(path.join(laravelDir, 'dump.sql'), sqlDump, 'utf-8');
  console.log(`  -> Created ${path.join(laravelDir, 'dump.sql')} (${sqlDump.length} bytes)`);

  // Copy images into laravel_export/storage/app/public/images
  console.log('\n=== Packaging Storage Directory for Laravel ===');
  const laravelStorage = path.join(laravelDir, 'storage', 'app', 'public', 'images');
  fs.mkdirSync(laravelStorage, { recursive: true });

  function copyDirRecursive(src: string, dest: string) {
    if (!fs.existsSync(src)) return;
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        copyDirRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  copyDirRecursive(imagesBaseDir, laravelStorage);

  // README in laravel_export
  const readmeContent = `# Exportação de Dados e Migrations Laravel

Este pacote contém todas as migrations, seeders e dados exportados do sistema RPG.

## Estrutura
- \`database/migrations/\`: Todas as migrações de tabelas estruturadas com Blueprint.
- \`database/seeders/\`: Todos os seeders contendo todos os dados reais (usuários, personagens, sessões, talentos, poderes, etc.).
- \`database/seeders/DatabaseSeeder.php\`: Seeder mestre para executar \`php artisan db:seed\`.
- \`storage/app/public/images/\`: Todas as imagens (mapas de masmorras, mapas de mundo, avatares de personagens decodificados de Base64 para arquivos JPG/PNG, itens e campanhas).
- \`dump.sql\`: Dump direto SQL para importação instantânea em MySQL/PostgreSQL.

## Como Usar no Laravel:
1. Copie a pasta \`database/migrations/*\` para o diretório \`database/migrations/\` do seu projeto Laravel.
2. Copie a pasta \`database/seeders/*\` para o diretório \`database/seeders/\` do seu projeto Laravel.
3. Copie a pasta \`storage/app/public/images/\` para \`storage/app/public/images/\` do Laravel e execute:
   \`\`\`bash
   php artisan storage:link
   \`\`\`
4. Execute as migrations e os seeders:
   \`\`\`bash
   php artisan migrate:fresh --seed
   \`\`\`
`;
  fs.writeFileSync(path.join(laravelDir, 'README.md'), readmeContent, 'utf-8');

  console.log('\n--- Build finished successfully! ---');
}

main().catch(console.error);
