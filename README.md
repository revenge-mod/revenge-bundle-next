<p align="center">
  <picture>
    <source
      width="512px"
      media="(prefers-color-scheme: dark)"
      srcset="assets/wordmark/wordmark+slogan-dark.svg"
    >
    <img
      width="512px"
      src="assets/wordmark/wordmark+slogan-light.svg"
    >
  </picture>
  <br>
   <a href="https://discord.com/invite/ddcQf3s2Uq">
       <picture>
           <source height="32px" media="(prefers-color-scheme: dark)" srcset="https://user-images.githubusercontent.com/13122796/178032563-d4e084b7-244e-4358-af50-26bde6dd4996.png" />
           <img height="32px" src="https://user-images.githubusercontent.com/13122796/178032563-d4e084b7-244e-4358-af50-26bde6dd4996.png" />
       </picture>
   </a>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
   <a href="https://github.com/revenge-mod">
       <picture>
           <source height="32px" media="(prefers-color-scheme: dark)" srcset="https://i.ibb.co/dMMmCrW/Git-Hub-Mark.png" />
           <img height="32px" src="https://i.ibb.co/9wV3HGF/Git-Hub-Mark-Light.png" />
       </picture>
   </a>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
   </a>
</p>

# Revenge

**Discord, your way.** Revenge is a client modification for Discord Android.

Revenge aims to be a lightweight and lightning-fast client modification for Discord Android, while being user-friendly and developer-first. It provides a powerful framework, allowing developers to make add-ons with ease. The sky is the limit!

## ❓ About

This repository releases Hermes Bytecode to be executed on official Discord Android clients. The bytecode is not standalone and is meant to be used with official bootstrappers listed in the [⬇️ Download](#️-download) section.

## 💪 Features

- **🔌 Plugins**: Extend Discord with custom features
- **🎨 Themes & Fonts**: Customize Discord's appearance to your liking
- **🧪 Experiments**: Try out Discord's new features before they're rolled out

## ⬇️ Download

These are the official Revenge ways to install Revenge:

- **📵 Non-root**: [Revenge Manager](https://github.com/revenge-mod/revenge-manager/releases/latest)
- **🩹 Root with Xposed**: [RevengeXposed](https://github.com/revenge-mod/revenge-xposed/releases/latest)

Using the installation methods above will currently install [Revenge Classic](https://github.com/revenge-mod/revenge-bundle). You'll need to update from Revenge Classic to Revenge Next manually.

### ⬆️ Updating to Revenge Next

> **It is recommended to do a separate installation of Revenge before updating to Revenge Next.**  
> Revenge Next does not offer an easy way to downgrade to Revenge Classic.

To update to Revenge Next from Revenge Classic, follow these steps:

1. Download the latest release asset from [Revenge Next's Actions tab](https://github.com/revenge-mod/revenge-bundle-next/actions/workflows/build.yml).
2. Extract the built bundle and host a local HTTP server that serves the `revenge.bundle` file.
3. In Revenge Classic, go to **Settings** > **Revenge**, and toggle on **Developer Settings**.
4. Navigate back, and head into the **Developer** section.
5. Edit the **Load from custom URL** field to point to the URL of the `revenge.bundle` file you hosted.
6. Restart Discord, and you should be running Revenge Next!

### 🔄️ Updating builds

Revenge Next is updated regularly with new features and bug fixes. To update to the latest build, follow these steps:

1. Host a HTTP server that points to a new `revenge.bundle` file.
2. Head to **Settings** > **Developer** (under the **Revenge** section).
3. Tap on the **Evaluate JavaScript** option.
4. Paste and evaluate the following snippet. Make sure to modify the URL to point to your newly hosted `revenge.bundle` file:

    ```js
    var REVENGE_UPDATE_URL = "<URL here, keep the quotes>";
    revenge.discord.native.FileModule.writeFile("documents", "pyoncord/loader.json", JSON.stringify({"customLoadUrl":{"enabled":true,"url":REVENGE_UPDATE_URL}}), "utf8");
    "URL updated, please reload Revenge"
    ```

5. Restart Discord.

## 👷 Developing with Revenge Next

You'll need to have [Bun](https://bun.com/) installed. Once you have Bun, follow these steps:

```sh
# Install dependencies
bun install
```

---

```sh
# Build Revenge Next
bun run build

# Build Revenge Next with debugging enabled (slow, don't use in production)
bun run build --dev
```

```sh
# Start the development server
bun run dev

# Build as production
bun run dev --prod
```

<sub>Builds are generated at `dist/revenge.bundle`.</sub>

```sh
# Build types for external consumers
bun run types
```

<sub>Types are generated at `dist/types`. To consume, include `<dir>/globals.d.ts`, and map `@revenge-mod/*` to `<dir>/lib/*`.</sub>
<br>
<sub>Bundlers will need to map imports to property access on `revenge` turning `kebab-case` and `snake_case` to `camelCase`.</sub>
<sub>Example: `@revenge-mod/discord/modules/main_tabs_v2` to `revenge.discord.modules.mainTabsV2`</sub>
