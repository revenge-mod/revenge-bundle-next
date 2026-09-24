import { registerInternalManifest } from '@revenge-mod/plugins/_'
import type { InternalPluginManifest } from '@revenge-mod/plugins/_'

export type RawInternalPluginManifest = InternalPluginManifest & {
    build?: {
        devOnly?: boolean
    }
}

const manifests = import.meta.glob<RawInternalPluginManifest>(
    './*/*/manifest.json',
    {
        eager: true,
        import: 'default',
    },
)

for (const manifest of Object.values(manifests)) {
    if (manifest.build?.devOnly && !__DEV__) continue
    registerInternalManifest(manifest)
}
