define('io.ox/dynamic-theme/signin', [
    'io.ox/core/extensions',
    'io.ox/dynamic-theme/less',
    'text!io.ox/dynamic-theme/apps/themes/login/login.less.dyn'
], function (ext, less, theme) {
    'use strict';

    var vars = ox.serverConfig.dynamicTheme;

    if (vars.headerLogo) {
        $('#io-ox-login-header h1').empty().append($('<img>').attr({
            src: vars.headerLogo,
            alt: ox.serverConfig.productName
        }));
    }

    less.setVars(vars);
    less.enable('themes/login/login', theme);
});
