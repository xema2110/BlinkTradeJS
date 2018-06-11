import json from 'rollup-plugin-json';
import flow from 'rollup-plugin-flow';
import babel from 'rollup-plugin-babel';
import uglify from 'rollup-plugin-uglify';
import commonjs from 'rollup-plugin-commonjs';
import resolve from 'rollup-plugin-node-resolve';

const env = process.env.NODE_ENV;
const format = (env === 'development' || env === 'production') ? 'umd' : env;

const config = {
  input: 'src/index.js',
  output: {
    name: 'blinktrade',
    format,
  },
  external: ['ip', 'macaddress'],
  plugins: [
    json({
      include: 'node_modules/**',
      preferConst: true,
    }),
    flow({ all: true }),
    babel({
      babelrc: false,
      // presets: [['env', { modules: false }]],
      plugins: [
        'transform-object-rest-spread',
        'external-helpers'
      ],
    }),
    resolve({
      jsnext: true,
      browser: format === 'umd',
      preferBuiltins: false,
    }),
    commonjs({
      include: 'node_modules/**',
      // exclude: ['ip', 'macaddress'],
    }),
    uglify({
      mangle: env === 'production',
      output: {
        beautify: env !== 'production',
      },
      compress: {
        pure_getters: true,
        unsafe: true,
        unsafe_comps: true,
        warnings: false,
      },
    })
  ],
};


if (env === 'production') {
  config.output.file = 'build/blinktrade.min.js'
}

export default config
