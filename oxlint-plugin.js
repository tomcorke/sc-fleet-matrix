// Rules from aion2's ESLint config that Oxlint has no built-in equivalent for.
export default {
  meta: { name: 'local' },
  rules: {
    'css-module-import-name': {
      meta: {
        messages: {
          name: 'Import CSS modules as `import STYLES from "./name.module.scss"`.',
        },
      },
      create(context) {
        return {
          ImportDeclaration(node) {
            if (!node.source.value.endsWith('.module.scss')) {
              return;
            }

            for (const specifier of node.specifiers) {
              const isStyles =
                specifier.type === 'ImportDefaultSpecifier' &&
                specifier.local.name === 'STYLES';

              if (!isStyles) {
                context.report({ node: specifier, messageId: 'name' });
              }
            }
          },
        };
      },
    },
  },
};
