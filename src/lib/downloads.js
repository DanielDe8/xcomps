import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Preferences } from '@capacitor/preferences'

export async function findSoarFolders(filesystem = Filesystem, preferences = Preferences) {
    const result = await filesystem.readdir({ path: 'Android/media', directory: Directory.ExternalStorage })
    return Promise.all(result.files
        .filter(info => info.type === 'directory' && info.name.toLowerCase().includes('soar'))
        .map(async ({ name }) => ({ name, preferred: (await preferences.get({ key: name })).value !== 'false' })))
}

export async function writeDownloadFile(data, fileName, folders, filesystem = Filesystem) {
    if (!folders.length) throw new Error('Please select at least one Android/media folder.')
    const saved = [], failed = []
    for (const { name } of folders) {
        if (!name || /[/\\]/.test(name) || name === '..') throw new Error('Invalid destination folder.')
        try {
            await filesystem.writeFile({
                path: `Android/media/${name}/${fileName}`, data,
                directory: Directory.ExternalStorage, encoding: Encoding.UTF8,
            })
            saved.push(name)
        } catch (error) { failed.push({ name, message: error.message || String(error) }) }
    }
    return { saved, failed }
}

export function downloadError(result) {
    return `${result.saved.length ? `Saved to ${result.saved.join(', ')}. ` : ''}Unable to save to ${result.failed.map(f => `${f.name}: ${f.message}`).join('; ')}. Check storage permission and try again.`
}
