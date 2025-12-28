# Copy Any Component Plugin for Strapi 5

[![npm version](https://img.shields.io/npm/v/strapi-plugin-copy-any-component.svg)](https://www.npmjs.com/package/strapi-plugin-copy-any-component)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A powerful Strapi plugin that allows you to copy and reorder components between pages using an intuitive drag-and-drop interface. **No code required!**

## ✨ Features

- 🎯 Drag & Drop Interface
- 🔍 Auto-Detects all content types and dynamic zones
- ⚙️ Zero-Code Configuration via admin panel
- 📸 Media Support
- 💾 Draft/Publish System

## 📦 Installation

```bash
npm install strapi-plugin-copy-any-component
```

### Register Plugin

Add to `config/plugins.ts`:

```typescript
export default () => ({
  'copy-any-component': {
    enabled: true,
    config: {
      contentType: 'api::page.page',  // Optional: default content type
      dynamicZoneField: 'sections',    // Optional: default dynamic zone
    },
  },
});
```

> **Note:** The `config` section is optional. You can also configure content type via admin panel.

### Set Permissions

Go to **Settings > Users & Permissions > Roles**, select your role, and enable all permissions for **Copy Any Component**.

Restart Strapi:
```bash
npm run develop
```

## 🚀 Usage

1. Go to **Plugins > Copy Any Component** in Strapi admin
2. Configure content type via **⚙️ Content Type Settings** (optional)
3. Select **Source Page** and **Target Page**
4. Drag components from Source to Target
5. Click **Publish** to save

## Requirements

- Strapi 5.0.0+
- Node.js 18.x+
- React 18.2.0+ (for flushSync support)

## ⚠️ Troubleshooting

### `flushSync` Error

Update React version in `package.json`:
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  }
}
```

Then:
```bash
rm -rf node_modules package-lock.json
npm install
npm run develop
```

## License

MIT

## Support

[GitHub Issues](https://github.com/metehankasapp/strapi-plugin-copy-any-component/issues)
