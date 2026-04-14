
  import { defineConfig } from 'vite';
  import react from '@vitejs/plugin-react-swc';
  import path from 'path';
  import { Plugin } from 'vite';

  // Plugin pour fournir un export par défaut pour react-dom (compatibilité React 19)
  const reactDOMCompatPlugin = (): Plugin => {
    return {
      name: 'react-dom-compat',
      enforce: 'pre',
      resolveId(source, importer) {
        // Intercepter les imports de react-dom depuis node_modules (packages tiers)
        if (source === 'react-dom' && importer?.includes('node_modules')) {
          // Retourner un ID virtuel pour notre wrapper
          return '\0react-dom-compat';
        }
        return null;
      },
      load(id) {
        // Charger notre wrapper pour react-dom
        if (id === '\0react-dom-compat') {
          return `
            import * as ReactDOM from 'react-dom';
            // Fournir un export par défaut pour compatibilité avec les anciens imports
            const ReactDOMDefault = ReactDOM;
            export default ReactDOMDefault;
            export * from 'react-dom';
          `;
        }
        return null;
      },
    };
  };

  export default defineConfig({
    plugins: [react(), reactDOMCompatPlugin()],
    base: process.env.NODE_ENV === 'production' ? '/EcoMobile/' : '/',
    resolve: {
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
      alias: {
        'vaul@1.1.2': 'vaul',
        'sonner@2.0.3': 'sonner',
        'recharts@2.15.2': 'recharts',
        'react-resizable-panels@2.1.7': 'react-resizable-panels',
        'react-hook-form@7.55.0': 'react-hook-form',
        'react-day-picker@8.10.1': 'react-day-picker',
        'next-themes@0.4.6': 'next-themes',
        'lucide-react@0.487.0': 'lucide-react',
        'input-otp@1.4.2': 'input-otp',
        'embla-carousel-react@8.6.0': 'embla-carousel-react',
        'cmdk@1.1.1': 'cmdk',
        'class-variance-authority@0.7.1': 'class-variance-authority',
        '@radix-ui/react-tooltip@1.1.8': '@radix-ui/react-tooltip',
        '@radix-ui/react-toggle@1.1.2': '@radix-ui/react-toggle',
        '@radix-ui/react-toggle-group@1.1.2': '@radix-ui/react-toggle-group',
        '@radix-ui/react-tabs@1.1.3': '@radix-ui/react-tabs',
        '@radix-ui/react-switch@1.1.3': '@radix-ui/react-switch',
        '@radix-ui/react-slot@1.1.2': '@radix-ui/react-slot',
        '@radix-ui/react-slider@1.2.3': '@radix-ui/react-slider',
        '@radix-ui/react-separator@1.1.2': '@radix-ui/react-separator',
        '@radix-ui/react-select@2.1.6': '@radix-ui/react-select',
        '@radix-ui/react-scroll-area@1.2.3': '@radix-ui/react-scroll-area',
        '@radix-ui/react-radio-group@1.2.3': '@radix-ui/react-radio-group',
        '@radix-ui/react-progress@1.1.2': '@radix-ui/react-progress',
        '@radix-ui/react-popover@1.1.6': '@radix-ui/react-popover',
        '@radix-ui/react-navigation-menu@1.2.5': '@radix-ui/react-navigation-menu',
        '@radix-ui/react-menubar@1.1.6': '@radix-ui/react-menubar',
        '@radix-ui/react-label@2.1.2': '@radix-ui/react-label',
        '@radix-ui/react-hover-card@1.1.6': '@radix-ui/react-hover-card',
        '@radix-ui/react-dropdown-menu@2.1.6': '@radix-ui/react-dropdown-menu',
        '@radix-ui/react-dialog@1.1.6': '@radix-ui/react-dialog',
        '@radix-ui/react-context-menu@2.2.6': '@radix-ui/react-context-menu',
        '@radix-ui/react-collapsible@1.1.3': '@radix-ui/react-collapsible',
        '@radix-ui/react-checkbox@1.1.4': '@radix-ui/react-checkbox',
        '@radix-ui/react-avatar@1.1.3': '@radix-ui/react-avatar',
        '@radix-ui/react-aspect-ratio@1.1.2': '@radix-ui/react-aspect-ratio',
        '@radix-ui/react-alert-dialog@1.1.6': '@radix-ui/react-alert-dialog',
        '@radix-ui/react-accordion@1.2.3': '@radix-ui/react-accordion',
        '@': path.resolve(__dirname, './src'),
      },
      dedupe: ['react', 'react-dom'],
    },
    build: {
      target: 'esnext',
      outDir: 'build',
      commonjsOptions: {
        transformMixedEsModules: true,
      },
    },
    server: {
      port: 3000,
      open: true,
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        '@radix-ui/react-dialog',
        '@radix-ui/react-popover',
        '@radix-ui/react-dropdown-menu',
        '@radix-ui/react-select',
      ],
      esbuildOptions: {
        target: 'esnext',
        jsx: 'automatic',
      },
    },
    ssr: {
      noExternal: ['@radix-ui/react-dialog', '@radix-ui/react-popover', '@radix-ui/react-dropdown-menu'],
    },
  });