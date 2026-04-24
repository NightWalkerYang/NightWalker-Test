# Control UI Vendor Assets

These files are bundled by the zero-intrusive Control UI build and copied to `generated/control-ui/assets/vendor/`.

## Script Tags

- ECharts: `/assets/vendor/echarts.min.js`
- ECharts-GL: `/assets/vendor/echarts-gl.min.js`
- GSAP: `/assets/vendor/gsap.min.js`
- PixiJS: `/assets/vendor/pixi.min.js`
- Babylon.js: `/assets/vendor/babylon.js`
- tsParticles: `/assets/vendor/tsparticles.bundle.min.js`

## Three.js

- Root module: `/assets/vendor/three.module.min.js`
- Package-style module: `/assets/vendor/three/build/three.module.min.js`
- Addons root: `/assets/vendor/three/examples/jsm/`

The bundled `three/examples/jsm/**` tree is patched for direct browser use inside the public visualization route, so common addon imports no longer depend on a bare `three` package specifier.

Example:

```html
<script type="module">
  import * as THREE from "/assets/vendor/three.module.min.js";
  import { OrbitControls } from "/assets/vendor/three/examples/jsm/controls/OrbitControls.js";
</script>
```
