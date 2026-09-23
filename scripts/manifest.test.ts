import { mkdir, mkdtemp, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { beforeEach, describe, expect, it } from 'vitest'
import { getInternalPluginManifests } from './manifest'

let root: string

beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'revenge-manifests-'))
})

async function plugin(stage: string, dir: string, manifest: unknown) {
    const path = join(root, stage, dir)
    await mkdir(path, { recursive: true })
    await writeFile(join(path, 'manifest.json'), JSON.stringify(manifest))
}

describe('getInternalPluginManifests', () => {
    it('stamps every plugin with the bundle version', async () => {
        await plugin('preinit', 'api', { id: 'revenge.api' })
        await plugin('start', 'settings', { id: 'revenge.settings' })

        expect(await getInternalPluginManifests(root)).toEqual([
            { id: 'revenge.api' },
            { id: 'revenge.settings' },
        ])
    })

    it('keeps dependencies, which is the half native cannot derive', async () => {
        await plugin('start', 'settings', { id: 'revenge.settings' })
        await plugin('start', 'settings.plugins', {
            id: 'revenge.settings.plugins',
            dependencies: { 'revenge.settings': {} },
        })

        const plugins = await getInternalPluginManifests(root)
        expect(plugins).toContainEqual({
            id: 'revenge.settings.plugins',
            dependencies: { 'revenge.settings': {} },
        })
    })

    it('drops everything native does not read', async () => {
        await plugin('start', 'settings', {
            id: 'revenge.settings',
            name: 'Settings',
            description: 'Settings UI for Revenge.',
            author: 'Revenge',
            icon: 'SettingsIcon',
        })

        const plugins = await getInternalPluginManifests(root)
        expect(plugins).toEqual([{ id: 'revenge.settings' }])
    })

    // Replaces the type checking lost when cross-plugin ID imports were removed.
    it('rejects a dependency on a plugin that does not exist', async () => {
        await plugin('start', 'settings.plugins', {
            id: 'revenge.settings.plugins',
            dependencies: { 'revenge.setings': {} },
        })

        await expect(getInternalPluginManifests(root)).rejects.toThrow(
            /"revenge.setings", which is not an internal plugin/,
        )
    })

    it('allows reserved dependencies, which no plugin declares', async () => {
        await plugin('preinit', 'logging', {
            id: 'revenge.logging',
            dependencies: { 'revenge.api': {}, discord: {} },
        })

        await expect(getInternalPluginManifests(root)).resolves.toBeDefined()
    })

    it('rejects two plugins claiming one ID', async () => {
        await plugin('preinit', 'settings', { id: 'revenge.settings' })
        await plugin('start', 'settings', { id: 'revenge.settings' })

        await expect(getInternalPluginManifests(root)).rejects.toThrow(
            /share the ID "revenge.settings"/,
        )
    })
})
