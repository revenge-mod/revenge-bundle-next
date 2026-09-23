import { registerInternalManifest } from '@revenge-mod/plugins/_'
import type { InternalPluginManifest } from '@revenge-mod/plugins/_'

const manifests = import.meta.glob<InternalPluginManifest>(
    './*/*/manifest.json',
    {
        eager: true,
        import: 'default',
    },
)

for (const manifest of Object.values(manifests))
    registerInternalManifest(manifest)
