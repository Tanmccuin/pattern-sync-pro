const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );
const path = require( 'path' );

module.exports = {
    ...defaultConfig,
    entry: {
        editor: path.resolve( __dirname, 'src/js/editor/index.js' ),
        debug:  path.resolve( __dirname, 'src/js/editor/debug.js' ),
        admin:  path.resolve( __dirname, 'src/js/admin/uninstall.js' ),
    },
    output: {
        ...defaultConfig.output,
        path: path.resolve( __dirname, 'build' ),
    },
};
