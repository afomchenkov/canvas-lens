## Added features

- Load large images background on the OffscreenCanvas in order to  be able to handle the calculations in WebWorker
- Load pixelated background image on the second OffscreenCanvas for the lens effect and render over the main one so that the pixelation is not calculated on every mouse move
- Render the HEX color of the selected pixel
- The circle image is not rendered for the optimization purpose
- On mouse move the selected circle is moving over the pixelated canvas, not the real background one
- For optimization, only a portion of the main canvas is re-drawn where the previous lens location were, this optimizes the calculation heavily and does not re-redner the whole canvas

## Bug
- The pixelation function sometimes calculations the color incorrectly, resulting in saving the pixel as red or blue
- The central pixel is not outlined with white, cursor is shown instead (can be updated)
- UI is not updated/ideal, header menu is scrolled with the whole page, menu items not visible
- Tested in Chrome Version 125.0.6422.112 (Official Build) (x86_64)


## How to start
```
npm install
npm run start:watch
```
![lens-screenshot](https://github.com/afomchenkov/canvas-lens/assets/99535774/70991d8f-bae9-4347-a706-b7a0ccf2db63)


# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type aware lint rules:

- Configure the top-level `parserOptions` property like this:

```js
export default {
  // other rules...
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: ['./tsconfig.json', './tsconfig.node.json'],
    tsconfigRootDir: __dirname,
  },
}
```

- Replace `plugin:@typescript-eslint/recommended` to `plugin:@typescript-eslint/recommended-type-checked` or `plugin:@typescript-eslint/strict-type-checked`
- Optionally add `plugin:@typescript-eslint/stylistic-type-checked`
- Install [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react) and add `plugin:react/recommended` & `plugin:react/jsx-runtime` to the `extends` list
