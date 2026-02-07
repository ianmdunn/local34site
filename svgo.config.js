/** @type {import('svgo').Config} */
export default {
  multipass: true,
  plugins: [
    'preset-default',
    {
      name: 'convertStyleToAttrs',
      params: { keepImportant: false },
    },
    {
      name: 'removeAttrs',
      params: {
        attrs: ['data-name', 'id'],
      },
    },
  ],
  js2svg: {
    pretty: false,
    indent: 0,
  },
  path: {
    floatPrecision: 2,
  },
};
