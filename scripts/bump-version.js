
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// usage: node bump-version.js 0.5.3
const newVersion = process.argv[2];

if (!newVersion) {
    console.error('Error: Please provide a version number. Usage: node bump-version.js <version>');
    process.exit(1);
}

// 1. package.json
const packageJsonPath = path.resolve(__dirname, '../package.json');
try {
    const content = fs.readFileSync(packageJsonPath, 'utf-8');
    const json = JSON.parse(content);
    const oldVersion = json.version;
    json.version = newVersion;
    fs.writeFileSync(packageJsonPath, JSON.stringify(json, null, 2) + '\n');
    console.log(`Updated package.json: ${oldVersion} -> ${newVersion}`);
} catch (e) {
    console.error('Failed to update package.json', e);
}

// 2. src-tauri/tauri.conf.json
const tauriConfPath = path.resolve(__dirname, '../src-tauri/tauri.conf.json');
try {
    const content = fs.readFileSync(tauriConfPath, 'utf-8');
    const json = JSON.parse(content);
    const oldVersion = json.version;
    json.version = newVersion;
    fs.writeFileSync(tauriConfPath, JSON.stringify(json, null, 2)); // tauri.conf.json usually 2 spaces
    console.log(`Updated tauri.conf.json: ${oldVersion} -> ${newVersion}`);
} catch (e) {
    console.error('Failed to update tauri.conf.json', e);
}

// 3. src-tauri/Cargo.toml
const cargoTomlPath = path.resolve(__dirname, '../src-tauri/Cargo.toml');
try {
    let content = fs.readFileSync(cargoTomlPath, 'utf-8');
    // Simple regex to find version = "..." under [package]
    // We use a regex that matches the first occurrence which is typically the package version
    const regex = /^version\s*=\s*"[^"]+"/m;

    if (regex.test(content)) {
        const oldMatch = content.match(regex)[0];
        const newContent = content.replace(regex, `version = "${newVersion}"`);
        fs.writeFileSync(cargoTomlPath, newContent);
        console.log(`Updated Cargo.toml: ${oldMatch} -> version = "${newVersion}"`);
    } else {
        console.warn('Could not find version string in Cargo.toml');
    }
} catch (e) {
    console.error('Failed to update Cargo.toml', e);
}

// 4. components/Settings.tsx
const settingsPath = path.resolve(__dirname, '../components/Settings.tsx');
try {
    let content = fs.readFileSync(settingsPath, 'utf-8');
    // Look for: NXmind 心流导图 v0.5.2
    const regex = /NXmind 心流导图 v\d+\.\d+\.\d+/;

    if (regex.test(content)) {
        const oldMatch = content.match(regex)[0];
        const newContent = content.replace(regex, `NXmind 心流导图 v${newVersion}`);
        fs.writeFileSync(settingsPath, newContent);
        console.log(`Updated Settings.tsx: ${oldMatch} -> NXmind 心流导图 v${newVersion}`);
    } else {
        console.warn('Could not find version string in Settings.tsx');
    }
} catch (e) {
    console.error('Failed to update Settings.tsx', e);
}

console.log('Done! Please verify the changes.');
